import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl, uploadFile } from '../lib/api.js';
import { makeMomentPreview } from '../lib/momentPreview.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Confirm, Icon, Modal, Spinner } from '../components/ui.jsx';
import { ago } from '../lib/format.js';
import { refreshMoments, useMoments } from './MomentList.jsx';

const DURATION = 6000;

export default function MomentViewer() {
  const { userId } = useParams();
  const uid = Number(userId);
  const navigate = useNavigate();
  const { me, toast, upsertConversation } = useApp();
  const { data } = useMoments();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [viewers, setViewers] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const videoRef = useRef(null);
  const sending = useRef(false);
  const started = useRef(Date.now());
  const elapsedBefore = useRef(0);

  const group = data ? (uid === me.id ? data.mine : data.others.find((g) => g.user.id === uid)) : null;
  const moments = group?.moments || [];
  const m = moments[index];
  const isMine = uid === me.id;

  useEffect(() => {
    // start at the first unseen moment
    if (!group) return;
    const firstUnseen = group.moments.findIndex((x) => !x.viewed);
    setIndex(isMine || firstUnseen === -1 ? 0 : firstUnseen);
  }, [uid, !!group]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!m) return;
    setProgress(0);
    started.current = Date.now();
    elapsedBefore.current = 0;
    if (!isMine && !m.viewed) api(`/moments/${m.id}/view`, { method: 'POST' }).catch(() => {});
  }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (index < moments.length - 1) { setIndex((i) => i + 1); return; }
    const others = data?.others || [];
    const pos = others.findIndex((g) => g.user.id === uid);
    const nextGroup = others.slice(pos + 1).find((g) => !g.allViewed);
    refreshMoments();
    if (!isMine && nextGroup) navigate(`/moments/${nextGroup.user.id}`, { replace: true });
    else navigate('/moments', { replace: true });
  };
  const prev = () => { if (index > 0) setIndex((i) => i - 1); else { started.current = Date.now(); elapsedBefore.current = 0; setProgress(0); } };

  // Timer for text/image moments; video moments follow the video's own progress
  const hold = paused || !!reply || confirm || viewers !== null;
  useEffect(() => {
    if (!m || m.type === 'video') return undefined;
    if (hold) { elapsedBefore.current += Date.now() - started.current; return undefined; }
    started.current = Date.now();
    const t = setInterval(() => {
      const p = (elapsedBefore.current + Date.now() - started.current) / DURATION;
      if (p >= 1) { clearInterval(t); next(); } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
  }, [m?.id, hold]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hold) v.pause(); else v.play().catch(() => {});
  }, [hold, m?.id]);

  useEffect(() => {
    const k = (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'Escape') navigate('/moments'); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!data) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  if (!group || !m) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/80 gap-4">
        <p className="font-serif text-xl">These moments have faded.</p>
        <button className="btn-outline !text-white" onClick={() => navigate('/moments')}>Back to moments</button>
      </div>
    );
  }

  // Send a message to the moment's owner with a snapshot of the moment quoted above it
  // (used for typed replies and for the like / emoji reaction buttons)
  const sendAboutMoment = async (text, doneMessage, icon = 'send') => {
    if (sending.current) return false;
    sending.current = true;
    try {
      const conv = await api('/conversations/direct', { method: 'POST', body: { userId: uid } });
      upsertConversation(conv);
      let previewId = null;
      if (m.type !== 'text') {
        try {
          const blob = await makeMomentPreview(m);
          if (blob) previewId = (await uploadFile(blob, { name: 'moment.jpg' })).id;
        } catch { /* send without the picture rather than failing */ }
      }
      const momentQuote = {
        type: m.type,
        body: m.body || '',
        background: m.background,
        ownerId: uid,
        ownerName: group.user.name,
        previewId,
      };
      await api(`/conversations/${conv.id}/messages`, { method: 'POST', body: { body: text, momentQuote } });
      toast(doneMessage, { icon, to: `/chat/${conv.id}` });
      return true;
    } catch (e) {
      toast(e.message, { error: true });
      return false;
    } finally {
      sending.current = false;
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    if (await sendAboutMoment(text, `Reply sent to ${group.user.name.split(' ')[0]}`)) setReply('');
  };

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-[#0B1120] md:p-6">
      <div className="relative w-full h-full md:max-w-[440px] md:max-h-[820px] md:rounded-3xl overflow-hidden bg-black shadow-2xl select-none">
        {/* content */}
        {m.type === 'text' && (
          <div className="absolute inset-0 flex items-center justify-center p-10" style={{ background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,.08), transparent 60%), ${m.background}` }}>
            <div className="text-center">
              <span className="block font-serif text-7xl leading-none text-[#C9A86A] mb-1">“</span>
              <p className="font-serif italic text-[28px] leading-[1.35] text-[#F2EFE9] whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </div>
        )}
        {m.type === 'image' && <img src={fileUrl(m.file?.id)} alt="" className="absolute inset-0 w-full h-full object-contain" />}
        {m.type === 'video' && (
          <video ref={videoRef} key={m.id} src={fileUrl(m.file?.id)} autoPlay playsInline className="absolute inset-0 w-full h-full object-contain"
            onTimeUpdate={(e) => e.target.duration && setProgress(e.target.currentTime / e.target.duration)} onEnded={next} />
        )}
        {m.type !== 'text' && m.body && (
          <div className="absolute left-4 right-4 bottom-28 rounded-2xl bg-[#14213D]/80 backdrop-blur border border-[#C9A86A]/30 p-4">
            <p className="font-serif italic text-lg text-[#F2EFE9] leading-7">“{m.body}”</p>
          </div>
        )}

        {/* tap zones */}
        <button className="absolute left-0 top-16 bottom-28 w-1/3 z-10" onClick={prev} aria-label="Previous" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />
        <button className="absolute right-0 top-16 bottom-28 w-2/3 z-10" onClick={next} aria-label="Next" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 z-20 p-3 pt-safe bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex gap-1 mb-3">
            {moments.map((x, i) => (
              <div key={x.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-[#C9A86A]" style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 text-white">
            <Avatar id={group.user.avatarId} name={group.user.name} size={38} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{isMine ? 'My moment' : group.user.name}</div>
              <div className="text-xs text-[#E5C281]">{ago(m.createdAt)} · fades in {Math.max(1, Math.ceil((new Date(m.expiresAt) - Date.now()) / 3600000))}h</div>
            </div>
            <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
              <Icon name={paused ? 'play_arrow' : 'pause'} />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => navigate('/moments')} aria-label="Close"><Icon name="close" /></button>
          </div>
        </div>

        {/* bottom bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          {isMine ? (
            <div className="flex items-center gap-2">
              <button className="flex-1 h-12 rounded-full bg-white/10 backdrop-blur text-white flex items-center justify-center gap-2" onClick={() => api(`/moments/${m.id}/viewers`).then(setViewers).catch(() => setViewers([]))}>
                <Icon name="visibility" size={20} /> {m.viewCount} view{m.viewCount === 1 ? '' : 's'}
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur text-[#FF8A80] flex items-center justify-center" onClick={() => setConfirm(true)} aria-label="Delete moment"><Icon name="delete" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder={`Reply privately to ${group.user.name.split(' ')[0]}…`}
                className="flex-1 h-12 px-5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white placeholder:text-white/60 outline-none focus:border-[#C9A86A]"
              />
              {reply ? (
                <button className="w-12 h-12 rounded-full bg-[#C9A86A] text-[#0E1420] flex items-center justify-center" onClick={sendReply} aria-label="Send"><Icon name="arrow_upward" /></button>
              ) : (
                ['❤️', '👏'].map((em) => (
                  <button key={em} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur text-xl" onClick={() => sendAboutMoment(em, 'Reaction sent', 'favorite')}>{em}</button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={viewers !== null} onClose={() => setViewers(null)} title="Viewed by">
        {viewers?.length ? viewers.map((v) => (
          <div key={v.id} className="flex items-center gap-3 py-2">
            <Avatar id={v.avatarId} name={v.name} size={40} />
            <span className="flex-1 font-medium text-ink">{v.name}</span>
            <span className="text-xs text-muted">{ago(v.viewedAt)}</span>
          </div>
        )) : <p className="text-sm text-muted py-4 text-center">No views yet.</p>}
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this moment?" confirmLabel="Delete" danger
        onConfirm={async () => {
          await api(`/moments/${m.id}`, { method: 'DELETE' });
          refreshMoments();
          if (moments.length <= 1) navigate('/moments', { replace: true });
          else setIndex((i) => Math.max(0, i - 1));
        }} />
    </div>
  );
}
