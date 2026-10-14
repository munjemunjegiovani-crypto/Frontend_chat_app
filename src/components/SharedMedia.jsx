import { useEffect, useState } from 'react';
import { api, fileUrl } from '../lib/api.js';
import { fileSize, listTime } from '../lib/format.js';
import { Icon } from './ui.jsx';
import Lightbox from './Lightbox.jsx';
import VoicePlayer from './VoicePlayer.jsx';

export default function SharedMedia({ conversationId }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState('media');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!conversationId) { setItems([]); return; }
    api(`/conversations/${conversationId}/media`).then(setItems).catch(() => setItems([]));
  }, [conversationId]);

  const media = (items || []).filter((m) => m.type === 'image' || m.type === 'video');
  const docs = (items || []).filter((m) => m.type === 'file');
  const voice = (items || []).filter((m) => m.type === 'audio');
  const tabs = [['media', `Media (${media.length})`], ['docs', `Docs (${docs.length})`], ['voice', `Voice (${voice.length})`]];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-xl text-ink">Shared archive</h3>
        <span className="text-xs text-muted">{items ? `${items.length} item${items.length === 1 ? '' : 's'}` : '…'}</span>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip !h-8 ${tab === k ? 'chip-active' : ''}`}>{l}</button>
        ))}
      </div>
      {tab === 'media' && (
        media.length ? (
          <div className="grid grid-cols-3 gap-1.5">
            {media.map((m) => (
              <button key={m.id} onClick={() => setOpen(m)} className="relative aspect-square rounded-lg overflow-hidden bg-soft">
                {m.type === 'image' ? (
                  <img src={fileUrl(m.file.id)} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <>
                    <video src={fileUrl(m.file.id)} className="w-full h-full object-cover" preload="metadata" muted />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white"><Icon name="play_circle" fill size={32} /></span>
                  </>
                )}
              </button>
            ))}
          </div>
        ) : <p className="text-sm text-muted text-center py-6">No photos or videos yet.</p>
      )}
      {tab === 'docs' && (
        docs.length ? (
          <div className="flex flex-col gap-2">
            {docs.map((m) => (
              <a key={m.id} href={fileUrl(m.file.id, true)} className="flex items-center gap-3 p-3 rounded-xl bg-soft/70 hover:bg-soft">
                <span className="w-10 h-10 rounded-lg bg-gold-soft text-gold-ink flex items-center justify-center"><Icon name="description" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{m.file.name}</span>
                  <span className="block text-xs text-muted">{fileSize(m.file.size)} · {listTime(m.createdAt)}</span>
                </span>
                <Icon name="download" size={20} className="text-muted" />
              </a>
            ))}
          </div>
        ) : <p className="text-sm text-muted text-center py-6">No documents yet.</p>
      )}
      {tab === 'voice' && (
        voice.length ? (
          <div className="flex flex-col gap-2">
            {voice.map((m) => (
              <div key={m.id} className="p-3 rounded-xl bg-soft/70">
                <div className="text-xs text-muted mb-1">{m.sender?.name} · {listTime(m.createdAt)}</div>
                <VoicePlayer fileId={m.file.id} seed={m.id} compact />
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted text-center py-6">No voice notes yet.</p>
      )}
      {open && <Lightbox file={open.file} caption={open.body} onClose={() => setOpen(null)} />}
    </div>
  );
}
