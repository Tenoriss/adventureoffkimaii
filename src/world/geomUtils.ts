import * as THREE from 'three';

export interface MeshBuilder {
  positions: number[];
  colors: number[];
  indices: number[];
  addTri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    color: THREE.Color,
  ): void;
  addQuad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    color: THREE.Color,
  ): void;
  build(): THREE.BufferGeometry;
  triangleCount(): number;
}

/** Accumulates raw triangles so large props become a single draw call. */
export function createBuilder(): MeshBuilder {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const push = (x: number, y: number, z: number, c: THREE.Color) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
    return positions.length / 3 - 1;
  };

  return {
    positions,
    colors,
    indices,
    addTri(ax, ay, az, bx, by, bz, cx, cy, cz, color) {
      const i0 = push(ax, ay, az, color);
      const i1 = push(bx, by, bz, color);
      const i2 = push(cx, cy, cz, color);
      indices.push(i0, i1, i2);
    },
    addQuad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color) {
      const i0 = push(ax, ay, az, color);
      const i1 = push(bx, by, bz, color);
      const i2 = push(cx, cy, cz, color);
      const i3 = push(dx, dy, dz, color);
      indices.push(i0, i1, i2, i0, i2, i3);
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    },
    triangleCount() {
      return indices.length / 3;
    },
  };
}

/** Add a box (8 corners, 12 tris) into a builder, with per-face shading. */
export function addBox(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  color: THREE.Color,
  rotationY = 0,
  topColor?: THREE.Color,
) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const p = (x: number, y: number, z: number): [number, number, number] => [
    cx + x * cos - z * sin,
    cy + y,
    cz + x * sin + z * cos,
  ];

  const c000 = p(-hx, -hy, -hz);
  const c100 = p(hx, -hy, -hz);
  const c110 = p(hx, hy, -hz);
  const c010 = p(-hx, hy, -hz);
  const c001 = p(-hx, -hy, hz);
  const c101 = p(hx, -hy, hz);
  const c111 = p(hx, hy, hz);
  const c011 = p(-hx, hy, hz);

  const top = topColor ?? color;
  // Winding is counter-clockwise seen from outside so single-sided materials
  // keep their outward faces.
  b.addQuad(...c010, ...c011, ...c111, ...c110, top); // +y
  b.addQuad(...c001, ...c101, ...c111, ...c011, color); // +z
  b.addQuad(...c100, ...c000, ...c010, ...c110, color); // -z
  b.addQuad(...c000, ...c100, ...c101, ...c001, color); // -y
  b.addQuad(...c100, ...c101, ...c111, ...c110, color); // +x
  b.addQuad(...c000, ...c001, ...c011, ...c010, color); // -x
}

/** Add a tapered cylinder / prism (low-poly, flat shaded). */
export function addPrism(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  bottomRadius: number,
  topRadius: number,
  height: number,
  sides: number,
  color: THREE.Color,
  rotationY = 0,
  capTop = true,
  capBottom = false,
) {
  const half = height / 2;
  const step = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i++) {
    const a0 = rotationY + i * step;
    const a1 = a0 + step;
    const x0 = Math.cos(a0);
    const z0 = Math.sin(a0);
    const x1 = Math.cos(a1);
    const z1 = Math.sin(a1);
    const bx0 = cx + x0 * bottomRadius;
    const bz0 = cz + z0 * bottomRadius;
    const bx1 = cx + x1 * bottomRadius;
    const bz1 = cz + z1 * bottomRadius;
    const tx0 = cx + x0 * topRadius;
    const tz0 = cz + z0 * topRadius;
    const tx1 = cx + x1 * topRadius;
    const tz1 = cz + z1 * topRadius;
    const by = cy - half;
    const ty = cy + half;
    if (topRadius <= 0.0001) {
      b.addTri(bx1, by, bz1, bx0, by, bz0, cx, ty, cz, color);
    } else {
      b.addQuad(bx1, by, bz1, bx0, by, bz0, tx0, ty, tz0, tx1, ty, tz1, color);
      if (capTop) b.addTri(cx, ty, cz, tx1, ty, tz1, tx0, ty, tz0, color);
    }
    if (capBottom && bottomRadius > 0.0001) {
      b.addTri(cx, by, cz, bx0, by, bz0, bx1, by, bz1, color);
    }
  }
}

/** Add a simple gable roof along the X axis. */
export function addGableRoof(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  width: number, depth: number, height: number,
  color: THREE.Color,
  rotationY = 0,
  overhang = 0.6,
) {
  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const p = (x: number, y: number, z: number): [number, number, number] => [
    cx + x * cos - z * sin,
    cy + y,
    cz + x * sin + z * cos,
  ];
  const ridgeA = p(-hw, height, 0);
  const ridgeB = p(hw, height, 0);
  const eA = p(-hw, 0, -hd);
  const eB = p(hw, 0, -hd);
  const fA = p(-hw, 0, hd);
  const fB = p(hw, 0, hd);
  const gableL0 = p(-hw, 0, -hd);
  const gableL1 = p(-hw, 0, hd);
  const gableR0 = p(hw, 0, -hd);
  const gableR1 = p(hw, 0, hd);
  const ridgeL = p(-hw, height, 0);
  const ridgeR = p(hw, height, 0);
  // Two slopes.
  b.addQuad(...eA, ...ridgeA, ...ridgeB, ...eB, color);
  b.addQuad(...fB, ...ridgeB, ...ridgeA, ...fA, color);
  // Gable ends.
  b.addTri(...gableL1, ...ridgeL, ...gableL0, color.clone().multiplyScalar(0.85));
  b.addTri(...gableR0, ...ridgeR, ...gableR1, color.clone().multiplyScalar(0.85));
}

/** Low-poly sphere added to the builder (rings + pole caps, jittered). */
export function addBlob(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
  color: THREE.Color,
  seed = 1,
  jitter = 0.18,
  segments = 6,
) {
  const rings = 4;
  const rand = (i: number) => {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const ringAt = (r: number): [number, number, number][] => {
    const v = r / (rings + 1);
    const phi = v * Math.PI;
    const out: [number, number, number][] = [];
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const j = 1 + (rand(r * 31 + s) - 0.5) * 2 * jitter;
      out.push([
        cx + Math.sin(phi) * Math.cos(theta) * rx * j,
        cy + Math.cos(phi) * ry * j,
        cz + Math.sin(phi) * Math.sin(theta) * rz * j,
      ]);
    }
    return out;
  };

  const top: [number, number, number] = [cx, cy + ry * (1 + (rand(7) - 0.5) * jitter), cz];
  const bottom: [number, number, number] = [cx, cy - ry * (1 + (rand(9) - 0.5) * jitter), cz];
  const rows: [number, number, number][][] = [];
  for (let r = 0; r < rings; r++) rows.push(ringAt(r));

  // Top cap.
  for (let s = 0; s < segments; s++) {
    const s2 = (s + 1) % segments;
    b.addTri(...top, ...rows[0][s2], ...rows[0][s], color);
  }
  // Bands between rings.
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      const a = rows[r][s];
      const bb = rows[r][s2];
      const c = rows[r + 1][s2];
      const d = rows[r + 1][s];
      b.addTri(...a, ...bb, ...c, color);
      b.addTri(...a, ...c, ...d, color);
    }
  }
  // Bottom cap.
  for (let s = 0; s < segments; s++) {
    const s2 = (s + 1) % segments;
    b.addTri(...bottom, ...rows[rings - 1][s], ...rows[rings - 1][s2], color);
  }
}
