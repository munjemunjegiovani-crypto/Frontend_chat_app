import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, fileUrl, uploadFile } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { Avatar, Icon, Logo, Modal, Spinner } from '../components/ui.jsx';
import { ago } from '../lib/format.js';

export function useMoments() {
  const [data, setData] = useState(null);
  const load = useCallback(() => api('/moments').then(setData).catch(() => setData((d) => d || { mine: null, others: [] })), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('moments:changed', load);
  useEffect(() => {
    window.addEventListener('kova:moments', load);
    return () => window.removeEventListener('kova:moments', load);
  }, [load]);
  return { data, load };
}
export const refreshMoments = () => window.dispatchEvent(new Event('kova:moments'));

const BACKGROUNDS = ['#14213D', '#755A24', '#1F4D3A', '#6B1E2E', '#3A4664', '#0E1420'];

function MomentComposer({ mode, onClose }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (mode === 'media') setTimeout(() => ref.current?.click(), 50); }, [mode]);

  const post = async () => {
    setBusy(true);
    try {
      if (file) {
        const up = await uploadFile(file);
        await api('/moments', { method: 'POST', body: { type: file.type.startsWith('video/') ? 'video' : 'image', body: text, fileId: up.id } });
      } else {
        await api('/moments', { method: 'POST', body: { type: 'text', body: text, background: bg } });
      }
      toast('Moment shared for 24 hours', { icon: 'auto_awesome' });
      refreshMoments();
      onClose();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New moment">
      <input ref={ref} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) setFile(f); }} />
      {file ? (
        <div className="rounded-2xl overflow-hidden bg-black mb-3 relative">
          {file.type.startsWith('video/') ? <video src={URL.createObjectURL(file)} className="w-full max-h-80" controls playsInline /> : <img src={URL.createObjectURL(file)} alt="" className="w-full max-h-80 object-contain" />}
          <button onClick={() => setFile(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove"><Icon name="close" size={18} /></button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl aspect-[4/5] max-h-80 w-full flex items-center justify-center p-6 mb-3 transition-colors" style={{ background: bg }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={700}
              autoFocus
              placeholder="Type a moment…"
              className="w-full bg-transparent text-center font-serif italic text-2xl leading-9 text-[#F2EFE9] placeholder:text-white/50 outline-none resize-none"
              rows={5}
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            {BACKGROUNDS.map((c) => (
              <button key={c} onClick={() => setBg(c)} className={`w-8 h-8 rounded-full ring-offset-2 ring-offset-card ${bg === c ? 'ring-2 ring-gold' : ''}`} style={{ background: c }} aria-label="Background colour" />
            ))}
            <button className="ml-auto btn-outline !h-9 !px-3" onClick={() => ref.current.click()}><Icon name="add_photo_alternate" size={18} /> Photo/video</button>
          </div>
        </>
      )}
      {file && <input className="field mb-3" placeholder="Add a caption…" value={text} onChange={(e) => setText(e.target.value)} maxLength={700} />}
      <button className="btn-primary w-full" disabled={busy || (!file && !text.trim())} onClick={post}>
        {busy ? <Spinner size={16} /> : <>Share moment <Icon name="arrow_upward" size={18} /></>}
      </button>
    </Modal>
  );
}

function Thumb({ m }) {
  if (!m) return null;
  if (m.type === 'text') return <div className="w-full h-full flex items-center justify-center p-2 text-center font-serif italic text-[10px] text-white" style={{ background: m.background }}>{m.body.slice(0, 40)}</div>;
  if (m.type === 'image') return <img src={fileUrl(m.file?.id)} alt="" className="w-full h-full object-cover" />;
  return <video src={fileUrl(m.file?.id)} className="w-full h-full object-cover" muted preload="metadata" />;
}

export default function MomentList() {
  const { me } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useMoments();
  const [composer, setComposer] = useState(null);
  const fresh = data?.others.filter((g) => !g.allViewed) || [];
  const seen = data?.others.filter((g) => g.allViewed) || [];

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl">
        <div className="h-16 px-4 flex items-center gap-3">
          <Logo size={34} className="md:hidden" />
          <div className="flex-1">
            <div className="eyebrow leading-none">Ephemera · 24h</div>
            <h1 className="font-serif text-[24px] leading-8 text-ink">Moments</h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center" onClick={() => setComposer('media')} aria-label="New photo moment"><Icon name="photo_camera" size={20} /></button>
        </div>
      </header>
      {!data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="px-3 pb-24 md:pb-6">
          <div className="card p-4 mt-1">
            <div className="flex items-center gap-4">
              <button className="relative" onClick={() => (data.mine ? navigate(`/moments/${me.id}`) : setComposer('text'))}>
                <Avatar id={me.avatarId} name={me.name} size={60} ring={!!data.mine} />
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center border-2 border-card"><Icon name="add" size={16} /></span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-lg text-ink">{data.mine ? 'My moments' : 'Share a moment'}</div>
                <div className="text-xs text-muted">
                  {data.mine ? `${data.mine.moments.length} active · ${data.mine.moments.reduce((s, m) => s + m.viewCount, 0)} views · tap to view` : 'Moments disappear after 24 hours.'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 p-1.5 rounded-xl bg-soft/70">
              <button onClick={() => setComposer('text')} className="h-10 rounded-lg flex items-center justify-center gap-2 text-sm text-ink/80 hover:bg-card"><Icon name="edit_note" size={20} className="text-gold-ink" /> Text</button>
              <button onClick={() => setComposer('media')} className="h-10 rounded-lg flex items-center justify-center gap-2 text-sm text-ink/80 hover:bg-card"><Icon name="photo_library" size={20} className="text-gold-ink" /> Photo / video</button>
            </div>
          </div>

          {fresh.length > 0 && (
            <>
              <div className="flex items-center justify-between px-2 mt-6 mb-3">
                <span className="eyebrow">Recent updates</span>
                <span className="text-label-md text-muted">{fresh.length} new</span>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar px-1 pb-2">
                {fresh.map((g) => (
                  <button key={g.user.id} onClick={() => navigate(`/moments/${g.user.id}`)} className="flex flex-col items-center gap-1.5 w-[72px] shrink-0">
                    <Avatar id={g.user.avatarId} name={g.user.name} size={66} ring />
                    <span className={`text-[12px] truncate w-full text-center ${pathname === `/moments/${g.user.id}` ? 'text-gold-ink font-semibold' : 'text-ink/80'}`}>{g.user.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              <div className="card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)] mt-2">
                {fresh.map((g) => (
                  <button key={g.user.id} onClick={() => navigate(`/moments/${g.user.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-soft/60">
                    <div className="w-12 h-16 rounded-lg overflow-hidden ring-2 ring-gold shrink-0"><Thumb m={g.moments[g.moments.length - 1]} /></div>
                    <div className="flex-1 min-w-0"><div className="font-medium text-ink">{g.user.name}</div><div className="text-xs text-muted">{ago(g.latestAt)} · {g.moments.length} moment{g.moments.length === 1 ? '' : 's'}</div></div>
                    <Icon name="chevron_right" size={20} className="text-muted" />
                  </button>
                ))}
              </div>
            </>
          )}

          {seen.length > 0 && (
            <>
              <div className="eyebrow px-2 mt-6 mb-3 !text-muted">Viewed updates</div>
              <div className="flex flex-col gap-2">
                {seen.map((g) => (
                  <button key={g.user.id} onClick={() => navigate(`/moments/${g.user.id}`)} className="card flex items-center gap-3 px-4 py-3 text-left hover:bg-soft/50">
                    <Avatar id={g.user.avatarId} name={g.user.name} size={48} ring ringDim />
                    <div className="flex-1 min-w-0"><div className="font-medium text-ink">{g.user.name}</div><div className="text-xs text-muted">{ago(g.latestAt)}</div></div>
                    <Icon name="chevron_right" size={20} className="text-muted" />
                  </button>
                ))}
              </div>
            </>
          )}

          {!data.others.length && (
            <div className="text-center px-6 py-10">
              <Icon name="auto_awesome" size={36} className="text-gold-ink/70" />
              <p className="text-sm text-muted mt-2">No moments from your contacts yet. People you chat with will appear here when they share.</p>
            </div>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-soft/70 flex gap-3">
            <Icon name="hourglass_top" className="text-gold-ink" />
            <div>
              <div className="font-medium text-ink text-sm">Moments fade gracefully</div>
              <p className="text-xs text-muted leading-5 mt-0.5">Everything you share here is deleted automatically 24 hours after you post it. Only people you chat with can see your moments.</p>
            </div>
          </div>
        </div>
      )}
      {composer && <MomentComposer mode={composer} onClose={() => setComposer(null)} />}
    </div>
  );
}
