import * as THREE from 'three';

/**
 * A tall, cheap "look here" marker planted at the tracked objective.
 *
 * Two crossed gradient quads plus a light column: 3 draw calls, no textures,
 * additive blending so it reads clearly against sky, grass or rock, and it
 * never occludes the player because it is rendered without depth writes.
 */
export class ObjectiveBeacon {
  readonly group = new THREE.Group();
  private beam: THREE.Mesh;
  private diamond: THREE.Mesh;
  private ring: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private diamondMaterial: THREE.MeshBasicMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;
  private outline: THREE.Mesh;
  private outlineMaterial: THREE.MeshBasicMaterial;
  private halo: THREE.Sprite;
  private haloMaterial: THREE.SpriteMaterial;
  private haloTexture: THREE.Texture;
  private time = 0;
  private wasVisible = false;

  constructor() {
    // ---- Light column -------------------------------------------------
    const beamGeo = new THREE.CylinderGeometry(0.55, 1.25, 52, 12, 1, true);
    beamGeo.translate(0, 26, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffc247) },
        uOpacity: { value: 0.72 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vFade = 1.0;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          // Bright at the base, fading out toward the top of the column.
          float vertical = pow(1.0 - vUv.y, 1.6);
          // Soft edges across the cylinder so it does not look like a solid tube.
          float edge = pow(sin(vUv.x * 3.14159), 1.2);
          // Slow upward pulse.
          float pulse = 0.72 + 0.28 * sin(uTime * 2.2 - vUv.y * 6.0);
          // Floor the pulse (never fully dark) but keep it scaled by opacity so
          // the column genuinely fades out as the player arrives.
          float body = vertical * edge * max(pulse, 0.55);
          float a = body * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * (1.05 + 0.45 * vertical), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(beamGeo, this.material);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 3;

    // ---- Floating diamond --------------------------------------------
    const diaGeo = new THREE.OctahedronGeometry(0.95, 0);
    // Always visible, even behind a hill or above the fog: this is the "walk
    // this way" marker, so hiding it behind terrain would defeat the purpose.
    this.diamondMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb63d,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });
    this.diamond = new THREE.Mesh(diaGeo, this.diamondMaterial);
    this.diamond.position.y = 9;
    this.diamond.renderOrder = 20;

    // Dark outline so the gold diamond stays readable against bright sky.
    const outlineGeo = new THREE.OctahedronGeometry(1.16, 0);
    this.outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x120c04,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
    });
    this.outline = new THREE.Mesh(outlineGeo, this.outlineMaterial);
    this.outline.position.y = 9;
    this.outline.renderOrder = 19;

    // ---- Ground ring --------------------------------------------------
    const ringGeo = new THREE.RingGeometry(2.0, 2.55, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd479,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ring.position.y = 0.25;
    this.ring.renderOrder = 3;

    // ---- Glow halo ----------------------------------------------------
    // A camera-facing sprite guarantees the marker reads at any distance or
    // angle, where a faceted solid would shrink to a couple of pixels.
    this.haloTexture = makeHaloTexture();
    this.haloMaterial = new THREE.SpriteMaterial({
      map: this.haloTexture,
      color: 0xffd479,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.halo = new THREE.Sprite(this.haloMaterial);
    this.halo.position.y = 9;
    this.halo.renderOrder = 18;

    this.group.add(this.beam, this.outline, this.diamond, this.halo, this.ring);
    this.group.visible = false;
    this.group.renderOrder = 3;

    // The diamond opts out of the fog too: a waypoint 300 m out still has to be
    // visible, and fog would otherwise wash it into the horizon.
    (this.diamondMaterial as THREE.MeshBasicMaterial).fog = false;
    (this.outlineMaterial as THREE.MeshBasicMaterial).fog = false;
  }

  /** Point the marker at a world position (y is the ground height there). */
  setTarget(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
    if (!this.wasVisible) {
      this.group.visible = true;
      this.wasVisible = true;
    }
  }

  hide(): void {
    this.group.visible = false;
    this.wasVisible = false;
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    if (!this.group.visible) return;
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;

    const dist = Math.hypot(cameraPos.x - this.group.position.x, cameraPos.z - this.group.position.z);

    // Far away the marker would shrink to a pixel: grow it with distance
    // (capped) so the player can always see where to walk.
    const grow = THREE.MathUtils.clamp(dist / 40, 1, 5);
    this.beam.scale.set(grow, 1, grow);

    // Floating diamond: bobs, spins slowly and breathes. It is drawn with
    // depthTest off so it shows through hills (this is a waypoint, not scenery).
    const pulseScale = 1 + Math.sin(this.time * 2.6) * 0.07;
    const diaScale = grow * pulseScale;
    // Halo grows faster than the solid so a 300 m-away marker is still obvious.
    const haloScale = 4.2 + grow * 3.4;
    this.halo.scale.set(haloScale, haloScale, 1);
    this.diamond.rotation.y = this.time * 1.1;
    const bob = 9 + Math.sin(this.time * 1.8) * 0.4;
    this.diamond.position.y = bob;
    this.halo.position.y = bob;
    this.diamond.scale.setScalar(diaScale);
    this.outline.rotation.y = this.diamond.rotation.y;
    this.outline.position.y = bob;
    this.outline.scale.setScalar(diaScale);

    // The ground ring pulses outward to draw the eye.
    const pulse = (this.time % 2.2) / 2.2;
    this.ring.scale.setScalar(0.85 + pulse * 0.45 + (grow - 1) * 0.5);
    this.ringMaterial.opacity = 0.5 * (1 - pulse);

    // Fade the column out as the player arrives: standing inside a 50 m light
    // shaft floods the screen, and the ground ring already marks the spot.
    const strength = THREE.MathUtils.clamp((dist - 13) / 18, 0, 1);
    this.material.uniforms.uOpacity.value = 0.72 * strength;
    this.outlineMaterial.opacity = 0.55 * strength;
    this.diamondMaterial.opacity = Math.max(0, strength);
    this.haloMaterial.opacity = 0.85 * strength * (0.82 + 0.18 * Math.sin(this.time * 2.4));
    this.beam.visible = strength > 0.02;
    this.diamond.visible = strength > 0.02;
    this.outline.visible = strength > 0.02;
    this.halo.visible = strength > 0.02;
  }

  dispose(): void {
    this.beam.geometry.dispose();
    this.diamond.geometry.dispose();
    this.ring.geometry.dispose();
    this.outline.geometry.dispose();
    this.outlineMaterial.dispose();
    this.haloMaterial.dispose();
    this.haloTexture.dispose();
    this.material.dispose();
    this.diamondMaterial.dispose();
    this.ringMaterial.dispose();
  }
}

/** Soft radial gold glow, generated once (no image assets needed). */
function makeHaloTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 246, 222, 1)');
    g.addColorStop(0.28, 'rgba(255, 206, 122, 0.85)');
    g.addColorStop(0.6, 'rgba(255, 178, 60, 0.32)');
    g.addColorStop(1, 'rgba(255, 170, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
