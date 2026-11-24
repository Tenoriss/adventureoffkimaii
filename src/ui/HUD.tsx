import { memo, useEffect, useMemo, useRef } from 'react';
import { useGame } from '../game/store';
import { QUESTS } from '../game/quests';
import { MiniMap } from './MiniMap';
import { useEngine } from './useGameEngine';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { ITEMS } from '../config/items';
import { useT } from '../i18n';
import { questTitle, objectiveText, placeName } from '../i18n/content';

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
  const t = useT();
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
        <div className="vital-track" role="progressbar" aria-label={t('hud.health')} aria-valuenow={healthPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="vital-fill health" style={{ width: `${healthPct}%` }} />
        </div>
        <span className="vital-value">{Math.ceil(health)}</span>
      </div>
      <div className="vital-row">
        <Icon name="bolt" size={13} className="vital-icon stamina" />
        <div className="vital-track" role="progressbar" aria-label={t('hud.stamina')} aria-valuenow={staminaPct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`vital-fill stamina${staminaPct < 25 ? ' low' : ''}`} style={{ width: `${staminaPct}%` }} />
        </div>
        <span className="vital-value">{Math.ceil(stamina)}</span>
      </div>
    </div>
  );
});

export const ClockChip = memo(function ClockChip() {
  const t = useT();
  const timeOfDay = useGame((s) => s.timeOfDay);
  const day = useGame((s) => s.day);
  return (
    <div className="clock-chip">
      <span className="sun-icon" aria-hidden>
        <PhaseIcon phase={phaseOf(timeOfDay)} />
      </span>
      <span>{formatClock(timeOfDay)}</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span className="day-num">{t('hud.day', { n: day })}</span>
    </div>
  );
});

/**
 * On-screen pointer toward the tracked objective.
 *
 * - Off-screen: a gold arrow pinned to the edge of the viewport, pointing at
 *   the target, with the live distance underneath.
 * - On-screen: the arrow floats above the marker in the world so the eye lands
 *   on the exact spot.
 *
 * Positions come from `game.guidance()` (projected world position), not CSS, so
 * it stays correct at any aspect ratio and on phones.
 */
export const ObjectivePointer = memo(function ObjectivePointer({ hidden = false }: { hidden?: boolean }) {
  useT();
  const trackedQuest = useGame((s) => s.trackedQuest);
  const quests = useGame((s) => s.quests);
  const { game } = useEngine();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const distRef = useRef<HTMLSpanElement | null>(null);

  // The pointer is updated every frame, so it writes straight to the DOM
  // instead of going through React state (a 60 Hz re-render of the HUD would
  // cost more than the pointer is worth on a phone).
  useEffect(() => {
    if (!game || hidden) return;
    let raf = 0;
    let lastVisible: boolean | null = null;
    let lastDist = '';
    const step = () => {
      raf = requestAnimationFrame(step);
      const g = game.guidance();
      const wrap = wrapRef.current;
      const arrow = arrowRef.current;
      const distEl = distRef.current;
      if (!wrap || !arrow || !distEl) return;
      // Only draw the edge arrow while the target is off screen: when the
      // beacon itself is visible the arrow is noise.
      const show = !!g && !g.onScreen && g.distance >= 5;
      if (show !== lastVisible) {
        wrap.style.display = show ? '' : 'none';
        lastVisible = show;
      }
      if (!show || !g) return;
      wrap.style.left = `${g.x.toFixed(2)}%`;
      wrap.style.top = `${g.y.toFixed(2)}%`;
      arrow.style.transform = `rotate(${g.edgeAngle.toFixed(1)}deg)`;
      const text = g.distance > 1000 ? `${(g.distance / 1000).toFixed(1)} km` : `${Math.round(g.distance)} m`;
      if (text !== lastDist) {
        distEl.textContent = text;
        lastDist = text;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [game, hidden, trackedQuest, quests]);

  if (hidden) return null;

  return (
    <div ref={wrapRef} className="obj-pointer edge" style={{ display: 'none' }} aria-hidden>
      <div ref={arrowRef} className="obj-pointer-arrow" style={{ transform: 'rotate(0deg)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.6 20.5 21 12 16.4 3.5 21z"
            fill="#fff6e2"
            stroke="#1a1204"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span ref={distRef} className="obj-pointer-dist" />
    </div>
  );
});

export const ObjectivePill = memo(function ObjectivePill({ hidden = false }: { hidden?: boolean }) {
  const t = useT();
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
        <span className="obj-title">{questTitle(quest.id, quest.title)}</span>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {current ? objectiveText(quest.id, state.progress, current.text) : t('hud.questComplete')}
        </div>
      </div>
      {heading && (
        <div className="obj-distance">
          <span className="obj-dir">{compassWord(heading.angle)}</span>
          {heading.distance > 1000 ? `${(heading.distance / 1000).toFixed(1)}km` : `${Math.round(heading.distance)}m`}
        </div>
      )}
    </div>
  );
});

/** Turns a world heading into the cardinal letter the player should walk toward. */
function compassWord(angleDeg: number): string {
  // The pointer is drawn with 0° pointing north (−Z) and grows clockwise.
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((angleDeg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

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
        <div className="area-chip">{placeName(area)}</div>
      </div>

      <MiniMap />

      <div className="clock-slot">
        <ClockChip />
      </div>

      <div className="hud-bottom-left" style={{ bottom: `calc(${isTouch ? 148 : 20}px + var(--safe-bottom))` }}>
        <ObjectivePill hidden={dialogueOpen} />
      </div>


      <ObjectivePointer hidden={dialogueOpen} />

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
