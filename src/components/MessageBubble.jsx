import { useRef } from 'react';
import { fileUrl } from '../lib/api.js';
import { fileSize, linkify, timeOf } from '../lib/format.js';
import { Icon, Avatar } from './ui.jsx';
import Ticks from './Ticks.jsx';
import VoicePlayer from './VoicePlayer.jsx';

const NAME_COLORS = ['text-[#755A24] dark:text-[#E5C281]', 'text-[#3A4664] dark:text-[#B9C6EA]', 'text-[#1F4D3A] dark:text-[#A8D5BC]', 'text-[#6B1E2E] dark:text-[#F0A8B4]', 'text-[#5C421E] dark:text-[#E7C092]'];

function Highlight({ text, term }) {
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-gold/50 text-inherit rounded px-0.5">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function RichText({ text, term }) {
  return linkify(text).map((p, i) =>
    typeof p === 'string' ? (
      <Highlight key={i} text={p} term={term} />
    ) : (
      <a key={i} href={p.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 break-all" onClick={(e) => e.stopPropagation()}>
        {p.url}
      </a>
    )
  );
}

export default function MessageBubble({
  m, mine, showSender, firstInGroup, lastInGroup, isGroup, status, meId, term,
  onOpenActions, onReact, onOpenMedia, onJumpTo, onOpenProfile, highlighted,
}) {
  const press = useRef(null);
  const deleted = !!m.deletedAt;

  if (m.type === 'system') {
    return (
      <div className="flex justify-center my-3 px-6">
        <span className="text-[12px] text-muted bg-soft/90 rounded-full px-4 py-1.5 text-center">{m.body}</span>
      </div>
    );
  }

  const startPress = (e) => {
    if (e.pointerType === 'mouse') return;
    press.current = setTimeout(() => {
      navigator.vibrate?.(15);
      onOpenActions(m);
    }, 450);
  };
  const cancelPress = () => clearTimeout(press.current);

  const reactions = Object.values(
    (m.reactions || []).reduce((acc, r) => {
      acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, mine: false };
      acc[r.emoji].count += 1;
      if (r.userId === meId) acc[r.emoji].mine = true;
      return acc;
    }, {})
  );

  const media = !deleted && (m.type === 'image' || m.type === 'video');
  const radius = mine
    ? `rounded-2xl ${lastInGroup ? 'rounded-br-[4px]' : ''}`
    : `rounded-2xl ${lastInGroup ? 'rounded-bl-[4px]' : ''}`;
  const colorIdx = (m.sender?.id || 0) % NAME_COLORS.length;

  const meta = (
    <span className={`inline-flex items-center gap-1 text-[11px] tnum whitespace-nowrap ${mine ? 'text-bubble-out-ink/70' : 'text-muted'}`}>
      {m.starred && <Icon name="star" fill size={12} />}
      {m.editedAt && !deleted && <span className="italic">edited</span>}
      {timeOf(m.createdAt)}
      {mine && !deleted && <Ticks status={status} onBubble />}
    </span>
  );

  return (
    <div
      id={`msg-${m.id}`}
      className={`group flex items-end gap-2 px-3 md:px-6 ${firstInGroup ? 'mt-3' : 'mt-[3px]'} ${mine ? 'justify-end' : 'justify-start'} ${
        highlighted ? 'animate-pulse' : ''
      }`}
    >
      {isGroup && !mine && (
        <div className="w-8 shrink-0">
          {lastInGroup && (
            <button onClick={() => onOpenProfile(m.sender?.id)} aria-label={m.sender?.name}>
              <Avatar id={m.sender?.avatarId} name={m.sender?.name} size={32} />
            </button>
          )}
        </div>
      )}
      <div className={`relative max-w-[82%] md:max-w-[68%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {/* Hover action button (desktop) */}
        <button
          onClick={() => onOpenActions(m)}
          className={`hidden md:flex absolute top-1 ${mine ? '-left-9' : '-right-9'} w-8 h-8 rounded-full items-center justify-center text-muted bg-card border hairline shadow-lvl1 opacity-0 group-hover:opacity-100 transition`}
          aria-label="Message actions"
        >
          <Icon name="expand_more" size={20} />
        </button>
        <div
          onContextMenu={(e) => { e.preventDefault(); onOpenActions(m); }}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerMove={cancelPress}
          className={`relative ${radius} ${media ? 'p-1' : 'px-3.5 py-2'} select-text ${
            mine
              ? 'bg-bubble-out text-bubble-out-ink shadow-lvl1'
              : 'bg-bubble-in text-ink border hairline shadow-lvl1'
          } ${m.pending ? 'opacity-80' : ''}`}
        >
          {showSender && !mine && (
            <button onClick={() => onOpenProfile(m.sender?.id)} className={`block text-[13px] font-semibold mb-0.5 ${media ? 'px-2.5 pt-1.5' : ''} ${NAME_COLORS[colorIdx]}`}>
              {m.sender?.name || 'Deleted account'}
            </button>
          )}
          {m.forwarded && !deleted && (
            <div className={`flex items-center gap-1 text-[12px] italic mb-0.5 ${media ? 'px-2.5' : ''} ${mine ? 'opacity-75' : 'text-muted'}`}>
              <Icon name="forward" size={14} /> Forwarded
            </div>
          )}
          {m.momentQuote && !deleted && (
            <div
              className={`mb-1.5 rounded-lg overflow-hidden border-l-[3px] border-gold flex ${mine ? 'bg-black/15 dark:bg-black/10' : 'bg-soft'} ${media ? 'mt-1' : ''}`}
            >
              <div className="flex-1 min-w-0 px-3 py-2">
                <span className={`block text-[12px] font-semibold ${mine ? 'text-[#E5C281] dark:text-[#14213D]' : 'text-gold-ink'}`}>
                  {m.momentQuote.ownerId === meId ? 'Your moment' : `${(m.momentQuote.ownerName || 'Moment').split(' ')[0]}’s moment`}
                </span>
                <span className={`block text-[13px] line-clamp-2 ${mine ? 'opacity-80' : 'text-muted'}`}>
                  {m.momentQuote.type === 'text' ? `“${m.momentQuote.body}”` : m.momentQuote.body ? m.momentQuote.body : m.momentQuote.type === 'video' ? '🎬 Video' : '📷 Photo'}
                </span>
              </div>
              {m.momentQuote.type === 'text' ? (
                <div className="w-[72px] shrink-0 flex items-center justify-center p-1.5 text-center font-serif italic text-[10px] leading-tight text-[#F2EFE9] overflow-hidden" style={{ background: m.momentQuote.background }}>
                  <span className="line-clamp-4">{m.momentQuote.body}</span>
                </div>
              ) : m.momentQuote.previewId ? (
                <img src={fileUrl(m.momentQuote.previewId)} alt="Moment" className="w-[72px] h-[72px] shrink-0 object-cover bg-soft" loading="lazy" />
              ) : null}
            </div>
          )}
          {m.replyTo && !deleted && (
            <button
              onClick={() => onJumpTo(m.replyTo.id)}
              className={`block w-full text-left mb-1.5 rounded-lg px-3 py-2 border-l-[3px] border-gold ${
                mine ? 'bg-black/15 dark:bg-black/10' : 'bg-soft'
              } ${media ? 'mt-1' : ''}`}
            >
              <span className={`block text-[12px] font-semibold ${mine ? 'text-[#E5C281] dark:text-[#14213D]' : 'text-gold-ink'}`}>
                {m.replyTo.senderId === meId ? 'You' : m.replyTo.senderName || 'Message'}
              </span>
              <span className={`block text-[13px] italic line-clamp-2 ${mine ? 'opacity-80' : 'text-muted'}`}>
                {m.replyTo.type === 'text' ? `“${m.replyTo.body}”` : m.replyTo.type === 'audio' ? '🎙 Voice note' : m.replyTo.type === 'image' ? '📷 Photo' : m.replyTo.type === 'video' ? '🎬 Video' : '📄 Document'}
              </span>
            </button>
          )}

          {deleted ? (
            <p className={`msg-text italic flex items-center gap-1.5 ${mine ? 'opacity-75' : 'text-muted'}`}>
              <Icon name="block" size={16} /> {mine ? 'You deleted this message' : 'This message was deleted'}
              <span className="ml-2">{meta}</span>
            </p>
          ) : (
            <>
              {m.type === 'image' && m.file && (
                <button onClick={() => onOpenMedia(m)} className="block">
                  <img
                    src={m.localUrl || fileUrl(m.file.id)}
                    alt={m.body || 'Photo'}
                    className="rounded-xl max-h-[340px] min-w-[160px] w-auto object-cover bg-soft"
                    loading="lazy"
                  />
                </button>
              )}
              {m.type === 'video' && m.file && (
                <video
                  src={m.localUrl || fileUrl(m.file.id)}
                  controls
                  playsInline
                  preload="metadata"
                  className="rounded-xl max-h-[340px] max-w-full bg-black"
                />
              )}
              {m.type === 'audio' && m.file && (
                <div className="py-1">
                  <VoicePlayer fileId={m.file.id} seed={m.id} outgoing={mine} />
                </div>
              )}
              {m.type === 'file' && m.file && (
                <a
                  href={fileUrl(m.file.id, true)}
                  className={`flex items-center gap-3 rounded-xl p-2.5 my-0.5 min-w-[220px] ${mine ? 'bg-black/15' : 'bg-soft'}`}
                >
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${mine ? 'bg-bubble-out-ink/15' : 'bg-gold-soft text-gold-ink'}`}>
                    <Icon name="description" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{m.file.name}</span>
                    <span className={`block text-[11px] ${mine ? 'opacity-70' : 'text-muted'}`}>{fileSize(m.file.size)} · Tap to download</span>
                  </span>
                  <Icon name="download" size={20} />
                </a>
              )}
              {m.body && m.type !== 'audio' && (
                <p className={`msg-text whitespace-pre-wrap break-words ${media ? 'px-2.5 pt-1.5' : ''}`}>
                  <RichText text={m.body} term={term} />
                  <span className={`inline-block ${mine ? 'w-[84px]' : 'w-[60px]'} ${m.editedAt ? '!w-[120px]' : ''} ${m.starred ? 'ml-4' : ''}`} />
                </p>
              )}
              <div className={`flex justify-end -mt-4 ${media && !m.body ? 'absolute bottom-2.5 right-3 !mt-0 px-2 py-0.5 rounded-full bg-black/45 [&_*]:!text-white' : ''} ${media && m.body ? 'px-2 pb-1' : ''} ${!m.body && !media ? '!mt-1' : ''}`}>
                {meta}
              </div>
            </>
          )}
          {m.failed && (
            <div className="text-[11px] text-danger mt-1">Not sent — tap and hold to retry</div>
          )}
        </div>
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 -mt-1.5 z-[1] ${mine ? 'mr-2' : 'ml-2'}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m, r.emoji)}
                className={`h-6 px-2 rounded-full text-[12px] flex items-center gap-1 border shadow-sm ${
                  r.mine ? 'bg-gold-soft border-gold/50' : 'bg-card hairline'
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-muted tnum">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
