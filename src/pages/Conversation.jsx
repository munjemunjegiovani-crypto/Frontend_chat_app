import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import { api, uploadFile } from '../lib/api.js';
import { dayLabel, isSameDay, lastSeen } from '../lib/format.js';
import { messageStatus, QUICK_REACTIONS, EMOJIS } from '../lib/chat.js';
import { sentTick } from '../lib/sound.js';
import { Avatar, Confirm, Icon, Menu, Modal, Spinner, EmptyState } from '../components/ui.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import Composer from '../components/Composer.jsx';
import Lightbox from '../components/Lightbox.jsx';

export default function ConversationRoute() {
  const { id } = useParams();
  return <Conversation key={id} id={Number(id)} />;
}

let tmpCounter = 0;

function ForwardModal({ message, onClose }) {
  const { conversations, toast } = useApp();
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const list = conversations.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const go = async () => {
    setBusy(true);
    try {
      const r = await api(`/messages/${message.id}/forward`, { method: 'POST', body: { conversationIds: picked } });
      toast(`Forwarded to ${r.sent} chat${r.sent === 1 ? '' : 's'}`, { icon: 'forward' });
      onClose();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!message}
      onClose={onClose}
      title="Forward to…"
      footer={
        <button className="btn-primary w-full" disabled={!picked.length || busy} onClick={go}>
          {busy ? <Spinner size={16} /> : <><Icon name="forward" size={20} /> Forward{picked.length ? ` (${picked.length})` : ''}</>}
        </button>
      }
    >
      <input className="field mb-3" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-2">
        {list.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id].slice(0, 10)))}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-soft"
            >
              <Avatar id={c.avatarId} name={c.name} size={40} group={c.type === 'group'} />
              <span className="flex-1 text-left font-medium text-ink truncate">{c.name}</span>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? 'bg-gold-ink border-gold-ink text-white dark:bg-gold dark:border-gold dark:text-[#0E1420]' : 'hairline-strong'}`}>
                {on && <Icon name="check" size={16} />}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function Conversation({ id }) {
  const app = useApp();
  const { me, conversations, upsertConversation, patchConversation, markRead, socket, typing, activeConv, toast, prefs } = app;
  const { startCall } = useCall();
  const navigate = useNavigate();
  const conv = conversations.find((c) => c.id === id);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionsFor, setActionsFor] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAllEmoji, setShowAllEmoji] = useState(false);
  const scroller = useRef(null);
  const atBottomRef = useRef(true);
  const preserveScroll = useRef(null);
  atBottomRef.current = atBottom;

  // Load the conversation if it isn't in the list yet (e.g. opened from a link)
  useEffect(() => {
    if (!conv) {
      api(`/conversations/${id}`).then(upsertConversation).catch((e) => setError(e.message));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeConv.current = id;
    return () => { if (activeConv.current === id) activeConv.current = null; };
  }, [id, activeConv]);

  // Initial messages
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api(`/conversations/${id}/messages`)
      .then((r) => {
        if (!alive) return;
        setMessages(r.messages);
        setHasMore(r.hasMore);
        markRead(id);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync after reconnecting (messages may have been missed while offline)
  useSocketEvent('connect', () => {
    api(`/conversations/${id}/messages`).then((r) => {
      setMessages((prev) => {
        const pendings = prev.filter((m) => m.pending || m.failed);
        return [...r.messages, ...pendings];
      });
    }).catch(() => {});
  });

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setNewBelow(0);
  }, []);

  useLayoutEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, scrollToBottom]);

  // Keep the view pinned to the bottom when new messages arrive, or keep position when older ones load
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (preserveScroll.current != null) {
      el.scrollTop = el.scrollHeight - preserveScroll.current;
      preserveScroll.current = null;
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && newBelow) setNewBelow(0);
    if (el.scrollTop < 120 && hasMore && !loadingMore) loadOlder();
  };

  const loadOlder = async () => {
    const first = messages.find((m) => typeof m.id === 'number');
    if (!first) return;
    setLoadingMore(true);
    try {
      const r = await api(`/conversations/${id}/messages?before=${first.id}`);
      preserveScroll.current = scroller.current.scrollHeight - scroller.current.scrollTop;
      setMessages((prev) => [...r.messages, ...prev]);
      setHasMore(r.hasMore);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  };

  // ---------- realtime ----------
  useSocketEvent('message:new', (msg) => {
    if (msg.conversationId !== id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    if (msg.sender?.id !== me.id) {
      if (!document.hidden) markRead(id);
      if (!atBottomRef.current) setNewBelow((n) => n + 1);
    }
  });
  useSocketEvent('message:updated', (msg) => {
    if (msg.conversationId !== id) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...msg, starred: m.starred } : m)));
  });
  useSocketEvent('message:hidden', ({ id: mid, conversationId }) => {
    if (conversationId !== id) return;
    setMessages((prev) => prev.filter((m) => m.id !== mid));
  });
  useSocketEvent('conversation:removed', ({ conversationId }) => {
    if (conversationId === id) {
      toast('You are no longer in this group.', { icon: 'group_off' });
      navigate('/');
    }
  });

  useEffect(() => {
    const onVis = () => { if (!document.hidden) markRead(id); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [id, markRead]);

  // ---------- sending ----------
  const replaceTemp = (tempId, real) => {
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === real.id)) return withoutTemp;
      const i = prev.findIndex((m) => m.id === tempId);
      const next = [...prev];
      next[i] = real;
      return next;
    });
  };

  const postMessage = async (tempId, payload) => {
    try {
      const real = await api(`/conversations/${id}/messages`, { method: 'POST', body: payload });
      replaceTemp(tempId, real);
      if (prefs.sounds) sentTick();
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, payload } : m)));
      toast(e.message, { error: true });
    }
  };

  const optimistic = (fields) => ({
    id: `tmp-${++tmpCounter}`,
    conversationId: id,
    sender: { id: me.id, name: me.name, avatarId: me.avatarId },
    type: 'text',
    body: '',
    reactions: [],
    createdAt: new Date().toISOString(),
    pending: true,
    replyTo: replyTo ? { id: replyTo.id, senderId: replyTo.sender?.id, senderName: replyTo.sender?.name, type: replyTo.type, body: replyTo.body } : null,
    ...fields,
  });

  const sendText = (body) => {
    const temp = optimistic({ body });
    setMessages((p) => [...p, temp]);
    atBottomRef.current = true;
    setAtBottom(true);
    postMessage(temp.id, { type: 'text', body, replyToId: replyTo?.id });
    setReplyTo(null);
  };

  const sendFiles = async (items, caption) => {
    const replyId = replyTo?.id;
    setReplyTo(null);
    for (let i = 0; i < items.length; i++) {
      const { file, kind } = items[i];
      const body = i === items.length - 1 && kind !== 'file' ? caption : '';
      const temp = optimistic({
        type: kind,
        body,
        file: { id: null, name: file.name, mime: file.type, size: file.size },
        localUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
      });
      setMessages((p) => [...p, temp]);
      atBottomRef.current = true;
      try {
        const up = await uploadFile(file);
        await postMessage(temp.id, { type: kind, body, fileId: up.id, replyToId: replyId });
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
        toast(e.message, { error: true });
      }
    }
    if (caption && items.every((x) => x.kind === 'file')) sendText(caption);
  };

  const sendVoice = async (blob, type) => {
    const ext = type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type });
    const temp = optimistic({ type: 'audio', file: { id: null, name: file.name, mime: type, size: file.size } });
    const replyId = replyTo?.id;
    setReplyTo(null);
    setMessages((p) => [...p, temp]);
    atBottomRef.current = true;
    try {
      const up = await uploadFile(file);
      await postMessage(temp.id, { type: 'audio', fileId: up.id, replyToId: replyId });
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      toast(e.message, { error: true });
    }
  };

  const retry = (m) => {
    if (!m.payload) return toast('Please send it again.', { error: true });
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)));
    postMessage(m.id, m.payload);
  };

  const saveEdit = async (m, body) => {
    setEditing(null);
    if (body === m.body) return;
    try {
      const updated = await api(`/messages/${m.id}`, { method: 'PATCH', body: { body } });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...updated, starred: x.starred } : x)));
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const react = async (m, emoji) => {
    setActionsFor(null);
    setShowAllEmoji(false);
    if (typeof m.id !== 'number') return;
    try {
      const updated = await api(`/messages/${m.id}/react`, { method: 'POST', body: { emoji } });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...updated, starred: x.starred } : x)));
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const star = async (m) => {
    setActionsFor(null);
    const r = await api(`/messages/${m.id}/star`, { method: 'POST' }).catch((e) => toast(e.message, { error: true }));
    if (r) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: r.starred } : x)));
      toast(r.starred ? 'Message starred' : 'Removed from starred', { icon: 'star' });
    }
  };

  const remove = async (m, scope) => {
    setDeleting(null);
    if (typeof m.id !== 'number') {
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      return;
    }
    try {
      await api(`/messages/${m.id}?scope=${scope}`, { method: 'DELETE' });
      if (scope === 'me') setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const jumpTo = (mid) => {
    const el = document.getElementById(`msg-${mid}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(mid);
      setTimeout(() => setHighlight(null), 1600);
    } else {
      toast('That message is further up — scroll to load older messages.', { icon: 'history' });
    }
  };

  const emitTyping = useCallback((isTyping, recording = false) => {
    socket?.emit('typing', { conversationId: id, typing: isTyping, recording });
  }, [socket, id]);

  const settings = async (patch) => {
    try {
      const c = await api(`/conversations/${id}/settings`, { method: 'PATCH', body: patch });
      upsertConversation(c);
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  // ---------- derived ----------
  const isGroup = conv?.type === 'group';
  const typers = Object.entries(typing[id] || {});
  const visibleMessages = useMemo(() => {
    if (!term.trim()) return messages;
    const t = term.toLowerCase();
    return messages.filter((m) => (m.body || '').toLowerCase().includes(t) && m.type !== 'system');
  }, [messages, term]);

  let subtitle = '';
  if (conv) {
    if (typers.length) {
      const names = typers.map(([uid]) => conv.members.find((m) => m.id === Number(uid))?.name.split(' ')[0]).filter(Boolean);
      const rec = typers.some(([, v]) => v.recording);
      subtitle = isGroup ? `${names.join(', ')} ${rec ? 'recording…' : 'typing…'}` : rec ? 'recording audio…' : 'typing…';
    } else if (isGroup) {
      subtitle = conv.members.map((m) => (m.id === me.id ? 'You' : m.name.split(' ')[0])).join(', ');
    } else if (conv.blockedMe) {
      subtitle = '';
    } else {
      subtitle = lastSeen(conv.other);
    }
  }

  let disabledNotice = null;
  if (conv?.blockedByMe) {
    disabledNotice = (
      <span>You blocked this contact. <button className="text-gold-ink font-medium underline" onClick={() => api(`/users/${conv.other.id}/block`, { method: 'DELETE' }).then(() => toast('Contact unblocked'))}>Unblock</button> to send a message.</span>
    );
  } else if (conv?.blockedMe) {
    disabledNotice = 'You can no longer send messages to this person.';
  } else if (conv?.type === 'direct' && !conv.other) {
    disabledNotice = 'This account has been deleted.';
  } else if (isGroup && conv.onlyAdminsSend && conv.role !== 'admin') {
    disabledNotice = 'Only admins can send messages in this group.';
  }

  const openInfo = () => {
    if (!conv) return;
    if (isGroup) navigate(`/chat/${id}/info`);
    else if (conv.other) navigate(`/user/${conv.other.id}`);
  };

  if (error && !conv) {
    return <EmptyState icon="error" title="Conversation unavailable" text={error} action={<button className="btn-outline" onClick={() => navigate('/')}>Back to chats</button>} />;
  }

  const paper = `paper-${prefs.paper || 'vellum'}`;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col relative"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files') && !disabledNotice) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = [...e.dataTransfer.files].slice(0, 10);
        if (files.length) sendFiles(files.map((f) => ({ file: f, kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file' })), '');
      }}
    >
      {/* Header */}
      <header className="shrink-0 z-20 pt-safe bg-canvas/90 backdrop-blur-xl border-b hairline">
        {searchOpen ? (
          <div className="h-16 px-3 flex items-center gap-2">
            <button className="btn-ghost" onClick={() => { setSearchOpen(false); setTerm(''); }} aria-label="Close search">
              <Icon name="arrow_back" />
            </button>
            <input autoFocus className="field !h-10" placeholder="Search in this chat" value={term} onChange={(e) => setTerm(e.target.value)} />
            <span className="text-xs text-muted shrink-0 w-16 text-right">{term ? `${visibleMessages.length} found` : ''}</span>
          </div>
        ) : (
          <div className="h-16 px-2 md:px-4 flex items-center gap-2">
            <button className="btn-ghost md:hidden" onClick={() => navigate('/')} aria-label="Back">
              <Icon name="arrow_back_ios_new" size={20} />
            </button>
            <button className="flex items-center gap-3 min-w-0 flex-1 text-left" onClick={openInfo}>
              <Avatar id={conv?.avatarId} name={conv?.name || ''} size={42} online={!isGroup && conv?.other?.online} group={isGroup} />
              <div className="min-w-0">
                <div className="font-serif text-[20px] leading-6 text-ink truncate">{conv?.name || '…'}</div>
                <div className={`text-[12.5px] truncate ${typers.length ? 'text-gold-ink italic' : 'text-muted'}`}>
                  {!isGroup && conv?.other?.online && !typers.length && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold mr-1.5 align-middle" />}
                  {subtitle}
                </div>
              </div>
            </button>
            {conv && !isGroup && conv.other && !conv.blockedByMe && !conv.blockedMe && (
              <>
                <button className="btn-ghost !text-gold-ink" onClick={() => startCall(conv.other, 'voice')} aria-label="Voice call" title="Voice call">
                  <Icon name="call" />
                </button>
                <button className="btn-ghost !text-gold-ink" onClick={() => startCall(conv.other, 'video')} aria-label="Video call" title="Video call">
                  <Icon name="videocam" />
                </button>
              </>
            )}
            {conv && (
              <Menu
                trigger={<button className="btn-ghost" aria-label="Chat options"><Icon name="more_vert" /></button>}
                items={[
                  { icon: isGroup ? 'groups' : 'person', label: isGroup ? 'Group info' : 'View contact', onClick: openInfo },
                  { icon: 'search', label: 'Search', onClick: () => setSearchOpen(true) },
                  { icon: 'perm_media', label: 'Media, links & docs', onClick: openInfo },
                  '-',
                  { icon: conv.muted ? 'notifications' : 'notifications_off', label: conv.muted ? 'Unmute' : 'Mute notifications', onClick: () => settings({ muted: !conv.muted }) },
                  { icon: 'push_pin', label: conv.pinned ? 'Unpin chat' : 'Pin chat', onClick: () => settings({ pinned: !conv.pinned }) },
                  { icon: 'favorite', label: conv.favourite ? 'Remove from favourites' : 'Add to favourites', onClick: () => settings({ favourite: !conv.favourite }) },
                  { icon: 'inventory_2', label: conv.archived ? 'Unarchive chat' : 'Archive chat', onClick: () => { settings({ archived: !conv.archived }); if (!conv.archived) navigate('/'); } },
                  '-',
                  { icon: 'cleaning_services', label: 'Clear chat', danger: true, onClick: () => setConfirm('clear') },
                  !isGroup && conv.other && { icon: 'block', label: conv.blockedByMe ? 'Unblock' : 'Block', danger: true, onClick: () => setConfirm('block') },
                  isGroup && { icon: 'logout', label: 'Exit group', danger: true, onClick: () => setConfirm('leave') },
                ]}
              />
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className={`flex-1 min-h-0 overflow-y-auto scroll-thin ${paper} pb-3`}>
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <>
            {loadingMore && <div className="flex justify-center py-3"><Spinner size={18} /></div>}
            {!hasMore && (
              <div className="flex justify-center pt-5 pb-2 px-6">
                <span className="flex items-center gap-2 text-label-sm uppercase tracking-[0.1em] text-muted bg-soft/90 rounded-full px-4 py-2 text-center">
                  <Icon name="lock" size={14} />
                  {isGroup ? `${conv?.name} · ${conv?.memberCount} members` : 'This is the start of your conversation'}
                </span>
              </div>
            )}
            {!visibleMessages.length && !term && (
              <div className="text-center px-8 py-16">
                <p className="font-serif italic text-xl text-gold-ink">Begin the correspondence.</p>
                <p className="text-sm text-muted mt-2">Say hello to {conv?.name?.split(' ')[0] || 'them'} — they will see it instantly.</p>
              </div>
            )}
            {term && !visibleMessages.length && <p className="text-center text-sm text-muted py-10">No messages match “{term}”.</p>}
            {visibleMessages.map((m, i) => {
              const prev = visibleMessages[i - 1];
              const next = visibleMessages[i + 1];
              const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const sameAsPrev = prev && !newDay && prev.type !== 'system' && prev.sender?.id === m.sender?.id && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
              const sameAsNext = next && isSameDay(next.createdAt, m.createdAt) && next.type !== 'system' && next.sender?.id === m.sender?.id && new Date(next.createdAt) - new Date(m.createdAt) < 5 * 60000;
              const mine = m.sender?.id === me.id;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="flex items-center gap-4 px-6 my-5">
                      <div className="flex-1 gold-rule" />
                      <span className="font-serif italic text-[15px] text-gold-ink">{dayLabel(m.createdAt)}</span>
                      <div className="flex-1 gold-rule" />
                    </div>
                  )}
                  <MessageBubble
                    m={m}
                    mine={mine}
                    meId={me.id}
                    isGroup={isGroup}
                    showSender={isGroup && !sameAsPrev}
                    firstInGroup={!sameAsPrev}
                    lastInGroup={!sameAsNext}
                    status={mine ? messageStatus(m, conv, me.id) : null}
                    term={term}
                    highlighted={highlight === m.id}
                    onOpenActions={(msg) => (msg.failed ? retry(msg) : setActionsFor(msg))}
                    onReply={disabledNotice ? undefined : (msg) => setReplyTo(msg)}
                    onReact={react}
                    onOpenMedia={(msg) => setLightbox(msg)}
                    onJumpTo={jumpTo}
                    onOpenProfile={(uid) => uid && uid !== me.id && navigate(`/user/${uid}`)}
                  />
                </div>
              );
            })}
            {typers.length > 0 && !term && (
              <div className="px-3 md:px-6 mt-3 flex">
                <div className="flex items-center gap-2 rounded-full bg-card border hairline px-4 py-2 shadow-lvl1">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-gold-ink animate-blink" style={{ animationDelay: `${d * 0.2}s` }} />)}
                  </span>
                  <span className="text-[13px] italic text-muted">{subtitle}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!atBottom && !loading && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute right-4 bottom-24 z-10 w-11 h-11 rounded-full bg-card border hairline-strong shadow-lvl2 flex items-center justify-center text-gold-ink"
          aria-label="Scroll to latest"
        >
          <Icon name="keyboard_double_arrow_down" />
          {newBelow > 0 && <span className="absolute -top-2 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-gold text-white dark:text-[#0E1420] text-[11px] flex items-center justify-center">{newBelow}</span>}
        </button>
      )}

      {dragOver && (
        <div className="absolute inset-0 z-30 bg-canvas/85 backdrop-blur-sm border-2 border-dashed border-gold m-3 rounded-3xl flex flex-col items-center justify-center pointer-events-none">
          <Icon name="upload_file" size={48} className="text-gold-ink" />
          <p className="font-serif text-xl mt-3 text-ink">Drop to send</p>
        </div>
      )}

      <Composer
        meId={me.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSendText={sendText}
        onSendFiles={sendFiles}
        onSendVoice={sendVoice}
        onSaveEdit={saveEdit}
        onTyping={emitTyping}
        disabledNotice={disabledNotice}
        toast={toast}
      />

      {/* Message action sheet */}
      <Modal open={!!actionsFor} onClose={() => { setActionsFor(null); setShowAllEmoji(false); }}>
        {actionsFor && (
          <div className="pt-5">
            <div className="flex justify-between gap-1 mb-3 px-1">
              {QUICK_REACTIONS.map((em) => {
                const mineR = actionsFor.reactions?.some((r) => r.userId === me.id && r.emoji === em);
                return (
                  <button key={em} onClick={() => react(actionsFor, em)} className={`w-11 h-11 rounded-full text-2xl hover:bg-soft transition ${mineR ? 'bg-gold-soft' : ''}`}>
                    {em}
                  </button>
                );
              })}
              <button onClick={() => setShowAllEmoji((s) => !s)} className="w-11 h-11 rounded-full bg-soft text-muted flex items-center justify-center" aria-label="More reactions">
                <Icon name="add" />
              </button>
            </div>
            {showAllEmoji && (
              <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto mb-3 scroll-thin">
                {EMOJIS.map((em) => <button key={em} className="h-9 rounded-lg hover:bg-soft text-xl" onClick={() => react(actionsFor, em)}>{em}</button>)}
              </div>
            )}
            <div className="rounded-xl bg-soft/60 px-4 py-3 mb-3 text-sm text-muted line-clamp-3">
              {actionsFor.deletedAt ? 'This message was deleted' : actionsFor.body || (actionsFor.type === 'audio' ? '🎙 Voice note' : actionsFor.type === 'image' ? '📷 Photo' : actionsFor.type === 'video' ? '🎬 Video' : `📄 ${actionsFor.file?.name || ''}`)}
            </div>
            <div className="-mx-5 divide-y divide-[rgb(var(--line)/0.15)]">
              {[
                !actionsFor.deletedAt && !disabledNotice && { icon: 'reply', label: 'Reply', fn: () => setReplyTo(actionsFor) },
                actionsFor.body && !actionsFor.deletedAt && { icon: 'content_copy', label: 'Copy text', fn: () => { navigator.clipboard?.writeText(actionsFor.body); toast('Copied'); } },
                !actionsFor.deletedAt && { icon: 'forward', label: 'Forward', fn: () => setForwarding(actionsFor) },
                !actionsFor.deletedAt && { icon: 'star', label: actionsFor.starred ? 'Unstar' : 'Star', fn: () => star(actionsFor) },
                actionsFor.sender?.id === me.id && !actionsFor.deletedAt && ['text', 'image', 'video'].includes(actionsFor.type) && { icon: 'edit', label: 'Edit', fn: () => setEditing(actionsFor) },
                { icon: 'delete', label: 'Delete', danger: true, fn: () => setDeleting(actionsFor) },
              ].filter(Boolean).map((a) => (
                <button
                  key={a.label}
                  className={`w-full flex items-center gap-4 px-6 py-3.5 text-[15px] hover:bg-soft ${a.danger ? 'text-danger' : 'text-ink'}`}
                  onClick={() => { const m = actionsFor; setActionsFor(null); if (a.label !== 'Star' && a.label !== 'Unstar') a.fn(m); else star(m); }}
                  disabled={typeof actionsFor.id !== 'number' && a.label !== 'Delete'}
                >
                  <Icon name={a.icon} size={21} className={a.danger ? '' : 'text-gold-ink'} /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete message?">
        {deleting && (
          <div className="flex flex-col gap-2">
            {!deleting.deletedAt && (deleting.sender?.id === me.id || (isGroup && conv?.role === 'admin')) && typeof deleting.id === 'number' && (
              <button className="btn-outline !justify-start !text-danger" onClick={() => remove(deleting, 'everyone')}>
                <Icon name="delete_forever" size={20} /> Delete for everyone
              </button>
            )}
            <button className="btn-outline !justify-start" onClick={() => remove(deleting, 'me')}>
              <Icon name="delete" size={20} /> Delete for me
            </button>
            <button className="btn-outline !justify-start" onClick={() => setDeleting(null)}>Cancel</button>
          </div>
        )}
      </Modal>

      {forwarding && <ForwardModal message={forwarding} onClose={() => setForwarding(null)} />}
      {lightbox && <Lightbox file={lightbox.file} caption={lightbox.body} onClose={() => setLightbox(null)} />}

      <Confirm
        open={confirm === 'clear'}
        onClose={() => setConfirm(null)}
        title="Clear this chat?"
        text="Messages will be removed from your device view only. Others keep their copy."
        confirmLabel="Clear chat"
        danger
        onConfirm={async () => {
          const c = await api(`/conversations/${id}/clear`, { method: 'POST' });
          upsertConversation(c);
          setMessages([]);
        }}
      />
      <Confirm
        open={confirm === 'block'}
        onClose={() => setConfirm(null)}
        title={conv?.blockedByMe ? `Unblock ${conv?.name}?` : `Block ${conv?.name}?`}
        text={conv?.blockedByMe ? 'They will be able to message and call you again.' : 'Blocked contacts cannot call you or send you messages.'}
        confirmLabel={conv?.blockedByMe ? 'Unblock' : 'Block'}
        danger={!conv?.blockedByMe}
        onConfirm={async () => {
          await api(`/users/${conv.other.id}/block`, { method: conv.blockedByMe ? 'DELETE' : 'POST' });
          patchConversation(id, (c) => ({ blockedByMe: !c.blockedByMe }));
        }}
      />
      <Confirm
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title={`Exit "${conv?.name}"?`}
        text="You will stop receiving messages from this group."
        confirmLabel="Exit group"
        danger
        onConfirm={async () => {
          await api(`/conversations/${id}/members/${me.id}`, { method: 'DELETE' });
          app.setConversations((l) => l.filter((c) => c.id !== id));
          navigate('/');
        }}
      />
    </div>
  );
}
