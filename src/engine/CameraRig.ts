import * as THREE from 'three';
import { sampleHeight, WATER_LEVEL } from '../world/terrain';
import { clamp, lerp } from '../world/noise';

/**
 * Third-person orbit camera with terrain collision, smoothing and a
 * first-person-ish shoulder mode when you get close.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = -0.18;
  distance = 5.6;
  private targetDistance = 5.6;
  private smoothedTarget = new THREE.Vector3();
  private withAspect = 1;
  private shakeTime = 0;
  private shakeStrength = 0;
  private tmp = new THREE.Vector3();
  zoom = 0;
  private aspect = 1.6;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.15, 1200);
    this.camera.position.set(0, 6, 12);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    // Portrait phones get a narrower field of view, so widen the framing with a
    // slightly longer lens instead of clipping the character.
    const portrait = aspect < 1;
    this.camera.fov = portrait ? 70 : aspect < 1.35 ? 65 : 60;
    this.camera.updateProjectionMatrix();
  }

  /** Extra distance needed so the character fits on narrow screens. */
  private get aspectDistance(): number {
    if (this.aspect >= 1) return 1;
    return clamp(1 / Math.sqrt(this.aspect), 1, 1.85);
  }

  applyLook(dx: number, dy: number, invertY: boolean): void {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - (invertY ? -dy : dy) * 0.8, -1.15, 0.62);
    this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  }

  addZoom(amount: number): void {
    this.targetDistance = clamp(this.targetDistance + amount, 2.6, 13);
  }

  reset(playerYaw: number): void {
    this.yaw = playerYaw + Math.PI;
    this.pitch = -0.18;
    this.targetDistance = 5.6;
  }

  shake(strength: number, duration = 0.35): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt: number, targetPos: THREE.Vector3, snap = false): void {
    const focus = this.tmp.set(targetPos.x, targetPos.y + 1.45, targetPos.z);
    if (snap) this.smoothedTarget.copy(focus);
    else this.smoothedTarget.lerp(focus, Math.min(1, dt * 9));

    this.withAspect = this.aspectDistance;
    this.distance = lerp(this.distance, this.targetDistance * this.withAspect, Math.min(1, dt * 8));

    const cosPitch = Math.cos(this.pitch);
    const dirX = Math.sin(this.yaw) * cosPitch;
    const dirZ = Math.cos(this.yaw) * cosPitch;
    const dirY = -Math.sin(this.pitch);

    let desired = new THREE.Vector3(
      this.smoothedTarget.x + dirX * this.distance,
      this.smoothedTarget.y + dirY * this.distance + 0.9,
      this.smoothedTarget.z + dirZ * this.distance,
    );

    // Prevent the camera from going under the ground or into water.
    const ground = sampleHeight(desired.x, desired.z);
    const minY = Math.max(ground + 1.6, WATER_LEVEL + 1.2);
    if (desired.y < minY) desired.y = minY;

    // Pull in if a hill blocks the view between the player and the camera.
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = lerp(this.smoothedTarget.x, desired.x, t);
      const sy = lerp(this.smoothedTarget.y, desired.y, t);
      const sz = lerp(this.smoothedTarget.z, desired.z, t);
      const h = sampleHeight(sx, sz) + 1.05;
      if (sy < h) {
        const pull = Math.max(0.2, t - 0.12);
        desired = desired.clone().lerp(this.smoothedTarget, 1 - pull);
        desired.y = Math.max(desired.y, sampleHeight(desired.x, desired.z) + 0.75);
        break;
      }
    }

    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, Math.min(1, dt * 14));

    // Never let the near plane cut into tree canopies: shortest focus distance
    // is 2.6m, and anything closer than that is simply not rendered.
    this.camera.near = 0.35;

    // Screen shake.
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * Math.max(0, this.shakeTime) * 2.4;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      if (this.shakeTime <= 0) this.shakeStrength = 0;
    }

    this.camera.lookAt(this.smoothedTarget.x, this.smoothedTarget.y + 0.15, this.smoothedTarget.z);
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
