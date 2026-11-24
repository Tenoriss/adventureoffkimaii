import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from '../world/props';
import { sampleHeight, sampleSlope, WATER_LEVEL } from '../world/terrain';
import { clamp, lerp, angleDelta } from '../world/noise';

export interface PlayerPalette {
  robe: string;
  trim: string;
  skin: string;
  hair: string;
  cloak: string;
}

export const DEFAULT_PALETTE: PlayerPalette = {
  robe: '#4a86a6',
  trim: '#d39a54',
  skin: '#e8bb95',
  hair: '#3a2a22',
  cloak: '#5c8fae',
};

const GRAVITY = -26;
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.4;
const SWIM_SPEED = 2.6;
const MAX_FALL = -40;

export class Player {
  readonly rig: CharacterRig;
  readonly group: THREE.Group;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  sprinting = false;
  swimming = false;
  moving = false;
  inWater = false;
  speedBoostUntil = 0;
  mistUntil = 0;
  /** Vertical speed used for landing impact effects. */
  lastLandVy = 0;
  animationTime = 0;
  private bob = 0;

  constructor(scene: THREE.Scene, palette: PlayerPalette = DEFAULT_PALETTE) {
    this.rig = buildCharacter(palette);
    this.group = new THREE.Group();
    this.group.add(this.rig.group);
    scene.add(this.group);
  }

  spawn(x: number, z: number): void {
    this.position.set(x, sampleHeight(x, z) + 0.1, z);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.grounded = true;
    this.syncTransform();
  }

  get eyeHeight(): number {
    return 1.5;
  }

  /** Horizontal speed for UI / audio. */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  update(
    dt: number,
    move: { x: number; y: number; sprint: boolean; jump: boolean },
    cameraYaw: number,
  ): { jumped: boolean; landed: boolean } {
    const now = performance.now();
    let jumped = false;
    let landed = false;

    const groundH = sampleHeight(this.position.x, this.position.z);
    const waterSurface = WATER_LEVEL;
    const depth = waterSurface - groundH;
    this.inWater = groundH < waterSurface - 0.15 && this.position.y < waterSurface + 0.6;
    this.swimming = depth > 1.6 && this.position.y < waterSurface + 0.35;

    const slope = sampleSlope(this.position.x, this.position.z);
    let maxSpeed = WALK_SPEED;
    const boost = now < this.speedBoostUntil ? 1.28 : 1;
    if (this.swimming) {
      maxSpeed = SWIM_SPEED;
    } else if (move.sprint) {
      maxSpeed = RUN_SPEED * boost;
    } else {
      maxSpeed = WALK_SPEED * boost;
    }
    // Uphill costs speed, downhill gives a little.
    if (!this.swimming) maxSpeed *= clamp(1 - (slope - 0.45) * 0.6, 0.55, 1.15);

    this.sprinting = move.sprint && !this.swimming && move.y > 0.15;

    // Camera-relative desired direction.
    const len = Math.hypot(move.x, move.y);
    this.moving = len > 0.06;
    let desiredX = 0;
    let desiredZ = 0;
    if (this.moving) {
      const nx = move.x / len;
      const ny = move.y / len;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      // Forward is -Z in camera space.
      desiredX = nx * cos - ny * sin;
      desiredZ = -nx * sin - ny * cos;
      const targetYaw = Math.atan2(desiredX, desiredZ);
      this.yaw += angleDelta(this.yaw, targetYaw) * Math.min(1, dt * 12);
    }

    const accel = this.grounded ? 34 : 14;
    const targetVX = desiredX * maxSpeed * len;
    const targetVZ = desiredZ * maxSpeed * len;
    this.velocity.x = lerp(this.velocity.x, targetVX, Math.min(1, accel * dt));
    this.velocity.z = lerp(this.velocity.z, targetVZ, Math.min(1, accel * dt));

    // Vertical motion.
    if (this.swimming) {
      this.velocity.y = lerp(this.velocity.y, 0, Math.min(1, dt * 6));
      const floatTarget = waterSurface - 0.55;
      this.position.y = lerp(this.position.y, floatTarget, Math.min(1, dt * 3.4));
      if (move.jump) {
        this.velocity.y = 4.2;
        this.position.y += this.velocity.y * dt;
        jumped = true;
      }
      if (groundH > waterSurface - 1.2 && this.position.y < groundH + 0.4) {
        this.position.y = groundH;
      }
    } else {
      if (move.jump && this.grounded) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
        jumped = true;
      }
      this.velocity.y += GRAVITY * dt * (now < this.mistUntil ? 0.45 : 1);
      if (this.velocity.y < MAX_FALL) this.velocity.y = MAX_FALL;
      this.position.y += this.velocity.y * dt;
    }

    // Horizontal integration with simple terrain blocking for very steep slopes.
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;
    const nextGround = sampleHeight(nextX, nextZ);
    const climb = nextGround - this.position.y;
    const tooSteep = climb > 1.35 && !this.swimming;
    if (!tooSteep) {
      this.position.x = nextX;
      this.position.z = nextZ;
    } else {
      this.velocity.x *= 0.2;
      this.velocity.z *= 0.2;
    }

    // Ground collision.
    const newGround = sampleHeight(this.position.x, this.position.z);
    // If something moved us below the surface (teleport, chunk rebuild), snap
    // back up instead of falling through the world.
    if (this.position.y < newGround - 2.5) {
      this.position.y = newGround;
      this.velocity.y = 0;
    }
    const wasGrounded = this.grounded;
    if (this.position.y <= newGround + 0.02) {
      this.lastLandVy = this.velocity.y;
      this.position.y = newGround;
      if (!wasGrounded && this.velocity.y < -6) landed = true;
      this.velocity.y = 0;
      this.grounded = true;
    } else if (!this.swimming) {
      this.grounded = false;
    }
    if (this.swimming) this.grounded = false;

    // Keep the player inside the world.
    const radius = Math.hypot(this.position.x, this.position.z);
    if (radius > 1000) {
      const k = 1000 / radius;
      this.position.x *= k;
      this.position.z *= k;
    }

    this.animate(dt);
    this.syncTransform();
    return { jumped, landed };
  }

  private animate(dt: number): void {
    const speed = this.horizontalSpeed;
    const cycle = speed > 0.4 ? 8.5 + (speed / RUN_SPEED) * 4 : 0;
    this.animationTime += dt * cycle;
    const t = this.animationTime;
    const swing = Math.min(1, speed / RUN_SPEED);

    const { rig } = this;
    if (this.swimming) {
      rig.legL.rotation.x = Math.sin(t * 2) * 0.5;
      rig.legR.rotation.x = -Math.sin(t * 2) * 0.5;
      rig.armL.rotation.x = -1.6 + Math.sin(t * 2.4) * 0.5;
      rig.armR.rotation.x = -1.6 - Math.sin(t * 2.4) * 0.5;
      rig.torso.rotation.x = 0.38;
      rig.torso.position.y = 1.02;
    } else if (this.grounded) {
      rig.legL.rotation.x = Math.sin(t) * 0.72 * swing;
      rig.legR.rotation.x = -Math.sin(t) * 0.72 * swing;
      rig.armL.rotation.x = -Math.sin(t) * 0.62 * swing;
      rig.armR.rotation.x = Math.sin(t) * 0.62 * swing;
      rig.armL.rotation.z = 0.12;
      rig.armR.rotation.z = -0.12;
      this.bob = Math.abs(Math.sin(t)) * 0.05 * swing;
      rig.torso.position.y = 1.02 + this.bob;
      rig.torso.rotation.x = lerp(rig.torso.rotation.x, swing * 0.14, Math.min(1, dt * 8));
      rig.torso.rotation.z = Math.sin(t) * 0.04 * swing;
    } else {
      rig.legL.rotation.x = -0.5;
      rig.legR.rotation.x = 0.25;
      rig.armL.rotation.x = -0.9;
      rig.armR.rotation.x = -0.9;
      rig.torso.position.y = 1.02;
      rig.torso.rotation.x = -0.12;
    }
    rig.cloak.rotation.x = Math.sin(t * 0.85) * 0.06 - speed * 0.014;
    rig.head.rotation.y = Math.sin(t * 0.27) * 0.06;
  }

  private syncTransform(): void {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    // Keep the contact shadow on the ground and fade it while airborne.
    const ground = sampleHeight(this.position.x, this.position.z);
    const height = Math.max(0, this.position.y - ground);
    const mat = this.rig.shadow.material as THREE.MeshBasicMaterial;
    mat.opacity = this.swimming ? 0 : Math.max(0.02, 0.28 - height * 0.05);
    this.rig.shadow.position.y = ground - this.position.y + 0.03;
    const scale = 1 + Math.min(height, 6) * 0.1;
    this.rig.shadow.scale.set(scale, 1, scale);
    this.rig.shadow.visible = !this.swimming;
  }
}
