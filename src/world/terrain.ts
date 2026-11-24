/**
 * Pure heightfield generator. Shared by the renderer, the physics system and
 * the minimap so that everything agrees on where the ground is.
 */
import { fbm2, ridged2, smoothstep, clamp, lerp, hash2i } from './noise';
import {
  RIVERS,
  LAKES,
  VILLAGES,
  CAVE,
  WORLD_SEED,
  WATER_LEVEL,
  type Vec2,
} from './features';

export const CHUNK_SIZE = 64;
/** Height samples per chunk edge (resulting triangles per chunk = 2 * n^2). */
export const CHUNK_SEGMENTS = 16;

/* ------------------------------------------------------------------ */
/* Distance helpers                                                     */
/* ------------------------------------------------------------------ */

function distToSegment2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len2 = vx * vx + vz * vz || 1;
  let t = (wx * vx + wz * vz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + vx * t);
  const dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}

function distToPolyline(px: number, pz: number, pts: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment2(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/* ------------------------------------------------------------------ */
/* Base mountain / valley shape                                         */
/* ------------------------------------------------------------------ */

function baseHeight(x: number, z: number): number {
  // Large scale landmass.
  const continent = fbm2(x * 0.0016, z * 0.0016, 4, WORLD_SEED) - 0.5;

  // Mountain ridges, stronger toward the north and west edges of the map.
  const ridgeMask = smoothstep(0.15, 0.85, fbm2(x * 0.0021 + 40, z * 0.0021 - 20, 3, WORLD_SEED + 91));
  const ridges = ridged2(x * 0.0042, z * 0.0042, 5, WORLD_SEED + 17);
  const northness = smoothstep(-180, -560, z);
  const mountainAmp = 26 + ridged2(x * 0.0011, z * 0.0011, 2, WORLD_SEED + 55) * 118 * (0.45 + northness);

  // Rolling hills everywhere.
  const hills = fbm2(x * 0.0125, z * 0.0125, 4, WORLD_SEED + 7) - 0.5;

  // Fine detail.
  const detail = fbm2(x * 0.045, z * 0.045, 2, WORLD_SEED + 31) - 0.5;

  let h = 8;
  h += continent * 16;
  h += hills * 9;
  h += detail * 1.5;
  h += ridges * ridges * mountainAmp * ridgeMask;

  // Carve out the safe starting valley (south of the river).
  const valley = 1 - smoothstep(0, 1, Math.hypot(x - 30, z - 140) / 300);
  h = lerp(h, 3.2 + detail * 1.1 + hills * 2.4, valley * 0.72);

  return h;
}

/* ------------------------------------------------------------------ */
/* River carving cache (sampled per chunk is not enough — evaluate exact) */
/* ------------------------------------------------------------------ */

export interface RiverSample {
  distance: number;
  t: number; // 0..1 along river
  riverIndex: number;
}

export function riverProximity(x: number, z: number): RiverSample {
  let best = Infinity;
  let bestT = 0;
  let bestIndex = 0;
  for (let r = 0; r < RIVERS.length; r++) {
    const pts = RIVERS[r].points;
    let total = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segLens.push(l);
      total += l;
    }
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1];
      const bx = pts[i + 1][0], bz = pts[i + 1][1];
      const d = Math.sqrt(distToSegment2(x, z, ax, az, bx, bz));
      if (d < best) {
        best = d;
        // approximate parameter along the whole river
        const vx = bx - ax, vz = bz - az;
        const len2 = vx * vx + vz * vz || 1;
        let tt = ((x - ax) * vx + (z - az) * vz) / len2;
        tt = clamp(tt, 0, 1);
        bestT = (acc + tt * segLens[i]) / total;
        bestIndex = r;
      }
      acc += segLens[i];
    }
  }
  return { distance: best, t: bestT, riverIndex: bestIndex };
}

/** Lake falloff value: 1 at centre, 0 outside influence. */
export function lakeFalloff(x: number, z: number): { depth: number; bed: number; index: number } {
  let bestDepth = 0;
  let bestBed = 0;
  let bestIndex = -1;
  for (let i = 0; i < LAKES.length; i++) {
    const l = LAKES[i];
    const nx = (x - l.x) / l.rx;
    const nz = (z - l.z) / l.rz;
    const d = Math.sqrt(nx * nx + nz * nz);
    if (d < 1.35) {
      const f = 1 - smoothstep(0.55, 1.35, d);
      if (f > bestDepth) {
        bestDepth = f;
        bestBed = l.bed;
        bestIndex = i;
      }
    }
  }
  return { depth: bestDepth, bed: bestBed, index: bestIndex };
}

/* ------------------------------------------------------------------ */
/* Main height function                                                 */
/* ------------------------------------------------------------------ */

let cacheX = NaN;
let cacheZ = NaN;
let cacheH = 0;
let cacheMeta: HeightMeta | null = null;

export interface HeightMeta {
  height: number;
  /** Distance to nearest river centreline (metres). */
  riverDist: number;
  riverT: number;
  lakeDepth: number;
  /** 0..1 — how "settled"/flattened the ground is (village pads, roads). */
  pad: number;
  villageIndex: number;
  /** Approximate slope in metres per metre. */
  slope?: number;
}

/**
 * Sample the world height. Cheap for repeated calls — the last sample is
 * memoised because the physics step and the renderer both hammer this.
 */
export function sampleHeight(x: number, z: number): number {
  if (x === cacheX && z === cacheZ && cacheMeta) return cacheH;
  return sampleHeightFull(x, z).height;
}

export function sampleHeightFull(x: number, z: number): HeightMeta {
  if (x === cacheX && z === cacheZ && cacheMeta) return cacheMeta;

  let h = baseHeight(x, z);

  // ---- Rivers: carve a valley, then a channel bed ----
  const river = riverProximity(x, z);
  const riverDef = RIVERS[river.riverIndex];
  const riverCore = riverDef ? riverDef.width : 14;
  const riverInf = riverDef ? riverDef.influence : 70;
  let padFactor = 0;
  if (river.distance < riverInf) {
    const t = 1 - smoothstep(riverCore, riverInf, river.distance);
    // Pull terrain toward the river bed inside the valley.
    const target = (riverDef?.bed ?? -2) - 1.6;
    h = lerp(h, target + Math.max(0, river.distance - riverCore) * 0.18, t * 0.82);
    if (river.distance < riverCore * 1.15) {
      const core = 1 - smoothstep(riverCore * 0.5, riverCore * 1.15, river.distance);
      h = lerp(h, riverDef?.bed ?? -2, core);
    }
    padFactor = Math.max(padFactor, t * 0.25);
  }

  // ---- Lakes: carve basins ----
  const lake = lakeFalloff(x, z);
  if (lake.depth > 0) {
    const shore = lake.bed + 3.4;
    const mix = lake.depth;
    // Blend from current height to a smooth bowl.
    const bowl = lerp(lake.bed, shore, 1 - lake.depth);
    h = lerp(h, Math.min(h, bowl), mix * 0.92);
    padFactor = Math.max(padFactor, mix * 0.35);
  }

  // ---- Villages: flatten pads ----
  let villageIndex = -1;
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    const d = Math.hypot(x - v.x, z - v.z);
    const r = v.radius + 16;
    if (d < r) {
      const t = 1 - smoothstep(v.radius * 0.65, r, d);
      const padHeight = villagePadHeight(i);
      h = lerp(h, padHeight + (d / r) * 1.4, t * 0.9);
      padFactor = Math.max(padFactor, t);
      if (t > 0.4) villageIndex = i;
    }
  }

  // ---- Cave mouth: carve a bowl so the entrance is reachable ----
  {
    const d = Math.hypot(x - CAVE.x, z - CAVE.z);
    if (d < CAVE.radius + 12) {
      const t = 1 - smoothstep(CAVE.radius * 0.5, CAVE.radius + 12, d);
      const caveFloor = cavePadHeight();
      h = lerp(h, caveFloor, t * 0.85);
      padFactor = Math.max(padFactor, t * 0.8);
    }
  }

  // Keep the ocean floor from being too deep for rendering.
  h = clamp(h, -14, 220);

  const meta: HeightMeta = {
    height: h,
    riverDist: river.distance,
    riverT: river.t,
    lakeDepth: lake.depth,
    pad: padFactor,
    villageIndex,
  };
  cacheX = x;
  cacheZ = z;
  cacheH = h;
  cacheMeta = meta;
  return meta;
}

/** Flattened elevation used for each village plaza (constant per village). */
const VILLAGE_PADS = VILLAGES.map((_v, i) => 4.6 + hash2i(i * 37 + 11, 5, WORLD_SEED + 5) * 2.4);

function villagePadHeight(index: number): number {
  return VILLAGE_PADS[index] ?? 5.5;
}

function cavePadHeight(): number {
  return 7.2;
}

/** Terrain slope magnitude (metres/metre), sampled with a 2m delta. */
export function sampleSlope(x: number, z: number): number {
  const d = 2;
  const hx = sampleHeight(x + d, z) - sampleHeight(x - d, z);
  const hz = sampleHeight(x, z + d) - sampleHeight(x, z - d);
  return Math.hypot(hx, hz) / (2 * d);
}

/** Surface normal for the heightfield. */
export function sampleNormal(x: number, z: number, out: [number, number, number]): [number, number, number] {
  const d = 1.5;
  const hL = sampleHeight(x - d, z);
  const hR = sampleHeight(x + d, z);
  const hD = sampleHeight(x, z - d);
  const hU = sampleHeight(x, z + d);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * d;
  const len = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / len;
  out[1] = ny / len;
  out[2] = nz / len;
  return out;
}

/** Distance to the closest dirt road centreline (for terrain tinting). */
export function roadProximity(x: number, z: number, roads: { points: Vec2[] }[]): number {
  let best = Infinity;
  for (const r of roads) {
    const d = distToPolyline(x, z, r.points);
    if (d < best) best = d;
  }
  return best;
}

export { distToPolyline, WATER_LEVEL };
