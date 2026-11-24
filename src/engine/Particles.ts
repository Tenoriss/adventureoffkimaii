import * as THREE from 'three';
import { getSoftSprite } from './sprite';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  maxLife: number;
  material: THREE.PointsMaterial;
  gravity: number;
}

/**
 * Small pooled particle system: pickup sparkles, footstep dust, water splashes,
 * waystone activation rings. Fixed pool, no per-frame allocations.
 */
export class Particles {
  private scene: THREE.Scene;
  private bursts: Burst[] = [];
  private geo: THREE.BufferGeometry;
  private maxBursts = 8;
  private activeBursts = 0;

  constructor(scene: THREE.Scene, maxParticles: number) {
    this.scene = scene;
    const count = Math.max(24, Math.min(90, Math.round(maxParticles / 4)));
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.maxBursts = maxParticles < 150 ? 4 : 8;
  }

  spawn(
    origin: THREE.Vector3,
    color: number,
    opts: { count?: number; speed?: number; life?: number; gravity?: number; size?: number; spread?: number } = {},
  ): void {
    if (this.bursts.length >= this.maxBursts) {
      const oldest = this.bursts.shift();
      if (oldest) this.release(oldest);
    }
    const n = Math.min(this.geo.getAttribute('position').count, opts.count ?? 22);
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    const spread = opts.spread ?? 0.5;
    const speed = opts.speed ?? 2.4;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = origin.x + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.15;
      const r = Math.random() * speed;
      velocities[i * 3] = Math.cos(a) * r;
      velocities[i * 3 + 1] = up * speed;
      velocities[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: (opts.size ?? 0.22) * 1.6,
      map: getSoftSprite(),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
      alphaTest: 0.01,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    this.scene.add(points);
    const life = opts.life ?? 0.9;
    this.bursts.push({ points, velocities, life, maxLife: life, material, gravity: opts.gravity ?? -4.5 });
    this.activeBursts++;
  }

  private release(b: Burst): void {
    this.scene.remove(b.points);
    b.points.geometry.dispose();
    b.material.dispose();
    this.activeBursts = Math.max(0, this.activeBursts - 1);
  }

  update(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.release(b);
        this.bursts.splice(i, 1);
        continue;
      }
      const attr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let p = 0; p < attr.count; p++) {
        const p3 = p * 3;
        b.velocities[p3 + 1] += b.gravity * dt;
        arr[p3] += b.velocities[p3] * dt;
        arr[p3 + 1] += b.velocities[p3 + 1] * dt;
        arr[p3 + 2] += b.velocities[p3 + 2] * dt;
      }
      attr.needsUpdate = true;
      b.material.opacity = Math.max(0, b.life / b.maxLife);
    }
  }

  dispose(): void {
    for (const b of this.bursts) this.release(b);
    this.bursts = [];
    this.geo.dispose();
  }

  get active(): number {
    return this.activeBursts;
  }

  get burstTotal(): number {
    return this.geo.getAttribute('position').count;
  }
}
