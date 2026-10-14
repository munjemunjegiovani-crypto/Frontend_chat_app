import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { Avatar, Badge, Icon, Logo, SearchField, Spinner } from '../components/ui.jsx';
import { listTime } from '../lib/format.js';

export function useChannels() {
  const [data, setData] = useState(null);
  const load = useCallback(() => api('/channels').then(setData).catch(() => setData((d) => d || { mine: [], following: [], discover: [] })), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('channel:post', load);
  useEffect(() => {
    window.addEventListener('gochat:channels', load);
    return () => window.removeEventListener('gochat:channels', load);
  }, [load]);
  return { data, load };
}

export const refreshChannels = () => window.dispatchEvent(new Event('gochat:channels'));

function ChannelRow({ c, active, onClick, action }) {
  const preview = c.lastPost ? (c.lastPost.body || (c.lastPost.mediaType === 'image' ? '📷 Photo' : c.lastPost.mediaType === 'video' ? '🎬 Video' : '📎 Attachment')) : c.description || 'No posts yet';
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3 transition ${active ? 'bg-gold-soft/60 dark:bg-gold/10' : 'hover:bg-soft/60'}`}>
      <button onClick={onClick} className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
        <Avatar id={c.avatarId} name={c.name} size={50} ring={c.unread > 0} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[18px] text-ink truncate flex-1">{c.name}</span>
            {c.lastPost && !action && <span className={`text-[12px] shrink-0 ${c.unread ? 'text-gold-ink font-semibold' : 'text-muted'}`}>{listTime(c.lastPost.createdAt)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] text-muted truncate flex-1">{action ? `${c.followerCount} follower${c.followerCount === 1 ? '' : 's'} · ${c.owner.name}` : preview}</span>
            {!action && <Badge count={c.unread} />}
          </div>
        </div>
      </button>
      {action}
    </div>
  );
}

export default function ChannelList() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { notifCount, refreshChannelUnread, toast } = useApp();
  const { data, load } = useChannels();
  const [q, setQ] = useState('');
  const [following, setFollowing] = useState(null);
  const activeId = pathname.startsWith('/channels/') ? Number(pathname.split('/')[2]) : null;

  useEffect(() => { refreshChannelUnread(); }, [data, refreshChannelUnread]);

  const match = (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.description.toLowerCase().includes(q.toLowerCase());
  const follow = async (c) => {
    setFollowing(c.id);
    try {
      await api(`/channels/${c.id}/follow`, { method: 'POST' });
      toast(`You now follow ${c.name}`, { icon: 'hub' });
      await load();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setFollowing(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl">
        <div className="h-16 px-4 flex items-center gap-3">
          <Logo size={34} className="md:hidden" />
          <div className="flex-1">
            <div className="eyebrow leading-none">Gochat</div>
            <h1 className="font-serif text-[24px] leading-8 text-ink">Channels</h1>
          </div>
          <button className="btn-ghost relative" onClick={() => navigate('/activity')} aria-label="Activity" title="Activity">
            <Icon name="notifications" fill={pathname === '/activity'} />
            {notifCount > 0 && <Badge count={notifCount} className="absolute -top-0.5 -right-0.5" />}
          </button>
          <button className="btn-ghost" onClick={() => navigate('/channels/new')} aria-label="Create channel" title="Create channel">
            <Icon name="add_circle" />
          </button>
        </div>
      </header>
      <div className="px-4 pt-1">
        <SearchField value={q} onChange={setQ} placeholder="Search channels" />
      </div>
      {!data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="pb-24 md:pb-6">
          <button onClick={() => navigate('/channels/new')} className="mx-3 mt-4 w-[calc(100%-24px)] card flex items-center gap-4 p-4 text-left hover:bg-soft/50">
            <span className="w-12 h-12 rounded-full bg-[#14213D] text-[#C9A86A] flex items-center justify-center ring-1 ring-gold/40"><Icon name="campaign" /></span>
            <span className="flex-1">
              <span className="block font-serif text-lg text-ink">Create a channel</span>
              <span className="block text-xs text-muted">Post updates; followers can react and comment</span>
            </span>
            <Icon name="chevron_right" className="text-muted" />
          </button>

          {data.mine.filter(match).length > 0 && (
            <>
              <div className="eyebrow px-5 mt-6 mb-2">Your channels</div>
              <div className="mx-3 card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
                {data.mine.filter(match).map((c) => <ChannelRow key={c.id} c={c} active={c.id === activeId} onClick={() => navigate(`/channels/${c.id}`)} />)}
              </div>
            </>
          )}
          <div className="flex items-center justify-between px-5 mt-6 mb-2">
            <span className="eyebrow">Following</span>
            <span className="text-label-md text-muted">{data.following.length}</span>
          </div>
          {data.following.filter(match).length ? (
            <div className="mx-3 card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
              {data.following.filter(match).map((c) => <ChannelRow key={c.id} c={c} active={c.id === activeId} onClick={() => navigate(`/channels/${c.id}`)} />)}
            </div>
          ) : (
            <p className="mx-5 text-sm text-muted">You don’t follow any channels yet. Discover some below.</p>
          )}
          <div className="flex items-center justify-between px-5 mt-6 mb-2">
            <span className="eyebrow">Discover channels</span>
          </div>
          {data.discover.filter(match).length ? (
            <div className="mx-3 card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
              {data.discover.filter(match).map((c) => (
                <ChannelRow key={c.id} c={c} active={c.id === activeId} onClick={() => navigate(`/channels/${c.id}`)}
                  action={
                    <button className="btn-outline !h-9 !px-4 shrink-0" onClick={() => follow(c)} disabled={following === c.id}>
                      {following === c.id ? <Spinner size={14} /> : 'Follow'}
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mx-5 text-sm text-muted">No new channels to discover right now. Be the first — create one!</p>
          )}
        </div>
      )}
    </div>
  );
}
