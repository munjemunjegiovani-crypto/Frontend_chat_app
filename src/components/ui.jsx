import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fileUrl } from '../lib/api.js';
import { initials } from '../lib/format.js';

export function Icon({ name, className = '', fill = false, size, style }) {
  return (
    <span
      className={`icon ${fill ? 'fill' : ''} ${className}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function Logo({ size = 36, className = '' }) {
  return (
    <img src="/icon-192.png" alt="Gochat" width={size} height={size} className={`rounded-[22%] shadow-lvl1 ${className}`} />
  );
}

const AVATAR_TINTS = [
  'bg-[#F3E7CF] text-[#755A24] dark:bg-[#3A3222] dark:text-[#E5C281]',
  'bg-[#E3E7F1] text-[#14213D] dark:bg-[#26324B] dark:text-[#B9C6EA]',
  'bg-[#EEE5E0] text-[#5C421E] dark:bg-[#3B2E25] dark:text-[#E7C092]',
  'bg-[#E4ECE6] text-[#1F4D3A] dark:bg-[#20362D] dark:text-[#A8D5BC]',
];

export function Avatar({ id, name = '', size = 48, online = false, ring = false, ringDim = false, className = '', group = false }) {
  const [broken, setBroken] = useState(false);
  const src = id && !broken ? fileUrl(id) : null;
  const tint = AVATAR_TINTS[(name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
  const fontSize = Math.max(11, Math.round(size * 0.36));
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${
          ring ? `p-[2px] ${ringDim ? 'bg-muted/40' : 'bg-gradient-to-br from-[#E5C281] via-[#C9A86A] to-[#8C6A2E]'}` : ''
        }`}
      >
        <div
          className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${ring ? 'border-2 border-card' : ''} ${
            src ? 'bg-soft' : tint
          }`}
        >
          {src ? (
            <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setBroken(true)} loading="lazy" />
          ) : group && !name ? (
            <Icon name="groups" size={fontSize * 1.3} />
          ) : (
            <span className="font-serif font-medium" style={{ fontSize }}>{initials(name)}</span>
          )}
        </div>
      </div>
      {online && (
        <span
          className="absolute bottom-[2%] right-[2%] rounded-full bg-gold border-2 border-card"
          style={{ width: Math.max(10, size * 0.24), height: Math.max(10, size * 0.24) }}
        />
      )}
    </div>
  );
}

export function Spinner({ className = '', size = 20 }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-gold/30 border-t-gold animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
        checked ? 'bg-gold-ink dark:bg-gold' : 'bg-soft border hairline-strong'
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full shadow transition-all ${
          checked ? 'left-6 bg-card' : 'left-1 bg-muted/60'
        }`}
      />
    </button>
  );
}

export function Badge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span
      className={`min-w-[20px] h-5 px-1.5 rounded-full bg-gold text-[11px] font-semibold text-white dark:text-[#0E1420] flex items-center justify-center tnum ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Header used at the top of every pane
export function PaneHeader({ title, eyebrow = 'Gochat', back, actions, children, sub, onTitleClick }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 pt-safe bg-canvas/85 backdrop-blur-xl border-b hairline">
      <div className="h-16 px-3 md:px-4 flex items-center gap-2">
        {back && (
          <button
            className="btn-ghost -ml-1"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="Back"
          >
            <Icon name="arrow_back_ios_new" size={20} />
          </button>
        )}
        {children || (
          <button className="min-w-0 flex-1 text-left" onClick={onTitleClick} disabled={!onTitleClick}>
            {eyebrow && <div className="eyebrow leading-none mb-0.5">{eyebrow}</div>}
            <h1 className="font-serif text-[22px] leading-7 text-ink truncate">{title}</h1>
            {sub && <div className="text-xs text-muted truncate">{sub}</div>}
          </button>
        )}
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ icon = 'history_edu', title, text, action, quote }) {
  return (
    <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="w-20 h-20 rounded-full bg-primary/5 dark:bg-gold/10 border hairline flex items-center justify-center mb-5">
        <Icon name={icon} size={34} className="text-gold-ink" />
      </div>
      <h2 className="font-serif text-2xl text-ink mb-2">{title}</h2>
      {text && <p className="text-sm text-muted max-w-sm leading-6">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
      {quote && (
        <p className="mt-10 font-serif italic text-gold-ink/90 text-[15px] max-w-xs">“{quote}”</p>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0B1120]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'} max-h-[88vh] flex flex-col bg-card sm:rounded-2xl rounded-t-3xl border hairline shadow-lvl2 animate-fadeUp pb-safe`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-serif text-xl text-ink">{title}</h3>
            <button className="btn-ghost -mr-2" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto scroll-thin px-5 pb-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t hairline">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Confirm({ open, title, text, confirmLabel = 'Confirm', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal open={open} onClose={() => { setError(''); onClose(); }} title={title}>
      {text && <p className="text-sm text-muted leading-6 mb-4">{text}</p>}
      {children}
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <div className="flex gap-3 justify-end mt-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button
          className={`btn-primary ${danger ? '!bg-danger !text-white' : ''}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try { await onConfirm(); onClose(); } catch (e) { setError(e.message || 'Something went wrong.'); } finally { setBusy(false); }
          }}
        >
          {busy ? <Spinner size={16} /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// Small dropdown menu anchored to a button
export function Menu({ trigger, items, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className={`relative ${className}`} ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-50 mt-1 min-w-[210px] py-1.5 bg-card rounded-xl border hairline-strong shadow-lvl2 animate-fadeUp ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.filter(Boolean).map((it, i) =>
            it === '-' ? (
              <div key={i} className="my-1 border-t hairline" />
            ) : (
              <button
                key={it.label}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-soft transition ${
                  it.danger ? 'text-danger' : 'text-ink'
                }`}
                onClick={() => { setOpen(false); it.onClick(); }}
              >
                {it.icon && <Icon name={it.icon} size={20} className={it.danger ? '' : 'text-gold-ink'} />}
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function SectionLabel({ icon, children, right }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2 mt-5">
      <div className="flex items-center gap-2 eyebrow">
        {icon && <Icon name={icon} size={16} />}
        {children}
      </div>
      {right}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search', autoFocus }) {
  return (
    <div className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-card border hairline shadow-lvl1 focus-within:border-gold transition">
      <Icon name="search" size={20} className="text-gold-ink" />
      <input
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted/70 min-w-0"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-muted hover:text-ink">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}

export function Row({ icon, title, sub, onClick, right, danger, iconClass = '' }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-soft/70 transition ${danger ? 'text-danger' : ''}`}
    >
      {icon && (
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-danger-soft' : 'bg-soft text-gold-ink'} ${iconClass}`}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-medium ${danger ? '' : 'text-ink'}`}>{title}</span>
        {sub && <span className="block text-xs text-muted mt-0.5 truncate">{sub}</span>}
      </span>
      {right !== undefined ? right : onClick && <Icon name="chevron_right" className="text-muted" size={20} />}
    </button>
  );
}

export function Quote({ children, cite }) {
  return (
    <div className="text-center py-10 px-6">
      <div className="gold-rule w-24 mx-auto mb-5" />
      <p className="font-serif italic text-[17px] text-gold-ink leading-7">“{children}”</p>
      {cite && <p className="eyebrow mt-3 !text-muted">{cite}</p>}
    </div>
  );
}
