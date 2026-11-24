import * as THREE from 'three';

let softSprite: THREE.Texture | null = null;
let glowSprite: THREE.Texture | null = null;

/** A round, soft-edged point sprite (used by every particle system). */
export function getSoftSprite(): THREE.Texture {
  if (softSprite) return softSprite;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  softSprite = tex;
  return tex;
}

/** A wider, warmer glow used for lamps, waystones and fireflies. */
export function getGlowSprite(): THREE.Texture {
  if (glowSprite) return glowSprite;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.25, 'rgba(255,240,200,0.55)');
  grad.addColorStop(0.6, 'rgba(255,220,160,0.14)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  glowSprite = tex;
  return tex;
}

export function makeGlowMaterial(color: number, opacity = 0.7): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: getGlowSprite(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
}
