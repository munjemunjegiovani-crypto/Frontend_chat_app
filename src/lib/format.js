const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function timeOf(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function listTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  if (sameDay(d, now)) return timeOf(d);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function dayLabel(date) {
  const d = new Date(date);
  const now = new Date();
  if (sameDay(d, now)) return `Today, ${d.toLocaleDateString([], { month: 'long', day: 'numeric' })}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export const isSameDay = (a, b) => sameDay(new Date(a), new Date(b));

export function lastSeen(user) {
  if (!user) return '';
  if (user.online) return 'Online';
  if (!user.lastSeenAt) return 'Last seen recently';
  const d = new Date(user.lastSeenAt);
  const now = new Date();
  const mins = Math.round((now - d) / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins} min ago`;
  if (sameDay(d, now)) return `Last seen today at ${timeOf(d)}`;
  return `Last seen ${listTime(d).toLowerCase() === 'yesterday' ? 'yesterday' : listTime(d)} at ${timeOf(d)}`;
}

export function ago(date) {
  const s = Math.round((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function duration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function messagePreview(m) {
  if (!m) return '';
  if (m.deletedAt) return 'This message was deleted';
  switch (m.type) {
    case 'image': return m.body ? `📷 ${m.body}` : '📷 Photo';
    case 'video': return m.body ? `🎬 ${m.body}` : '🎬 Video';
    case 'audio': return '🎙 Voice note';
    case 'file': return `📄 ${m.file?.name || 'Document'}`;
    default: return m.body;
  }
}

// Turn URLs into links, safely
export function linkify(text) {
  const parts = [];
  const re = /(https?:\/\/[^\s]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ url: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
