import React from 'react';
import { Star } from 'lucide-react';

interface MikiliFeedbackProps {
  comment?: string | null;
  rating?: number | null;
  compact?: boolean;
}

export const MikiliFeedback: React.FC<MikiliFeedbackProps> = ({ comment, rating, compact = false }) => {
  const cleanComment = comment?.trim();
  const safeRating = typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
  if (!cleanComment && safeRating === null) return null;

  return (
    <div className={`mt-2 space-y-1.5 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
      {safeRating !== null && (
        <div className="flex items-center gap-1.5" role="img" aria-label={`Satisfaction du client : ${safeRating} sur 5`}>
          <span className="flex items-center gap-0.5 text-amber-300" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} size={compact ? 11 : 13} fill={index < safeRating ? 'currentColor' : 'none'} />
            ))}
          </span>
          <span className="font-black text-amber-100">{safeRating}/5</span>
        </div>
      )}
      {cleanComment && <p className="break-words leading-relaxed text-gray-300"><span className="font-black text-gray-400">Commentaire :</span> {cleanComment}</p>}
    </div>
  );
};
