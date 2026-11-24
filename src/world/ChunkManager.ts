import * as THREE from 'three';
import {
  buildChunk,
  disposeChunk,
  WorldAssets,
  CHUNK_WORLD_SIZE,
  type Chunk,
} from './chunks';
import type { QualityPreset } from '../config/quality';

interface PendingJob {
  cx: number;
  cz: number;
  priority: number;
}

/**
 * Streams chunks in a spiral around the player with a per-frame time budget so
 * loading never stutters the frame (critical on low-end phones).
 */
export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private queue: PendingJob[] = [];
  private assets: WorldAssets;
  private scene: THREE.Scene;
  private preset: QualityPreset;
  private seed: number;
  private lastCx = NaN;
  private lastCz = NaN;
  private dirty = true;
  private viewRadius = 4;
  /** Chunks baked under an older preset, rebuilt nearest-first. */
  private staleKeys = new Set<string>();
  constructor(scene: THREE.Scene, preset: QualityPreset, seed: number) {
    this.scene = scene;
    this.preset = preset;
    this.seed = seed;
    this.assets = new WorldAssets(preset.waterDetail ? 'high' : 'low');
  }

  /** Enough chunks to fill a disc of radius `viewChunks` (recomputed per preset). */
  get maxChunks(): number {
    const r = this.preset.viewChunks + 1;
    return Math.ceil(Math.PI * r * r) + 6;
  }

  get activeCount(): number {
    return this.chunks.size;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get triangleCount(): number {
    let t = 0;
    for (const c of this.chunks.values()) t += c.triangleCount;
    return t;
  }

  get loadedChunks(): Chunk[] {
    return [...this.chunks.values()];
  }

  /**
   * Apply a new quality preset.
   *
   * Chunks baked under the old preset hold the old prop density, so they are
   * re-queued at a lower priority and rebuilt nearest-first. Chunks stay on
   * screen meanwhile, which keeps the world seamless while the upgrade streams
   * in over the next few frames.
   */
  setPreset(preset: QualityPreset): void {
    if (preset.level === this.preset.level) return;
    const waterChanged = preset.waterDetail !== this.preset.waterDetail;
    this.preset = preset;
    this.viewRadius = preset.viewChunks + 1.5;
    this.dirty = true;
    if (Number.isNaN(this.lastCx)) return;
    if (waterChanged) {
      // Water material is shared with the new chunks only; keep old geometry,
      // it is disposed with the chunk.
      this.buildAssetsWithWater(preset);
    }
    this.rebuildQueue(this.lastCx, this.lastCz, 1);
    this.staleKeys = new Set(this.chunks.keys());
    for (const key of this.staleKeys) {
      const [cxs, czs] = key.split(',');
      this.queue.push({
        cx: Number(cxs),
        cz: Number(czs),
        priority: Math.hypot(Number(cxs) - this.lastCx, Number(czs) - this.lastCz),
      });
    }
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  /** Called every frame with the player position. */
  update(playerX: number, playerZ: number, viewDistanceScale = 1): void {
    const cx = Math.floor(playerX / CHUNK_WORLD_SIZE);
    const cz = Math.floor(playerZ / CHUNK_WORLD_SIZE);
    if (cx !== this.lastCx || cz !== this.lastCz) {
      this.lastCx = cx;
      this.lastCz = cz;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.rebuildQueue(cx, cz, viewDistanceScale);
    }
    // Unload far chunks immediately to free memory.
    const radius = Math.max(this.viewRadius, this.preset.viewChunks + 1.5);
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - cx) > radius || Math.abs(chunk.cz - cz) > radius) {
        disposeChunk(chunk, this.scene);
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Build a few queued chunks within a millisecond budget.
   * Returns the number of chunks built.
   */
  processQueue(budgetMs = 6): number {
    const start = performance.now();
    let built = 0;
    while (this.queue.length > 0) {
      if (performance.now() - start > budgetMs && built > 0) break;
      const job = this.queue.shift()!;
      const key = `${job.cx},${job.cz}`;
      const stale = this.staleKeys.has(key);
      if (this.chunks.has(key) && !stale) continue;
      if (this.chunks.size >= this.maxChunks) break;
      if (stale) {
        const old = this.chunks.get(key);
        if (old) disposeChunk(old, this.scene);
        this.chunks.delete(key);
        this.staleKeys.delete(key);
      }
      const chunk = buildChunk(job.cx, job.cz, {
        preset: this.preset,
        assets: this.assets,
        scene: this.scene,
        seed: this.seed,
      });
      this.chunks.set(key, chunk);
      this.scene.add(chunk.group);
      built++;
      if (built >= 3) break;
    }
    return built;
  }

  private rebuildQueue(cx: number, cz: number, scale: number): void {
    const r = Math.max(1, Math.round(this.preset.viewChunks * scale));
    const jobs: PendingJob[] = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dz);
        if (d > r + 0.35) continue;
        const key = `${cx + dx},${cz + dz}`;
        if (this.chunks.has(key) && !this.staleKeys.has(key)) continue;
        // Every job is prioritised nearest-first; loading more view radius is
        // therefore smooth even when the player stands still.
        jobs.push({ cx: cx + dx, cz: cz + dz, priority: d });
      }
    }
    // Nearest-first so the player always stands on real ground.
    jobs.sort((a, b) => a.priority - b.priority);
    this.queue = jobs;
  }

  /** Remove all chunks (used on quality change or teardown). */
  clear(): void {
    for (const chunk of this.chunks.values()) disposeChunk(chunk, this.scene);
    this.chunks.clear();
    this.queue.length = 0;
    this.staleKeys.clear();
  }

  private buildAssetsWithWater(preset: QualityPreset): void {
    this.assets.dispose();
    this.assets = new WorldAssets(preset.waterDetail ? 'high' : 'low');
  }

  /**
   * Distance at which props can be hidden without the player noticing.
   * Chunk-level frustum culling is done by three.js; this adds distance LOD.
   */
  /**
   * Two-tier distance LOD (the third tier is chunk culling done by three.js):
   *  - near: everything
   *  - mid:  ground scatter (grass, flowers, reeds, mushrooms) drops out
   *  - far:  the chunk itself is unloaded by `update()`
   * Trees and rocks stay for the whole view radius so forests never pop out.
   */
  applyDistanceLod(playerX: number, playerZ: number): void {
    // Ground scatter is small: hide it well before the tree LOD distance so it
    // never becomes a field of dark specks on the horizon.
    const near = Math.min(this.preset.lodFar, 78);
    const near2 = near * near;
    for (const chunk of this.chunks.values()) {
      const dx = chunk.cx * CHUNK_WORLD_SIZE + CHUNK_WORLD_SIZE / 2 - playerX;
      const dz = chunk.cz * CHUNK_WORLD_SIZE + CHUNK_WORLD_SIZE / 2 - playerZ;
      const d2 = dx * dx + dz * dz;
      const detailVisible = d2 < near2;
      for (const child of chunk.props.children) {
        if (child.userData.detail) child.visible = detailVisible;
      }
    }
  }

  dispose(): void {
    this.clear();
    this.assets.dispose();
  }
}
