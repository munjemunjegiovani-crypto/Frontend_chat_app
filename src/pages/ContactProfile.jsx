import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import { Avatar, Confirm, Icon, PaneHeader, Spinner, Toggle, Quote, EmptyState } from '../components/ui.jsx';
import SharedMedia from '../components/SharedMedia.jsx';
import { lastSeen } from '../lib/format.js';

export default function ContactProfile() {
  const { id } = useParams();
  const userId = Number(id);
  const navigate = useNavigate();
  const { me, conversations, upsertConversation, toast } = useApp();
  const { startCall } = useCall();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (userId === me.id) { navigate('/settings/profile', { replace: true }); return; }
    setUser(null);
    api(`/users/${userId}`).then(setUser).catch((e) => setError(e.message));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const conv = conversations.find((c) => c.type === 'direct' && c.other?.id === userId);
  // keep presence fresh from the conversation list
  const live = conv?.other ? { ...user, online: conv.other.online, lastSeenAt: conv.other.lastSeenAt } : user;

  if (error) return <EmptyState icon="person_off" title="Profile unavailable" text={error} />;
  if (!user) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;

  const message = async () => {
    const c = await api('/conversations/direct', { method: 'POST', body: { userId } });
    upsertConversation(c);
    navigate(`/chat/${c.id}`);
  };
  const blocked = user.blockedByMe;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title="Contact" eyebrow="Personal registry" back />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="card p-6 text-center relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gold-soft/70 to-transparent" />
          <div className="relative inline-block">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-[#E5C281] via-[#C9A86A] to-[#8C6A2E]">
              <Avatar id={user.avatarId} name={user.name} size={120} className="[&>div]:border-4 [&>div]:border-card" online={live.online} />
            </div>
          </div>
          <div className="relative mt-3 inline-flex items-center gap-2 px-3 h-7 rounded-full bg-soft text-label-md text-ink/80">
            {live.online && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
            {user.blockedMe ? 'Gochat member' : lastSeen(live)}
          </div>
          <h2 className="relative font-serif text-3xl text-ink mt-3">{user.name}</h2>
          <p className="relative text-sm text-muted mt-1">@{user.username}</p>
          {user.bio && <p className="relative font-serif italic text-[15px] text-gold-ink mt-3">“{user.bio}”</p>}

          <div className="relative grid grid-cols-4 gap-2 mt-6 p-2 rounded-2xl bg-soft/60">
            {[
              ['chat', 'Message', message, true],
              ['call', 'Audio', () => startCall(user, 'voice'), false, blocked || user.blockedMe],
              ['videocam', 'Video', () => startCall(user, 'video'), false, blocked || user.blockedMe],
              ['share', 'Share', async () => {
                const t = `Find ${user.name} on Gochat: @${user.username} — ${window.location.origin}`;
                try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast('Copied'); } } catch { /* ignore */ }
              }],
            ].map(([icon, label, fn, primary, disabled]) => (
              <button key={label} onClick={fn} disabled={disabled} className="flex flex-col items-center gap-2 py-2 disabled:opacity-40">
                <span className={`w-12 h-12 rounded-full flex items-center justify-center ${primary ? 'bg-primary text-on-primary' : 'bg-card text-gold-ink border hairline'}`}>
                  <Icon name={icon} />
                </span>
                <span className="text-[12px] text-ink/80">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-ink flex items-center gap-2"><Icon name="verified_user" className="text-gold-ink" /> Identity</h3>
            <span className="eyebrow">Gochat registry</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-soft/70">
              <span className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-gold-ink"><Icon name="alternate_email" /></span>
              <div className="flex-1">
                <div className="text-label-sm uppercase text-muted">Username</div>
                <div className="text-ink">@{user.username}</div>
              </div>
              <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(`@${user.username}`); toast('Username copied'); }} aria-label="Copy username"><Icon name="content_copy" size={18} /></button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-soft/70">
              <span className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-gold-ink"><Icon name="event" /></span>
              <div>
                <div className="text-label-sm uppercase text-muted">Member since</div>
                <div className="text-ink">{new Date(user.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
              </div>
            </div>
          </div>
        </div>

        {conv && <SharedMedia conversationId={conv.id} />}

        {user.commonGroups.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-xl text-ink">Groups in common</h3>
              <span className="text-xs text-muted">{user.commonGroups.length}</span>
            </div>
            <div className="space-y-2">
              {user.commonGroups.map((g) => (
                <button key={g.id} onClick={() => navigate(`/chat/${g.id}`)} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-soft/60 hover:bg-soft text-left">
                  <Avatar id={g.avatarId} name={g.name} size={40} group />
                  <span className="flex-1"><span className="block font-medium text-ink">{g.name}</span><span className="block text-xs text-muted">{g.memberCount} members</span></span>
                  <Icon name="chevron_right" size={20} className="text-muted" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <h3 className="font-serif text-xl text-ink flex items-center gap-2"><Icon name="tune" className="text-gold-ink" /> Discretion controls</h3>
          {conv && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div><div className="font-medium text-ink">Mute notifications</div><div className="text-xs text-muted">Silence alerts from this person</div></div>
                <Toggle checked={conv.muted} onChange={async (v) => upsertConversation(await api(`/conversations/${conv.id}/settings`, { method: 'PATCH', body: { muted: v } }))} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div><div className="font-medium text-ink">Favourite</div><div className="text-xs text-muted">Show in your Favourites filter</div></div>
                <Toggle checked={conv.favourite} onChange={async (v) => upsertConversation(await api(`/conversations/${conv.id}/settings`, { method: 'PATCH', body: { favourite: v } }))} />
              </div>
            </>
          )}
          <button className="w-full flex items-center justify-between py-2 text-danger" onClick={() => setConfirm(true)}>
            <span className="font-medium">{blocked ? `Unblock ${user.name.split(' ')[0]}` : `Block ${user.name.split(' ')[0]}`}</span>
            <Icon name="block" />
          </button>
        </div>
        <Quote cite="Gochat">A sanctuary of quiet discretion.</Quote>
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={blocked ? `Unblock ${user.name}?` : `Block ${user.name}?`}
        text={blocked ? 'They will be able to message and call you again.' : 'Blocked contacts cannot call you or send you messages. They will not be told.'}
        confirmLabel={blocked ? 'Unblock' : 'Block'}
        danger={!blocked}
        onConfirm={async () => {
          await api(`/users/${userId}/block`, { method: blocked ? 'DELETE' : 'POST' });
          setUser((u) => ({ ...u, blockedByMe: !blocked }));
          toast(blocked ? 'Contact unblocked' : 'Contact blocked', { icon: 'block' });
        }}
      />
    </div>
  );
}
