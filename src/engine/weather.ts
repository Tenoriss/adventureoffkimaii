import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { getSoftSprite } from './sprite';

/**
 * Cheap particle weather: drifting pollen/fireflies by day and night, and a
 * light rain now and then. Uses a single Points object with a shader-free
 * material and CPU-side recycling inside a box around the player.
 */
export class Weather {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private count: number;
  private material: THREE.PointsMaterial;
  private origin = new THREE.Vector3();
  private rain: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private rainVel: Float32Array | null = null;
  private rainCount = 0;
  private bounds = 34;

  constructor(scene: THREE.Scene, preset: QualityPreset) {
    this.count = Math.min(preset.maxParticles, 320);
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.bounds * 2;
      this.positions[i * 3 + 1] = Math.random() * 22;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.bounds * 2;
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.35;
      this.velocities[i * 3 + 1] = -0.1 - Math.random() * 0.25;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      color: 0xfff2c4,
      size: 0.42,
      map: getSoftSprite(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      alphaTest: 0.02,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setPreset(preset: QualityPreset): void {
    this.points.visible = preset.maxParticles >= 120;
  }

  setRain(scene: THREE.Scene, enabled: boolean, preset: QualityPreset): void {
    if (enabled && !this.rain) {
      this.rainCount = Math.min(220, Math.max(40, preset.maxParticles));
      this.rainPositions = new Float32Array(this.rainCount * 3);
      this.rainVel = new Float32Array(this.rainCount * 3);
      for (let i = 0; i < this.rainCount; i++) {
        this.rainPositions[i * 3] = (Math.random() - 0.5) * 44;
        this.rainPositions[i * 3 + 1] = Math.random() * 26;
        this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
        this.rainVel[i * 3] = 0.6;
        this.rainVel[i * 3 + 1] = -16 - Math.random() * 8;
        this.rainVel[i * 3 + 2] = 0.3;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xcfe3f2,
        size: 0.22,
        map: getSoftSprite(),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        fog: false,
        alphaTest: 0.02,
      });
      this.rain = new THREE.Points(geo, mat);
      this.rain.frustumCulled = false;
      scene.add(this.rain);
    } else if (!enabled && this.rain) {
      scene.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as THREE.Material).dispose();
      this.rain = null;
      this.rainPositions = null;
      this.rainVel = null;
    }
  }

  /** particle colour shifts with time of day + mood. */
  setTint(color: THREE.Color, opacityScale: number, sizeScale = 1): void {
    this.material.color.copy(color);
    this.material.opacity = 0.6 * opacityScale;
    this.material.size = 0.42 * sizeScale;
  }

  update(dt: number, cameraPos: THREE.Vector3, time: number, windX: number, windZ: number): void {
    this.origin.copy(cameraPos);
    const pos = this.positions;
    const vel = this.velocities;
    const by = this.bounds;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      pos[i3] += (vel[i3] + windX * 0.6 + Math.sin(time + i) * 0.12) * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += (vel[i3 + 2] + windZ * 0.6 + Math.cos(time * 1.1 + i) * 0.12) * dt;
      // Recycle inside a box around the camera.
      if (pos[i3] > by) pos[i3] -= by * 2;
      else if (pos[i3] < -by) pos[i3] += by * 2;
      if (pos[i3 + 2] > by) pos[i3 + 2] -= by * 2;
      else if (pos[i3 + 2] < -by) pos[i3 + 2] += by * 2;
      if (pos[i3 + 1] < -2) {
        pos[i3 + 1] = 20 + Math.random() * 6;
        poReset(pos, i3, by);
      } else if (pos[i3 + 1] > 26) {
        pos[i3 + 1] = -1;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.position.set(this.origin.x, this.origin.y - 10, this.origin.z);

    if (this.rain && this.rainPositions && this.rainVel) {
      const rp = this.rainPositions;
      const rv = this.rainVel;
      for (let i = 0; i < this.rainCount; i++) {
        const i3 = i * 3;
        rp[i3] += rv[i3] * dt;
        rp[i3 + 1] += rv[i3 + 1] * dt;
        rp[i3 + 2] += rv[i3 + 2] * dt;
        if (rp[i3 + 1] < -3) {
          rp[i3] = (Math.random() - 0.5) * 44;
          rp[i3 + 1] = 22 + Math.random() * 8;
          rp[i3 + 2] = (Math.random() - 0.5) * 44;
        }
        if (rp[i3] > 22) rp[i3] -= 44;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.copy(this.origin);
    }
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.parent?.remove(this.points);
    if (this.rain) {
      this.rain.parent?.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as THREE.Material).dispose();
    }
  }
}

function poReset(pos: Float32Array, i3: number, bounds: number): void {
  pos[i3] = (Math.random() - 0.5) * bounds * 2;
  pos[i3 + 2] = (Math.random() - 0.5) * bounds * 2;
}
