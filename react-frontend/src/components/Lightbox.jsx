import { useEffect } from 'react';
import ReactDOM from 'react-dom';

export default function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="lightbox"
      id="lightbox"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button className="lightbox-close" id="lightboxClose" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <div className="lightbox-inner">
        <img id="lightboxImg" src={src} alt="Detection frame" />
        <p className="lightbox-caption" id="lightboxCaption">{caption}</p>
      </div>
    </div>,
    document.body
  );
}
