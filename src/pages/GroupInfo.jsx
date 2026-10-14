import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Confirm, Icon, Menu, Modal, PaneHeader, Spinner, Toggle, Quote } from '../components/ui.jsx';
import SharedMedia from '../components/SharedMedia.jsx';
import { useUserSearch } from './NewChat.jsx';
import { lastSeen } from '../lib/format.js';

function AddMembers({ conv, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const { results } = useUserSearch(q);
  const existing = new Set(conv.members.map((m) => m.id));
  const { toast } = useApp();
  const add = async () => {
    setBusy(true);
    try {
      const c = await api(`/conversations/${conv.id}/members`, { method: 'POST', body: { userIds: picked } });
      onDone(c);
      onClose();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Add members" footer={
      <button className="btn-primary w-full" disabled={!picked.length || busy} onClick={add}>
        {busy ? <Spinner size={16} /> : `Add ${picked.length || ''}`}
      </button>
    }>
      <input className="field mb-3" placeholder="Search by name or @username" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {results.filter((u) => !existing.has(u.id)).map((u) => {
        const on = picked.includes(u.id);
        return (
          <button key={u.id} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))} className="w-full flex items-center gap-3 py-2 px-1 rounded-xl hover:bg-soft">
            <Avatar id={u.avatarId} name={u.name} size={40} />
            <span className="flex-1 text-left"><span className="block font-medium text-ink">{u.name}</span><span className="block text-xs text-muted">@{u.username}</span></span>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${on ? 'bg-gold-ink text-white dark:bg-gold dark:text-[#0E1420]' : 'bg-soft'}`}>{on && <Icon name="check" size={16} />}</span>
          </button>
        );
      })}
    </Modal>
  );
}

export default function GroupInfo() {
  const { id } = useParams();
  const convId = Number(id);
  const navigate = useNavigate();
  const { me, conversations, upsertConversation, setConversations, toast } = useApp();
  const conv = conversations.find((c) => c.id === convId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!conv) api(`/conversations/${convId}`).then(upsertConversation).catch(() => navigate('/'));
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (conv && conv.type === 'direct' && conv.other) navigate(`/user/${conv.other.id}`, { replace: true });
  }, [conv, navigate]);

  if (!conv) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  const isAdmin = conv.role === 'admin';
  const link = conv.inviteCode ? `${window.location.origin}/join/${conv.inviteCode}` : null;

  const patch = async (body) => {
    try {
      const c = await api(`/conversations/${conv.id}`, { method: 'PATCH', body });
      upsertConversation(c);
      return c;
    } catch (e) {
      toast(e.message, { error: true });
      return null;
    }
  };

  const changePhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadFile(file);
      await patch({ avatarId: up.id });
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  const memberAction = async (m, action) => {
    try {
      if (action === 'message') {
        const c = await api('/conversations/direct', { method: 'POST', body: { userId: m.id } });
        upsertConversation(c);
        navigate(`/chat/${c.id}`);
      } else if (action === 'admin' || action === 'member') {
        upsertConversation(await api(`/conversations/${conv.id}/members/${m.id}`, { method: 'PATCH', body: { role: action } }));
      } else if (action === 'remove') {
        await api(`/conversations/${conv.id}/members/${m.id}`, { method: 'DELETE' });
        upsertConversation({ ...conv, members: conv.members.filter((x) => x.id !== m.id), memberCount: conv.memberCount - 1 });
      }
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const quickActions = [
    isAdmin && ['person_add', 'Add', () => setAdding(true)],
    [conv.muted ? 'notifications_off' : 'notifications', conv.muted ? 'Muted' : 'Mute', async () => upsertConversation(await api(`/conversations/${conv.id}/settings`, { method: 'PATCH', body: { muted: !conv.muted } }))],
    ['chat', 'Chat', () => navigate(`/chat/${conv.id}`)],
    link && ['link', 'Invite', () => { navigator.clipboard?.writeText(link); toast('Invite link copied'); }],
    ['logout', 'Exit', () => setConfirm('leave'), true],
  ].filter(Boolean).slice(0, 4);
  const members = [...conv.members].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1));
  const shown = showAll ? members : members.slice(0, 8);
  const online = conv.members.filter((m) => m.online && m.id !== me.id).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title="Group info" eyebrow={conv.name} back={`/chat/${conv.id}`} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-[#E5C281] via-[#C9A86A] to-[#8C6A2E]">
              <Avatar id={conv.avatarId} name={conv.name} size={112} group className="[&>div]:border-4 [&>div]:border-canvas" />
            </div>
            {isAdmin && (
              <button onClick={() => fileRef.current.click()} className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-gold text-[#0E1420] shadow flex items-center justify-center" aria-label="Change photo">
                {busy ? <Spinner size={16} /> : <Icon name="photo_camera" size={18} />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changePhoto(e.target.files[0])} />
          </div>
          <h2 className="font-serif text-3xl text-ink mt-4">{conv.name}</h2>
          <div className="inline-flex items-center gap-2 mt-2 px-3 h-7 rounded-full bg-soft text-label-md text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Group · {conv.memberCount} members{online ? ` · ${online} online` : ''}
          </div>
          {isAdmin && (
            <div className="mt-3">
              <button className="text-label-md text-gold-ink underline-offset-4 hover:underline" onClick={() => { setForm({ name: conv.name, description: conv.description }); setEditing(true); }}>
                Edit name & description
              </button>
            </div>
          )}
        </div>

        {conv.description ? (
          <blockquote className="card border-l-4 !border-l-gold px-5 py-4 font-serif italic text-[16px] leading-7 text-ink/90">“{conv.description}”</blockquote>
        ) : isAdmin ? (
          <button className="card w-full px-5 py-4 text-left text-sm text-muted" onClick={() => { setForm({ name: conv.name, description: '' }); setEditing(true); }}>
            <Icon name="add" size={18} className="align-[-4px] mr-1 text-gold-ink" /> Add a group description
          </button>
        ) : null}

        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))` }}>
          {quickActions.map(([icon, label, fn, danger]) => (
            <button key={label} onClick={fn} className="card flex flex-col items-center gap-2 py-4 hover:bg-soft/50">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${danger ? 'bg-danger-soft text-danger' : 'bg-soft text-gold-ink'}`}><Icon name={icon} /></span>
              <span className={`text-[12px] ${danger ? 'text-danger' : 'text-ink/80'}`}>{label}</span>
            </button>
          ))}
        </div>

        <SharedMedia conversationId={conv.id} />

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="font-serif text-xl text-ink">Members</h3>
            <span className="text-xs text-muted">{conv.memberCount}</span>
          </div>
          {isAdmin && (
            <button onClick={() => setAdding(true)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-soft/60 text-gold-ink">
              <span className="w-11 h-11 rounded-full bg-gold-soft flex items-center justify-center"><Icon name="person_add" /></span>
              <span className="font-medium">Add members</span>
            </button>
          )}
          {shown.map((m) => {
            const isMe = m.id === me.id;
            const row = (
              <div className="w-full flex items-center gap-3 px-5 py-3 hover:bg-soft/60 text-left">
                <Avatar id={m.avatarId} name={m.name} size={44} online={m.online && !isMe} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink truncate">{isMe ? `${m.name} (You)` : m.name}</span>
                    {m.role === 'admin' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-gold-soft text-gold-ink font-semibold">Admin</span>}
                  </div>
                  <div className="text-xs text-muted truncate">{isMe ? m.bio : `@${m.username} · ${lastSeen(m)}`}</div>
                </div>
                {!isMe && <Icon name="more_horiz" className="text-muted" />}
              </div>
            );
            if (isMe) return <div key={m.id}>{row}</div>;
            return (
              <Menu key={m.id} className="w-full" trigger={<button className="w-full">{row}</button>} items={[
                { icon: 'chat', label: `Message ${m.name.split(' ')[0]}`, onClick: () => memberAction(m, 'message') },
                { icon: 'person', label: 'View profile', onClick: () => navigate(`/user/${m.id}`) },
                isAdmin && (m.role === 'admin'
                  ? { icon: 'remove_moderator', label: 'Dismiss as admin', onClick: () => memberAction(m, 'member') }
                  : { icon: 'shield_person', label: 'Make group admin', onClick: () => memberAction(m, 'admin') }),
                isAdmin && { icon: 'person_remove', label: 'Remove from group', danger: true, onClick: () => memberAction(m, 'remove') },
              ]} />
            );
          })}
          {members.length > 8 && (
            <button className="w-full py-3 text-label-md text-gold-ink border-t hairline" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show less' : `View all ${members.length} members`}
            </button>
          )}
        </div>

        <div className="card p-5 space-y-5">
          <h3 className="font-serif text-xl text-ink">Governance</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-ink">Mute notifications</div>
              <div className="text-xs text-muted">No sounds or alerts from this group</div>
            </div>
            <Toggle checked={conv.muted} onChange={async (v) => upsertConversation(await api(`/conversations/${conv.id}/settings`, { method: 'PATCH', body: { muted: v } }))} />
          </div>
          {isAdmin && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-ink">Only admins can send</div>
                <div className="text-xs text-muted">Turn the group into an announcement board</div>
              </div>
              <Toggle checked={conv.onlyAdminsSend} onChange={(v) => patch({ onlyAdminsSend: v })} />
            </div>
          )}
          {link && (
            <div>
              <div className="font-medium text-ink mb-2">Group invitation link</div>
              <div className="flex items-center gap-2 p-2 pl-4 rounded-xl bg-soft">
                <span className="flex-1 text-sm text-ink/80 truncate font-mono">{link.replace(/^https?:\/\//, '')}</span>
                <button className="btn-outline !h-9 !px-3" onClick={() => { navigator.clipboard?.writeText(link); toast('Invite link copied'); }}>
                  <Icon name="content_copy" size={16} /> Copy
                </button>
              </div>
              <button className="text-xs text-muted mt-2 hover:text-ink" onClick={async () => {
                const r = await api(`/conversations/${conv.id}/invite/reset`, { method: 'POST' });
                upsertConversation({ ...conv, inviteCode: r.inviteCode });
                toast('Old link no longer works');
              }}>Reset link</button>
            </div>
          )}
          <button className="w-full h-12 rounded-xl bg-danger-soft text-danger font-medium flex items-center justify-center gap-2" onClick={() => setConfirm('leave')}>
            <Icon name="logout" size={20} /> Exit group
          </button>
        </div>
        <Quote cite="Kova · Groups">What is shared among friends remains timeless.</Quote>
      </div>

      {adding && <AddMembers conv={conv} onClose={() => setAdding(false)} onDone={upsertConversation} />}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit group">
        <label className="block">
          <span className="block text-label-md text-ink/80 mb-1.5">Name</span>
          <input className="field" value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="block mt-4">
          <span className="block text-label-md text-ink/80 mb-1.5">Description</span>
          <textarea className="field !h-28 py-3 resize-none" value={form.description} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </label>
        <button className="btn-primary w-full mt-5" onClick={async () => {
          const body = {};
          if (form.name !== conv.name) body.name = form.name;
          if (form.description !== conv.description) body.description = form.description;
          if (Object.keys(body).length) await patch(body);
          setEditing(false);
        }}>Save</button>
      </Modal>
      <Confirm
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title={`Exit "${conv.name}"?`}
        text="You will no longer receive messages from this group."
        confirmLabel="Exit group"
        danger
        onConfirm={async () => {
          await api(`/conversations/${conv.id}/members/${me.id}`, { method: 'DELETE' });
          setConversations((l) => l.filter((c) => c.id !== conv.id));
          navigate('/');
        }}
      />
    </div>
  );
}
