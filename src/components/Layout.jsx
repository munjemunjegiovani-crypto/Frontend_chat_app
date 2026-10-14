import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Badge, Icon, Logo } from './ui.jsx';

const NAV = [
  { to: '/', icon: 'chat_bubble', label: 'Chats', match: (p) => p === '/' || /^\/(chat|user|new|join)/.test(p) },
  { to: '/channels', icon: 'hub', label: 'Channels', match: (p) => /^\/(channels|posts|activity)/.test(p) },
  { to: '/calls', icon: 'call', label: 'Calls', match: (p) => p.startsWith('/calls') },
  { to: '/moments', icon: 'auto_awesome', label: 'Moments', match: (p) => p.startsWith('/moments') },
  { to: '/settings', icon: 'tune', label: 'Settings', match: (p) => p.startsWith('/settings') },
];

function useBadges() {
  const { totalUnread, channelUnread, notifCount } = useApp();
  return { '/': totalUnread, '/channels': channelUnread + notifCount };
}

function NavRail() {
  const { pathname } = useLocation();
  const { me } = useApp();
  const badges = useBadges();
  const navigate = useNavigate();
  return (
    <nav className="hidden md:flex flex-col items-center w-[84px] shrink-0 py-4 gap-1 bg-[#14213D] dark:bg-[#0A0F19] text-[#C9C3B5] border-r border-[#C9A86A]/15">
      <button onClick={() => navigate('/')} className="mb-5" aria-label="Gochat home">
        <Logo size={44} className="!shadow-none ring-1 ring-[#C9A86A]/40" />
      </button>
      {NAV.map((n) => {
        const active = n.match(pathname);
        return (
          <NavLink
            key={n.to}
            to={n.to}
            className={`relative w-[68px] py-2.5 rounded-xl flex flex-col items-center gap-1 transition ${
              active ? 'bg-[#C9A86A]/15 text-[#E5C281]' : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon name={n.icon} fill={active} size={24} />
            <span className="text-[11px] font-medium tracking-wide">{n.label}</span>
            {badges[n.to] ? <Badge count={badges[n.to]} className="absolute top-1 right-2" /> : null}
            {active && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-[#C9A86A]" />}
          </NavLink>
        );
      })}
      <div className="flex-1" />
      <button onClick={() => navigate('/settings/profile')} aria-label="Your profile" className="rounded-full ring-1 ring-[#C9A86A]/40">
        <Avatar id={me?.avatarId} name={me?.name} size={42} />
      </button>
    </nav>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const badges = useBadges();
  return (
    <nav className="md:hidden shrink-0 bg-card/95 backdrop-blur-xl border-t hairline pb-safe">
      <div className="h-[68px] flex items-stretch justify-around px-1">
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <NavLink key={n.to} to={n.to} className="relative flex-1 flex flex-col items-center justify-center gap-1">
              <span className={`w-14 h-8 rounded-full flex items-center justify-center transition ${active ? 'bg-gold-soft text-gold-ink' : 'text-muted'}`}>
                <Icon name={n.icon} fill={active} size={23} />
              </span>
              <span className={`text-[11px] font-medium ${active ? 'text-ink' : 'text-muted'}`}>{n.label}</span>
              {badges[n.to] ? <Badge count={badges[n.to]} className="absolute top-1.5 left-1/2 ml-2" /> : null}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function ConnectionBar() {
  const { connected } = useApp();
  if (connected) return null;
  return (
    <div className="shrink-0 flex items-center justify-center gap-2 py-1.5 text-xs bg-gold-soft text-gold-ink">
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
      Connecting to Gochat…
    </div>
  );
}

export default function Section({ list, detail, showDetail = false, immersive = false }) {
  return (
    <div className="h-[100dvh] flex overflow-hidden bg-canvas">
      <NavRail />
      <aside
        className={`${showDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] lg:w-[390px] shrink-0 md:border-r hairline bg-canvas min-h-0`}
      >
        <ConnectionBar />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">{list}</div>
        <BottomNav />
      </aside>
      <main className={`${showDetail ? 'flex' : 'hidden md:flex'} ${immersive ? 'bg-[#0B1120]' : ''} flex-1 min-w-0 min-h-0 flex-col relative`}>
        {showDetail && <div className="md:hidden"><ConnectionBar /></div>}
        {detail}
      </main>
    </div>
  );
}
