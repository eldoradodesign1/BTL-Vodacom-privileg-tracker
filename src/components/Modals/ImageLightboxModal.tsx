import React, { useEffect } from 'react';
import { Maximize2, X } from 'lucide-react';

export interface LightboxImage {
  url: string;
  alt: string;
}

interface ImageLightboxModalProps {
  image: LightboxImage | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({ image, onClose }) => {
  useEffect(() => {
    if (!image) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-white/15 sm:right-6 sm:top-6"
      >
        <X size={16} /> Fermer
      </button>
      <div className="relative max-h-[92vh] max-w-[96vw] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_30px_120px_rgba(0,0,0,0.75)]" onClick={(event) => event.stopPropagation()}>
        <img src={image.url} alt={image.alt} className="max-h-[92vh] max-w-[96vw] object-contain" />
        <div className="pointer-events-none absolute bottom-0 inset-x-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12 text-[10px] font-black uppercase tracking-wide text-white">
          <Maximize2 size={14} /> Vue plein écran
        </div>
      </div>
    </div>
  );
};
