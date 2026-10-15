import { fileUrl } from './api.js';

const W = 480;
const MAX_H = 640;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image.'));
    img.src = src;
  });
}

function loadVideoFrame(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const fail = () => reject(new Error('Could not read the video.'));
    v.onerror = fail;
    v.onloadeddata = () => { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); };
    v.onseeked = () => resolve(v);
    setTimeout(fail, 8000);
    v.src = src;
  });
}

// Draw `src` (image or video element) cropped to fill a W x H card
function drawCover(ctx, src, sw, sh, h) {
  const scale = Math.max(W / sw, h / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(src, (W - dw) / 2, (h - dh) / 2, dw, dh);
}

// Make a small JPEG "screenshot" of a Moment's photo or video, so the reply can show it
// even after the Moment has faded. Text moments need no preview (the card is drawn from the text).
export async function makeMomentPreview(moment) {
  if (!moment?.file?.id || moment.type === 'text') return null;
  const url = fileUrl(moment.file.id);
  let el, sw, sh;
  if (moment.type === 'image') {
    el = await loadImage(url);
    sw = el.naturalWidth; sh = el.naturalHeight;
  } else {
    el = await loadVideoFrame(url);
    sw = el.videoWidth; sh = el.videoHeight;
  }
  if (!sw || !sh) throw new Error('Empty preview.');
  const h = Math.round(Math.min(MAX_H, Math.max(W * 0.75, (W * sh) / sw)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(0, 0, W, h);
  drawCover(ctx, el, sw, sh, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Preview failed.'))), 'image/jpeg', 0.8);
  });
}
