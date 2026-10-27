import React, { useEffect, useState } from 'react';
import { Check, Volume2, VolumeX } from 'lucide-react';
import { DEFAULT_BLUR, THEME_OPTIONS, applyBackdropBlur, applyCardSolidity, getBackdropBlur, getCardSolidity, type ThemeMode } from '../utils/themes';
import { getNotificationsMuted, setNotificationsMuted } from '../utils/fundRequestAlert';
import { publicUrl } from '../utils/assets';

// Onglet Thèmes : chaque carte montre la matière elle-même (fond soie, champ, couleurs, bouton d'action).
// Le son des alertes et l'opacité des cartes se règlent ici aussi.

interface ThemesViewProps {
  userId: string;
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
}

export const ThemesView: React.FC<ThemesViewProps> = ({ userId, theme, onSetTheme }) => {
  const [muted, setMuted] = useState(() => getNotificationsMuted(userId));
  const [solidity, setSolidity] = useState(getCardSolidity);
  const [blur, setBlur] = useState(() => getBackdropBlur() ?? DEFAULT_BLUR);

  useEffect(() => { setMuted(getNotificationsMuted(userId)); }, [userId]);

  const toggleSound = () => {
    setNotificationsMuted(userId, !muted);
    setMuted(!muted);
  };

  return (
    <div className="space-y-4 animate-pop">
      <header className="px-1">
        <h2 className="text-[1.6rem] font-extrabold tracking-tight text-[var(--m-text)]">Thèmes</h2>
        <p className="text-sm text-[var(--m-text-2)]">Choisissez la matière de l’appli. Le changement est immédiat.</p>
      </header>

      <section className="glass-card space-y-4 !p-5">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--m-text)]">
          {muted ? <VolumeX className="h-5 w-5 text-[var(--m-muted)]" aria-hidden="true" /> : <Volume2 className="h-5 w-5 text-[var(--m-accent)]" aria-hidden="true" />}
          <span className="flex-1">
            Son des alertes
            <span className="block text-xs font-normal text-[var(--m-text-2)]">{muted ? 'Les alertes arrivent sans bruit' : 'Un signal sonore accompagne chaque alerte'}</span>
          </span>
          <input type="checkbox" checked={!muted} onChange={toggleSound} />
        </label>
        <div className="space-y-2 border-t border-[var(--m-edge-soft)] pt-4">
          <div className="flex items-center justify-between text-sm font-semibold text-[var(--m-text)]">
            <label htmlFor="card-solidity">Opacité des cartes</label>
            <span className="tabular-nums text-[var(--m-text-2)]">{Math.round(solidity)} %</span>
          </div>
          <input
            id="card-solidity"
            type="range"
            min={0}
            max={100}
            step={0.001}
            value={solidity}
            onChange={(event) => { const next = Number(event.target.value); setSolidity(next); applyCardSolidity(next); }}
            className="theme-solidity w-full"
            style={{ ['--solidity' as string]: `${solidity}%` }}
          />
          <div className="flex justify-between text-xs text-[var(--m-muted)]"><span>Givré</span><span>Opaque</span></div>
        </div>
        <div className="space-y-2 border-t border-[var(--m-edge-soft)] pt-4">
          <div className="flex items-center justify-between text-sm font-semibold text-[var(--m-text)]">
            <label htmlFor="backdrop-blur">Flou d’arrière-plan</label>
            <span className="tabular-nums text-[var(--m-text-2)]">{Math.round(blur)} px</span>
          </div>
          <input
            id="backdrop-blur"
            type="range"
            min={0}
            max={60}
            step={0.001}
            value={blur}
            onChange={(event) => { const next = Number(event.target.value); setBlur(next); applyBackdropBlur(next); }}
            className="theme-solidity w-full"
            style={{ ['--solidity' as string]: `${(blur / 60) * 100}%` }}
          />
          <div className="flex justify-between text-xs text-[var(--m-muted)]"><span>Net</span><span>Très flou</span></div>
        </div>
      </section>

      <div className="theme-cards" role="radiogroup" aria-label="Thème de l’appli">
        {THEME_OPTIONS.map((option) => {
          const active = option.key === theme;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSetTheme(option.key)}
              data-theme-preview={option.key}
              className="theme-card"
              style={{ ['--m-silk-image' as string]: `url("${publicUrl(`theme-backgrounds/silk-${option.key}.jpg`)}")` }}
            >
              <span className="theme-card__head">
                <b>{option.label}</b>
                {active ? <span className="theme-card__badge theme-card__badge--active"><Check className="h-3.5 w-3.5" aria-hidden="true" />Actif</span> : <span className="theme-card__badge">{option.light ? 'Clair' : 'Sombre'}</span>}
              </span>
              <span className="theme-card__field">Champ</span>
              <span className="theme-card__foot">
                <span className="theme-card__chips" aria-hidden="true">
                  <i style={{ background: 'var(--m-chart-1)' }} />
                  <i style={{ background: 'var(--m-chart-2)' }} />
                  <i style={{ background: 'var(--m-chart-3)' }} />
                </span>
                <span className="theme-card__action">Action</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemesView;
