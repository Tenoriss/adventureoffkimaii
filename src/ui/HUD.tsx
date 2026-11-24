import { memo, useMemo } from 'react';
import { useGame } from '../game/store';
import { QUESTS } from '../game/quests';
import { MiniMap } from './MiniMap';
import { useEngine } from './useGameEngine';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { ITEMS } from '../config/items';

type Phase = 'night' | 'dawn' | 'day' | 'dusk';

function phaseOf(hour: number): Phase {
  if (hour < 5 || hour >= 20.5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17.5) return 'day';
  return 'dusk';
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === 'night') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cfe0ff" strokeWidth="1.7" aria-hidden>
        <path d="M20 14.4A8 8 0 0 1 9.6 4a8.2 8.2 0 1 0 10.4 10.4z" strokeLinejoin="round" />
      </svg>
    );
  }
  const color = phase === 'day' ? '#ffd894' : '#ffb27a';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="4.2" fill={color} fillOpacity="0.5" />
      {phase === 'day' ? (
        <>
          <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
        </>
      ) : (
        <>
          <path d="M3 17h18M6 20h12" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function formatClock(hour: number): string {
  const total = Math.floor(hour * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export const Vitals = memo(function Vitals({ compact }: { compact: boolean }) {
  const health = useGame((s) => s.health);
  const maxHealth = useGame((s) => s.maxHealth);
  const stamina = useGame((s) => s.stamina);
  const maxStamina = useGame((s) => s.maxStamina);
  const healthPct = Math.round((health / maxHealth) * 100);
  const staminaPct = Math.round((stamina / maxStamina) * 100);

  return (
    <div className="vitals" style={compact ? { minWidth: 132 } : undefined}>
      <div className="vital-row">
        <Icon name="heart" size={13} className="vital-icon health" />
        <div className="vital-track" role="progressbar" aria-label="Health" aria-valuenow={healthPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="vital-fill health" style={{ width: `${healthPct}%` }} />
        </div>
        <span className="vital-value">{Math.ceil(health)}</span>
      </div>
      <div className="vital-row">
        <Icon name="bolt" size={13} className="vital-icon stamina" />
        <div className="vital-track" role="progressbar" aria-label="Stamina" aria-valuenow={staminaPct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`vital-fill stamina${staminaPct < 25 ? ' low' : ''}`} style={{ width: `${staminaPct}%` }} />
        </div>
        <span className="vital-value">{Math.ceil(stamina)}</span>
      </div>
    </div>
  );
});

export const ClockChip = memo(function ClockChip() {
  const timeOfDay = useGame((s) => s.timeOfDay);
  const day = useGame((s) => s.day);
  return (
    <div className="clock-chip">
      <span className="sun-icon" aria-hidden>
        <PhaseIcon phase={phaseOf(timeOfDay)} />
      </span>
      <span>{formatClock(timeOfDay)}</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span className="day-num">Day {day}</span>
    </div>
  );
});

export const ObjectivePill = memo(function ObjectivePill({ hidden = false }: { hidden?: boolean }) {
  const trackedQuest = useGame((s) => s.trackedQuest);
  const quests = useGame((s) => s.quests);
  // Re-render twice a second so the compass distance stays live.
  const tick = useGame((s) => s.stats.fps);
  const { game } = useEngine();
  const heading = useMemo(() => {
    if (!game) return null;
    return game.objectiveHeading();
  }, [game, trackedQuest, quests, tick]);

  const quest = trackedQuest ? QUESTS.find((q) => q.id === trackedQuest) : null;
  const state = trackedQuest ? quests[trackedQuest] : null;
  // While a conversation is open the tracker would sit under the options.
  if (hidden || !quest || !state || state.status !== 'active') return null;
  const current = quest.objectives[state.progress];

  return (
    <div className="objective-pill">
      <div
        className="objective-arrow"
        aria-hidden
        style={{ transform: heading ? `rotate(${heading.angle}deg)` : undefined }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 3.5 20 19.5 12 15.6 4 19.5z" />
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <span className="obj-title">{quest.title}</span>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.text ?? 'Quest complete'}</div>
      </div>
      {heading && (
        <div style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
          {heading.distance > 1000 ? `${(heading.distance / 1000).toFixed(1)}km` : `${Math.round(heading.distance)}m`}
        </div>
      )}
    </div>
  );
});

export function HUD() {
  const area = useGame((s) => s.area);
  const interactLabel = useGame((s) => s.interactLabel);
  const isTouch = useGame((s) => s.isTouch);
  const isMobile = useGame((s) => s.isMobile);
  const showFps = useGame((s) => s.graphics.showFps);
  const stats = useGame((s) => s.stats);
  const toasts = useGame((s) => s.toasts);
  const dialogueOpen = useGame((s) => s.dialogueOpen);

  return (
    <div className="hud" aria-live="off">
      <div className="hud-top-left">
        <Vitals compact={isMobile} />
        <div className="area-chip">{area}</div>
      </div>

      <MiniMap />

      <div className="clock-slot">
        <ClockChip />
      </div>

      <div className="hud-bottom-left" style={{ bottom: `calc(${isTouch ? 170 : 20}px + var(--safe-bottom))` }}>
        <ObjectivePill hidden={dialogueOpen} />
      </div>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.icon && ITEMS[t.icon] && <ItemIcon id={t.icon} size={17} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {interactLabel && !isTouch && (
        <div className="interact-prompt">
          <span className="key-cap">E</span>
          <span>{interactLabel}</span>
        </div>
      )}

      {showFps && (
        <div className="stats-overlay">
          {`${stats.fps} fps · ${stats.frameMs.toFixed(1)}ms\n`}
          {`draw ${stats.drawCalls} · tri ${(stats.triangles / 1000).toFixed(0)}k\n`}
          {`chunks ${stats.chunks} · scale ${stats.renderScale.toFixed(2)}\n`}
          {`quality ${stats.quality}`}
        </div>
      )}
    </div>
  );
}
