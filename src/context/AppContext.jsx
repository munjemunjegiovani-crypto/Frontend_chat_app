import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL, getToken, setToken, setUnauthorizedHandler, fileUrl } from '../lib/api.js';
import { loadPrefs, savePrefs, applyPrefs } from '../lib/prefs.js';
import { chime, unlockAudio } from '../lib/sound.js';
import { messagePreview } from '../lib/format.js';
import { registerServiceWorker, enablePush, disablePush, showLocalNotification } from '../lib/push.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function useSocketEvent(event, handler) {
  const { socket } = useApp();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}

export function AppProvider({ children }) {
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [convLoaded, setConvLoaded] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState({});
  const [notifCount, setNotifCount] = useState(0);
  const [channelUnread, setChannelUnread] = useState(0);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const [toasts, setToasts] = useState([]);
  const activeConv = useRef(null);
  const typingTimers = useRef({});
  const meRef = useRef(null);
  const convRef = useRef([]);
  convRef.current = conversations;
  meRef.current = me;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // ---------- prefs / theme ----------
  const setPrefs = useCallback((patch) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      applyPrefs(next);
      return next;
    });
  }, []);
  useEffect(() => {
    applyPrefs(prefs);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyPrefs(prefsRef.current);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- toasts ----------
  const toast = useCallback((text, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // ---------- auth ----------
  const logout = useCallback(async () => {
    await disablePush();
    setToken(null);
    setMe(null);
    setConversations([]);
    setConvLoaded(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api('/users/me')
      .then(setMe)
      .catch(() => {})
      .finally(() => setBooting(false));
  }, [logout]);

  // Service worker for background push notifications
  useEffect(() => {
    if (!me?.id) return;
    registerServiceWorker().then(() => {
      if (prefsRef.current.notifications && 'Notification' in window && Notification.permission === 'granted') enablePush();
    });
  }, [me?.id]);

  const signIn = useCallback((token, user) => {
    setToken(token);
    setMe(user);
    unlockAudio();
  }, []);

  // ---------- conversations ----------
  const refreshConversations = useCallback(async () => {
    try {
      const list = await api('/conversations');
      setConversations(list);
      setConvLoaded(true);
    } catch { /* offline */ }
  }, []);

  const upsertConversation = useCallback((conv) => {
    setConversations((list) => {
      const i = list.findIndex((c) => c.id === conv.id);
      if (i === -1) return [conv, ...list];
      const next = [...list];
      next[i] = { ...next[i], ...conv };
      return next;
    });
  }, []);

  const patchConversation = useCallback((id, fn) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)));
  }, []);

  const markRead = useCallback((id) => {
    patchConversation(id, () => ({ unread: 0 }));
    api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
  }, [patchConversation]);

  const refreshNotifCount = useCallback(() => {
    api('/notifications/count').then((r) => setNotifCount(r.count)).catch(() => {});
  }, []);

  const refreshChannelUnread = useCallback(() => {
    api('/channels')
      .then((r) => setChannelUnread(r.following.reduce((s, c) => s + (c.unread || 0), 0)))
      .catch(() => {});
  }, []);

  // ---------- socket ----------
  useEffect(() => {
    if (!me?.id) return undefined;
    const s = io(API_URL, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 8000,
    });
    setSocket(s);
    s.on('connect', () => {
      setConnected(true);
      refreshConversations();
      refreshNotifCount();
      refreshChannelUnread();
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      setConnected(false);
      if (err?.message === 'unauthorized') logout();
    });
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [me?.id, refreshConversations, refreshNotifCount, refreshChannelUnread, logout]);

  const notify = useCallback((title, body, { icon, url, tag } = {}) => {
    const p = prefsRef.current;
    if (p.sounds) chime();
    if (p.notifications && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      showLocalNotification(title, { body, icon: icon || '/icon-192.png', badge: '/icon-192.png', tag, data: { url: url || '/' } });
    }
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = async (msg) => {
      const mine = msg.sender?.id === meRef.current?.id;
      const isActive = activeConv.current === msg.conversationId && !document.hidden;
      const existing = convRef.current.find((x) => x.id === msg.conversationId);
      const known = !!existing;
      let muted = existing?.muted;
      let convName = existing?.name || '';
      let isGroup = existing?.type === 'group';
      if (known) {
        setConversations((list) =>
          list.map((x) =>
            x.id === msg.conversationId
              ? {
                  ...x,
                  lastMessage: msg,
                  lastMessageAt: msg.createdAt,
                  archived: x.archived && x.muted,
                  unread: mine || isActive || msg.type === 'system' ? x.unread : (x.unread || 0) + 1,
                }
              : x
          )
        );
      }
      if (!known) {
        try {
          const conv = await api(`/conversations/${msg.conversationId}`);
          upsertConversation(conv);
          muted = conv.muted;
          convName = conv.name;
          isGroup = conv.type === 'group';
        } catch { /* ignore */ }
      }
      // stop showing "typing…" for this sender
      setTyping((t) => {
        const conv = { ...(t[msg.conversationId] || {}) };
        delete conv[msg.sender?.id];
        return { ...t, [msg.conversationId]: conv };
      });
      if (!mine && msg.type !== 'system' && !muted && !isActive) {
        const who = msg.sender?.name || 'Someone';
        notify(isGroup ? convName : who, `${isGroup ? `${who}: ` : ''}${messagePreview(msg)}`, {
          icon: fileUrl(msg.sender?.avatarId) || undefined,
          tag: `conv-${msg.conversationId}`,
          url: `/chat/${msg.conversationId}`,
        });
      }
    };
    const onUpdated = (msg) => {
      setConversations((list) =>
        list.map((c) => (c.id === msg.conversationId && c.lastMessage?.id === msg.id ? { ...c, lastMessage: msg } : c))
      );
    };
    const onHidden = ({ conversationId }) => {
      api(`/conversations/${conversationId}`).then(upsertConversation).catch(() => {});
    };
    const onConvUpdated = (conv) => upsertConversation(conv);
    const onConvRemoved = ({ conversationId }) => setConversations((l) => l.filter((c) => c.id !== conversationId));
    const onReceipts = ({ conversationId, userId, lastReadAt, lastDeliveredAt }) => {
      setConversations((list) =>
        list.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                members: c.members.map((m) =>
                  m.id !== userId
                    ? m
                    : {
                        ...m,
                        lastReadAt: lastReadAt !== undefined ? lastReadAt : m.lastReadAt,
                        lastDeliveredAt: lastDeliveredAt || m.lastDeliveredAt,
                      }
                ),
              }
        )
      );
    };
    const updateUserEverywhere = (userId, patch) => {
      setConversations((list) =>
        list.map((c) => {
          if (!c.members.some((m) => m.id === userId)) return c;
          const members = c.members.map((m) => (m.id === userId ? { ...m, ...patch } : m));
          const other = c.other?.id === userId ? { ...c.other, ...patch } : c.other;
          return {
            ...c,
            members,
            other,
            ...(c.type === 'direct' && other ? { name: other.name, avatarId: other.avatarId } : {}),
          };
        })
      );
    };
    const onPresence = ({ userId, online, lastSeenAt }) => updateUserEverywhere(userId, { online, lastSeenAt });
    const onUserUpdated = (u) =>
      updateUserEverywhere(u.id, { name: u.name, username: u.username, bio: u.bio, avatarId: u.avatarId });
    const onTyping = ({ conversationId, userId, typing: isTyping, recording }) => {
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.current[key]);
      setTyping((t) => {
        const conv = { ...(t[conversationId] || {}) };
        if (isTyping) conv[userId] = { recording };
        else delete conv[userId];
        return { ...t, [conversationId]: conv };
      });
      if (isTyping) {
        typingTimers.current[key] = setTimeout(() => onTyping({ conversationId, userId, typing: false }), 7000);
      }
    };
    const onNotification = (n) => {
      setNotifCount((c) => c + 1);
      notify('Kova', n.text, { tag: `n-${n.id}`, url: n.postId ? `/posts/${n.postId}` : '/activity' });
      toast(n.text, { icon: n.type === 'comment' || n.type === 'reply' ? 'chat_bubble' : 'notifications', to: n.postId ? `/posts/${n.postId}` : n.channelId ? `/channels/${n.channelId}` : '/activity' });
    };
    const onChannelPost = ({ post, channelName }) => {
      if (post.author?.id !== meRef.current?.id) {
        setChannelUnread((c) => c + 1);
        toast(`New post in ${channelName}`, { icon: 'hub', to: `/channels/${post.channelId}` });
      }
    };
    const onBlocks = () => refreshConversations();

    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:hidden', onHidden);
    socket.on('conversation:updated', onConvUpdated);
    socket.on('conversation:removed', onConvRemoved);
    socket.on('receipts', onReceipts);
    socket.on('presence', onPresence);
    socket.on('user:updated', onUserUpdated);
    socket.on('typing', onTyping);
    socket.on('notification', onNotification);
    socket.on('channel:post', onChannelPost);
    socket.on('blocks:changed', onBlocks);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:hidden', onHidden);
      socket.off('conversation:updated', onConvUpdated);
      socket.off('conversation:removed', onConvRemoved);
      socket.off('receipts', onReceipts);
      socket.off('presence', onPresence);
      socket.off('user:updated', onUserUpdated);
      socket.off('typing', onTyping);
      socket.off('notification', onNotification);
      socket.off('channel:post', onChannelPost);
      socket.off('blocks:changed', onBlocks);
    };
  }, [socket, upsertConversation, refreshConversations, notify, toast]);

  // Unread count in the browser tab title
  const totalUnread = useMemo(
    () => conversations.filter((c) => !c.muted && !c.archived).reduce((s, c) => s + (c.unread || 0), 0),
    [conversations]
  );
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Kova` : 'Kova — Speak freely, stay close';
  }, [totalUnread]);

  const value = {
    me, setMe, booting, signIn, logout,
    conversations, convLoaded, refreshConversations, upsertConversation, patchConversation, setConversations, markRead,
    socket, connected, typing, activeConv,
    notifCount, setNotifCount, refreshNotifCount,
    channelUnread, setChannelUnread, refreshChannelUnread,
    prefs, setPrefs,
    toast, toasts, dismissToast,
    totalUnread,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
