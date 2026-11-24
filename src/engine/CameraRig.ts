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

  /**
   * Trees that can swallow the camera, supplied by the chunk manager each
   * frame. Optional so the rig still works in tests and on first frame.
   */
  setFoliage(blocks: { x: number; z: number; y: number; r: number }[]): void {
    this.foliage = blocks;
  }

  private foliage: { x: number; z: number; y: number; r: number }[] = [];
  /** Extra yaw used to slip the camera past a trunk instead of into it. */
  private avoidYaw = 0;
  private avoidYawTarget = 0;

  /** True when the straight arm from the focus point to `pos` hits a canopy. */
  private armBlocked(pos: THREE.Vector3): boolean {
    if (this.foliage.length === 0) return false;
    for (let i = 3; i <= 10; i++) {
      const t = i / 10;
      const sx = lerp(this.smoothedTarget.x, pos.x, t);
      const sy = lerp(this.smoothedTarget.y, pos.y, t);
      const sz = lerp(this.smoothedTarget.z, pos.z, t);
      for (const f of this.foliage) {
        const dx = sx - f.x;
        const dz = sz - f.z;
        const radius = f.r + 0.55;
        if (dx * dx + dz * dz > radius * radius) continue;
        if (sy < f.y - 0.3 || sy > f.y + 8.5) continue;
        return true;
      }
    }
    return false;
  }

  update(dt: number, targetPos: THREE.Vector3, snap = false): void {
    const focus = this.tmp.set(targetPos.x, targetPos.y + 1.45, targetPos.z);
    if (snap) this.smoothedTarget.copy(focus);
    else this.smoothedTarget.lerp(focus, Math.min(1, dt * 9));

    this.withAspect = this.aspectDistance;
    this.distance = lerp(this.distance, this.targetDistance * this.withAspect, Math.min(1, dt * 8));

    // Choose a shoulder offset that keeps the camera clear of tree trunks,
    // preferring the smallest change from the angle the player asked for.
    if (this.foliage.length > 0) {
      const offsets = [0, 0.26, -0.26, 0.5, -0.5, 0.8, -0.8];
      let chosen = this.avoidYawTarget;
      let bestCost = Infinity;
      for (const o of offsets) {
        const cosP = Math.cos(this.pitch);
        const probe = new THREE.Vector3(
          this.smoothedTarget.x + Math.sin(this.yaw - o) * cosP * this.distance,
          this.smoothedTarget.y - Math.sin(this.pitch) * this.distance + 0.9,
          this.smoothedTarget.z + Math.cos(this.yaw - o) * cosP * this.distance,
        );
        probe.y = Math.max(probe.y, sampleHeight(probe.x, probe.z) + 1.4);
        const cost = (this.armBlocked(probe) ? 10 : 0) + Math.abs(o) + Math.abs(o - this.avoidYaw) * 0.6;
        if (cost < bestCost) {
          bestCost = cost;
          chosen = o;
          if (cost === Math.abs(o)) break;
        }
      }
      this.avoidYawTarget = Object.is(chosen, -0) ? 0 : chosen;
    } else {
      this.avoidYawTarget = 0;
    }
    this.avoidYaw = lerp(this.avoidYaw, this.avoidYawTarget, Math.min(1, dt * 6));

    const armYaw = this.yaw - this.avoidYaw;
    const cosPitch = Math.cos(this.pitch);
    const dirX = Math.sin(armYaw) * cosPitch;
    const dirZ = Math.cos(armYaw) * cosPitch;
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

    // Pull in if a tree canopy would swallow the camera. Trees are modelled as
    // a vertical cylinder from the ground to the top of the crown; the camera
    // slides toward the player until it is clear of every nearby trunk.
    if (this.foliage.length > 0) {
      // Last resort (offset could not find a clear lane): shorten the arm, but
      // stop at a comfortable minimum so we never sit on the player's neck.
      const steps = 10;
      for (let i = 4; i <= steps; i++) {
        const t = i / steps;
        const sx = lerp(this.smoothedTarget.x, desired.x, t);
        const sy = lerp(this.smoothedTarget.y, desired.y, t);
        const sz = lerp(this.smoothedTarget.z, desired.z, t);
        let blocked = false;
        for (const f of this.foliage) {
          const dx = sx - f.x;
          const dz = sz - f.z;
          const radius = f.r + 0.55;
          if (dx * dx + dz * dz > radius * radius) continue;
          if (sy < f.y - 0.3 || sy > f.y + 8.5) continue;
          blocked = true;
          break;
        }
        if (blocked) {
          const keep = Math.max(0.55, t - 0.14);
          desired.set(
            lerp(this.smoothedTarget.x, desired.x, keep),
            lerp(this.smoothedTarget.y, desired.y, keep),
            lerp(this.smoothedTarget.z, desired.z, keep),
          );
          break;
        }
      }
      // Re-clamp after the pull-in so the shorter arm stays above the ground.
      const groundNow = sampleHeight(desired.x, desired.z);
      desired.y = Math.max(desired.y, groundNow + 1.2, WATER_LEVEL + 1.0);
    }

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
