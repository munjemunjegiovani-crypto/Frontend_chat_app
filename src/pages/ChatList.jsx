import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Badge, Confirm, Icon, Logo, Menu, Modal, SearchField, Spinner } from '../components/ui.jsx';
import Ticks from '../components/Ticks.jsx';
import { listTime, messagePreview } from '../lib/format.js';
import { messageStatus } from '../lib/chat.js';
import { api } from '../lib/api.js';
import { enablePush } from '../lib/push.js';

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['groups', 'Groups'],
  ['favourites', 'Favourites'],
];

export function ChatRow({ c, active, me, typingInfo, onClick, onLongPress, compact }) {
  const last = c.lastMessage;
  // Press and hold (touch) or right-click (mouse) opens the chat's quick actions without opening the chat
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);
  const down = (e) => {
    fired.current = false;
    if (!onLongPress || e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      navigator.vibrate?.(15);
      onLongPress(c, true);
    }, 450);
  };
  const move = (e) => {
    if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clearTimeout(timer.current);
  };
  const cancel = () => clearTimeout(timer.current);
  const click = () => {
    if (fired.current) { fired.current = false; return; }
    onClick();
  };
  const mine = last?.sender?.id === me.id;
  const typers = typingInfo ? Object.entries(typingInfo) : [];
  let preview;
  if (typers.length) {
    const [uid, info] = typers[0];
    const who = c.type === 'group' ? `${c.members.find((m) => m.id === Number(uid))?.name.split(' ')[0] || 'Someone'} is ` : '';
    preview = <span className="text-gold-ink italic">{who}{info.recording ? 'recording audio…' : 'typing…'}</span>;
  } else if (!last) {
    preview = <span className="italic">{c.type === 'group' ? `${c.memberCount} members` : 'Say hello 👋'}</span>;
  } else if (last.type === 'system') {
    preview = <span className="italic">{last.body}</span>;
  } else {
    preview = (
      <>
        {mine && <Ticks status={messageStatus(last, c, me.id)} className="mr-1 align-[-3px]" />}
        {c.type === 'group' && !mine && <span className="text-gold-ink font-medium">{last.sender?.name.split(' ')[0]}: </span>}
        {last.deletedAt ? <span className="italic">🚫 This message was deleted</span> : messagePreview(last)}
      </>
    );
  }
  return (
    <button
      onClick={click}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => { if (!onLongPress) return; e.preventDefault(); onLongPress(c, false); }}
      className={`w-full flex items-center gap-3.5 px-4 select-none [-webkit-touch-callout:none] ${compact ? 'py-2.5' : 'py-3.5'} text-left transition ${
        active ? 'bg-gold-soft/60 dark:bg-gold/10' : 'hover:bg-soft/60'
      }`}
    >
      <Avatar id={c.avatarId} name={c.name} size={52} online={c.type === 'direct' && c.other?.online} group={c.type === 'group'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[19px] leading-7 text-ink truncate flex-1">{c.name}</span>
          <span className={`text-[12px] tnum shrink-0 ${c.unread ? 'text-gold-ink font-semibold' : 'text-muted'}`}>
            {listTime(last?.createdAt || c.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[14px] text-muted truncate flex-1">{preview}</span>
          {c.muted && <Icon name="notifications_off" size={16} className="text-muted" />}
          {c.pinned && <Icon name="push_pin" size={16} className="text-gold-ink rotate-45" />}
          <Badge count={c.unread} className={c.muted ? '!bg-muted' : ''} />
        </div>
      </div>
    </button>
  );
}

export default function ChatList() {
  const { me, conversations, convLoaded, typing, setConversations } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id } = useParams();
  const activeId = pathname.startsWith('/chat/') ? Number(id) : null;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const { setPrefs, toast, upsertConversation, patchConversation, markRead } = useApp();
  const [menuFor, setMenuFor] = useState(null);
  // While the finger that opened the sheet is still down (and for a moment after lifting), ignore taps on the
  // sheet: the browser sends the release as a tap to whatever is now under the finger.
  const blockUntil = useRef(0);
  const guarded = () => Date.now() < blockUntil.current;
  const openMenu = (c, viaTouch = false) => {
    if (blockUntil.current === Infinity) return; // same press already opened it
    if (viaTouch) {
      blockUntil.current = Infinity;
      const events = ['pointerup', 'pointercancel', 'touchend', 'touchcancel'];
      const release = () => {
        blockUntil.current = Date.now() + 500;
        events.forEach((ev) => document.removeEventListener(ev, release, true));
      };
      events.forEach((ev) => document.addEventListener(ev, release, true));
      setTimeout(() => { if (blockUntil.current === Infinity) release(); }, 6000);
    } else {
      blockUntil.current = Date.now() + 500;
    }
    setMenuFor(c);
  };
  const [confirm, setConfirm] = useState(null); // { kind, c }
  const [askNotif, setAskNotif] = useState(() => {
    try { return 'Notification' in window && Notification.permission === 'default' && !localStorage.getItem('gochat.notifAsked'); } catch { return false; }
  });
  const dismissNotif = () => { setAskNotif(false); try { localStorage.setItem('gochat.notifAsked', '1'); } catch { /* ignore */ } };
  const turnOnNotif = async () => {
    dismissNotif();
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      setPrefs({ notifications: true });
      await enablePush();
      toast('Notifications are on', { icon: 'notifications_active' });
    }
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return conversations
      .filter((c) => c.type === 'group' || c.lastMessage || c.id === activeId)
      .filter((c) => (showArchived ? c.archived : !c.archived))
      .filter((c) => {
        if (filter === 'unread') return c.unread > 0;
        if (filter === 'groups') return c.type === 'group';
        if (filter === 'favourites') return c.favourite;
        return true;
      })
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.other?.username?.includes(term) ||
        (c.lastMessage?.body || '').toLowerCase().includes(term))
      .sort((a, b) => new Date(b.lastMessage?.createdAt || b.lastMessageAt) - new Date(a.lastMessage?.createdAt || a.lastMessageAt));
  }, [conversations, q, filter, showArchived, activeId]);

  const pinned = visible.filter((c) => c.pinned && !showArchived);
  const rest = visible.filter((c) => !c.pinned || showArchived);
  const archivedCount = conversations.filter((c) => c.archived && (c.lastMessage || c.type === 'group')).length;
  const unreadTotal = conversations.filter((c) => c.unread).length;

  const markAllRead = () => {
    conversations.filter((c) => c.unread).forEach((c) => api(`/conversations/${c.id}/read`, { method: 'POST' }).catch(() => {}));
    setConversations((l) => l.map((c) => ({ ...c, unread: 0 })));
  };

  const open = (c) => navigate(`/chat/${c.id}`);

  // ---- quick actions for a chat (long press on the row) ----
  const setting = async (c, patch, done) => {
    try {
      upsertConversation(await api(`/conversations/${c.id}/settings`, { method: 'PATCH', body: patch }));
      toast(done);
    } catch (e) {
      toast(e.message, { error: true });
    }
  };
  const goInfo = (c) => navigate(c.type === 'group' ? `/chat/${c.id}/info` : `/user/${c.other?.id}`);
  const leaveIfActive = (c) => { if (activeId === c.id) navigate('/'); };
  const sheetActions = (c) => {
    const group = c.type === 'group';
    return [
      { icon: group ? 'groups' : 'person', label: group ? 'Group info' : 'View contact', fn: () => goInfo(c) },
      { icon: 'perm_media', label: 'Media, links & docs', fn: () => goInfo(c) },
      c.unread > 0 && { icon: 'mark_chat_read', label: 'Mark as read', fn: () => markRead(c.id) },
      '-',
      { icon: c.muted ? 'notifications' : 'notifications_off', label: c.muted ? 'Unmute' : 'Mute notifications', fn: () => setting(c, { muted: !c.muted }, c.muted ? 'Unmuted' : 'Muted') },
      { icon: 'push_pin', label: c.pinned ? 'Unpin chat' : 'Pin chat', fn: () => setting(c, { pinned: !c.pinned }, c.pinned ? 'Chat unpinned' : 'Chat pinned') },
      { icon: 'favorite', label: c.favourite ? 'Remove from favourites' : 'Add to favourites', fn: () => setting(c, { favourite: !c.favourite }, c.favourite ? 'Removed from favourites' : 'Added to favourites') },
      { icon: 'inventory_2', label: c.archived ? 'Unarchive chat' : 'Archive chat', fn: () => { setting(c, { archived: !c.archived }, c.archived ? 'Chat unarchived' : 'Chat archived'); if (!c.archived) leaveIfActive(c); } },
      '-',
      !group && c.other && { icon: 'block', label: c.blockedByMe ? 'Unblock' : 'Block', danger: true, fn: () => setConfirm({ kind: 'block', c }) },
      !group && { icon: 'delete', label: 'Delete chat', danger: true, fn: () => setConfirm({ kind: 'delete', c }) },
      group && { icon: 'cleaning_services', label: 'Clear chat', danger: true, fn: () => setConfirm({ kind: 'clear', c }) },
      group && { icon: 'logout', label: 'Exit group', danger: true, fn: () => setConfirm({ kind: 'leave', c }) },
    ].filter(Boolean);
  };
  const cc = confirm?.c;

  return (
    <div className="min-h-full flex flex-col relative">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl">
        <div className="h-16 px-4 flex items-center gap-3">
          <Logo size={34} className="md:hidden" />
          <div className="flex-1 min-w-0">
            <div className="eyebrow leading-none">Gochat</div>
            <h1 className="font-serif text-[24px] leading-8 text-ink">{showArchived ? 'Archived' : 'Chats'}</h1>
          </div>
          <button className="btn-ghost" onClick={() => navigate('/new')} aria-label="New chat" title="New chat">
            <Icon name="edit_square" />
          </button>
          <Menu
            trigger={<button className="btn-ghost" aria-label="More options"><Icon name="more_vert" /></button>}
            items={[
              { icon: 'person_add', label: 'New chat', onClick: () => navigate('/new') },
              { icon: 'group_add', label: 'New group', onClick: () => navigate('/new-group') },
              { icon: 'hub', label: 'New channel', onClick: () => navigate('/channels/new') },
              '-',
              { icon: 'star', label: 'Starred messages', onClick: () => navigate('/settings/starred') },
              { icon: 'done_all', label: 'Mark all as read', onClick: markAllRead },
              { icon: 'tune', label: 'Settings', onClick: () => navigate('/settings') },
            ]}
          />
        </div>
      </header>

      <div className="px-4 pt-1">
        <SearchField value={q} onChange={setQ} placeholder="Search chats and messages" />
        {!showArchived && (
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'chip-active' : ''}`}>
                {label}
                {k === 'unread' && unreadTotal > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold-ink text-white dark:text-[#0E1420] dark:bg-gold text-[10px] flex items-center justify-center">{unreadTotal}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {showArchived && (
          <button className="flex items-center gap-2 mt-3 text-sm text-gold-ink" onClick={() => setShowArchived(false)}>
            <Icon name="arrow_back" size={18} /> Back to chats
          </button>
        )}
      </div>

      {askNotif && !showArchived && (
        <div className="mx-3 mt-4 card p-4 flex items-start gap-3 animate-fadeUp">
          <span className="w-10 h-10 rounded-full bg-gold-soft text-gold-ink flex items-center justify-center shrink-0"><Icon name="notifications_active" size={20} /></span>
          <div className="flex-1">
            <div className="font-medium text-ink">Never miss a message</div>
            <p className="text-xs text-muted mt-0.5 leading-5">Turn on notifications to be alerted when friends write or call — even when Gochat is closed.</p>
            <div className="flex gap-2 mt-3">
              <button className="btn-primary !h-9 !px-4" onClick={turnOnNotif}>Turn on</button>
              <button className="btn-outline !h-9 !px-4" onClick={dismissNotif}>Not now</button>
            </div>
          </div>
        </div>
      )}

      {!convLoaded ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="flex-1 pb-24 md:pb-6">
          {pinned.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 mt-5 mb-2">
                <span className="flex items-center gap-2 eyebrow"><Icon name="push_pin" size={15} /> Pinned</span>
                <span className="text-label-md text-muted">{pinned.length} pinned</span>
              </div>
              <div className="mx-3 card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
                {pinned.map((c) => (
                  <ChatRow key={c.id} c={c} me={me} active={c.id === activeId} typingInfo={typing[c.id]} onClick={() => open(c)} onLongPress={openMenu} />
                ))}
              </div>
            </>
          )}

          {rest.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 mt-5 mb-2">
                <span className="flex items-center gap-2 eyebrow !text-muted"><Icon name="schedule" size={15} /> Recent correspondence</span>
                {unreadTotal > 0 && <button className="text-label-md text-gold-ink" onClick={markAllRead}>Mark all read</button>}
              </div>
              <div className="mx-3 card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
                {rest.map((c) => (
                  <ChatRow key={c.id} c={c} me={me} active={c.id === activeId} typingInfo={typing[c.id]} onClick={() => open(c)} onLongPress={openMenu} />
                ))}
              </div>
            </>
          )}

          {!visible.length && (
            <div className="text-center px-8 py-14">
              <Icon name={q ? 'search_off' : 'forum'} size={40} className="text-gold-ink/70" />
              <p className="font-serif text-xl mt-3 text-ink">{q ? 'No matches' : filter !== 'all' ? 'Nothing here yet' : 'No conversations yet'}</p>
              <p className="text-sm text-muted mt-1 mb-5">
                {q ? 'Try another name or word.' : 'Find a friend by their name or @username and say hello.'}
              </p>
              {!q && filter === 'all' && (
                <button className="btn-primary" onClick={() => navigate('/new')}><Icon name="person_add" size={20} /> Start a chat</button>
              )}
            </div>
          )}

          {!showArchived && archivedCount > 0 && (
            <button onClick={() => setShowArchived(true)} className="mx-3 mt-4 w-[calc(100%-24px)] flex items-center gap-4 p-4 rounded-2xl bg-soft/80 hover:bg-soft text-left">
              <span className="w-11 h-11 rounded-full bg-card flex items-center justify-center"><Icon name="inventory_2" className="text-gold-ink" /></span>
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-ink">Archived conversations</span>
                <span className="block text-xs text-muted">Hidden from your main list</span>
              </span>
              <span className="text-label-md text-gold-ink">{archivedCount}</span>
              <Icon name="chevron_right" className="text-muted" size={20} />
            </button>
          )}

          {visible.length > 0 && !showArchived && (
            <p className="mx-6 mt-8 text-center font-serif italic text-[14px] text-gold-ink/80">“Words composed with care endure like bronze.”</p>
          )}
        </div>
      )}


      <Modal open={!!menuFor} onClose={() => { if (!guarded()) setMenuFor(null); }}>
        {menuFor && (
          <div className="pt-4">
            <div className="flex items-center gap-3 pb-3 mb-1 border-b hairline">
              <Avatar id={menuFor.avatarId} name={menuFor.name} size={44} group={menuFor.type === 'group'} />
              <div className="min-w-0">
                <div className="font-serif text-[19px] leading-6 text-ink truncate">{menuFor.name}</div>
                <div className="text-xs text-muted">{menuFor.type === 'group' ? `${menuFor.memberCount} members` : 'Chat options'}</div>
              </div>
            </div>
            <div className="-mx-5">
              {sheetActions(menuFor).map((a, i) =>
                a === '-' ? (
                  <div key={i} className="my-1 border-t hairline" />
                ) : (
                  <button
                    key={a.label}
                    className={`w-full flex items-center gap-4 px-6 py-3.5 text-[15px] text-left hover:bg-soft ${a.danger ? 'text-danger' : 'text-ink'}`}
                    onClick={() => { if (guarded()) return; const c = menuFor; setMenuFor(null); a.fn(c); }}
                  >
                    <Icon name={a.icon} size={21} className={a.danger ? '' : 'text-gold-ink'} /> {a.label}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </Modal>

      <Confirm
        open={confirm?.kind === 'block'}
        onClose={() => setConfirm(null)}
        title={cc?.blockedByMe ? `Unblock ${cc?.name}?` : `Block ${cc?.name}?`}
        text={cc?.blockedByMe ? 'They will be able to message and call you again.' : 'Blocked contacts cannot call you or send you messages.'}
        confirmLabel={cc?.blockedByMe ? 'Unblock' : 'Block'}
        danger={!cc?.blockedByMe}
        onConfirm={async () => {
          await api(`/users/${cc.other.id}/block`, { method: cc.blockedByMe ? 'DELETE' : 'POST' });
          patchConversation(cc.id, () => ({ blockedByMe: !cc.blockedByMe }));
          toast(cc.blockedByMe ? 'Contact unblocked' : 'Contact blocked');
        }}
      />
      <Confirm
        open={confirm?.kind === 'delete'}
        onClose={() => setConfirm(null)}
        title={`Delete chat with ${cc?.name}?`}
        text="The conversation is removed from your list. It comes back if they message you again. Their copy is not affected."
        confirmLabel="Delete chat"
        danger
        onConfirm={async () => {
          await api(`/conversations/${cc.id}`, { method: 'DELETE' });
          setConversations((l) => l.filter((x) => x.id !== cc.id));
          leaveIfActive(cc);
          toast('Chat deleted');
        }}
      />
      <Confirm
        open={confirm?.kind === 'clear'}
        onClose={() => setConfirm(null)}
        title="Clear this chat?"
        text="Messages will be removed from your view only. Others keep their copy."
        confirmLabel="Clear chat"
        danger
        onConfirm={async () => {
          upsertConversation(await api(`/conversations/${cc.id}/clear`, { method: 'POST' }));
          toast('Chat cleared');
        }}
      />
      <Confirm
        open={confirm?.kind === 'leave'}
        onClose={() => setConfirm(null)}
        title={`Exit "${cc?.name}"?`}
        text="You will stop receiving messages from this group."
        confirmLabel="Exit group"
        danger
        onConfirm={async () => {
          await api(`/conversations/${cc.id}/members/${me.id}`, { method: 'DELETE' });
          setConversations((l) => l.filter((x) => x.id !== cc.id));
          leaveIfActive(cc);
          toast('You left the group');
        }}
      />

      <button
        onClick={() => navigate('/new')}
        className="md:hidden fixed right-5 bottom-[96px] z-30 w-14 h-14 rounded-full bg-[#14213D] dark:bg-gold text-[#E5C281] dark:text-[#0E1420] shadow-lvl2 flex items-center justify-center ring-1 ring-gold/40 active:scale-95"
        aria-label="New chat"
      >
        <Icon name="history_edu" size={26} />
      </button>
    </div>
  );
}
