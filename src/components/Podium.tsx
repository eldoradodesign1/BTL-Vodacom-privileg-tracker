import React from 'react';
import { UsersRound } from 'lucide-react';

// Podium du jour, commun aux campagnes : scène en verre de la matière, trois marches teintées par le thème,
// avatars cerclés or, argent et bronze. Les places vides restent visibles en pointillés.

export interface PodiumEntry {
  name: string;
  score: string;
  photo?: string;
}

interface PodiumProps {
  /** Classement dans l'ordre : 1er, 2e, 3e (null = place libre). */
  entries: Array<PodiumEntry | null | undefined>;
  emptyScore: string;
}

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

const Crown: React.FC = () => (
  <svg className="btl-podium__crown" viewBox="0 0 24 16" aria-hidden="true">
    <path d="M2 14 L4 4 L9 9 L12 2 L15 9 L20 4 L22 14 Z" />
  </svg>
);

export const Podium: React.FC<PodiumProps> = ({ entries, emptyScore }) => (
  <section className="btl-podium" aria-label="Podium du jour">
    <div className="btl-podium__steps">
      {[1, 0, 2].map((index) => {
        const entry = entries[index];
        const rank = index + 1;
        return (
          <div key={rank} className={`btl-podium__slot btl-podium__slot--${rank} ${entry ? '' : 'btl-podium__slot--empty'}`}>
            <div className="btl-podium__avatar">
              {rank === 1 && entry && <Crown />}
              <span className="btl-podium__ring">
                {entry?.photo ? <img src={entry.photo} alt="" /> : entry ? initialsOf(entry.name) : <UsersRound className="h-5 w-5" aria-hidden="true" />}
              </span>
            </div>
            <p className="btl-podium__name" title={entry?.name || 'Place libre'}>{entry?.name || 'Place libre'}</p>
            <p className="btl-podium__score">{entry?.score || emptyScore}</p>
            <div className="btl-podium__step" aria-label={`${rank}${rank === 1 ? 'er' : 'e'}`}>
              <span>{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
    <div className="btl-podium__floor" aria-hidden="true" />
  </section>
);

export default Podium;
