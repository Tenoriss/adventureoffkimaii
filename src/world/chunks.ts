/**
 * Chunked world streaming.
 *
 * A chunk is 64m x 64m. Terrain, water, vegetation and scatter props are all
 * generated on demand around the player and disposed outside the view radius,
 * so memory stays flat no matter how far you walk.
 */
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_SEGMENTS, sampleHeightFull, sampleSlope, roadProximity, WATER_LEVEL } from './terrain';
import { hash2i, mulberry32, clamp, lerp, smoothstep } from './noise';
import {
  buildPine,
  buildBushyTree,
  buildBirch,
  buildRock,
  buildReeds,
  buildFlower,
  buildGrassTuft,
  buildMushroom,
} from './props';
import { FOREST_GROVES, ROADS, VILLAGES, WAYSTONES, CAVE, WORLD_RADIUS } from './features';
import type { QualityPreset } from '../config/quality';

const GRASS_COLORS = [0x8ab35c, 0x79a44f, 0x9cbf68, 0x6d9647];
const SAND = new THREE.Color(0xd9c9a0);
const ROCK = new THREE.Color(0x8d8f93);
const SNOW = new THREE.Color(0xeef3f7);
const DIRT = new THREE.Color(0xa78b64);
const WET = new THREE.Color(0x6d7d6a);

export interface Chunk {
  key: string;
  cx: number;
  cz: number;
  group: THREE.Group;
  terrain: THREE.Mesh;
  water?: THREE.Mesh;
  props: THREE.Group;
  lastSeen: number;
  triangleCount: number;
  /** Owned geometries/materials to release when the chunk unloads. */
  disposables: { dispose: () => void }[];
}

export interface ChunkStats {
  active: number;
  pendingQueue: number;
  triangles: number;
  drawCalls: number;
}

/** Shared base geometries + materials created once and reused by every chunk. */
export class WorldAssets {
  readonly pine: THREE.BufferGeometry;
  readonly bushy: THREE.BufferGeometry;
  readonly birch: THREE.BufferGeometry;
  readonly rock: THREE.BufferGeometry;
  readonly rockBig: THREE.BufferGeometry;
  readonly reeds: THREE.BufferGeometry;
  readonly flower: THREE.BufferGeometry;
  readonly grass: THREE.BufferGeometry;
  readonly mushroom: THREE.BufferGeometry;
  readonly terrainMat: THREE.MeshStandardMaterial;
  readonly waterMat: THREE.MeshStandardMaterial;
  readonly waterMatFar: THREE.MeshStandardMaterial;

  constructor(detail: 'low' | 'high') {
    this.pine = buildPine();
    this.bushy = buildBushyTree();
    this.birch = buildBirch();
    this.rock = buildRock(false);
    this.rockBig = buildRock(true);
    this.reeds = buildReeds();
    this.flower = buildFlower();
    this.grass = buildGrassTuft();
    this.mushroom = buildMushroom();

    this.terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    });

    const waterDetail = detail === 'high';
    this.waterMat = new THREE.MeshStandardMaterial({
      color: waterDetail ? 0x56a8c8 : 0x4f9dc0,
      roughness: 0.22,
      metalness: 0.05,
      transparent: true,
      opacity: waterDetail ? 0.72 : 0.8,
      flatShading: true,
      depthWrite: false,
    });
    this.waterMatFar = new THREE.MeshStandardMaterial({
      color: 0x356f92,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
      flatShading: true,
    });
  }

  dispose(): void {
    for (const g of [this.pine, this.bushy, this.birch, this.rock, this.rockBig, this.reeds, this.flower, this.grass, this.mushroom]) {
      g.dispose();
    }
    this.terrainMat.dispose();
    this.waterMat.dispose();
    this.waterMatFar.dispose();
  }
}

/** Tree/rock distribution weight for a point, in [0,1]. */
export function vegetationDensity(x: number, z: number, slope: number, roadDist: number): number {
  if (slope > 0.62) return 0;
  let grove = 0;
  for (const g of FOREST_GROVES) {
    const d = Math.hypot(x - g.x, z - g.z) / g.r;
    if (d < 1) grove = Math.max(grove, (1 - smoothstep(0.35, 1, d)) * g.strength);
  }
  // Meadow speckle outside groves.
  const speckle = Math.max(0, hash2i(Math.floor(x / 7), Math.floor(z / 7), 404) - 0.82) * 1.6;
  let density = clamp(grove * 0.92 + speckle, 0, 1);
  // Clear around roads and villages.
  density *= smoothstep(4.5, 11, roadDist);
  // Keep landmark sightlines open: waystones and the cave mouth sit in clearings.
  for (const w of WAYSTONES) density *= smoothstep(5, 12, Math.hypot(x - w.x, z - w.z));
  density *= smoothstep(CAVE.radius * 0.9, CAVE.radius + 16, Math.hypot(x - CAVE.x, z - CAVE.z));
  for (const v of VILLAGES) {
    const d = Math.hypot(x - v.x, z - v.z);
    density *= smoothstep(v.radius * 0.7, v.radius + 9, d);
  }
  return density;
}

function pickTerrainColor(
  x: number,
  z: number,
  h: number,
  slope: number,
  roadDist: number,
  riverDist: number,
  lakeDepth: number,
  out: THREE.Color,
): THREE.Color {
  const rnd = hash2i(Math.floor(x * 1.7), Math.floor(z * 1.7), 77);
  const n = hash2i(Math.floor(x * 0.37), Math.floor(z * 0.37), 91);

  const base = new THREE.Color(GRASS_COLORS[Math.floor(rnd * GRASS_COLORS.length) % GRASS_COLORS.length]);
  base.lerp(new THREE.Color(GRASS_COLORS[Math.floor(n * 3) % GRASS_COLORS.length]), 0.35);

  // Dry lowlands near water, greener on slopes.
  base.lerp(WET, smoothstep(2.5, -0.5, h) * 0.45);

  // Altitude banding: grass -> rock -> snow.
  base.lerp(ROCK, smoothstep(52, 96, h + n * 12));
  base.lerp(SNOW, smoothstep(104, 142, h + n * 16));

  // Steep faces always show rock.
  base.lerp(ROCK, smoothstep(0.52, 0.95, slope));

  // Shores.
  if (h < WATER_LEVEL + 1.4 || lakeDepth > 0.35) {
    base.lerp(SAND, clamp(1 - (h - WATER_LEVEL) / 1.8, 0.25, 1));
  }
  if (riverDist < 20) {
    base.lerp(WET, (1 - riverDist / 20) * 0.35);
    if (riverDist < 9) base.lerp(SAND, clamp(1 - riverDist / 9, 0, 1) * 0.8);
  }

  // Dirt roads blend into the terrain colour.
  base.lerp(DIRT, smoothstep(6.5, 1.2, roadDist) * 0.85);

  out.copy(base);
  return out;
}

export interface ChunkBuildOptions {
  preset: QualityPreset;
  assets: WorldAssets;
  scene: THREE.Scene;
  seed: number;
}

export function buildChunk(cx: number, cz: number, opts: ChunkBuildOptions): Chunk {
  const { preset, assets } = opts;
  const seg = preset.level === 'verylow' ? 8 : CHUNK_SEGMENTS;
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const group = new THREE.Group();
  group.position.set(ox, 0, oz);

  // ---------------- Terrain ----------------
  const vCount = seg + 1;
  const positions = new Float32Array(vCount * vCount * 3);
  const colors = new Float32Array(vCount * vCount * 3);
  const indices: number[] = [];
  const heights = new Float32Array(vCount * vCount);
  const step = CHUNK_SIZE / seg;
  const tmpColor = new THREE.Color();

  let minH = Infinity;
  let maxH = -Infinity;

  for (let iz = 0; iz < vCount; iz++) {
    for (let ix = 0; ix < vCount; ix++) {
      const lx = ix * step;
      const lz = iz * step;
      const wx = ox + lx;
      const wz = oz + lz;
      const meta = sampleHeightFull(wx, wz);
      let h = meta.height;
      // Skirts help hide seams on coarse LODs.
      const idx = iz * vCount + ix;
      heights[idx] = h;
      positions[idx * 3] = lx;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = lz;

      const slope = sampleSlope(wx, wz);
      const roadDist = roadProximity(wx, wz, ROADS);
      pickTerrainColor(wx, wz, h, slope, roadDist, meta.riverDist, meta.lakeDepth, tmpColor);
      colors[idx * 3] = tmpColor.r;
      colors[idx * 3 + 1] = tmpColor.g;
      colors[idx * 3 + 2] = tmpColor.b;

      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
  }

  for (let iz = 0; iz < seg; iz++) {
    for (let ix = 0; ix < seg; ix++) {
      const a = iz * vCount + ix;
      const b = a + 1;
      const c = a + vCount;
      const d = c + 1;
      // Alternate diagonal for a less regular low-poly look.
      if ((ix + iz) % 2 === 0) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, c, d, a, d, b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const terrain = new THREE.Mesh(geo, assets.terrainMat);
  terrain.receiveShadow = preset.shadows;
  terrain.castShadow = false;
  terrain.matrixAutoUpdate = false;
  terrain.updateMatrix();
  group.add(terrain);

  let triangleCount = indices.length / 3;

  // ---------------- Water ----------------
  let water: THREE.Mesh | undefined;
  if (minH < WATER_LEVEL + 0.4) {
    const wGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 1, 1);
    wGeo.rotateX(-Math.PI / 2);
    wGeo.translate(CHUNK_SIZE / 2, WATER_LEVEL, CHUNK_SIZE / 2);
    water = new THREE.Mesh(wGeo, assets.waterMat);
    water.position.y = 0;
    water.receiveShadow = false;
    water.matrixAutoUpdate = false;
    water.updateMatrix();
    group.add(water);
    triangleCount += 2;
  }

  // ---------------- Vegetation ----------------
  const props = new THREE.Group();
  props.name = 'props';
  group.add(props);

  const rnd = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ opts.seed);
  const pineMatrices: THREE.Matrix4[] = [];
  const bushyMatrices: THREE.Matrix4[] = [];
  const birchMatrices: THREE.Matrix4[] = [];
  const rockMatrices: THREE.Matrix4[] = [];
  const rockBigMatrices: THREE.Matrix4[] = [];
  const reedMatrices: THREE.Matrix4[] = [];
  const grassMatrices: THREE.Matrix4[] = [];
  const flowerMatrices: THREE.Matrix4[] = [];
  const mushroomMatrices: THREE.Matrix4[] = [];

  const nearVillage = VILLAGES.some((v) => Math.hypot(ox + 32 - v.x, oz + 32 - v.z) < v.radius + 20);
  const candidates = Math.round(lerp(46, 116, preset.propDensity));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < candidates; i++) {
    const lx = rnd() * CHUNK_SIZE;
    const lz = rnd() * CHUNK_SIZE;
    const wx = ox + lx;
    const wz = oz + lz;
    if (Math.hypot(wx, wz) > WORLD_RADIUS + 80) continue;

    const meta = sampleHeightFull(wx, wz);
    const h = meta.height;
    if (h < WATER_LEVEL + 0.6) {
      // Reeds at the waterline.
      if (preset.decorations && h > WATER_LEVEL - 0.9 && rnd() < 0.5) {
        const sc = 0.7 + rnd() * 0.6;
        m.compose(v.set(lx, Math.max(h, WATER_LEVEL - 0.3), lz), q.setFromAxisAngle(up, rnd() * 6.28), s.set(sc, sc, sc));
        reedMatrices.push(m.clone());
      }
      continue;
    }

    const slope = sampleSlope(wx, wz);
    if (slope > 0.75) continue;
    const roadDist = roadProximity(wx, wz, ROADS);
    const density = vegetationDensity(wx, wz, slope, roadDist);
    if (density <= 0.02) continue;
    if (rnd() > density * (0.55 + preset.propDensity * 0.6)) continue;

    const snowLine = 100 + hash2i(Math.floor(wx), Math.floor(wz), 3) * 18;
    const rot = rnd() * Math.PI * 2;
    q.setFromAxisAngle(up, rot);

    if (h > snowLine) {
      // Frozen highlands: only rocks.
      if (rnd() < 0.55) {
        const sc = 0.7 + rnd() * 1.1;
        m.compose(v.set(lx, h - 0.15, lz), q, s.set(sc, sc * 0.85, sc));
        rockMatrices.push(m.clone());
      }
      continue;
    }

    if (slope > 0.45 || h > 62) {
      if (rnd() < 0.62) {
        const big = rnd() < 0.35;
        const sc = 0.55 + rnd() * (big ? 1.2 : 0.7);
        m.compose(v.set(lx, h - 0.12, lz), q, s.set(sc, sc * (0.8 + rnd() * 0.5), sc));
        (big ? rockBigMatrices : rockMatrices).push(m.clone());
      }
      continue;
    }

    const roll = rnd();
    if (roll < 0.5) {
      const sc = 0.75 + rnd() * 0.65;
      m.compose(v.set(lx, h - 0.05, lz), q, s.set(sc, sc * (0.9 + rnd() * 0.35), sc));
      pineMatrices.push(m.clone());
    } else if (roll < 0.74) {
      const sc = 0.7 + rnd() * 0.6;
      m.compose(v.set(lx, h - 0.05, lz), q, s.set(sc, sc * (0.85 + rnd() * 0.4), sc));
      bushyMatrices.push(m.clone());
    } else if (roll < 0.86) {
      const sc = 0.7 + rnd() * 0.5;
      m.compose(v.set(lx, h - 0.05, lz), q, s.set(sc, sc * (0.9 + rnd() * 0.3), sc));
      birchMatrices.push(m.clone());
    } else if (roll < 0.93) {
      const sc = 0.5 + rnd() * 0.8;
      m.compose(v.set(lx, h - 0.1, lz), q, s.set(sc, sc, sc));
      rockMatrices.push(m.clone());
    } else if (preset.decorations) {
      const sc = 0.7 + rnd() * 0.7;
      m.compose(v.set(lx, h - 0.05, lz), q, s.set(sc, sc, sc));
      mushroomMatrices.push(m.clone());
    }
  }

  // Ground detail: grass + flowers (only for mid/high quality).
  if (preset.grassDensity > 0 && !nearVillage) {
    const grassCandidates = Math.round(420 * preset.grassDensity);
    for (let i = 0; i < grassCandidates; i++) {
      const lx = rnd() * CHUNK_SIZE;
      const lz = rnd() * CHUNK_SIZE;
      const wx = ox + lx;
      const wz = oz + lz;
      const h = sampleHeightFull(wx, wz).height;
      if (h < WATER_LEVEL + 1.2) continue;
      const slope = sampleSlope(wx, wz);
      if (slope > 0.55) continue;
      if (roadProximity(wx, wz, ROADS) < 2.6) continue;
      const density = vegetationDensity(wx, wz, slope, 20);
      if (density < 0.05 && rnd() < 0.6) continue;
      const sc = 0.55 + rnd() * 0.6;
      m.compose(v.set(lx, h - 0.02, lz), q.setFromAxisAngle(up, rnd() * 6.28), s.set(sc, sc * (0.75 + rnd() * 0.5), sc));
      grassMatrices.push(m.clone());
      if (rnd() < 0.1) {
        const fs = 0.8 + rnd() * 0.6;
        m.compose(v.set(lx + 0.3, h, lz + 0.2), q, s.set(fs, fs, fs));
        flowerMatrices.push(m.clone());
      }
    }
  }

  const disposables: { dispose: () => void }[] = [geo];
  const foliageMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Ground scatter is lit flatly: at grazing angles a shaded blade of grass
  // reads as a dark speck, which makes meadows look dirty from a distance.
  const scatterMat = new THREE.MeshBasicMaterial({
    color: 0x9cb173,
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: true,
  });
  disposables.push(foliageMat, rockMat, scatterMat);

  const addInstanced = (
    geo: THREE.BufferGeometry,
    matrices: THREE.Matrix4[],
    mat: THREE.Material,
    castShadow: boolean,
    detail = false,
  ) => {
    if (matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow && preset.shadows;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.computeBoundingSphere();
    if (detail) mesh.userData.detail = true;
    props.add(mesh);
    triangleCount += (geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3) * matrices.length * 0.6;
  };

  addInstanced(assets.pine, pineMatrices, foliageMat, true);
  addInstanced(assets.bushy, bushyMatrices, foliageMat, true);
  addInstanced(assets.birch, birchMatrices, foliageMat, true);
  addInstanced(assets.rock, rockMatrices, rockMat, false);
  addInstanced(assets.rockBig, rockBigMatrices, rockMat, true);
  addInstanced(assets.reeds, reedMatrices, scatterMat, false, true);
  addInstanced(assets.grass, grassMatrices, scatterMat, false, true);
  addInstanced(assets.flower, flowerMatrices, scatterMat, false, true);
  addInstanced(assets.mushroom, mushroomMatrices, rockMat, false, true);

  props.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    }
  });

  if (water) disposables.push(water.geometry);
  group.updateMatrixWorld(true);

  return {
    key: `${cx},${cz}`,
    cx,
    cz,
    group,
    terrain,
    water,
    props,
    lastSeen: performance.now(),
    triangleCount,
    disposables,
  };
}

export function disposeChunk(chunk: Chunk, scene: THREE.Scene): void {
  scene.remove(chunk.group);
  chunk.group.traverse((o) => {
    const mesh = o as THREE.InstancedMesh;
    if (mesh.isInstancedMesh) mesh.dispose();
  });
  for (const d of chunk.disposables) d.dispose();
  chunk.disposables.length = 0;
  chunk.group.clear();
}

export const CHUNK_WORLD_SIZE = CHUNK_SIZE;
export const CHUNK_SAMPLES = CHUNK_SEGMENTS;
export { WATER_LEVEL };
