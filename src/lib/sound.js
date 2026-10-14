// Gentle sounds generated with the Web Audio API (no audio files needed)
let ctx;
const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

function tone(freq, start, dur, gain = 0.08, type = 'sine') {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export function chime() {
  tone(880, 0, 0.35, 0.06);
  tone(1318.5, 0.09, 0.45, 0.05);
}

export function sentTick() {
  tone(1200, 0, 0.08, 0.025, 'triangle');
}

let ringTimer = null;
export function startRing(outgoing = false) {
  stopRing();
  const play = () => {
    if (outgoing) {
      tone(440, 0, 0.9, 0.04);
      tone(480, 0, 0.9, 0.04);
    } else {
      tone(659, 0, 0.25, 0.08);
      tone(784, 0.3, 0.25, 0.08);
      tone(988, 0.6, 0.4, 0.08);
    }
  };
  play();
  ringTimer = setInterval(play, outgoing ? 3000 : 2200);
}
export function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
}

export function unlockAudio() {
  getCtx();
}
