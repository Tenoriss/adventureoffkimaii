import { useEffect, useRef } from 'react';
import { useGame } from '../game/store';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import { Icon } from './Icon';
import { useT } from '../i18n';
import { placeName } from '../i18n/content';

/**
 * Full-screen parchment-style world map. The base image is baked once from the
 * heightfield (cheap, ~250ms on mobile) and markers are drawn on top.
 */
export function WorldMap() {
  const t = useT();
  const open = useGame((s) => s.mapOpen);
  const set = useGame((s) => s.set);
  const { game } = useEngine();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baked = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (open && !baked.current) {
      import('../world/mapBake').then(({ getWorldMapImage }) => {
        baked.current = getWorldMapImage(720);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !game) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(120, Math.round(rect.width));
      const h = Math.max(120, Math.round(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a1622';
      ctx.fillRect(0, 0, w, h);

      // Fit the whole 2000 m bake inside the viewport. `max(w, h)` used to make
      // the map as wide as the panel, which cropped ~45% of the north and south
      // — the peak objective of the last quest could fall outside the panel.
      const extent = 2000;
      const s = Math.min(w, h) / extent;
      const cx = w / 2;
      const cy = h / 2;
      // Soft backdrop for the letterboxed margins so the crop reads as a map
      // sheet rather than a bug.
      const sheet = Math.min(w, h);
      const grad = ctx.createRadialGradient(cx, cy, sheet * 0.2, cx, cy, sheet * 0.75);
      grad.addColorStop(0, 'rgba(30, 52, 74, 0.55)');
      grad.addColorStop(1, 'rgba(8, 18, 28, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      if (baked.current) {
        ctx.globalAlpha = 1;
        ctx.drawImage(baked.current, cx - 1000 * s, cy - 1000 * s, 2000 * s, 2000 * s);
      }

      const markers = game.mapMarkers();
      const toXY = (x: number, z: number) => [cx + x * s, cy + z * s] as const;

      // Villages.
      for (const v of markers.villages) {
        const [x, y] = toXY(v.x, v.z);
        ctx.fillStyle = '#f0c07a';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#fff4dd';
        ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;
        ctx.fillText(placeName(v.name), x, y - 10);
        ctx.shadowBlur = 0;
      }

      // Waystones.
      for (const ws of markers.waystones) {
        const [x, y] = toXY(ws.x, ws.z);
        const lit = useGame.getState().discovered.includes(ws.name);
        ctx.fillStyle = lit ? '#8fe3ff' : '#4a6b80';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();
        if (lit) {
          ctx.strokeStyle = 'rgba(143,227,255,0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Cave.
      {
        const [x, y] = toXY(markers.cave.x, markers.cave.z);
        ctx.fillStyle = '#c9a0ff';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Objective.
      if (markers.objective) {
        const [x, y] = toXY(markers.objective.x, markers.objective.z);
        ctx.strokeStyle = '#ffd894';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,216,148,0.35)';
        ctx.fill();
      }

      // Player.
      const [px, py] = toXY(game.playerPosition.x, game.playerPosition.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(127,216,200,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open, game]);

  if (!open) return null;

  const close = () => {
    set({ mapOpen: false });
    if (game) game.setPaused(false);
    bus.emit('playSfx', { name: 'close' });
  };

  return (
    <div className="panel-backdrop" onClick={close} role="presentation">
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('map.title')}>
        <div className="panel-head">
          <div>
            <h2>{t('map.title')}</h2>
            <div className="sub">{t('map.sub')}</div>
          </div>
          <button className="icon-btn" onClick={close} aria-label={t('map.title')}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="panel-body">
          <div className="map-canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
          <div className="map-legend" aria-label={t('map.legend')}>
            <span>
              <span className="legend-dot" style={{ background: '#f0c07a' }} />
              {t('map.villages')}
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#8fe3ff' }} />
              {t('map.waystones')}
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#c9a0ff' }} />
              {t('map.cave')}
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#ffd894' }} />
              {t('map.objective')}
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#ffffff' }} />
              {t('map.you')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
