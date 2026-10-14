import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { Avatar, Confirm, EmptyState, Icon, Menu, Spinner } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import { refreshChannels } from './ChannelList.jsx';

function PostComposer({ channel, onPosted }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);
  const publish = async () => {
    setBusy(true);
    try {
      let fileId = null;
      if (file) fileId = (await uploadFile(file.file, { onProgress: setProgress })).id;
      const post = await api(`/channels/${channel.id}/posts`, { method: 'POST', body: { body: text, fileId } });
      onPosted(post);
      setText('');
      setFile(null);
      toast('Published to your followers', { icon: 'campaign' });
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };
  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar id={channel.avatarId} name={channel.name} size={40} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Share an update with ${channel.followerCount} follower${channel.followerCount === 1 ? '' : 's'}…`}
          className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-6 min-h-[64px] placeholder:text-muted/70"
          maxLength={5000}
        />
      </div>
      {file && (
        <div className="relative mt-3 rounded-xl overflow-hidden bg-soft">
          {file.file.type.startsWith('image/') ? <img src={file.url} alt="" className="w-full max-h-72 object-cover" /> :
            file.file.type.startsWith('video/') ? <video src={file.url} className="w-full max-h-72" controls /> :
              <div className="p-4 text-sm flex items-center gap-2"><Icon name="description" /> {file.file.name}</div>}
          <button onClick={() => setFile(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove"><Icon name="close" size={18} /></button>
          {busy && progress > 0 && <div className="absolute bottom-0 left-0 h-1 bg-gold transition-all" style={{ width: `${progress * 100}%` }} />}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t hairline">
        <button className="btn-ghost !text-gold-ink" onClick={() => ref.current.click()} aria-label="Attach photo or video"><Icon name="add_photo_alternate" /></button>
        <input ref={ref} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" hidden onChange={(e) => { const f = e.target.files[0]; if (f) setFile({ file: f, url: URL.createObjectURL(f) }); e.target.value = ''; }} />
        <span className="flex-1 text-xs text-muted">{text.length > 4500 ? `${5000 - text.length} left` : ''}</span>
        <button className="btn-primary !h-10" disabled={busy || (!text.trim() && !file)} onClick={publish}>
          {busy ? <Spinner size={16} /> : <>Publish <Icon name="send" size={18} /></>}
        </button>
      </div>
    </div>
  );
}

export default function ChannelPage() {
  const { id } = useParams();
  const channelId = Number(id);
  const navigate = useNavigate();
  const { toast, setChannelUnread, refreshChannelUnread } = useApp();
  const [channel, setChannel] = useState(null);
  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    setChannel(null);
    setPosts(null);
    api(`/channels/${channelId}`).then(setChannel).catch((e) => setError(e.message));
    api(`/channels/${channelId}/posts`).then((r) => {
      setPosts(r.posts);
      setHasMore(r.hasMore);
      refreshChannels();
      refreshChannelUnread();
    }).catch(() => setPosts([]));
  }, [channelId, refreshChannelUnread]);

  useSocketEvent('channel:post', ({ channelId: cid, post }) => {
    if (cid !== channelId) return;
    setPosts((p) => (p && !p.some((x) => x.id === post.id) ? [post, ...p] : p));
    setChannelUnread((c) => Math.max(0, c - 1));
    api(`/channels/${channelId}/posts`).catch(() => {});
  });
  useSocketEvent('channel:post:updated', (post) => {
    if (post.channelId !== channelId) return;
    setPosts((p) => p?.map((x) => (x.id === post.id ? post : x)));
  });
  useSocketEvent('post:comment', ({ postId }) => {
    setPosts((p) => p?.map((x) => (x.id === postId ? { ...x, commentCount: x.commentCount + 1 } : x)));
  });

  if (error) return <EmptyState icon="hub" title="Channel unavailable" text={error} action={<button className="btn-outline" onClick={() => navigate('/channels')}>All channels</button>} />;
  if (!channel) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;

  const toggleFollow = async () => {
    setBusy(true);
    try {
      const c = await api(`/channels/${channelId}/follow`, { method: channel.following ? 'DELETE' : 'POST' });
      setChannel(c);
      refreshChannels();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    const last = posts[posts.length - 1];
    const r = await api(`/channels/${channelId}/posts?before=${last.id}`);
    setPosts((p) => [...p, ...r.posts]);
    setHasMore(r.hasMore);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <header className="sticky top-0 z-20 pt-safe bg-canvas/90 backdrop-blur-xl border-b hairline">
        <div className="h-16 px-2 md:px-4 flex items-center gap-2">
          <button className="btn-ghost md:hidden" onClick={() => navigate('/channels')} aria-label="Back"><Icon name="arrow_back_ios_new" size={20} /></button>
          <Avatar id={channel.avatarId} name={channel.name} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[19px] leading-6 text-ink truncate">{channel.name}</div>
            <div className="text-xs text-muted">{channel.followerCount} follower{channel.followerCount === 1 ? '' : 's'}</div>
          </div>
          {channel.isOwner ? (
            <Menu trigger={<button className="btn-ghost" aria-label="Channel options"><Icon name="more_vert" /></button>} items={[
              { icon: 'edit', label: 'Edit channel', onClick: () => navigate(`/channels/${channelId}/edit`) },
              { icon: 'link', label: 'Copy channel link', onClick: () => { navigator.clipboard?.writeText(`${window.location.origin}/channels/${channelId}`); toast('Link copied'); } },
            ]} />
          ) : (
            <button className={channel.following ? 'btn-outline !h-9 !px-4' : 'btn-primary !h-9 !px-4'} onClick={toggleFollow} disabled={busy}>
              {busy ? <Spinner size={14} /> : channel.following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="card p-6 text-center relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-gold-soft/60 to-transparent" />
          <div className="relative flex justify-center"><Avatar id={channel.avatarId} name={channel.name} size={88} ring /></div>
          <h2 className="relative font-serif text-3xl text-ink mt-3">{channel.name}</h2>
          <p className="relative text-xs text-muted mt-1">Channel by {channel.isOwner ? 'you' : channel.owner.name} · {channel.postCount} post{channel.postCount === 1 ? '' : 's'}</p>
          {channel.description && <p className="relative font-serif italic text-[15px] text-gold-ink mt-3 leading-7">“{channel.description}”</p>}
          <div className="relative grid grid-cols-3 gap-2 mt-5">
            {[[channel.followerCount, 'Followers'], [channel.postCount, 'Posts'], [new Date(channel.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' }), 'Since']].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-soft/70 py-3">
                <div className="font-serif text-xl text-ink tnum">{v}</div>
                <div className="text-label-sm uppercase text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {channel.isOwner && <PostComposer channel={channel} onPosted={(p) => { setPosts((x) => (x?.some((y) => y.id === p.id) ? x : [p, ...(x || [])])); setChannel((c) => ({ ...c, postCount: c.postCount + 1 })); }} />}

        {!posts ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : posts.length ? (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} channel={channel}
                onChange={(np) => setPosts((x) => x.map((y) => (y.id === np.id ? np : y)))}
                onDelete={() => setDeleting(p)} />
            ))}
            {hasMore && <button className="btn-outline w-full" onClick={loadMore}>Load older posts</button>}
          </>
        ) : (
          <div className="text-center py-12">
            <Icon name="campaign" size={40} className="text-gold-ink/70" />
            <p className="font-serif text-xl text-ink mt-2">No posts yet</p>
            <p className="text-sm text-muted mt-1">{channel.isOwner ? 'Write your first update above.' : 'Follow to be notified when something is posted.'}</p>
          </div>
        )}
      </div>
      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Delete this post?" text="Its reactions and comments will be removed too." confirmLabel="Delete" danger
        onConfirm={async () => {
          await api(`/posts/${deleting.id}`, { method: 'DELETE' });
          setPosts((x) => x.filter((y) => y.id !== deleting.id));
          setChannel((c) => ({ ...c, postCount: c.postCount - 1 }));
        }} />
    </div>
  );
}
