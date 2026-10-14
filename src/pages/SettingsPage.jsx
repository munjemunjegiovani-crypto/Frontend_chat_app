import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Confirm, Icon, PaneHeader, Spinner, Toggle, Quote } from '../components/ui.jsx';
import { SECTIONS } from './SettingsMenu.jsx';
import { chime } from '../lib/sound.js';
import { enablePush, disablePush, pushSupported } from '../lib/push.js';
import { listTime, messagePreview } from '../lib/format.js';

function Card({ title, icon, children, sub }) {
  return (
    <section className="card p-5">
      {title && (
        <div className="mb-4">
          <h3 className="font-serif text-[22px] text-ink flex items-center gap-2">{icon && <Icon name={icon} className="text-gold-ink" />}{title}</h3>
          {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function SettingRow({ title, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="font-medium text-ink">{title}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Profile() {
  const { me, setMe, toast } = useApp();
  const [form, setForm] = useState({ name: me.name, username: me.username, bio: me.bio, phone: me.phone || '' });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      setMe(await api('/users/me', { method: 'PATCH', body: form }));
      toast('Profile saved');
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };
  const photo = async (file, remove) => {
    setUploading(true);
    try {
      const avatarId = remove ? null : (await uploadFile(file)).id;
      setMe(await api('/users/me', { method: 'PATCH', body: { avatarId } }));
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setUploading(false);
    }
  };
  return (
    <Card>
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar id={me.avatarId} name={me.name} size={120} ring />
          <button onClick={() => ref.current.click()} className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-gold text-[#0E1420] shadow flex items-center justify-center" aria-label="Change photo">
            {uploading ? <Spinner size={16} /> : <Icon name="photo_camera" size={20} />}
          </button>
          <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && photo(e.target.files[0])} />
        </div>
        {me.avatarId && <button className="text-xs text-muted mt-3 hover:text-danger" onClick={() => photo(null, true)}>Remove photo</button>}
      </div>
      <div className="space-y-4 mt-6">
        <label className="block"><span className="block text-label-md text-ink/80 mb-1.5">Name</span><input className="field" value={form.name} onChange={set('name')} maxLength={60} /></label>
        <label className="block">
          <span className="block text-label-md text-ink/80 mb-1.5">Username</span>
          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input className="field !pl-8" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') }))} maxLength={24} />
          </div>
        </label>
        <label className="block"><span className="block text-label-md text-ink/80 mb-1.5">About</span><input className="field" value={form.bio} onChange={set('bio')} maxLength={160} /></label>
        <label className="block"><span className="block text-label-md text-ink/80 mb-1.5">Phone <span className="text-muted">(optional, only visible to you)</span></span><input className="field" value={form.phone} onChange={set('phone')} maxLength={30} placeholder="+237 6XX XXX XXX" /></label>
        <div className="text-xs text-muted">Email: {me.email}</div>
        <button className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? <Spinner size={16} /> : 'Save profile'}</button>
      </div>
    </Card>
  );
}

function ThemePreview({ dark, label, tag, active, onClick }) {
  return (
    <button onClick={onClick} className={`card p-4 text-left w-full transition ${active ? '!border-gold ring-2 ring-gold/30' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={dark ? 'dark_mode' : 'light_mode'} size={20} className="text-gold-ink" />
        <span className="font-medium text-ink">{label}</span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-gold-soft text-gold-ink font-semibold">{tag}</span>
        {active && <Icon name="check_circle" fill size={20} className="ml-auto text-gold-ink" />}
      </div>
      <div className={`rounded-xl p-3 space-y-2 ${dark ? 'bg-[#0E1420]' : 'bg-[#FAF7F2] border border-[#C9A86A]/20'}`}>
        <div className={`text-[11px] rounded-lg rounded-bl-[3px] px-3 py-2 w-3/4 ${dark ? 'bg-[#182030] text-[#F2EFE9]' : 'bg-white text-[#1F1F1F] border border-[#C9A86A]/25'}`}>Your letter arrived this morning.</div>
        <div className={`text-[11px] rounded-lg rounded-br-[3px] px-3 py-2 w-2/3 ml-auto ${dark ? 'bg-[#C9A86A] text-[#0E1420]' : 'bg-[#14213D] text-[#FAF7F2]'}`}>Read with great pleasure ✓✓</div>
      </div>
    </button>
  );
}

function Appearance() {
  const { prefs, setPrefs } = useApp();
  const Option = ({ k, value, label, icon }) => (
    <button onClick={() => setPrefs({ [k]: value })} className={`flex-1 h-12 rounded-xl text-sm flex items-center justify-center gap-2 transition ${prefs[k] === value ? 'bg-gold-soft text-gold-ink font-semibold ring-1 ring-gold/40' : 'bg-soft text-ink/80 hover:bg-gold/10'}`}>
      {icon && <Icon name={icon} size={18} />}{label}
    </button>
  );
  return (
    <div className="space-y-5">
      <Card title="Appearance & atmosphere" icon="palette" sub="Choose the ambience of your correspondence.">
        <div className="grid sm:grid-cols-2 gap-3">
          <ThemePreview label="Warm Ivory" tag="Light" active={prefs.theme === 'light'} onClick={() => setPrefs({ theme: 'light' })} />
          <ThemePreview dark label="Midnight Slate" tag="Dark" active={prefs.theme === 'dark'} onClick={() => setPrefs({ theme: 'dark' })} />
        </div>
        <button onClick={() => setPrefs({ theme: 'system' })} className={`card w-full mt-3 p-4 flex items-center gap-3 text-left ${prefs.theme === 'system' ? '!border-gold ring-2 ring-gold/30' : ''}`}>
          <span className="w-10 h-10 rounded-full bg-soft text-gold-ink flex items-center justify-center"><Icon name="brightness_auto" /></span>
          <span className="flex-1"><span className="block font-medium text-ink">System default</span><span className="block text-xs text-muted">Follow your device’s light or dark setting</span></span>
          {prefs.theme === 'system' && <Icon name="check_circle" fill className="text-gold-ink" />}
        </button>
      </Card>
      <Card title="Message text size" icon="format_size">
        <div className="flex gap-2">
          <Option k="textScale" value="small" label="Petite" />
          <Option k="textScale" value="medium" label="Classic" />
          <Option k="textScale" value="large" label="Grand" />
        </div>
      </Card>
      <Card title="Chat background" icon="texture">
        <div className="flex gap-2">
          <Option k="paper" value="vellum" label="Vellum" icon="crop_square" />
          <Option k="paper" value="parchment" label="Parchment" icon="grain" />
          <Option k="paper" value="grain" label="Linen" icon="texture" />
        </div>
      </Card>
      <Card title="Sent message colour" icon="water_drop">
        <div className="flex gap-3">
          {[['navy', '#14213D', 'Midnight'], ['forest', '#1F4D3A', 'Forest'], ['burgundy', '#6B1E2E', 'Burgundy']].map(([v, c, l]) => (
            <button key={v} onClick={() => setPrefs({ wax: v })} className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl ${prefs.wax === v ? 'bg-gold-soft ring-1 ring-gold/40' : 'bg-soft'}`}>
              <span className="w-9 h-9 rounded-full ring-2 ring-white/60 shadow" style={{ background: c }} />
              <span className="text-xs text-ink/80">{l}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">In dark mode, sent messages use champagne gold unless you pick Forest or Burgundy.</p>
      </Card>
    </div>
  );
}

function Privacy() {
  const { me, setMe, toast } = useApp();
  const navigate = useNavigate();
  const update = async (patch) => {
    try { setMe(await api('/users/me', { method: 'PATCH', body: patch })); } catch (e) { toast(e.message, { error: true }); }
  };
  return (
    <Card title="Privacy & discretion" icon="lock">
      <div className="divide-y divide-[rgb(var(--line)/0.15)]">
        <SettingRow title="Show last seen & online" sub="If off, others see “last seen recently”">
          <Toggle checked={me.showLastSeen} onChange={(v) => update({ showLastSeen: v })} />
        </SettingRow>
        <SettingRow title="Read receipts" sub="If off, others won’t see gold ticks when you read their messages">
          <Toggle checked={me.readReceipts} onChange={(v) => update({ readReceipts: v })} />
        </SettingRow>
        <button className="w-full flex items-center justify-between py-3 text-left" onClick={() => navigate('/settings/blocked')}>
          <span><span className="block font-medium text-ink">Blocked contacts</span><span className="block text-xs text-muted">Manage people you’ve blocked</span></span>
          <Icon name="chevron_right" className="text-muted" />
        </button>
      </div>
    </Card>
  );
}

function Notifications() {
  const { prefs, setPrefs, toast } = useApp();
  const supported = 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  const ask = async () => {
    if (!supported) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') {
      setPrefs({ notifications: true });
      const ok = await enablePush();
      toast(ok ? 'Notifications are on — even when Kova is closed' : 'Notifications are on while Kova is open', { icon: 'notifications_active' });
    }
    else toast('Notifications were blocked. You can allow them in your browser’s site settings.', { error: true });
  };
  return (
    <Card title="Notifications & chimes" icon="notifications">
      <div className="divide-y divide-[rgb(var(--line)/0.15)]">
        <SettingRow title="Desktop & phone alerts" sub={perm === 'granted' ? (pushSupported() ? 'You will be alerted even when Kova is closed' : 'Shown while Kova is open in the background') : perm === 'denied' ? 'Blocked in your browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Allow Kova to show alerts'}>
          {perm === 'granted' ? <Toggle checked={prefs.notifications} onChange={(v) => { setPrefs({ notifications: v }); if (v) enablePush(); else disablePush(); }} /> :
            <button className="btn-outline !h-9 !px-3" onClick={ask} disabled={perm === 'unsupported' || perm === 'denied'}>Allow</button>}
        </SettingRow>
        <SettingRow title="Message chime" sub="A soft sound for new messages">
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={chime} aria-label="Play chime"><Icon name="play_circle" /></button>
            <Toggle checked={prefs.sounds} onChange={(v) => setPrefs({ sounds: v })} />
          </div>
        </SettingRow>
      </div>
      <p className="text-xs text-muted mt-4 leading-5">Tip: on phones, add Kova to your home screen (browser menu → “Add to Home screen”) so it opens like an app. On iPhone, notifications only work after adding Kova to the home screen (iOS 16.4 or later).</p>
    </Card>
  );
}

function Starred() {
  const [items, setItems] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { api('/messages/starred').then(setItems).catch(() => setItems([])); }, []);
  return (
    <Card title="Starred messages" icon="star">
      {!items ? <div className="flex justify-center py-6"><Spinner /></div> : items.length ? (
        <div className="space-y-2">
          {items.map((m) => (
            <button key={m.id} onClick={() => navigate(`/chat/${m.conversationId}`)} className="w-full text-left p-3 rounded-xl bg-soft/70 hover:bg-soft">
              <div className="flex items-center gap-2 mb-1">
                <Avatar id={m.sender?.avatarId} name={m.sender?.name || ''} size={24} />
                <span className="text-sm font-medium text-ink">{m.sender?.name}</span>
                <span className="text-xs text-muted ml-auto">{listTime(m.createdAt)}</span>
              </div>
              <p className="text-sm text-ink/90 line-clamp-3">{messagePreview(m)}</p>
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-muted text-center py-6">Long-press (or right-click) a message and choose Star to keep it here.</p>}
    </Card>
  );
}

function Blocked() {
  const [items, setItems] = useState(null);
  const { toast } = useApp();
  const load = () => api('/users/me/blocked').then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  return (
    <Card title="Blocked contacts" icon="block">
      {!items ? <div className="flex justify-center py-6"><Spinner /></div> : items.length ? (
        <div className="space-y-2">
          {items.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-2">
              <Avatar id={u.avatarId} name={u.name} size={40} />
              <span className="flex-1"><span className="block font-medium text-ink">{u.name}</span><span className="block text-xs text-muted">@{u.username}</span></span>
              <button className="btn-outline !h-9 !px-3" onClick={async () => { await api(`/users/${u.id}/block`, { method: 'DELETE' }); toast(`${u.name} unblocked`); load(); }}>Unblock</button>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted text-center py-6">You haven’t blocked anyone.</p>}
    </Card>
  );
}

function Account() {
  const { logout, toast } = useApp();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const change = async () => {
    setBusy(true);
    try {
      await api('/users/me/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <Card title="Change password" icon="key">
        <div className="space-y-3">
          <input className="field" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
          <input className="field" type="password" placeholder="New password (min. 6 characters)" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
          <button className="btn-primary w-full" disabled={busy || !pw.current || pw.next.length < 6} onClick={change}>{busy ? <Spinner size={16} /> : 'Update password'}</button>
        </div>
      </Card>
      <Card title="Session" icon="devices">
        <button className="btn-outline w-full" onClick={logout}><Icon name="logout" size={18} /> Sign out of this device</button>
      </Card>
      <Card title="Delete account" icon="warning">
        <p className="text-sm text-muted mb-4">This permanently deletes your profile, messages you sent, your channels and moments. It cannot be undone.</p>
        <button className="w-full h-11 rounded-lg bg-danger-soft text-danger font-medium" onClick={() => setDel(true)}>Delete my account</button>
      </Card>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete your account?" text="Enter your password to confirm." confirmLabel="Delete forever" danger
        onConfirm={async () => {
          await api('/users/me', { method: 'DELETE', body: { password: delPw } }); logout();
        }}>
        <input className="field mb-4" type="password" placeholder="Password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
      </Confirm>
    </div>
  );
}

function About() {
  const { me, toast } = useApp();
  const share = async () => {
    const text = `Join me on Kova — find me as @${me.username}: ${window.location.origin}`;
    try { if (navigator.share) await navigator.share({ title: 'Kova', text }); else { await navigator.clipboard.writeText(text); toast('Invite copied'); } } catch { /* ignore */ }
  };
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col items-center text-center py-4">
          <img src="/icon-192.png" alt="" className="w-20 h-20 rounded-[22%] shadow-lvl2" />
          <h2 className="font-serif text-3xl tracking-[0.08em] text-ink mt-4">KOVA</h2>
          <p className="font-serif italic text-gold-ink text-lg">Speak freely, stay close</p>
          <p className="text-xs text-muted mt-2">Version 1.0</p>
        </div>
      </Card>
      <Card title="How Kova works" icon="help">
        <ul className="space-y-3 text-sm text-ink/90">
          {[
            ['chat_bubble', 'Find friends by their @username and chat in real time — with photos, videos, documents and voice notes.'],
            ['groups', 'Create groups, share an invite link, and make other members admins.'],
            ['hub', 'Start a channel to publish posts. Followers react and comment; comments arrive in your Activity inbox.'],
            ['call', 'Voice and video calls connect your two devices directly. Both people need Kova open.'],
            ['auto_awesome', 'Moments are shared with people you chat with and vanish after 24 hours.'],
          ].map(([i, t]) => <li key={t} className="flex gap-3"><Icon name={i} size={20} className="text-gold-ink mt-0.5" /> <span>{t}</span></li>)}
        </ul>
        <button className="btn-primary w-full mt-5" onClick={share}><Icon name="share" size={18} /> Invite friends</button>
      </Card>
      <Quote cite="Kova">Words composed with care endure like bronze.</Quote>
    </div>
  );
}

const VIEWS = { profile: Profile, appearance: Appearance, privacy: Privacy, notifications: Notifications, starred: Starred, blocked: Blocked, account: Account, about: About };

export default function SettingsPage({ section: forced }) {
  const params = useParams();
  const section = forced || params.section;
  const View = VIEWS[section] || Appearance;
  const meta = SECTIONS.find((s) => s[0] === section) || SECTIONS[1];
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title={meta[2]} eyebrow="Settings" back="/settings" />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <View />
      </div>
    </div>
  );
}
