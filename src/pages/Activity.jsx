import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { Avatar, Icon, PaneHeader, Spinner } from '../components/ui.jsx';
import { ago } from '../lib/format.js';

const ICONS = { comment: 'chat_bubble', reply: 'reply', reaction: 'favorite', follow: 'person_add' };

export default function Activity() {
  const navigate = useNavigate();
  const { setNotifCount } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => {
    api('/notifications').then((n) => {
      setItems(n);
      api('/notifications/read', { method: 'POST' }).then(() => setNotifCount(0)).catch(() => {});
    }).catch(() => setItems([]));
  }, [setNotifCount]);
  useSocketEvent('notification', (n) => {
    setItems((list) => [{ ...n, read: true }, ...(list || [])]);
    api('/notifications/read', { method: 'POST' }).then(() => setNotifCount(0)).catch(() => {});
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title="Activity" eyebrow="Inbox" back="/channels" />
      <div className="max-w-2xl mx-auto px-4 py-5">
        {!items ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length ? (
          <div className="card overflow-hidden divide-y divide-[rgb(var(--line)/0.15)]">
            {items.map((n) => (
              <button key={n.id} onClick={() => navigate(n.postId ? `/posts/${n.postId}` : `/channels/${n.channelId}`)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-soft/60 ${!n.read ? 'bg-gold-soft/40' : ''}`}>
                <div className="relative">
                  <Avatar id={n.actor?.avatarId} name={n.actor?.name || ''} size={44} />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold text-[#0E1420] flex items-center justify-center border-2 border-card">
                    <Icon name={ICONS[n.type] || 'notifications'} fill size={13} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] leading-6 text-ink">{n.text}</p>
                  <p className="text-xs text-muted mt-0.5">{ago(n.createdAt)}{n.channelName ? ` · ${n.channelName}` : ''}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-gold mt-2" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Icon name="notifications" size={40} className="text-gold-ink/70" />
            <p className="font-serif text-xl text-ink mt-2">All quiet</p>
            <p className="text-sm text-muted mt-1">When someone follows your channel, reacts or comments on your posts, it lands here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
