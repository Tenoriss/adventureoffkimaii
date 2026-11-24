import { sampleHeight, WATER_LEVEL } from './terrain';
import { RIVERS, LAKES, ROADS, VILLAGES } from './features';

/**
 * Bakes the full valley into an offscreen canvas for the world map and the
 * minimap. Cached by the caller so it is computed at most once per session.
 */
let cached: HTMLCanvasElement | null = null;
let cachedSize = 0;

/** Shared, cached world map bake (minimap and world map both use it). */
export function getWorldMapImage(size = 640): HTMLCanvasElement {
  if (cached && cachedSize >= size) return cached;
  cached = bakeWorldMap(size);
  cachedSize = size;
  return cached;
}

export function bakeWorldMap(size = 640): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const extent = 2000;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size - 0.5) * extent;
      const wz = (py / size - 0.5) * extent;
      const h = sampleHeight(wx, wz);
      let r: number;
      let g: number;
      let b: number;
      if (h < WATER_LEVEL) {
        const d = Math.min(1, (WATER_LEVEL - h) / 10);
        r = 30 - d * 8;
        g = 74 - d * 18;
        b = 110 - d * 18;
      } else if (h < 1.8) {
        // Bright shoreline sand.
        r = 214;
        g = 199;
        b = 158;
      } else if (h > 118) {
        r = 240;
        g = 245;
        b = 250;
      } else if (h > 82) {
        const t = (h - 82) / 36;
        r = 150 + t * 84;
        g = 141 + t * 92;
        b = 129 + t * 108;
      } else if (h > 34) {
        const t = (h - 34) / 48;
        r = 92 + t * 56;
        g = 104 + t * 34;
        b = 64 + t * 62;
      } else {
        const t = Math.max(0, (h - 1.8) / 32);
        r = 104 + t * 30;
        g = 142 + t * 16;
        b = 84 + t * 20;
      }
      const i = (py * size + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Contour-like shading: a very light self-blend keeps it from looking like
  // a satellite photo, then a warm paper wash pulls the palette together.
  ctx.globalAlpha = 0.22;
  ctx.drawImage(canvas, 0, 0, size, size);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(198, 176, 130, 0.14)';
  ctx.fillRect(0, 0, size, size);

  // Fine grid, like a cartographer's ruling.
  ctx.strokeStyle = 'rgba(20, 40, 60, 0.09)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const p = (i / 8) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const scale = size / extent;
  const ox = size / 2;
  const oz = size / 2;

  // Rivers as tapered strokes.
  for (const river of RIVERS) {
    ctx.strokeStyle = 'rgba(74,142,186,0.9)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < river.points.length - 1; i++) {
      ctx.lineWidth = Math.max(1, river.width * scale * 1.4 * (1 - i / river.points.length));
      ctx.beginPath();
      ctx.moveTo(river.points[i][0] * scale + ox, river.points[i][1] * scale + oz);
      ctx.lineTo(river.points[i + 1][0] * scale + ox, river.points[i + 1][1] * scale + oz);
      ctx.stroke();
    }
  }

  // Lakes.
  for (const lake of LAKES) {
    ctx.fillStyle = 'rgba(58,124,166,0.92)';
    ctx.beginPath();
    ctx.ellipse(lake.x * scale + ox, lake.z * scale + oz, lake.rx * scale, lake.rz * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,210,235,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Roads.
  for (const road of ROADS) {
    ctx.strokeStyle = 'rgba(206,180,136,0.8)';
    ctx.lineWidth = Math.max(1, road.width * scale);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    road.points.forEach(([x, z], i) => {
      const px = x * scale + ox;
      const py = z * scale + oz;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Village footprints.
  for (const v of VILLAGES) {
    ctx.fillStyle = 'rgba(30,22,14,0.5)';
    for (const [hx, hz, sx, sz, rot] of v.houses) {
      const x = v.x * scale + ox + hx * scale;
      const z = v.z * scale + oz + hz * scale;
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(rot);
      ctx.fillRect((-sx * scale) / 2, (-sz * scale) / 2, sx * scale, sz * scale);
      ctx.restore();
    }
  }

  return canvas;
}
