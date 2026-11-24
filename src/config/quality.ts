/**
 * Device capability detection + adaptive quality presets.
 *
 * The goal is a stable frame rate on anything from a 2016 phone to a gaming
 * desktop. Nothing is ever forced to "high": the default is what the device can
 * actually sustain, and the player can always override it.
 */

export type QualityLevel = 'verylow' | 'low' | 'medium' | 'high';

export interface QualityPreset {
  level: QualityLevel;
  label: string;
  /** Hard cap on devicePixelRatio. */
  pixelRatioCap: number;
  /** Dynamic resolution scale range applied on top of the pixel ratio cap. */
  minRenderScale: number;
  /** World radius in chunks that stays loaded around the player. */
  viewChunks: number;
  /** Above this distance props are hidden. */
  shadowMapSize: number;
  shadows: boolean;
  shadowRadius: number;
  /** Fraction of potential trees/rocks/grass that get spawned. */
  propDensity: number;
  grassDensity: number;
  /** Terrain vertex colours + material features. */
  anisotropy: number;
  fogStart: number;
  fogEnd: number;
  /** Distance (metres) at which LOD swaps to the cheap version. */
  lodFar: number;
  waterDetail: boolean;
  /** Extra scenic props: reeds, flowers, ruins. */
  decorations: boolean;
  maxParticles: number;
  antialias: boolean;
}

const presets: Record<QualityLevel, QualityPreset> = {
  verylow: {
    level: 'verylow',
    label: 'Very Low',
    pixelRatioCap: 1,
    minRenderScale: 0.6,
    viewChunks: 2,
    shadowMapSize: 0,
    shadows: false,
    shadowRadius: 0,
    propDensity: 0.45,
    grassDensity: 0,
    anisotropy: 1,
    fogStart: 62,
    fogEnd: 230,
    lodFar: 60,
    waterDetail: false,
    decorations: false,
    maxParticles: 80,
    antialias: false,
  },
  low: {
    level: 'low',
    label: 'Low',
    pixelRatioCap: 1.35,
    minRenderScale: 0.65,
    viewChunks: 3,
    shadowMapSize: 512,
    shadows: true,
    shadowRadius: 26,
    propDensity: 0.7,
    grassDensity: 0.4,
    anisotropy: 2,
    fogStart: 80,
    fogEnd: 250,
    lodFar: 90,
    waterDetail: false,
    decorations: true,
    maxParticles: 160,
    antialias: false,
  },
  medium: {
    level: 'medium',
    label: 'Medium',
    pixelRatioCap: 1.75,
    minRenderScale: 0.7,
    viewChunks: 4,
    shadowMapSize: 1024,
    shadows: true,
    shadowRadius: 40,
    propDensity: 0.92,
    grassDensity: 0.75,
    anisotropy: 4,
    fogStart: 120,
    fogEnd: 360,
    lodFar: 140,
    waterDetail: true,
    decorations: true,
    maxParticles: 260,
    antialias: true,
  },
  high: {
    level: 'high',
    label: 'High',
    pixelRatioCap: 2,
    minRenderScale: 0.8,
    viewChunks: 6,
    shadowMapSize: 2048,
    shadows: true,
    shadowRadius: 60,
    propDensity: 1,
    grassDensity: 1,
    anisotropy: 8,
    fogStart: 170,
    fogEnd: 520,
    lodFar: 200,
    waterDetail: true,
    decorations: true,
    maxParticles: 400,
    antialias: true,
  },
};

export function getPreset(level: QualityLevel): QualityPreset {
  return presets[level];
}

export const QUALITY_LEVELS: QualityLevel[] = ['verylow', 'low', 'medium', 'high'];

export interface DeviceProfile {
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  cores: number;
  memoryGB: number;
  maxTextureSize: number;
  gpu: string;
  dpr: number;
  screenShortEdge: number;
  suggested: QualityLevel;
  webgl2: boolean;
  reducedMotion: boolean;
}

interface GPUInfo {
  gpu: string;
  webgl2: boolean;
  maxTextureSize: number;
}

function probeGPU(): GPUInfo {
  const fallback: GPUInfo = { gpu: 'unknown', webgl2: false, maxTextureSize: 2048 };
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    const gl = (gl2 ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return fallback;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return { gpu, webgl2: !!gl2, maxTextureSize };
  } catch {
    return fallback;
  }
}

function scoreGPU(gpu: string): number {
  const g = gpu.toLowerCase();
  if (!g || g === 'unknown') return 0.4;
  if (/(swiftshader|basic render|software|llvmpipe|mesa offscreen)/.test(g)) return 0;
  if (/(apple m[1-9]|rtx (30|40|50)|rx 6[0-9]|rx 7[0-9]|arc a7|gtx 16[6-9]|gtx 10[7-9]0)/.test(g)) return 1;
  if (/(apple a1[5-9]|apple a[2-9][0-9]|adreno 7[3-9]|adreno 8|mali-g7[1-9]|mali-g[89]|immortalis|gtx|radeon rx|iris xe|intel arc)/.test(g))
    return 0.72;
  if (/(adreno 6|mali-g5|mali-g6|intel uhd|hd graphics)/.test(g)) return 0.45;
  return 0.4;
}

let cachedProfile: DeviceProfile | null = null;

export function detectDevice(): DeviceProfile {
  if (cachedProfile) return cachedProfile;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    userAgentData?: { mobile?: boolean; platform?: string };
  };
  const ua = navigator.userAgent;
  const maxTouch = navigator.maxTouchPoints || 0;
  const coarse = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouch > 1);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouch > 1);
  const isTouch = maxTouch > 0 && coarse;
  const isTablet = isIPad || isAndroidTablet || (isTouch && Math.min(screen.width, screen.height) >= 700);
  const isMobile = isTouch && !isTablet;

  const cores = nav.hardwareConcurrency || (isMobile ? 4 : 4);
  const memoryGB = nav.deviceMemory || (isMobile ? 3 : 8);
  const dpr = window.devicePixelRatio || 1;
  const screenShortEdge = Math.min(window.screen.width, window.screen.height) * dpr;

  const gpuInfo = probeGPU();
  const gpuScore = scoreGPU(gpuInfo.gpu);

  let score = gpuScore * 55;
  score += Math.min(cores, 16) * 1.6;
  score += Math.min(memoryGB, 16) * 1.1;
  if (gpuInfo.webgl2) score += 6;
  if (!isTouch) score += 8;
  if (isMobile) score -= 18;
  else if (isTablet) score -= 8;
  if (dpr > 2.5) score -= 4;
  if (gpuInfo.maxTextureSize < 4096) score -= 8;

  let suggested: QualityLevel;
  if (gpuScore === 0 || score < 28) suggested = 'verylow';
  else if (score < 48) suggested = 'low';
  else if (score < 74) suggested = 'medium';
  else suggested = 'high';

  // Never offer "high" to a phone, however new it is — battery and thermals.
  if (isMobile && (suggested === 'high' || suggested === 'medium')) suggested = score > 62 ? 'medium' : 'low';

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  cachedProfile = {
    isTouch,
    isMobile,
    isTablet,
    isIOS,
    cores,
    memoryGB,
    maxTextureSize: gpuInfo.maxTextureSize,
    gpu: gpuInfo.gpu,
    dpr,
    screenShortEdge,
    suggested,
    webgl2: gpuInfo.webgl2,
    reducedMotion,
  };
  return cachedProfile;
}
