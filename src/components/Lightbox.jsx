import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fileUrl } from '../lib/api.js';
import { Icon } from './ui.jsx';

export default function Lightbox({ file, caption, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!file) return null;
  const isVideo = file.mime?.startsWith('video/');
  return createPortal(
    <div className="fixed inset-0 z-[95] bg-[#0B1120]/95 flex flex-col animate-fadeUp" onClick={onClose}>
      <div className="flex items-center justify-end gap-2 p-3 pt-safe text-white">
        <a href={fileUrl(file.id, true)} onClick={(e) => e.stopPropagation()} className="w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Download">
          <Icon name="download" />
        </a>
        <button className="w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={fileUrl(file.id)} controls autoPlay playsInline className="max-w-full max-h-full rounded-lg" />
        ) : (
          <img src={fileUrl(file.id)} alt={caption || ''} className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>
      {caption && <p className="text-center text-white/90 px-6 pb-8 pb-safe" onClick={(e) => e.stopPropagation()}>{caption}</p>}
    </div>,
    document.body
  );
}
