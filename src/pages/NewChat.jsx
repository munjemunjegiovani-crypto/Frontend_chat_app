import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Icon, PaneHeader, SearchField, Spinner } from '../components/ui.jsx';

export function useUserSearch(q) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return { results, loading };
}

export default function NewChat() {
  const navigate = useNavigate();
  const { upsertConversation, toast, me } = useApp();
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState(null);
  const { results, loading } = useUserSearch(q);

  const open = async (u) => {
    setOpening(u.id);
    try {
      const conv = await api('/conversations/direct', { method: 'POST', body: { userId: u.id } });
      upsertConversation(conv);
      navigate(`/chat/${conv.id}`, { replace: true });
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setOpening(null);
    }
  };

  const invite = async () => {
    const text = `Join me on Gochat — a classic, private messenger. Sign up and find me as @${me.username}: ${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Gochat', text });
      else { await navigator.clipboard.writeText(text); toast('Invite copied — paste it to your friends'); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title="New conversation" eyebrow="Compose" back="/" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <SearchField value={q} onChange={setQ} placeholder="Search by name, @username or email" autoFocus />
        <div className="card mt-4 overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
          {[
            ['group_add', 'New group', 'Gather several people in one chat', () => navigate('/new-group')],
            ['hub', 'New channel', 'Broadcast posts to your followers', () => navigate('/channels/new')],
            ['share', 'Invite friends to Gochat', 'Share a link to the app', invite],
          ].map(([icon, title, sub, fn]) => (
            <button key={title} onClick={fn} className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-soft/60">
              <span className="w-11 h-11 rounded-full bg-gold-soft text-gold-ink flex items-center justify-center"><Icon name={icon} /></span>
              <span className="flex-1">
                <span className="block font-medium text-ink">{title}</span>
                <span className="block text-xs text-muted">{sub}</span>
              </span>
              <Icon name="chevron_right" size={20} className="text-muted" />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1 mt-6 mb-2">
          <span className="eyebrow">{q ? 'People on Gochat' : 'Your contacts'}</span>
          {loading && <Spinner size={16} />}
        </div>
        <div className="card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
          {results.map((u) => (
            <button key={u.id} onClick={() => open(u)} disabled={opening === u.id} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-soft/60">
              <Avatar id={u.avatarId} name={u.name} size={46} online={u.online} />
              <span className="flex-1 min-w-0">
                <span className="block font-serif text-lg text-ink truncate">{u.name}</span>
                <span className="block text-xs text-muted truncate">@{u.username} · {u.bio}</span>
              </span>
              {opening === u.id ? <Spinner size={18} /> : <Icon name="chat_bubble_outline" size={20} className="text-gold-ink" />}
            </button>
          ))}
          {!loading && !results.length && (
            <div className="px-6 py-10 text-center">
              <Icon name="person_search" size={36} className="text-gold-ink/70" />
              <p className="text-sm text-muted mt-2">
                {q ? `No one found for “${q}”. Ask your friend for their @username.` : 'Search for friends by name or @username to start chatting.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
