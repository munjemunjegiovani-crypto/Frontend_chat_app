import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from './ui.jsx';

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  const navigate = useNavigate();
  return (
    <div className="fixed z-[90] top-3 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm flex flex-col gap-2 pointer-events-none pt-safe">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => { dismissToast(t.id); if (t.to) navigate(t.to); }}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lvl2 border text-left animate-fadeUp ${
            t.error ? 'bg-danger-soft text-danger border-danger/20' : 'bg-[#14213D] text-[#F2EFE9] border-[#C9A86A]/30 dark:bg-card dark:text-ink'
          }`}
        >
          <Icon name={t.error ? 'error' : t.icon || 'check_circle'} size={20} className={t.error ? '' : 'text-[#C9A86A]'} />
          <span className="text-sm flex-1 line-clamp-2">{t.text}</span>
        </button>
      ))}
    </div>
  );
}
