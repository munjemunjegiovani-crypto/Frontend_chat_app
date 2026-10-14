// Small per-device preferences kept in localStorage
const KEY = 'gochat.prefs';
const defaults = {
  theme: 'system', // light | dark | system
  textScale: 'medium', // small | medium | large
  paper: 'vellum', // vellum | parchment | grain
  wax: 'navy', // navy | forest | burgundy
  notifications: true,
  sounds: true,
};

export function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const theme = localStorage.getItem('gochat.theme') || saved.theme || defaults.theme;
    return { ...defaults, ...saved, theme };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.setItem('gochat.theme', p.theme);
  } catch { /* ignore */ }
}

export function applyPrefs(p) {
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.classList.remove('wax-forest', 'wax-burgundy', 'text-scale-small', 'text-scale-large');
  if (p.wax !== 'navy') root.classList.add(`wax-${p.wax}`);
  if (p.textScale !== 'medium') root.classList.add(`text-scale-${p.textScale}`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0E1420' : '#FAF7F2');
}
