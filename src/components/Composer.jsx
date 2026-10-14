import { useEffect, useRef, useState } from 'react';
import { Icon, Modal } from './ui.jsx';
import { EMOJIS } from '../lib/chat.js';
import { duration } from '../lib/format.js';

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'];
  return options.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export default function Composer({
  replyTo, onCancelReply, editing, onCancelEdit, onSendText, onSendFiles, onSendVoice, onSaveEdit,
  onTyping, disabledNotice, toast, meId,
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pending, setPending] = useState(null); // { files, caption }
  const [rec, setRec] = useState(null); // { seconds }
  const taRef = useRef(null);
  const mediaInput = useRef(null);
  const docInput = useRef(null);
  const camInput = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const recTimer = useRef(null);
  const cancelRec = useRef(false);
  const typingSent = useRef(0);
  const typingStop = useRef(null);

  useEffect(() => {
    if (editing) {
      setText(editing.body || '');
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);

  // Auto-grow the text box
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => () => {
    clearInterval(recTimer.current);
    if (recorder.current?.state === 'recording') {
      cancelRec.current = true;
      recorder.current.stop();
    }
  }, []);

  const signalTyping = (value) => {
    const now = Date.now();
    if (value && now - typingSent.current > 2500) {
      typingSent.current = now;
      onTyping(true);
    }
    clearTimeout(typingStop.current);
    typingStop.current = setTimeout(() => { typingSent.current = 0; onTyping(false); }, value ? 3500 : 0);
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    if (editing) onSaveEdit(editing, body);
    else onSendText(body);
    setText('');
    setShowEmoji(false);
    clearTimeout(typingStop.current);
    typingSent.current = 0;
    onTyping(false);
    taRef.current?.focus();
  };

  const onKey = (e) => {
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    if (e.key === 'Enter' && !e.shiftKey && desktop) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') {
      if (editing) { onCancelEdit(); setText(''); }
      else if (replyTo) onCancelReply();
    }
  };

  const insertEmoji = (em) => {
    const ta = taRef.current;
    if (!ta) return setText((t) => t + em);
    const s = ta.selectionStart ?? text.length;
    const e2 = ta.selectionEnd ?? text.length;
    const next = text.slice(0, s) + em + text.slice(e2);
    setText(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + em.length; }, 0);
  };

  const chooseFiles = (files, kind) => {
    const list = [...files].slice(0, 10);
    if (!list.length) return;
    setShowAttach(false);
    if (kind === 'doc') {
      onSendFiles(list.map((f) => ({ file: f, kind: 'file' })), '');
      return;
    }
    setPending({ files: list, caption: '' });
  };

  const sendPending = () => {
    const items = pending.files.map((f) => ({
      file: f,
      kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file',
    }));
    onSendFiles(items, pending.caption.trim());
    setPending(null);
  };

  const shareLocation = () => {
    setShowAttach(false);
    if (!navigator.geolocation) return toast('Location is not available on this device.', { error: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onSendText(`📍 My location\nhttps://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
      },
      () => toast('Could not get your location. Allow location access and try again.', { error: true }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startRecording = async () => {
    const mime = pickRecorderMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      return toast('Voice notes are not supported in this browser.', { error: true });
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelRec.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimer.current);
        const type = r.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        const secs = rec?.seconds;
        setRec(null);
        onTyping(false, true);
        if (!cancelRec.current && blob.size > 1000) onSendVoice(blob, type, secs);
      };
      r.start(250);
      recorder.current = r;
      setRec({ seconds: 0 });
      onTyping(true, true);
      const started = Date.now();
      recTimer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        setRec({ seconds: s });
        if (s >= 300) stopRecording(false);
      }, 250);
    } catch {
      toast('Microphone access was blocked. Allow it in your browser settings.', { error: true });
    }
  };

  const stopRecording = (cancel) => {
    cancelRec.current = cancel;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  if (disabledNotice) {
    return (
      <div className="shrink-0 px-4 py-4 pb-safe bg-card/95 border-t hairline text-center text-sm text-muted">
        {disabledNotice}
      </div>
    );
  }

  return (
    <div
      className="shrink-0 relative px-2 md:px-4 pt-2 pb-2 bg-canvas border-t hairline pb-safe"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      {(replyTo || editing) && (
        <div className="mx-1 mb-2 flex items-center gap-3 rounded-xl bg-card border hairline px-3 py-2 animate-fadeUp">
          <span className="w-[3px] self-stretch rounded bg-gold" />
          <Icon name={editing ? 'edit' : 'reply'} size={20} className="text-gold-ink" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-gold-ink">
              {editing ? 'Edit message' : `Replying to ${replyTo.sender?.id === meId ? 'yourself' : replyTo.sender?.name}`}
            </div>
            <div className="text-[13px] text-muted truncate">
              {(editing || replyTo).body || ((editing || replyTo).type === 'audio' ? '🎙 Voice note' : (editing || replyTo).type === 'image' ? '📷 Photo' : '📎 Attachment')}
            </div>
          </div>
          <button className="btn-ghost !w-8 !h-8" onClick={() => { editing ? (onCancelEdit(), setText('')) : onCancelReply(); }} aria-label="Cancel">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {showEmoji && (
        <div className="absolute bottom-full left-2 right-2 md:left-4 md:right-auto md:w-[360px] mb-2 card p-3 shadow-lvl2 animate-fadeUp z-20">
          <div className="grid grid-cols-10 gap-1 max-h-56 overflow-y-auto scroll-thin">
            {EMOJIS.map((em) => (
              <button key={em} className="h-9 rounded-lg hover:bg-soft text-xl" onClick={() => insertEmoji(em)}>{em}</button>
            ))}
          </div>
        </div>
      )}

      {showAttach && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowAttach(false)} />
          <div className="absolute bottom-full left-2 md:left-4 mb-2 card p-2 shadow-lvl2 animate-fadeUp z-20 grid grid-cols-2 gap-1 w-[280px]">
            {[
              ['photo_library', 'Photos & videos', () => mediaInput.current.click()],
              ['photo_camera', 'Camera', () => camInput.current.click()],
              ['description', 'Document', () => docInput.current.click()],
              ['location_on', 'Location', shareLocation],
            ].map(([icon, label, fn]) => (
              <button key={label} onClick={fn} className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-soft">
                <span className="w-11 h-11 rounded-full bg-gold-soft text-gold-ink flex items-center justify-center"><Icon name={icon} /></span>
                <span className="text-[12px] text-ink/80">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { chooseFiles(e.target.files, 'media'); e.target.value = ''; }} />
      <input ref={camInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { chooseFiles(e.target.files, 'media'); e.target.value = ''; }} />
      <input ref={docInput} type="file" multiple hidden onChange={(e) => { chooseFiles(e.target.files, 'doc'); e.target.value = ''; }} />

      {rec ? (
        <div className="flex items-center gap-3 h-[52px] px-2">
          <button className="btn-ghost !text-danger" onClick={() => stopRecording(true)} aria-label="Cancel recording">
            <Icon name="delete" />
          </button>
          <div className="flex-1 flex items-center gap-3 h-12 px-4 rounded-full bg-card border hairline">
            <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
            <span className="tnum text-sm text-ink">{duration(rec.seconds)}</span>
            <span className="text-sm text-muted truncate">Recording voice note…</span>
          </div>
          <button
            className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lvl2 active:scale-95"
            onClick={() => stopRecording(false)}
            aria-label="Send voice note"
          >
            <Icon name="arrow_upward" size={24} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 md:gap-2">
          {!editing && (
            <button
              className={`w-11 h-11 mb-[3px] rounded-full flex items-center justify-center shrink-0 transition ${showAttach ? 'bg-gold-soft text-gold-ink rotate-45' : 'bg-soft text-ink/70 hover:text-ink'}`}
              onClick={() => { setShowAttach((s) => !s); setShowEmoji(false); }}
              aria-label="Attach"
            >
              <Icon name="add" size={24} />
            </button>
          )}
          <div className="flex-1 min-w-0 flex items-end rounded-[24px] bg-card border hairline shadow-lvl1 focus-within:border-gold/60 transition">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => { setText(e.target.value); signalTyping(e.target.value); }}
              onKeyDown={onKey}
              placeholder={editing ? 'Edit your message' : 'Compose a message'}
              className="flex-1 min-w-0 resize-none bg-transparent outline-none px-4 py-3 text-[15px] leading-6 max-h-40 placeholder:text-muted/70 scroll-thin"
            />
            <button
              className={`w-10 h-10 m-1 rounded-full flex items-center justify-center shrink-0 ${showEmoji ? 'text-gold-ink' : 'text-muted hover:text-gold-ink'}`}
              onClick={() => { setShowEmoji((s) => !s); setShowAttach(false); }}
              aria-label="Emoji"
            >
              <Icon name="sentiment_satisfied" />
            </button>
          </div>
          {text.trim() || editing ? (
            <button
              className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-lvl2 active:scale-95"
              onClick={send}
              aria-label={editing ? 'Save' : 'Send'}
            >
              <Icon name={editing ? 'check' : 'arrow_upward'} size={24} />
            </button>
          ) : (
            <button
              className="w-12 h-12 rounded-full bg-soft text-gold-ink flex items-center justify-center shrink-0 hover:bg-gold-soft active:scale-95"
              onClick={startRecording}
              aria-label="Record voice note"
            >
              <Icon name="mic" size={24} />
            </button>
          )}
        </div>
      )}

      <Modal open={!!pending} onClose={() => setPending(null)} title={pending?.files.length > 1 ? `Send ${pending.files.length} items` : 'Send attachment'}>
        {pending && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {pending.files.map((f, i) => (
                <div key={i} className={`rounded-xl overflow-hidden bg-soft ${pending.files.length === 1 ? 'col-span-2' : ''}`}>
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt="" className="w-full max-h-72 object-contain" />
                  ) : f.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(f)} className="w-full max-h-72" controls playsInline />
                  ) : (
                    <div className="p-4 text-sm flex items-center gap-2"><Icon name="description" /> {f.name}</div>
                  )}
                </div>
              ))}
            </div>
            <input
              className="field"
              placeholder="Add a caption…"
              value={pending.caption}
              autoFocus
              onChange={(e) => setPending((p) => ({ ...p, caption: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && sendPending()}
            />
            <button className="btn-primary w-full mt-4" onClick={sendPending}>
              <Icon name="send" size={20} /> Send
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
