import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../world/noise';
import type { QualityPreset } from '../config/quality';

interface SkyStop {
  t: number;
  top: number;
  horizon: number;
  sun: number;
  ambient: number;
  hemiGround: number;
  fog: number;
  sunIntensity: number;
  ambientIntensity: number;
  starOpacity: number;
}

const STOPS: SkyStop[] = [
  { t: 0, top: 0x070d1c, horizon: 0x14243a, sun: 0x2c4a72, ambient: 0x24374f, hemiGround: 0x16202e, fog: 0x101d2e, sunIntensity: 0.35, ambientIntensity: 0.85, starOpacity: 1 },
  { t: 4.6, top: 0x0d1a2e, horizon: 0x2f3d5c, sun: 0x4a4a68, ambient: 0x33425e, hemiGround: 0x1a2536, fog: 0x1f2c46, sunIntensity: 0.35, ambientIntensity: 0.9, starOpacity: 0.75 },
  { t: 6.2, top: 0x3d6a9e, horizon: 0xe5a273, sun: 0xffcf8f, ambient: 0x6f89a8, hemiGround: 0x4a4038, fog: 0xd9a98a, sunIntensity: 0.85, ambientIntensity: 0.6, starOpacity: 0.1 },
  { t: 8.5, top: 0x4f97d6, horizon: 0xa9d4ea, sun: 0xfff2d0, ambient: 0x9fbcd4, hemiGround: 0x8f9d7a, fog: 0xb8d7e6, sunIntensity: 1.55, ambientIntensity: 0.8, starOpacity: 0 },
  { t: 12, top: 0x3f8fd8, horizon: 0xc0e0f0, sun: 0xffffff, ambient: 0xaecbe0, hemiGround: 0x9aa587, fog: 0xc8e2ef, sunIntensity: 1.8, ambientIntensity: 0.9, starOpacity: 0 },
  { t: 16.5, top: 0x4f8fc8, horizon: 0xd6d8c4, sun: 0xfff0cf, ambient: 0xa8bed0, hemiGround: 0x9c9d7a, fog: 0xd2ddcc, sunIntensity: 1.55, ambientIntensity: 0.82, starOpacity: 0 },
  { t: 18.6, top: 0x47649b, horizon: 0xf0a06a, sun: 0xffb36b, ambient: 0x8f8497, hemiGround: 0x5a4535, fog: 0xe2a07c, sunIntensity: 0.95, ambientIntensity: 0.62, starOpacity: 0.15 },
  { t: 20.2, top: 0x1d2b4a, horizon: 0x6a4f6a, sun: 0x6a5a7a, ambient: 0x3d4663, hemiGround: 0x232a3a, fog: 0x35305a, sunIntensity: 0.35, ambientIntensity: 0.5, starOpacity: 0.6 },
  { t: 22, top: 0x080f21, horizon: 0x152640, sun: 0x28406a, ambient: 0x233652, hemiGround: 0x141e2c, fog: 0x101c2c, sunIntensity: 0.35, ambientIntensity: 0.85, starOpacity: 1 },
  { t: 24, top: 0x070d1c, horizon: 0x14243a, sun: 0x2c4a72, ambient: 0x24374f, hemiGround: 0x16202e, fog: 0x101d2e, sunIntensity: 0.35, ambientIntensity: 0.85, starOpacity: 1 },
];

const cA = new THREE.Color();
const cB = new THREE.Color();

function sampleColor(key: keyof SkyStop, t: number, out: THREE.Color): THREE.Color {
  let i = 0;
  while (i < STOPS.length - 1 && STOPS[i + 1].t <= t) i++;
  const a = STOPS[i];
  const b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const span = b.t - a.t || 1;
  const f = smoothstep(0, 1, clamp((t - a.t) / span, 0, 1));
  cA.setHex(a[key] as number);
  cB.setHex(b[key] as number);
  return out.copy(cA).lerp(cB, f);
}

function sampleNumber(key: keyof SkyStop, t: number): number {
  let i = 0;
  while (i < STOPS.length - 1 && STOPS[i + 1].t <= t) i++;
  const a = STOPS[i];
  const b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const span = b.t - a.t || 1;
  const f = clamp((t - a.t) / span, 0, 1);
  return lerp(a[key] as number, b[key] as number, f);
}

export class Sky {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly fill: THREE.DirectionalLight;
  readonly dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private starsMat: THREE.PointsMaterial;
  private sunDisc: THREE.Mesh;
  private moonDisc: THREE.Mesh;
  private glow: THREE.Mesh;
  private fogColor = new THREE.Color();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, preset: QualityPreset) {
    this.scene = scene;

    // Sky dome with a vertical gradient.
    const geo = new THREE.SphereGeometry(900, 24, 16);
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x3f8fd8) },
        horizonColor: { value: new THREE.Color(0xc0e0f0) },
        sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) },
        sunColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y * 1.35 + 0.06, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.65));
          float sun = pow(max(dot(dir, normalize(sunDir)), 0.0), 12.0);
          col += sunColor * sun * 0.35;
          float glow = pow(max(dot(dir, normalize(sunDir)), 0.0), 2.0);
          col += sunColor * glow * 0.06;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(geo, this.domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    scene.add(this.dome);

    // Stars (only on capable devices).
    const starCount = preset.level === 'high' ? 900 : preset.level === 'medium' ? 520 : preset.level === 'low' ? 260 : 120;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random() * 0.85 + 0.05;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(v);
      const r = 780;
      starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPos[i * 3 + 1] = Math.cos(phi) * r;
      starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xe8f2ff,
      size: preset.level === 'verylow' ? 2.6 : 3.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -900;
    scene.add(this.stars);

    // Sun and moon discs.
    const discGeo = new THREE.SphereGeometry(16, 12, 8);
    this.sunDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    this.sunDisc.renderOrder = -890;
    scene.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
    this.moonDisc.scale.setScalar(0.62);
    this.moonDisc.renderOrder = -890;
    scene.add(this.moonDisc);

    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(34, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.18, depthWrite: false, fog: false }),
    );
    this.glow.renderOrder = -895;
    scene.add(this.glow);

    // Lights.
    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.castShadow = preset.shadows;
    if (preset.shadows) {
      this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      const r = preset.shadowRadius;
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = 220;
      cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0012;
      this.sun.shadow.normalBias = 0.04;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xaecbe0, 0x6b7c52, 0.85);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(this.ambient);

    // A dim, shadowless fill from the opposite side of the sun. Without it,
    // any face pointing away from the sun reads as flat grey — especially on
    // low-end devices where real-time shadows are off.
    this.fill = new THREE.DirectionalLight(0xdfeaff, 0.42);
    this.fill.position.set(-60, 55, -40);
    scene.add(this.fill);

    scene.fog = new THREE.Fog(0xc8e2ef, preset.fogStart, preset.fogEnd);
  }

  setPreset(preset: QualityPreset): void {
    this.sun.castShadow = preset.shadows;
    if (preset.shadows) {
      this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      const r = preset.shadowRadius;
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.far = 220;
      cam.updateProjectionMatrix();
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = preset.fogStart;
      this.scene.fog.far = preset.fogEnd;
    }
  }

  /** time: hours 0..24. cameraPos keeps the dome centred on the player. */
  update(time: number, cameraPos: THREE.Vector3, weather: number): void {
    const t = ((time % 24) + 24) % 24;

    const top = sampleColor('top', t, new THREE.Color());
    const horizon = sampleColor('horizon', t, new THREE.Color());
    const sunColor = sampleColor('sun', t, new THREE.Color());
    const ambientColor = sampleColor('ambient', t, new THREE.Color());
    const hemiGround = sampleColor('hemiGround', t, new THREE.Color());
    const fog = sampleColor('fog', t, this.fogColor);
    const starOpacity = sampleNumber('starOpacity', t);

    // Weather pulls everything toward a desaturated grey-blue.
    if (weather > 0) {
      const grey = new THREE.Color(0x8f9aa6);
      top.lerp(grey, weather * 0.55);
      horizon.lerp(grey, weather * 0.6);
      fog.lerp(grey, weather * 0.55);
    }

    this.domeMat.uniforms.topColor.value.copy(top);
    this.domeMat.uniforms.horizonColor.value.copy(horizon);
    this.domeMat.uniforms.sunColor.value.copy(sunColor);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(fog);
    }

    // Sun path: rises at 6, sets at 18.6, tilts across the sky.
    const dayAngle = ((t - 6) / 12.6) * Math.PI;
    const sunUp = t > 5.6 && t < 18.8;
    const sunX = Math.cos(dayAngle) * 0.85;
    const sunY = Math.sin(dayAngle);
    const sunZ = 0.42;
    const sunDir = new THREE.Vector3(sunX, sunUp ? Math.max(sunY, -0.2) : Math.min(sunY, -0.05), sunZ).normalize();
    this.domeMat.uniforms.sunDir.value.copy(sunDir);

    this.sun.position.copy(sunDir).multiplyScalar(120).add(cameraPos);
    this.sun.target.position.copy(cameraPos);
    this.sun.target.updateMatrixWorld();
    this.sun.color.copy(sunColor);
    this.sun.intensity = sampleNumber('sunIntensity', t) * (1 - weather * 0.45);

    this.hemi.color.copy(ambientColor);
    this.hemi.groundColor.copy(hemiGround);
    this.hemi.intensity = sampleNumber('ambientIntensity', t) * 0.8 * (1 - weather * 0.2);
    this.hemi.color.lerp(new THREE.Color(0xffffff), 0.25);
    this.ambient.color.copy(ambientColor);
    this.ambient.intensity = sampleNumber('ambientIntensity', t) * 0.42;
    this.fill.color.copy(ambientColor).lerp(new THREE.Color(0xffffff), 0.4);
    this.fill.intensity = sampleNumber('ambientIntensity', t) * 0.55 * (1 - weather * 0.3);
    this.fill.position.copy(cameraPos).add(new THREE.Vector3(-70, 60, -50));

    // Dome + stars follow the camera so the horizon never moves.
    this.dome.position.copy(cameraPos);
    this.stars.position.copy(cameraPos);
    this.starsMat.opacity = starOpacity * (1 - weather * 0.85);
    this.stars.rotation.y = (t / 24) * Math.PI * 0.5;

    // Celestial discs.
    this.sunDisc.position.copy(cameraPos).add(sunDir.clone().multiplyScalar(700));
    this.sunDisc.visible = sunUp;
    this.glow.position.copy(this.sunDisc.position);
    this.glow.visible = sunUp;
    this.moonDisc.position.copy(cameraPos).add(sunDir.clone().multiplyScalar(-700));
    this.moonDisc.visible = !sunUp;
  }

  /** 0..1 darkness helper for gameplay (shadowy forests at night). */
  static darkness(time: number): number {
    const t = ((time % 24) + 24) % 24;
    return 1 - smoothstep(5.5, 8, t) * (1 - smoothstep(17.5, 20.5, t));
  }

  dispose(): void {
    this.scene.remove(this.dome, this.stars, this.sunDisc, this.moonDisc, this.glow, this.sun, this.hemi, this.ambient, this.fill);
    this.dome.geometry.dispose();
    this.domeMat.dispose();
    this.stars.geometry.dispose();
    this.starsMat.dispose();
    this.sunDisc.geometry.dispose();
    (this.sunDisc.material as THREE.Material).dispose();
    (this.moonDisc.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.glow.geometry.dispose();
  }
}
