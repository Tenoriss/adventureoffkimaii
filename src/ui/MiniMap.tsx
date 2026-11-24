import { useEffect, useRef } from 'react';
import { useGame } from '../game/store';
import { useEngine } from './useGameEngine';
import { VILLAGES, WAYSTONES, CAVE } from '../world/features';
import { useT } from '../i18n';

/**
 * Hand-drawn style minimap. The base relief is baked once (shared with the
 * full world map) and then rotated/cropped every frame around the player.
 */
export function MiniMap() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { game } = useEngine();
  const compassRef = useRef<HTMLSpanElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('../world/mapBake').then(({ getWorldMapImage }) => {
      if (!cancelled) baseRef.current = getWorldMapImage(512);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!game) return;
      const canvas = canvasRef.current;
      const base = baseRef.current;
      if (!canvas || !base) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(48, Math.round(canvas.getBoundingClientRect().width));
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#0b1522';
      ctx.fillRect(0, 0, size, size);

      // 320m visible radius, rotated so "up" is where the camera looks.
      const pxPerMetre = size / 640;
      const yaw = game.cameraRig.yaw;
      ctx.translate(size / 2, size / 2);
      ctx.rotate(yaw);
      ctx.scale(pxPerMetre, pxPerMetre);
      // The bake covers 2000m across its 100%-width image.
      ctx.translate(-game.playerPosition.x, -game.playerPosition.z);
      ctx.drawImage(base, -1000, -1000, 2000, 2000);

      const marker = (x: number, z: number, color: string, radius: number, ring = false) => {
        ctx.beginPath();
        ctx.arc(x, z, radius / pxPerMetre, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (ring) {
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 1 / pxPerMetre;
          ctx.stroke();
        }
      };

      for (const v of VILLAGES) marker(v.x, v.z, '#f0c07a', 3.4, true);
      for (const w of WAYSTONES) marker(w.x, w.z, '#8fe3ff', 2.6);
      marker(CAVE.x, CAVE.z, '#c9a0ff', 2.8);

      const objective = game.mapMarkers().objective;
      if (objective) {
        ctx.beginPath();
        ctx.arc(objective.x, objective.z, 7 / pxPerMetre, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd894';
        ctx.lineWidth = 1.8 / pxPerMetre;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(objective.x, objective.z, 2.4 / pxPerMetre, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd894';
        ctx.fill();
      }
      ctx.restore();

      // Player arrow, always centred and pointing up.
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4.8, 5.2);
      ctx.lineTo(0, 2.4);
      ctx.lineTo(-4.8, 5.2);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.restore();

      const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      if (compassRef.current) {
        const deg = ((-yaw * 180) / Math.PI) % 360;
        const dirs = ['N', 'E', 'S', 'W'];
        const idx = Math.round((((deg % 360) + 360) % 360) / 90) % 4;
        compassRef.current.textContent = dirs[idx];
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  return (
    <div className="minimap" aria-label={t('map.title')}>
      <canvas ref={canvasRef} />
      <span className="minimap-compass" ref={compassRef}>
        N
      </span>
      <button
        className="minimap-expand"
        aria-label={t('map.open')}
        onClick={() => {
          const s = useGame.getState();
          s.set({ mapOpen: true });
          if (game) game.setPaused(true);
        }}
      />
    </div>
  );
}
