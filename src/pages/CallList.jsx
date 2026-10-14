import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import { Avatar, Icon, Logo, Spinner } from '../components/ui.jsx';
import { duration, listTime, timeOf } from '../lib/format.js';
import { useUserSearch } from './NewChat.jsx';

export default function CallList() {
  const { startCall } = useCall();
  const { conversations } = useApp();
  const navigate = useNavigate();
  const [calls, setCalls] = useState(null);
  const [filter, setFilter] = useState('all');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const { results } = useUserSearch(picking ? q : '');
  const load = useCallback(() => api('/calls').then(setCalls).catch(() => setCalls([])), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('calls:changed', load);

  const list = (calls || []).filter((c) => filter === 'all' || (c.status === 'missed' && c.direction === 'incoming'));
  const favourites = conversations.filter((c) => c.type === 'direct' && c.other && (c.favourite || c.pinned)).slice(0, 8);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl">
        <div className="h-16 px-4 flex items-center gap-3">
          <Logo size={34} className="md:hidden" />
          <div className="flex-1">
            <div className="eyebrow leading-none">Kova</div>
            <h1 className="font-serif text-[24px] leading-8 text-ink">Calls</h1>
          </div>
          <button className="btn-ghost" onClick={() => setPicking((p) => !p)} aria-label="New call" title="New call"><Icon name={picking ? 'close' : 'add_call'} /></button>
        </div>
      </header>

      {picking && (
        <div className="px-4 pb-2 animate-fadeUp">
          <input className="field" placeholder="Who do you want to call?" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="card mt-2 overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
            {results.slice(0, 8).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar id={u.avatarId} name={u.name} size={40} online={u.online} />
                <span className="flex-1 min-w-0"><span className="block font-medium text-ink truncate">{u.name}</span><span className="block text-xs text-muted">@{u.username}</span></span>
                <button className="btn-ghost !text-gold-ink" onClick={() => startCall(u, 'voice')} aria-label="Voice call"><Icon name="call" /></button>
                <button className="btn-ghost !text-gold-ink" onClick={() => startCall(u, 'video')} aria-label="Video call"><Icon name="videocam" /></button>
              </div>
            ))}
            {!results.length && <p className="text-sm text-muted text-center py-5">Search for someone to call.</p>}
          </div>
        </div>
      )}

      {favourites.length > 0 && !picking && (
        <div className="px-4 pt-2">
          <div className="eyebrow mb-3">Favourites</div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {favourites.map((c) => (
              <button key={c.id} onClick={() => startCall(c.other, 'voice')} className="flex flex-col items-center gap-1.5 w-16 shrink-0">
                <Avatar id={c.other.avatarId} name={c.other.name} size={56} ring online={c.other.online} />
                <span className="text-[12px] text-ink/80 truncate w-full text-center">{c.other.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 px-4 mt-4">
        {[['all', 'All'], ['missed', 'Missed']].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'chip-active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="px-3 pt-3 pb-24 md:pb-6">
        <div className="flex items-end justify-between px-2 mb-3">
          <div>
            <h2 className="font-serif text-2xl text-ink">Call history</h2>
            <p className="text-xs text-muted">Your recent voice and video calls</p>
          </div>
        </div>
        {!calls ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : list.length ? (
          <div className="flex flex-col gap-2">
            {list.map((c) => {
              const missed = c.status === 'missed' && c.direction === 'incoming';
              const label = c.status === 'missed'
                ? c.direction === 'incoming' ? 'Missed call' : 'No answer'
                : c.status === 'declined' ? c.direction === 'incoming' ? 'Declined' : 'Declined by them'
                  : `${c.direction === 'incoming' ? 'Incoming' : 'Outgoing'} · ${duration(c.duration)}`;
              return (
                <div key={c.id} className={`flex items-center gap-3 p-3 rounded-2xl ${missed ? 'bg-danger-soft/50' : 'bg-card border hairline'} shadow-lvl1`}>
                  <button onClick={() => navigate(`/user/${c.other.id}`)}><Avatar id={c.other.avatarId} name={c.other.name} size={48} /></button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-serif text-[18px] truncate ${missed ? 'text-danger' : 'text-ink'}`}>{c.other.name}</div>
                    <div className={`flex items-center gap-1.5 text-[13px] ${missed ? 'text-danger' : 'text-muted'}`}>
                      <Icon name={c.direction === 'incoming' ? (missed ? 'call_missed' : 'call_received') : 'call_made'} size={16} />
                      <Icon name={c.type === 'video' ? 'videocam' : 'call'} size={15} />
                      <span className="truncate">{label}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[12px] tnum ${missed ? 'text-danger' : 'text-muted'}`}>{listTime(c.startedAt) === timeOf(c.startedAt) ? timeOf(c.startedAt) : `${listTime(c.startedAt)}`}</div>
                    <button className="mt-1 w-9 h-9 rounded-full inline-flex items-center justify-center text-gold-ink hover:bg-soft" onClick={() => startCall(c.other, c.type)} aria-label="Call back">
                      <Icon name={c.type === 'video' ? 'videocam' : 'call'} size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-6">
            <Icon name="call" size={40} className="text-gold-ink/70" />
            <p className="font-serif text-xl text-ink mt-2">{filter === 'missed' ? 'No missed calls' : 'No calls yet'}</p>
            <p className="text-sm text-muted mt-1">Tap the phone icon in any chat to call. Both of you need Kova open.</p>
          </div>
        )}
        <div className="card mt-6 p-4 flex gap-3">
          <span className="w-10 h-10 rounded-full bg-soft flex items-center justify-center text-gold-ink shrink-0"><Icon name="shield" /></span>
          <div>
            <div className="font-medium text-ink">Device-to-device calls</div>
            <p className="text-xs text-muted leading-5 mt-0.5">Audio and video travel directly between your devices over an encrypted WebRTC connection. Kova only helps the two devices find each other.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
