import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useSocketEvent } from '../context/AppContext.jsx';
import { Avatar, EmptyState, Icon, PaneHeader, Spinner } from '../components/ui.jsx';
import PostCard, { PostBody } from '../components/PostCard.jsx';
import { ago } from '../lib/format.js';

export default function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const { me, toast } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    setData(null);
    api(`/posts/${postId}`).then(setData).catch((e) => setError(e.message));
  }, [postId]);

  useSocketEvent('post:comment', ({ postId: pid, comment }) => {
    if (pid !== postId) return;
    setData((d) => (d && !d.comments.some((c) => c.id === comment.id)
      ? { ...d, comments: [...d.comments, comment], post: { ...d.post, commentCount: d.post.commentCount + 1 } }
      : d));
  });
  useSocketEvent('channel:post:updated', (post) => {
    if (post.id === postId) setData((d) => d && { ...d, post: { ...post, commentCount: d.post.commentCount } });
  });

  if (error) return <EmptyState icon="article" title="Post unavailable" text={error} />;
  if (!data) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  const { post, channel, comments } = data;

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const c = await api(`/posts/${postId}/comments`, { method: 'POST', body: { body, parentId: replyTo?.id } });
      setData((d) => (d.comments.some((x) => x.id === c.id) ? d : { ...d, comments: [...d.comments, c], post: { ...d.post, commentCount: d.post.commentCount + 1 } }));
      setText('');
      setReplyTo(null);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    try {
      await api(`/posts/comments/${c.id}`, { method: 'DELETE' });
      setData((d) => ({ ...d, comments: d.comments.filter((x) => x.id !== c.id && x.parentId !== c.id) }));
    } catch (e) {
      toast(e.message, { error: true });
    }
  };

  const roots = comments.filter((c) => !c.parentId || !comments.some((p) => p.id === c.parentId));
  const repliesOf = (cid) => comments.filter((c) => c.parentId === cid);

  const Comment = ({ c, reply }) => (
    <div className={`flex gap-3 ${reply ? 'ml-12 mt-3' : ''}`}>
      <button onClick={() => c.user.id !== me.id && navigate(`/user/${c.user.id}`)}><Avatar id={c.user.avatarId} name={c.user.name || ''} size={reply ? 30 : 38} /></button>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-[4px] bg-card border hairline px-4 py-2.5 shadow-lvl1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">{c.user.id === me.id ? 'You' : c.user.name}</span>
            {c.user.id === channel.owner.id && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold-soft text-gold-ink font-semibold">Author</span>}
          </div>
          <p className="text-[14.5px] leading-6 text-ink whitespace-pre-wrap break-words"><PostBody text={c.body} /></p>
        </div>
        <div className="flex items-center gap-4 mt-1 ml-2 text-[12px] text-muted">
          <span>{ago(c.createdAt)}</span>
          <button className="font-medium hover:text-gold-ink" onClick={() => { setReplyTo(reply ? comments.find((x) => x.id === c.parentId) || c : c); inputRef.current?.focus(); }}>Reply</button>
          {(c.user.id === me.id || channel.isOwner) && <button className="hover:text-danger" onClick={() => remove(c)}>Delete</button>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PaneHeader title="Post" eyebrow={channel.name} back />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          <PostCard post={post} channel={channel} full onChange={(p) => setData((d) => ({ ...d, post: { ...p, commentCount: d.post.commentCount } }))}
            onDelete={async () => { await api(`/posts/${postId}`, { method: 'DELETE' }); navigate(`/channels/${channel.id}`, { replace: true }); }} />
          <div>
            <div className="flex items-center gap-2 eyebrow mb-3 px-1"><Icon name="forum" size={16} /> Comments · {comments.length}</div>
            {roots.length ? (
              <div className="space-y-4">
                {roots.map((c) => (
                  <div key={c.id}>
                    <Comment c={c} />
                    {repliesOf(c.id).map((r) => <Comment key={r.id} c={r} reply />)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-8">No comments yet. Start the conversation.</p>
            )}
            <div ref={endRef} />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t hairline bg-canvas px-3 md:px-4 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-muted mb-2 px-2">
            <Icon name="reply" size={16} className="text-gold-ink" /> Replying to <b className="text-ink">{replyTo.user.id === me.id ? 'yourself' : replyTo.user.name}</b>
            <button className="ml-auto" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><Icon name="close" size={16} /></button>
          </div>
        )}
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Avatar id={me.avatarId} name={me.name} size={36} className="mb-1.5 hidden sm:block" />
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) { e.preventDefault(); send(); } }}
            placeholder="Write a comment…"
            className="flex-1 resize-none rounded-[22px] bg-card border hairline px-4 py-3 outline-none focus:border-gold/60 text-[15px] max-h-32"
          />
          <button className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 disabled:opacity-40" disabled={!text.trim() || busy} onClick={send} aria-label="Send comment">
            {busy ? <Spinner size={16} /> : <Icon name="arrow_upward" />}
          </button>
        </div>
      </div>
    </div>
  );
}
