/**
 * Procedural low-poly prop geometry. Every prop is built from flat-shaded
 * triangles so the whole world uses a handful of draw calls.
 */
import * as THREE from 'three';
import { createBuilder, addBox, addPrism, addGableRoof, addBlob } from './geomUtils';
import { mulberry32 } from './noise';

const C = (hex: number) => new THREE.Color(hex);

/* ------------------------------------------------------------------ */
/* Vegetation                                                          */
/* ------------------------------------------------------------------ */

export function buildPine(): THREE.BufferGeometry {
  const b = createBuilder();
  const trunk = C(0x5a4433);
  const leaf = C(0x3f7a4e);
  const leafDark = C(0x2f6640);
  addPrism(b, 0, 0.9, 0, 0.22, 0.16, 1.8, 5, trunk);
  let y = 1.4;
  let r = 1.45;
  for (let i = 0; i < 3; i++) {
    addPrism(b, 0, y + 0.95, 0, r, 0, 2.0, 7, i % 2 ? leafDark : leaf, i * 0.4);
    y += 1.1;
    r *= 0.68;
  }
  return b.build();
}

export function buildBushyTree(): THREE.BufferGeometry {
  const b = createBuilder();
  const trunk = C(0x6b5138);
  addPrism(b, 0, 1.1, 0, 0.28, 0.2, 2.2, 5, trunk);
  const greens = [C(0x5f9a4a), C(0x71ab53), C(0x4d8a45)];
  addBlob(b, 0, 2.7, 0, 1.5, 1.25, 1.5, greens[0], 1, 0.22, 6);
  addBlob(b, 0.7, 3.3, 0.3, 1.0, 0.85, 1.0, greens[1], 3, 0.22, 5);
  addBlob(b, -0.6, 2.5, -0.5, 0.9, 0.8, 0.9, greens[2], 5, 0.22, 5);
  return b.build();
}

export function buildBirch(): THREE.BufferGeometry {
  const b = createBuilder();
  const trunk = C(0xd8d2c2);
  addPrism(b, 0, 1.6, 0, 0.16, 0.11, 3.2, 5, trunk);
  const greens = [C(0x8fc45a), C(0xa4d165), C(0x7ab44f)];
  addBlob(b, 0, 3.9, 0, 1.15, 1.0, 1.15, greens[0], 2, 0.26, 6);
  addBlob(b, 0.45, 4.6, -0.2, 0.8, 0.7, 0.8, greens[1], 4, 0.26, 5);
  addBlob(b, -0.5, 3.6, 0.4, 0.75, 0.65, 0.75, greens[2], 6, 0.26, 5);
  return b.build();
}

export function buildRock(large = false): THREE.BufferGeometry {
  const b = createBuilder();
  const base = large ? C(0x8a8d92) : C(0x9a9da3);
  const moss = C(0x6f8f56);
  addBlob(b, 0, 0.5, 0, large ? 1.6 : 0.9, large ? 1.1 : 0.6, large ? 1.4 : 0.85, base, large ? 2 : 7, 0.34, large ? 6 : 5);
  if (large) {
    addBlob(b, 0.9, 0.35, -0.6, 0.9, 0.7, 0.8, base.clone().multiplyScalar(0.92), 11, 0.3, 5);
    addBlob(b, -0.7, 1.15, 0.2, 1.1, 0.42, 0.95, moss, 13, 0.3, 5);
  }
  return b.build();
}

export function buildReeds(): THREE.BufferGeometry {
  const b = createBuilder();
  const stem = C(0x93a861);
  const tip = C(0xb08a4a);
  const rnd = mulberry32(99);
  for (let i = 0; i < 9; i++) {
    const x = (rnd() - 0.5) * 1.6;
    const z = (rnd() - 0.5) * 1.6;
    const h = 0.9 + rnd() * 0.9;
    const lean = (rnd() - 0.5) * 0.5;
    b.addTri(x, 0, z, x + 0.06, 0, z + 0.03, x + lean, h, z + lean * 0.6, stem);
    if (rnd() > 0.55) addPrism(b, x + lean, h + 0.12, z + lean * 0.6, 0.06, 0.05, 0.28, 4, tip);
  }
  return b.build();
}

export function buildFlower(): THREE.BufferGeometry {
  const b = createBuilder();
  const stem = C(0x76a84e);
  const petal = C(0xffe08a);
  b.addTri(-0.03, 0, 0, 0.03, 0, 0, 0, 0.42, 0, stem);
  b.addQuad(-0.12, 0.42, -0.02, 0.12, 0.42, -0.02, 0.1, 0.58, 0.08, -0.1, 0.58, 0.08, petal);
  b.addQuad(-0.1, 0.5, -0.09, 0.1, 0.5, -0.09, 0.05, 0.62, 0.0, -0.05, 0.62, 0.0, petal.clone().multiplyScalar(0.9));
  return b.build();
}

export function buildGrassTuft(): THREE.BufferGeometry {
  const b = createBuilder();
  const c1 = C(0x93b45c);
  const c2 = C(0x84a852);
  const c3 = C(0xa6c46a);
  // A small clump: blades fan out in all directions with different heights so
  // it reads as grass instead of a dark speck at a distance.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const spread = 0.24;
    const dx = Math.cos(a) * spread;
    const dz = Math.sin(a) * spread;
    const px = Math.cos(a + 1.6) * 0.06;
    const pz = Math.sin(a + 1.6) * 0.06;
    const h = 0.5 + (i % 3) * 0.12;
    b.addTri(px - dx, 0, pz - dz, px + dx, 0, pz + dz, px + dx * 0.5, h, pz + dz * 0.5, i % 3 === 0 ? c3 : i % 2 ? c1 : c2);
  }
  return b.build();
}

/** A smooth rounded riverstone with a pale vein, glinting on the shore. */
export function buildRiverstone(): THREE.BufferGeometry {
  const b = createBuilder();
  addBlob(b, 0, 0.16, 0, 0.3, 0.2, 0.26, C(0x6f8f9c), 3.1);
  addBlob(b, 0.02, 0.2, 0.01, 0.24, 0.14, 0.2, C(0xa8c6d0), 4.7);
  return b.build();
}

export function buildMushroom(): THREE.BufferGeometry {
  const b = createBuilder();
  addPrism(b, 0, 0.12, 0, 0.05, 0.045, 0.26, 5, C(0xe6ddc8));
  addPrism(b, 0, 0.3, 0, 0.17, 0.02, 0.1, 6, C(0xd9833f));
  return b.build();
}

/* ------------------------------------------------------------------ */
/* Settlements                                                         */
/* ------------------------------------------------------------------ */

export function buildHouse(variant: number, seed: number): THREE.BufferGeometry {
  const b = createBuilder();
  const rnd = mulberry32(seed);
  const walls = [C(0xfaf0dd), C(0xf3e4c8), C(0xe9dabc)][variant % 3];
  const beams = C(0x6d5138);
  const roof = [C(0xa9503c), C(0x8c5a44), C(0x7d4a3a)][variant % 3];
  const w = 3.4 + rnd() * 1.1;
  const d = 3.0 + rnd() * 0.9;
  const h = 2.6 + rnd() * 0.5;

  // Base plinth.
  addBox(b, 0, 0.15, 0, w + 0.4, 0.3, d + 0.4, C(0x9c9a92));
  // Walls.
  addBox(b, 0, h / 2 + 0.28, 0, w, h, d, walls);
  // Timber frame corners.
  const ow = w / 2 + 0.02;
  const od = d / 2 + 0.02;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(b, sx * ow, h / 2 + 0.28, sz * od, 0.22, h, 0.22, beams);
    }
  }
  // Door + windows on the front, windows on the sides and back so no face is blank.
  const doorMat = C(0x6b4a2c);
  const glass = C(0x2f4657);
  const frame = C(0x7d5f3e);
  addBox(b, 0, 1.3, od + 0.03, 1.0, 1.92, 0.1, doorMat);
  addBox(b, 0, 1.3, od + 0.07, 0.12, 1.9, 0.04, frame);
  for (const sx of [-1, 1]) {
    const wx = sx * w * 0.3;
    addBox(b, wx, h * 0.74, od + 0.03, 0.68, 0.68, 0.08, glass);
    addBox(b, wx, h * 0.74, od + 0.06, 0.8, 0.1, 0.05, frame);
    addBox(b, wx, h * 0.74, od + 0.06, 0.1, 0.8, 0.05, frame);
    // Side windows.
    addBox(b, sx * ow + sx * 0.03, h * 0.74, 0, 0.08, 0.62, 0.62, glass);
    addBox(b, sx * ow + sx * 0.06, h * 0.74, 0, 0.05, 0.74, 0.1, frame);
  }
  // Back window.
  addBox(b, 0, h * 0.74, -od - 0.03, 0.66, 0.62, 0.08, glass);
  // Stone footing keeps the base from looking like it floats on the grass.
  addBox(b, 0, 0.34, 0, w + 0.3, 0.5, d + 0.3, C(0xb9b3a5));
  // Roof.
  addGableRoof(b, 0, h + 0.28, 0, w, d, 1.5 + rnd() * 0.4, roof, 0, 0.5);
  // Chimney on some variants.
  if (variant !== 1) {
    addBox(b, w * 0.28, h + 0.95, -d * 0.2, 0.5, 1.5, 0.5, C(0x9a8f83));
  }
  return b.build();
}

export function buildWell(): THREE.BufferGeometry {
  const b = createBuilder();
  const stone = C(0x9b978d);
  const wood = C(0x6b5138);
  addPrism(b, 0, 0.35, 0, 1.1, 1.05, 0.7, 8, stone, 0, false);
  addPrism(b, 0, 0.73, 0, 1.08, 1.02, 0.09, 8, stone.clone().multiplyScalar(1.08), 0, false);
  addPrism(b, 0, 0.35, 0, 0.82, 0.82, 0.72, 8, C(0x2d3f52), 0, false);
  for (const sx of [-1, 1]) {
    addBox(b, sx * 0.95, 1.3, 0, 0.16, 1.5, 0.16, wood);
  }
  addGableRoof(b, 0, 2.05, 0, 2.5, 1.0, 0.7, C(0x7d4a3a), 0, 0.18);
  addBox(b, 0, 1.55, 0, 1.9, 0.1, 0.1, wood);
  addBox(b, 0, 1.1, 0, 0.28, 0.16, 0.28, C(0x4a3a2a));
  return b.build();
}

export function buildFenceSegment(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x7a5c3e);
  addBox(b, 0, 0.45, 0, 0.12, 0.9, 0.12, wood);
  addBox(b, 1.6, 0.45, 0, 0.12, 0.9, 0.12, wood);
  addBox(b, 0.8, 0.7, 0, 1.7, 0.1, 0.08, wood.clone().multiplyScalar(0.92));
  addBox(b, 0.8, 0.35, 0, 1.7, 0.1, 0.08, wood.clone().multiplyScalar(0.92));
  return b.build();
}

export function buildLamp(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x5c4530);
  const glass = C(0xffd27a);
  addPrism(b, 0, 1.1, 0, 0.09, 0.07, 2.2, 5, wood);
  addBox(b, 0, 2.2, 0, 0.46, 0.09, 0.09, wood);
  addBox(b, 0, 2.02, 0.24, 0.3, 0.34, 0.3, glass);
  addBox(b, 0, 2.24, 0.24, 0.36, 0.1, 0.36, wood);
  return b.build();
}

export function buildMarketStall(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x7a5c3e);
  const cloth = C(0xc4614f);
  const clothAlt = C(0xe8d8b3);
  addBox(b, 0, 0.45, 0, 2.4, 0.1, 1.2, wood);
  for (const sx of [-1, 1]) {
    addBox(b, sx * 1.15, 0.9, -0.55, 0.1, 1.8, 0.1, wood);
    addBox(b, sx * 1.15, 0.9, 0.55, 0.1, 1.8, 0.1, wood);
  }
  addGableRoof(b, 0, 1.85, 0, 2.7, 1.6, 0.55, cloth, 0, 0.2);
  addBox(b, 0, 0.75, 0.3, 2.3, 0.5, 0.4, wood);
  addBox(b, -0.5, 0.92, 0.3, 0.3, 0.18, 0.3, clothAlt);
  addBox(b, 0.2, 0.9, 0.3, 0.34, 0.14, 0.3, C(0xd6a35a));
  return b.build();
}

export function buildRuins(): THREE.BufferGeometry {
  const b = createBuilder();
  const stone = C(0xa8a49a);
  const stoneDark = C(0x8d8a80);
  addBox(b, 0, 0.6, 0, 1.4, 1.2, 1.4, stone, 0.2);
  addBox(b, 0.4, 1.5, 0.1, 1.0, 0.8, 1.0, stoneDark, 0.55);
  addPrism(b, -1.5, 1.4, 0.6, 0.4, 0.34, 2.8, 6, stone, 0.3);
  addPrism(b, 1.8, 0.9, -0.8, 0.34, 0.3, 1.8, 6, stoneDark, 1.1);
  return b.build();
}

/* ------------------------------------------------------------------ */
/* Landmarks                                                           */
/* ------------------------------------------------------------------ */

export function buildWaystone(): THREE.BufferGeometry {
  const b = createBuilder();
  const stone = C(0x7f8c9b);
  const stoneLight = C(0x9aa7b5);
  const rune = C(0x8fe3ff);
  addBox(b, 0, 0.2, 0, 1.9, 0.4, 1.6, C(0x6c757f));
  addPrism(b, 0, 1.75, 0, 0.62, 0.42, 3.1, 6, stone, 0.3);
  addBox(b, 0, 3.4, 0, 0.36, 0.42, 0.36, stoneLight, 0.62);
  // Rune band.
  addBox(b, 0, 2.5, 0, 0.7, 0.14, 0.7, rune, 0.3);
  addBox(b, 0, 1.9, 0, 0.64, 0.1, 0.64, rune, 0.3);
  return b.build();
}

export function buildCaveMouth(): THREE.BufferGeometry {
  const b = createBuilder();
  const rock = C(0x5f6168);
  const rockDark = C(0x3d4046);
  const rockLight = C(0x74777e);
  // Arch around a dark opening.
  addBlob(b, -6, 3.4, 0, 5.2, 4.4, 4.2, rock, 3, 0.3, 6);
  addBlob(b, 6, 3.0, 0, 4.8, 4.0, 4.0, rockLight, 5, 0.3, 6);
  addBlob(b, 0, 7.6, -1.0, 6.5, 2.6, 3.4, rockDark, 7, 0.26, 6);
  // Dark opening.
  addBox(b, 0, 2.7, 0.4, 5.4, 5.4, 0.4, C(0x0d1014));
  addBox(b, 0, 5.2, 0.3, 3.2, 1.4, 0.4, C(0x0d1014));
  // Scattered boulders.
  addBlob(b, -8.5, 0.9, 3.2, 1.6, 1.1, 1.4, rockLight, 11, 0.3, 5);
  addBlob(b, 8.0, 0.7, 4.0, 1.3, 0.9, 1.2, rock, 13, 0.3, 5);
  return b.build();
}

export function buildSignpost(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x6f5439);
  const paint = C(0xe6dcc4);
  addBox(b, 0, 1.0, 0, 0.16, 2.0, 0.16, wood);
  addBox(b, 0.55, 1.65, 0, 1.3, 0.34, 0.08, wood);
  addBox(b, 0.55, 1.24, 0, 1.1, 0.3, 0.08, wood);
  addBox(b, 0.55, 1.65, 0.05, 0.8, 0.08, 0.02, paint);
  addBox(b, 0.5, 1.24, 0.05, 0.7, 0.07, 0.02, paint);
  return b.build();
}

export function buildChest(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x8a6136);
  const iron = C(0x6b6f74);
  const gold = C(0xf0c65a);
  addBox(b, 0, 0.32, 0, 1.0, 0.64, 0.72, wood);
  addBox(b, 0, 0.72, 0, 1.04, 0.2, 0.76, wood.clone().multiplyScalar(0.86));
  for (const x of [-0.34, 0.34]) {
    addBox(b, x, 0.5, 0, 0.1, 0.8, 0.76, iron);
  }
  addBox(b, 0, 0.62, 0.39, 0.2, 0.22, 0.06, gold);
  return b.build();
}

export function buildCampfire(): THREE.BufferGeometry {
  const b = createBuilder();
  const wood = C(0x5c4630);
  const stone = C(0x8b8d92);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    addBlob(b, Math.cos(a) * 0.95, 0.16, Math.sin(a) * 0.95, 0.28, 0.18, 0.28, stone, i + 1, 0.3, 5);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    addBox(b, Math.cos(a) * 0.2, 0.16, Math.sin(a) * 0.2, 0.9, 0.16, 0.16, wood, a);
  }
  return b.build();
}

export function buildStarlitCairn(): THREE.BufferGeometry {
  const b = createBuilder();
  const stone = C(0x8f9aa8);
  const glow = C(0xbff0ff);
  let y = 0;
  const sizes = [1.1, 0.9, 0.75, 0.6, 0.45];
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    addBlob(b, 0, y + s * 0.5, 0, s, s * 0.55, s * 0.9, stone.clone().multiplyScalar(1 - i * 0.04), i + 2, 0.22, 5);
    y += s * 0.85;
  }
  addBox(b, 0, y + 0.35, 0, 0.28, 0.7, 0.28, glow);
  return b.build();
}

/* ------------------------------------------------------------------ */
/* Creatures / wildlife                                                */
/* ------------------------------------------------------------------ */

export function buildBird(): THREE.BufferGeometry {
  const b = createBuilder();
  const body = C(0x38424e);
  const wing = C(0x4e5a68);
  b.addTri(0.14, 0, 0, -0.14, 0, 0, 0, 0.05, 0.34, body);
  b.addTri(0.12, 0, 0.06, -0.12, 0, 0.06, 0, 0.02, -0.2, body);
  b.addQuad(0, 0, 0.12, 0.72, 0.12, 0.02, 0.7, 0.12, -0.12, 0, 0, -0.18, wing);
  b.addQuad(0, 0, 0.12, -0.72, 0.12, 0.02, -0.7, 0.12, -0.12, 0, 0, -0.18, wing.clone().multiplyScalar(0.9));
  return b.build();
}

export function buildFish(): THREE.BufferGeometry {
  const b = createBuilder();
  const body = C(0xd9e0e6);
  const fin = C(0x9fb4c4);
  b.addTri(0.3, 0, 0, -0.3, 0, 0, 0, 0.12, 0.001, body);
  b.addTri(-0.3, 0, 0, 0.3, 0, 0, 0, -0.12, 0.001, body);
  b.addTri(-0.3, 0, 0, -0.55, 0.18, 0, -0.55, -0.18, 0, fin);
  return b.build();
}

/* ------------------------------------------------------------------ */
/* Player character                                                    */
/* ------------------------------------------------------------------ */

export interface CharacterPart {
  mesh: THREE.Mesh;
  /** Rest transform for animation. */
  pivotY: number;
}

export interface CharacterRig {
  group: THREE.Group;
  shadow: THREE.Mesh;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  cloak: THREE.Mesh;
  dispose: () => void;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function getMat(color: string | number, opts?: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number }): THREE.MeshStandardMaterial {
  const key = `${color}:${opts?.roughness ?? 0.85}:${opts?.metalness ?? 0}:${opts?.emissive ?? ''}:${opts?.emissiveIntensity ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts?.roughness ?? 0.85,
      metalness: opts?.metalness ?? 0,
      flatShading: true,
      emissive: opts?.emissive ?? 0x000000,
      emissiveIntensity: opts?.emissiveIntensity ?? 0,
    });
    matCache.set(key, m);
  }
  return m;
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

export function buildCharacter(palette: {
  robe: string;
  trim: string;
  skin: string;
  hair: string;
  cloak?: string;
}): CharacterRig {
  const group = new THREE.Group();
  const robeMat = getMat(palette.robe);
  const trimMat = getMat(palette.trim);
  const skinMat = getMat(palette.skin, { roughness: 0.7 });
  const hairMat = getMat(palette.hair, { roughness: 0.9 });
  const bootMat = getMat(0x3a2f26);

  const torso = new THREE.Group();
  torso.position.y = 1.02;
  group.add(torso);

  const chest = part(new THREE.CylinderGeometry(0.26, 0.34, 0.62, 7), robeMat);
  chest.position.y = 0.1;
  torso.add(chest);

  const skirt = part(new THREE.CylinderGeometry(0.33, 0.45, 0.56, 7), robeMat);
  skirt.position.y = -0.42;
  torso.add(skirt);

  const belt = part(new THREE.CylinderGeometry(0.345, 0.345, 0.1, 7), trimMat);
  belt.position.y = -0.12;
  belt.castShadow = false;
  torso.add(belt);

  const shoulders = part(new THREE.CylinderGeometry(0.3, 0.24, 0.18, 7), trimMat);
  shoulders.position.y = 0.44;
  torso.add(shoulders);

  // Head + hood.
  const head = new THREE.Group();
  head.position.y = 0.68;
  torso.add(head);
  const skull = part(new THREE.IcosahedronGeometry(0.2, 1), skinMat);
  head.add(skull);
  const hair = part(new THREE.IcosahedronGeometry(0.215, 0), hairMat);
  hair.position.set(0, 0.05, -0.02);
  hair.scale.set(1, 0.85, 1);
  head.add(hair);
  const hood = part(new THREE.ConeGeometry(0.3, 0.42, 7), trimMat);
  hood.position.set(0, 0.12, -0.06);
  hood.rotation.x = -0.12;
  head.add(hood);
  const nose = part(new THREE.ConeGeometry(0.05, 0.12, 4), skinMat);
  nose.position.set(0, -0.02, 0.2);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);

  // Arms.
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 0.38, 0);
    const upper = part(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 5), robeMat);
    upper.position.y = -0.21;
    pivot.add(upper);
    const hand = part(new THREE.IcosahedronGeometry(0.09, 0), skinMat);
    hand.position.y = -0.46;
    pivot.add(hand);
    torso.add(pivot);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Legs (attached to group, below skirt).
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.46, 0);
    const thigh = part(new THREE.CylinderGeometry(0.095, 0.085, 0.4, 5), getMat(0x4b4038));
    thigh.position.y = -0.2;
    pivot.add(thigh);
    const boot = part(new THREE.BoxGeometry(0.16, 0.13, 0.25), bootMat);
    boot.position.set(0, -0.44, 0.05);
    pivot.add(boot);
    group.add(pivot);
    return pivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Cloak.
  // Walking staff in the right hand — reads clearly against any background.
  const staffMat = getMat(0x6b4f33, { roughness: 0.9 });
  const staff = part(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 5), staffMat);
  staff.position.set(0.06, -0.5, 0.06);
  staff.rotation.z = -0.06;
  armR.add(staff);
  const staffTip = part(new THREE.IcosahedronGeometry(0.085, 0), getMat(palette.trim, { emissive: palette.trim, emissiveIntensity: 0.25 }));
  staffTip.position.set(0.1, 0.45, 0.06);
  armR.add(staffTip);

  const cloakGeo = new THREE.CylinderGeometry(0.3, 0.52, 0.82, 8, 1, true);
  const cloakMat = getMat(palette.cloak ?? palette.trim, { roughness: 0.95 });
  cloakMat.side = THREE.DoubleSide;
  const cloak = new THREE.Mesh(cloakGeo, cloakMat);
  cloak.position.set(0, -0.24, -0.05);
  cloak.castShadow = true;
  torso.add(cloak);

  // Soft contact shadow so the character reads as grounded even when the
  // device has real-time shadows disabled.
  const shadowGeo = new THREE.CircleGeometry(0.55, 12);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = -0.68;
  shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group,
    shadow,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    cloak,
    dispose: () => {
      shadowGeo.dispose();
      shadowMat.dispose();
      // Shared materials live in a cache; geometry is disposed with the group.
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
}
