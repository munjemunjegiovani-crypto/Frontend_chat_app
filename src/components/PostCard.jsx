import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../lib/api.js';
import { ago, fileSize, linkify } from '../lib/format.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Icon, Menu } from './ui.jsx';
import Lightbox from './Lightbox.jsx';
import VoicePlayer from './VoicePlayer.jsx';

const POST_REACTIONS = ['❤️', '👍', '🔥', '👏', '😮', '🙏'];

export function PostBody({ text }) {
  return linkify(text).map((p, i) =>
    typeof p === 'string' ? p : <a key={i} href={p.url} target="_blank" rel="noreferrer noopener" className="text-gold-ink underline break-all">{p.url}</a>
  );
}

export default function PostCard({ post, channel, onChange, onDelete, full = false }) {
  const { me, toast } = useApp();
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState(false);
  const [picker, setPicker] = useState(false);

  const counts = Object.values((post.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === me.id) acc[r.emoji].mine = true;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);
  const myReaction = post.reactions?.find((r) => r.userId === me.id)?.emoji;

  const react = async (emoji) => {
    setPicker(false);
    try {
      onChange(await api(`/posts/${post.id}/react`, { method: 'POST', body: { emoji } }));
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: channel?.name, text: post.body.slice(0, 100), url });
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch { /* cancelled */ }
  };

  return (
    <article className="card overflow-hidden animate-fadeUp">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Avatar id={channel?.avatarId} name={channel?.name || ''} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[17px] text-ink truncate">{channel?.name}</div>
          <div className="text-xs text-muted">{ago(post.createdAt)} · <Icon name="visibility" size={13} className="align-[-2px]" /> {post.views}</div>
        </div>
        {channel?.isOwner && (
          <Menu trigger={<button className="btn-ghost" aria-label="Post options"><Icon name="more_horiz" /></button>} items={[
            { icon: 'link', label: 'Copy link', onClick: share },
            { icon: 'delete', label: 'Delete post', danger: true, onClick: onDelete },
          ]} />
        )}
      </header>
      {post.body && (
        <p className={`px-4 pt-3 text-[15px] leading-7 text-ink whitespace-pre-wrap break-words ${!full ? 'line-clamp-[12]' : ''}`}>
          <PostBody text={post.body} />
        </p>
      )}
      {post.file && post.mediaType === 'image' && (
        <button onClick={() => setLightbox(true)} className="block w-full mt-3 bg-soft">
          <img src={fileUrl(post.file.id)} alt="" className="w-full max-h-[520px] object-cover" loading="lazy" />
        </button>
      )}
      {post.file && post.mediaType === 'video' && (
        <video src={fileUrl(post.file.id)} controls playsInline preload="metadata" className="w-full max-h-[520px] mt-3 bg-black" />
      )}
      {post.file && post.mediaType === 'audio' && <div className="px-4 pt-3"><VoicePlayer fileId={post.file.id} seed={post.id} /></div>}
      {post.file && post.mediaType === 'file' && (
        <a href={fileUrl(post.file.id, true)} className="mx-4 mt-3 flex items-center gap-3 p-3 rounded-xl bg-soft">
          <Icon name="description" className="text-gold-ink" /><span className="flex-1 truncate text-sm">{post.file.name}</span><span className="text-xs text-muted">{fileSize(post.file.size)}</span>
        </a>
      )}

      {counts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {counts.map((r) => (
            <button key={r.emoji} onClick={() => react(r.emoji)} className={`h-7 px-2.5 rounded-full text-[13px] flex items-center gap-1 border ${r.mine ? 'bg-gold-soft border-gold/50' : 'bg-soft border-transparent'}`}>
              {r.emoji} <span className="text-muted tnum">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      <footer className="relative flex items-center gap-1 px-2 py-2 mt-2 border-t hairline">
        <button onClick={() => setPicker((p) => !p)} className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-sm hover:bg-soft ${myReaction ? 'text-gold-ink' : 'text-muted'}`}>
          {myReaction ? <span className="text-lg">{myReaction}</span> : <Icon name="add_reaction" size={20} />} React
        </button>
        <button onClick={() => !full && navigate(`/posts/${post.id}`)} className="flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-sm text-muted hover:bg-soft">
          <Icon name="chat_bubble_outline" size={20} /> {post.commentCount ? `${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}` : 'Comment'}
        </button>
        <button onClick={share} className="flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-sm text-muted hover:bg-soft">
          <Icon name="ios_share" size={20} /> Share
        </button>
        {picker && (
          <div className="absolute bottom-full left-2 mb-1 flex gap-1 p-1.5 rounded-full bg-card border hairline-strong shadow-lvl2 animate-fadeUp z-10">
            {POST_REACTIONS.map((em) => (
              <button key={em} onClick={() => react(em)} className={`w-10 h-10 rounded-full text-xl hover:bg-soft ${myReaction === em ? 'bg-gold-soft' : ''}`}>{em}</button>
            ))}
          </div>
        )}
      </footer>
      {lightbox && <Lightbox file={post.file} caption={post.body} onClose={() => setLightbox(false)} />}
    </article>
  );
}
