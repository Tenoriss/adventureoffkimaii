import * as THREE from 'three';
import {
  buildHouse,
  buildWell,
  buildFenceSegment,
  buildLamp,
  buildMarketStall,
  buildRuins,
  buildWaystone,
  buildCaveMouth,
  buildSignpost,
  buildChest,
  buildCampfire,
  buildStarlitCairn,
  buildReeds,
  buildFlower,
  buildMushroom,
  buildRiverstone,
  buildBird,
  buildFish,
  type CharacterRig,
  buildCharacter,
} from './props';
import { sampleHeight, sampleSlope, WATER_LEVEL } from './terrain';
import {
  VILLAGES,
  WAYSTONES,
  CAVE,
  LURE,
  HERBS,
  SHORE_STONES,
  RIVERS,
  LAKES,
  ROADS,
  WORLD_RADIUS,
  type Vec2,
} from './features';
import { hash2i, mulberry32, clamp, lerp, smoothstep } from './noise';
import { NPCS } from '../game/dialogue';
import { POWERUP_SPOTS, POWER_UPS, type PowerupKind } from '../game/powerups';
import type { Interactable } from '../game/types';
import type { QualityPreset } from '../config/quality';

const SHARED = { userData: { shared: true } };

function markShared<T extends THREE.BufferGeometry>(g: T): T {
  g.userData = { ...SHARED.userData };
  return g;
}

/* ------------------------------------------------------------------ */

export interface PropInstance {
  mesh: THREE.InstancedMesh;
  dispose: () => void;
}

export class Scenery {
  readonly group = new THREE.Group();
  private disposables: { dispose: () => void }[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return markShared(g);
  }

  private mat(m: THREE.Material): THREE.Material {
    this.disposables.push(m);
    return m;
  }

  /** Place instanced copies of one geometry at the given world positions. */
  private place(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    entries: { x: number; y: number; z: number; rot: number; scale: number; scaleY?: number; color?: THREE.Color }[],
    castShadow: boolean,
    shadows: boolean,
  ): THREE.InstancedMesh | null {
    if (entries.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, material, entries.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const colored = !!entries[0].color;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      q.setFromAxisAngle(up, e.rot);
      m.compose(v.set(e.x, e.y, e.z), q, s.set(e.scale, e.scaleY ?? e.scale, e.scale));
      mesh.setMatrixAt(i, m);
      if (colored) mesh.setColorAt(i, e.color ?? new THREE.Color(0xffffff));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow && shadows;
    mesh.receiveShadow = false;
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    return mesh;
  }

  build(preset: QualityPreset, interactables: Interactable[]): void {
    const shadows = preset.shadows;
    const detail = preset.decorations;

    // ---------------- Villages ----------------
    const houseGeos = [0, 1, 2].map((v) => this.geo(buildHouse(v, 1000 + v)));
    const houseMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const perVariant: { x: number; y: number; z: number; rot: number; scale: number }[][] = [[], [], []];
    const fenceGeos = this.geo(buildFenceSegment());
    const fences: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    const lampGeo = this.geo(buildLamp());
    const lamps: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    const wellGeo = this.geo(buildWell());
    const stallGeo = this.geo(buildMarketStall());
    const ruinsGeo = this.geo(buildRuins());
    const woodMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));

    for (let vi = 0; vi < VILLAGES.length; vi++) {
      const v = VILLAGES[vi];
      const padY = sampleHeight(v.x, v.z);
      for (let hi = 0; hi < v.houses.length; hi++) {
        const [ox, oz, , , rot, variant] = v.houses[hi];
        const hx = v.x + ox;
        const hz = v.z + oz;
        perVariant[variant % 3].push({ x: hx, y: sampleHeight(hx, hz) - 0.05, z: hz, rot, scale: 1 });
      }
      // Well in the plaza.
      this.place(wellGeo, woodMat, [{ x: v.x + 2, y: padY, z: v.z - 2, rot: 0.3, scale: 1 }], true, shadows);
      // Market stall.
      this.place(stallGeo, woodMat, [{ x: v.x - 6, y: sampleHeight(v.x - 6, v.z + 4), z: v.z + 4, rot: 0.9, scale: 1 }], true, shadows);

      // Lamps along the plaza edge.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const lx = v.x + Math.cos(a) * (v.radius * 0.62);
        const lz = v.z + Math.sin(a) * (v.radius * 0.62);
        lamps.push({ x: lx, y: sampleHeight(lx, lz) - 0.1, z: lz, rot: a, scale: 1 });
      }
      // Fences on the outskirts.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const fx = v.x + Math.cos(a) * (v.radius * 0.95);
        const fz = v.z + Math.sin(a) * (v.radius * 0.95);
        if (sampleHeight(fx, fz) < WATER_LEVEL + 0.8) continue;
        fences.push({ x: fx, y: sampleHeight(fx, fz) - 0.05, z: fz, rot: a + Math.PI / 2, scale: 1 });
      }
      // Signpost at the plaza.
      this.place(this.geo(buildSignpost()), woodMat, [{ x: v.x + 7, y: sampleHeight(v.x + 7, v.z + 7), z: v.z + 7, rot: 0.6, scale: 1 }], true, shadows);
    }
    for (let v = 0; v < 3; v++) this.place(houseGeos[v], houseMat, perVariant[v], true, shadows);
    this.place(fenceGeos, woodMat, fences, false, shadows);
    this.place(lampGeo, this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 })), lamps, false, shadows);

    // ---------------- Landmarks ----------------
    const stoneMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    for (const w of WAYSTONES) {
      this.place(this.geo(buildWaystone()), stoneMat, [{ x: w.x, y: sampleHeight(w.x, w.z) - 0.2, z: w.z, rot: 0.4, scale: 1 }], true, shadows);
      interactables.push({
        id: `waystone:${w.id}`,
        kind: 'waystone',
        label: `Touch ${w.name}`,
        x: w.x,
        y: sampleHeight(w.x, w.z),
        z: w.z,
        radius: 4.2,
        data: { id: w.id, name: w.name, rune: w.rune },
      });
    }

    // Cave mouth with boulders.
    const caveGeo = this.geo(buildCaveMouth());
    this.place(caveGeo, this.mat(new THREE.MeshLambertMaterial({ vertexColors: true })), [
      { x: CAVE.x, y: sampleHeight(CAVE.x, CAVE.z) - 0.4, z: CAVE.z, rot: 0.2, scale: 1.9 },
    ], true, shadows);
    interactables.push({
      id: 'cave:echo',
      kind: 'cave',
      label: 'Enter Echo Hollow',
      x: CAVE.x,
      y: sampleHeight(CAVE.x, CAVE.z),
      z: CAVE.z,
      radius: 7,
      data: { id: CAVE.id, name: CAVE.name },
    });

    // Ruins scattered in the wild.
    const ruinMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const ruinsEntries: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    const ruinSpots: Vec2[] = [[-120, -330], [260, -260], [-400, -80], [420, 150], [40, -420]];
    for (const [rx, rz] of ruinSpots) {
      ruinsEntries.push({ x: rx, y: sampleHeight(rx, rz) - 0.3, z: rz, rot: hash2i(rx | 0, rz | 0, 12) * 6.28, scale: 1.3 });
      interactables.push({
        id: `ruins:${rx}:${rz}`,
        kind: 'signpost',
        label: 'Study the old stones',
        x: rx,
        y: sampleHeight(rx, rz),
        z: rz,
        radius: 4.5,
        data: { text: 'Weathered glyphs: "When the stones sing, the horizon opens."' },
      });
    }
    this.place(ruinsGeo, ruinMat, ruinsEntries, true, shadows);

    // Chests (one per village as a small reward).
    const chestGeo = this.geo(buildChest());
    const chestMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const chestEntries: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    const chestSpots: { x: number; z: number; item: string; qty: number }[] = [
      { x: 118, z: 172, item: 'trail_ration', qty: 2 },
      { x: -188, z: -66, item: 'embercap', qty: 2 },
      { x: 352, z: 322, item: 'riverstone', qty: 3 },
      { x: -340, z: 350, item: 'waystone_shard', qty: 1 },
      { x: -70, z: -360, item: 'trail_ration', qty: 1 },
    ];
    for (const c of chestSpots) {
      chestEntries.push({ x: c.x, y: sampleHeight(c.x, c.z) - 0.1, z: c.z, rot: 0.4, scale: 1 });
      interactables.push({
        id: `chest:${c.x}:${c.z}`,
        kind: 'chest',
        label: 'Open the cache',
        x: c.x,
        y: sampleHeight(c.x, c.z),
        z: c.z,
        radius: 3.2,
        data: { item: c.item, qty: c.qty },
      });
    }
    this.place(chestGeo, chestMat, chestEntries, true, shadows);

    // Campfires at villages + a wild one.
    const fireGeo = this.geo(buildCampfire());
    const fireMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const fireEntries: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    for (const v of VILLAGES) {
      const fx = v.x + 10;
      const fz = v.z + 6;
      fireEntries.push({ x: fx, y: sampleHeight(fx, fz), z: fz, rot: 0, scale: 1 });
      interactables.push({
        id: `fire:${v.id}`,
        kind: 'campfire',
        label: 'Rest by the fire',
        x: fx,
        y: sampleHeight(fx, fz),
        z: fz,
        radius: 4.2,
        data: { village: v.name },
      });
    }
    this.place(fireGeo, fireMat, fireEntries, false, shadows);

    // Starlit cairn on the northern peak.
    const cairn = peakLocation();
    this.place(this.geo(buildStarlitCairn()), this.mat(new THREE.MeshLambertMaterial({ vertexColors: true })), [
      { x: cairn.x, y: cairn.y - 0.2, z: cairn.z, rot: 0.8, scale: 1.6 },
    ], true, shadows);
    interactables.push({
      id: 'cairn:starlit',
      kind: 'signpost',
      label: 'Read the Starlit Cairn',
      x: cairn.x,
      y: cairn.y,
      z: cairn.z,
      radius: 5,
      data: { cairn: true, text: 'The cairn hums. Stars wheel above the horizon.' },
    });

    // ---------------- Herbs ----------------
    const herbGeo = this.geo(buildFlower());
    const herbMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2a10 }));
    const herbEntries: { x: number; y: number; z: number; rot: number; scale: number; color: THREE.Color }[] = [];
    for (const h of HERBS) {
      const hy = sampleHeight(h.x, h.z);
      if (hy < WATER_LEVEL + 0.5) continue;
      const firstIndex = herbEntries.length;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        herbEntries.push({
          x: h.x + Math.cos(a) * 0.5,
          y: hy,
          z: h.z + Math.sin(a) * 0.5,
          rot: a,
          scale: 1.6,
          color: new THREE.Color(0xffe08a),
        });
      }
      this.herbInstanceIndex.set(h.id, firstIndex);
      interactables.push({
        id: `herb:${h.id}`,
        kind: 'herb',
        label: `Pick ${h.name}`,
        x: h.x,
        y: hy,
        z: h.z,
        radius: 3.4,
        data: { itemId: 'sunleaf', name: h.name },
      });
    }
    this.herbMesh = this.place(herbGeo, herbMat, herbEntries, false, shadows);

    // ---------------- Shore stones (q3: riverstones at Mirror Lake) -------------
    const shoreGeo = this.geo(buildRiverstone());
    const shoreMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x14232a }));
    const stoneEntries: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    for (const spot of SHORE_STONES) {
      const sy = sampleHeight(spot.x, spot.z);
      if (sy < WATER_LEVEL + 0.05) continue;
      stoneEntries.push({ x: spot.x, y: sy, z: spot.z, rot: (spot.x * 0.31 + spot.z * 0.17) % 6.28, scale: 1 });
      interactables.push({
        id: `stone:${spot.id}`,
        kind: 'stone',
        label: 'Pick up a riverstone',
        x: spot.x,
        y: sy,
        z: spot.z,
        radius: 3.2,
        data: { itemId: 'riverstone', name: 'Riverstone', qty: 1 },
      });
    }
    this.place(shoreGeo, shoreMat, stoneEntries, true, shadows);

    // The lost lure glints among the stones of the northern lake shore. It is
    // picked up automatically on approach (Game.checkShorePickups) so there is
    // no prompt to hunt for in the dark.
    const lureGeo = this.geo(buildRiverstone());
    const lureMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a12 }));
    this.lureMesh = this.place(
      lureGeo,
      lureMat,
      [{ x: LURE.x, y: sampleHeight(LURE.x, LURE.z) + 0.12, z: LURE.z, rot: 0.9, scale: 1.5 }],
      true,
      shadows,
    );

    // Extra wild pickups: embercaps in the woods.
    if (detail) {
      const capGeo = this.geo(buildMushroom());
      const capMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a0e04 }));
      const caps: { x: number; y: number; z: number; rot: number; scale: number; color: THREE.Color }[] = [];
      const rnd = mulberry32(4242);
      let count = 0;
      let guard = 0;
      while (count < 26 && guard++ < 600) {
        const x = (rnd() - 0.5) * 900;
        const z = (rnd() - 0.5) * 900;
        const h = sampleHeight(x, z);
        if (h < WATER_LEVEL + 1 || h > 60) continue;
        if (sampleSlope(x, z) > 0.5) continue;
        if (Math.hypot(x, z) > WORLD_RADIUS) continue;
        caps.push({ x, y: h, z, rot: rnd() * 6.28, scale: 1.5 + rnd(), color: new THREE.Color(0xff8a4a) });
        if (count % 4 === 0) {
          interactables.push({
            id: `cap:${x.toFixed(0)}:${z.toFixed(0)}`,
            kind: 'herb',
            label: 'Pick Embercap',
            x,
            y: h,
            z,
            radius: 3.8,
            data: { itemId: 'embercap', name: 'Embercap' },
          });
        }
        count++;
      }
      this.place(capGeo, capMat, caps, false, shadows);
    }

    // ---------------- Powerups ----------------
    this.buildPickups(interactables);

    // ---------------- River reeds & lakeside dressing ----------------
    const reedGeo = this.geo(buildReeds());
    const reedMat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const reeds: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    if (detail) {
      for (const river of RIVERS) {
        for (let i = 0; i < river.points.length - 1; i++) {
          const [ax, az] = river.points[i];
          const [bx, bz] = river.points[i + 1];
          const segLen = Math.hypot(bx - ax, bz - az);
          const steps = Math.max(1, Math.round(segLen / 7));
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const px = lerp(ax, bx, t);
            const pz = lerp(az, bz, t);
            const nx = -(bz - az) / (segLen || 1);
            const nz = (bx - ax) / (segLen || 1);
            for (const side of [-1, 1]) {
              const off = river.width + 0.8 + hash2i(i, s + side * 31, 8) * 2.2;
              const x = px + nx * off * side;
              const z = pz + nz * off * side;
              const h = sampleHeight(x, z);
              if (h < WATER_LEVEL - 0.4 || h > WATER_LEVEL + 1.6) continue;
              reeds.push({ x, y: h - 0.2, z, rot: hash2i(s, i, 5) * 6.28, scale: 0.8 + hash2i(s, i, 9) * 0.7 });
            }
          }
        }
      }
      for (const lake of LAKES) {
        const around = 46;
        for (let i = 0; i < around; i++) {
          const a = (i / around) * Math.PI * 2;
          const rr = 0.78 + hash2i(i, lake.x | 0, 3) * 0.28;
          const x = lake.x + Math.cos(a) * lake.rx * rr;
          const z = lake.z + Math.sin(a) * lake.rz * rr;
          const h = sampleHeight(x, z);
          if (h < WATER_LEVEL - 0.4 || h > WATER_LEVEL + 1.8) continue;
          reeds.push({ x, y: h - 0.2, z, rot: a, scale: 0.7 + hash2i(i, lake.z | 0, 4) * 0.8 });
        }
      }
    }
    this.place(reedGeo, reedMat, reeds, false, shadows);

    // ---------------- Ambience: birds ----------------
    if (preset.maxParticles > 100) {
      this.buildBirds();
    }
  }

  private buildBirds(): void {
    const geo = this.geo(buildBird());
    const mat = this.mat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const birds: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
    const rnd = mulberry32(777);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 120 + rnd() * 460;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      birds.push({ x, y: Math.max(sampleHeight(x, z) + 26 + rnd() * 30, 40), z, rot: a, scale: 1.4 });
    }
    this.place(geo, mat, birds, false, false);
  }

  private herbMesh: THREE.InstancedMesh | null = null;
  private lureMesh: THREE.InstancedMesh | null = null;
  private herbInstanceIndex = new Map<string, number>();
  private pickupGroup: THREE.Group | null = null;
  private pickupMeshes: { mesh: THREE.Mesh; kind: PowerupKind; baseY: number; phase: number }[] = [];

  private buildPickups(interactables: Interactable[]): void {
    const group = new THREE.Group();
    group.name = 'pickups';
    const geo = markShared(new THREE.OctahedronGeometry(0.36, 0));
    this.geometries.push(geo);
    for (const spot of POWERUP_SPOTS) {
      const y = sampleHeight(spot.x, spot.z);
      if (y < WATER_LEVEL) continue;
      const def = POWER_UPS[spot.kind];
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.75,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.95,
      });
      this.disposables.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, y + 1.1, spot.z);
      mesh.castShadow = false;
      group.add(mesh);
      this.pickupMeshes.push({ mesh, kind: spot.kind, baseY: y + 1.1, phase: Math.random() * 6.28 });
      interactables.push({
        id: `pickup:${spot.id}`,
        kind: 'signpost',
        label: `Collect ${def.name}`,
        x: spot.x,
        y,
        z: spot.z,
        radius: 2.4,
        data: { pickup: spot.id, kind: spot.kind, auto: true },
      });
    }
    this.group.add(group);
    this.pickupGroup = group;
  }

  /** Bob + spin the pickups. */
  updatePickups(time: number): void {
    if (!this.pickupGroup) return;
    for (const p of this.pickupMeshes) {
      p.mesh.position.y = p.baseY + Math.sin(time * 1.6 + p.phase) * 0.18;
      p.mesh.rotation.y = time * 1.2 + p.phase;
    }
  }

  /** Removes a harvested herb spot's flower cluster from the instanced mesh. */
  hideHerb(herbId: string): void {
    const start = this.herbInstanceIndex.get(herbId);
    const mesh = this.herbMesh;
    if (start === undefined || !mesh) return;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = start; i < start + 3 && i < mesh.count; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
    this.herbInstanceIndex.delete(herbId);
  }

  /** Removes the shore lure once Tovin's quest has been satisfied. */
  hideLure(): void {
    const mesh = this.lureMesh;
    if (!mesh) return;
    mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
    mesh.instanceMatrix.needsUpdate = true;
    this.lureMesh = null;
  }

  hidePickup(id: string): void {
    const idx = POWERUP_SPOTS.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const spot = POWERUP_SPOTS[idx];
    const match = this.pickupMeshes.find((p) => Math.abs(p.mesh.position.x - spot.x) < 0.01 && Math.abs(p.mesh.position.z - spot.z) < 0.01);
    if (match) match.mesh.visible = false;
  }

  resetPickups(): void {
    for (const p of this.pickupMeshes) p.mesh.visible = true;
  }

  dispose(): void {
    this.group.clear();
    for (const d of this.disposables) d.dispose();
    for (const g of this.geometries) g.dispose();
    this.disposables = [];
    this.geometries = [];
    this.pickupMeshes = [];
    this.herbInstanceIndex.clear();
    this.herbMesh = null;
    this.lureMesh = null;
  }
}

/** Finds the highest accessible point for the final quest. */
export function peakLocation(): { x: number; y: number; z: number } {
  let bestX = -60;
  let bestZ = -372;
  let bestH = -Infinity;
  for (let i = 0; i < 260; i++) {
    const a = (i / 260) * Math.PI * 2;
    const r = 380 + (i % 7) * 22;
    const x = Math.cos(a) * r * 0.55 - 40;
    const z = -220 - Math.abs(Math.sin(a)) * 180;
    const h = sampleHeight(x, z);
    if (h > bestH && h < 130) {
      bestH = h;
      bestX = x;
      bestZ = z;
    }
  }
  return { x: bestX, y: sampleHeight(bestX, bestZ), z: bestZ };
}

/** Runtime NPC avatar wrapper. */
export interface NPCActor {
  id: string;
  rig: CharacterRig;
  group: THREE.Group;
  x: number;
  z: number;
  baseY: number;
  phase: number;
}

export function buildNPCActors(scene: THREE.Scene): NPCActor[] {
  const actors: NPCActor[] = [];
  for (const npc of NPCS) {
    const rig = buildCharacter(npc.palette);
    const group = new THREE.Group();
    group.add(rig.group);
    const y = sampleHeight(npc.x, npc.z);
    group.position.set(npc.x, y, npc.z);
    group.rotation.y = hash2i(npc.x | 0, npc.z | 0, 55) * Math.PI * 2;
    scene.add(group);
    actors.push({ id: npc.id, rig, group, x: npc.x, z: npc.z, baseY: y, phase: Math.random() * 6.28 });
  }
  return actors;
}

/** Waving + idle animation for NPCs, and facing the player when close. */
export function updateNPCActors(actors: NPCActor[], time: number, playerPos: THREE.Vector3): void {
  for (const a of actors) {
    const d = Math.hypot(playerPos.x - a.x, playerPos.z - a.z);
    const near = d < 9;
    const targetYaw = near ? Math.atan2(playerPos.x - a.x, playerPos.z - a.z) : a.group.rotation.y;
    if (near) {
      let diff = targetYaw - a.group.rotation.y;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      a.group.rotation.y += diff * 0.08;
    }
    a.rig.torso.position.y = 1.02 + Math.sin(time * 1.3 + a.phase) * 0.015;
    a.rig.head.rotation.y = Math.sin(time * 0.6 + a.phase) * 0.28;
    if (near) {
      a.rig.armR.rotation.x = -0.6 + Math.sin(time * 5 + a.phase) * 0.5;
      a.rig.armR.rotation.z = -0.3;
    } else {
      a.rig.armR.rotation.x *= 0.94;
      a.rig.armR.rotation.z *= 0.94;
    }
    a.rig.armL.rotation.x = Math.sin(time * 0.9 + a.phase) * 0.08;
    a.rig.cloak.rotation.x = Math.sin(time * 0.8 + a.phase) * 0.05;
  }
}

/** Small fish that circle in lakes (cheap, adds life). */
export function buildFishSchool(): { group: THREE.Group; update: (t: number) => void; dispose: () => void } {
  const geo = markShared(buildFish());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  const group = new THREE.Group();
  const fishes: { mesh: THREE.Mesh; lake: number; radius: number; speed: number; offset: number; depth: number }[] = [];
  const rnd = mulberry32(313);
  for (let i = 0; i < 18; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(0.9 + rnd() * 0.5);
    group.add(mesh);
    fishes.push({
      mesh,
      lake: Math.floor(rnd() * LAKES.length),
      radius: 6 + rnd() * 26,
      speed: 0.25 + rnd() * 0.4,
      offset: rnd() * Math.PI * 2,
      depth: 0.5 + rnd() * 1.6,
    });
  }
  return {
    group,
    update: (t: number) => {
      for (const f of fishes) {
        const lake = LAKES[f.lake];
        const a = t * f.speed + f.offset;
        const x = lake.x + Math.cos(a) * f.radius;
        const z = lake.z + Math.sin(a) * f.radius * (lake.rz / lake.rx);
        const ground = sampleHeight(x, z);
        f.mesh.position.set(x, Math.max(WATER_LEVEL - f.depth, ground + 0.3), z);
        f.mesh.rotation.y = -a + Math.PI / 2;
      }
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export { ROADS, smoothstep, clamp };
