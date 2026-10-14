import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Icon, Logo } from '../components/ui.jsx';

export const SECTIONS = [
  ['profile', 'person', 'Profile', 'Name, photo, about'],
  ['appearance', 'palette', 'Appearance', 'Light, dark, text size, chat style'],
  ['privacy', 'lock', 'Privacy', 'Last seen, read receipts, blocked'],
  ['notifications', 'notifications', 'Notifications', 'Alerts and sounds'],
  ['starred', 'star', 'Starred messages', 'Messages you saved'],
  ['blocked', 'block', 'Blocked contacts', 'People who cannot reach you'],
  ['account', 'manage_accounts', 'Account', 'Password, sign out, delete'],
  ['about', 'info', 'About Kova', 'Version and help'],
];

export default function SettingsMenu() {
  const { me, prefs, setPrefs, logout } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dark = document.documentElement.classList.contains('dark');
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl">
        <div className="h-16 px-4 flex items-center gap-3">
          <Logo size={34} className="md:hidden" />
          <div className="flex-1">
            <div className="eyebrow leading-none">Kova</div>
            <h1 className="font-serif text-[24px] leading-8 text-ink">Settings</h1>
          </div>
          <button className="btn-ghost" onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })} aria-label="Toggle dark mode" title="Toggle dark mode">
            <Icon name={dark ? 'light_mode' : 'dark_mode'} />
          </button>
        </div>
      </header>
      <div className="px-3 pb-24 md:pb-6">
        <div className="card p-4 mt-1">
          <div className="flex items-center gap-4">
            <Avatar id={me.avatarId} name={me.name} size={64} ring />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[22px] text-ink truncate">{me.name}</div>
              <div className="text-xs text-muted truncate">@{me.username} · {me.email}</div>
              <div className="text-xs text-gold-ink italic truncate mt-0.5">{me.bio}</div>
            </div>
          </div>
          <button className="btn-outline w-full !h-10 mt-4" onClick={() => navigate('/settings/profile')}><Icon name="edit" size={18} /> Edit profile</button>
        </div>
        <div className="card mt-4 overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
          {SECTIONS.map(([key, icon, title, sub]) => {
            const active = pathname === `/settings/${key}`;
            return (
              <button key={key} onClick={() => navigate(`/settings/${key}`)} className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition ${active ? 'bg-gold-soft/60 dark:bg-gold/10' : 'hover:bg-soft/60'}`}>
                <span className="w-10 h-10 rounded-full bg-soft text-gold-ink flex items-center justify-center"><Icon name={icon} size={20} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{title}</span>
                  <span className="block text-xs text-muted truncate">{sub}</span>
                </span>
                {key === 'appearance' && <span className="text-xs text-muted capitalize">{prefs.theme}</span>}
                <Icon name="chevron_right" size={20} className="text-muted" />
              </button>
            );
          })}
        </div>
        <button className="mt-4 w-full h-12 rounded-xl bg-danger-soft text-danger font-medium flex items-center justify-center gap-2" onClick={logout}>
          <Icon name="logout" size={20} /> Sign out
        </button>
        <p className="text-center font-serif italic text-gold-ink/80 text-[14px] mt-8">“True conversation is an heirloom, treasured in deliberate silence.”</p>
        <p className="text-center eyebrow !text-muted mt-2">Kova · v1.0</p>
      </div>
    </div>
  );
}
