import { useEffect, useMemo, useRef, useState } from 'react';
import { fileUrl } from '../lib/api.js';
import { duration as fmt } from '../lib/format.js';
import { Icon } from './ui.jsx';

// Stop any other voice note when one starts playing
let current = null;

export default function VoicePlayer({ fileId, seed = 1, outgoing = false, compact = false }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const bars = useMemo(() => {
    let x = Number(String(seed).replace(/\D/g, '')) || 7;
    return Array.from({ length: compact ? 18 : 28 }, () => {
      x = (x * 9301 + 49297) % 233280;
      return 0.25 + (x / 233280) * 0.75;
    });
  }, [seed, compact]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return undefined;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setDur(a.duration);
      else {
        // Chrome reports Infinity for recorded webm until we seek to the end
        a.currentTime = 1e7;
        a.addEventListener('timeupdate', function fix() {
          a.removeEventListener('timeupdate', fix);
          setDur(a.duration);
          a.currentTime = 0;
        });
      }
    };
    const onEnd = () => { setPlaying(false); setTime(0); };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onPause);
    a.addEventListener('play', onPlay);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('play', onPlay);
    };
  }, []);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      a.playbackRate = rate;
      a.play().catch(() => {});
    } else a.pause();
  };

  const seek = (e) => {
    const a = ref.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  };

  const progress = dur ? time / dur : 0;
  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (ref.current) ref.current.playbackRate = next;
  };

  return (
    <div className={`flex items-center gap-3 ${compact ? 'min-w-[180px]' : 'min-w-[230px]'}`}>
      <audio ref={ref} src={fileUrl(fileId)} preload="metadata" />
      <button
        onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          outgoing ? 'bg-bubble-out-ink/15 text-bubble-out-ink' : 'bg-[#14213D] text-[#F2EFE9] dark:bg-gold dark:text-[#0E1420]'
        }`}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} fill size={24} />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-[2px] h-8 cursor-pointer" onClick={seek}>
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                i / bars.length < progress
                  ? outgoing ? 'bg-bubble-out-ink' : 'bg-gold-ink dark:bg-gold'
                  : outgoing ? 'bg-bubble-out-ink/35' : 'bg-muted/35'
              }`}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
        <div className={`flex justify-between text-[11px] tnum mt-0.5 ${outgoing ? 'opacity-75' : 'text-muted'}`}>
          <span>{fmt(playing || time ? time : dur)}</span>
        </div>
      </div>
      {!compact && (
        <button onClick={cycleRate} className={`text-[11px] font-semibold px-2 py-1 rounded-md ${outgoing ? 'bg-bubble-out-ink/15' : 'bg-soft text-ink/80'}`}>
          {rate}x
        </button>
      )}
    </div>
  );
}
