import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { clamp } from '../world/noise';

/**
 * WebGL renderer wrapper with:
 *  - WebGL2 detection + graceful fallback
 *  - pixel-ratio capping
 *  - dynamic resolution scaling driven by frame time
 *  - context-loss handling
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private preset: QualityPreset;
  private baseRenderScale = 1;
  private currentScale = 1;
  private targetScale = 1;
  private frameSamples: number[] = [];
  private sampleIndex = 0;
  private lastAdjust = 0;
  private contextLost = false;
  private onLost?: () => void;
  private onRestored?: () => void;
  readonly isWebGL2: boolean;

  constructor(canvas: HTMLCanvasElement, preset: QualityPreset, handlers: { onLost?: () => void; onRestored?: () => void } = {}) {
    this.canvas = canvas;
    this.preset = preset;
    this.onLost = handlers.onLost;
    this.onRestored = handlers.onRestored;

    const contextAttributes: WebGLContextAttributes = {
      antialias: preset.antialias,
      powerPreference: preset.level === 'high' ? 'high-performance' : 'default',
      alpha: false,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    };

    // Three picks WebGL2 automatically when available and falls back to WebGL1.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      ...contextAttributes,
    });
    this.isWebGL2 = this.renderer.capabilities.isWebGL2;

    this.renderer.setPixelRatio(this.cappedPixelRatio(preset.pixelRatioCap, 1));
    this.renderer.shadowMap.enabled = preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;

    canvas.addEventListener('webglcontextlost', this.handleLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleRestored, false);
  }

  private cappedPixelRatio(cap: number, scale: number): number {
    const dpr = window.devicePixelRatio || 1;
    return clamp(Math.min(dpr, cap) * scale, 0.5, 2);
  }

  setPreset(preset: QualityPreset): void {
    this.preset = preset;
    this.renderer.shadowMap.enabled = preset.shadows;
    this.frameSamples = [];
    this.lastAdjust = 0;
    this.targetScale = 1;
    this.currentScale = 1;
    this.applyScale(1);
  }

  setRenderScale(scale: number): void {
    this.baseRenderScale = clamp(scale, 0.5, 1);
    this.applyScale(this.currentScale);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.applyScale(this.currentScale);
  }

  private applyScale(scale: number): void {
    this.currentScale = scale;
    const ratio = this.cappedPixelRatio(this.preset.pixelRatioCap, scale * this.baseRenderScale);
    this.renderer.setPixelRatio(ratio);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(size.x, size.y, false);
  }

  /** Feed frame time to the dynamic resolution controller. */
  sampleFrame(frameMs: number, now: number): void {
    if (this.frameSamples.length < 90) {
      this.frameSamples.push(frameMs);
    } else {
      this.frameSamples[this.sampleIndex % 90] = frameMs;
      this.sampleIndex++;
    }
    if (now - this.lastAdjust < 1400) return;
    this.lastAdjust = now;
    if (this.frameSamples.length < 30) return;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = this.preset.minRenderScale;

    if (median > 26 && this.targetScale > min) {
      this.targetScale = Math.max(min, this.targetScale - 0.1);
    } else if (median < 15.5 && this.targetScale < 1) {
      this.targetScale = Math.min(1, this.targetScale + 0.05);
    }
    if (Math.abs(this.targetScale - this.currentScale) > 0.02) {
      this.applyScale(this.targetScale);
      this.frameSamples = [];
    }
  }

  get renderScale(): number {
    return this.currentScale;
  }

  get contextLostState(): boolean {
    return this.contextLost;
  }

  private handleLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.onLost?.();
  };

  private handleRestored = (): void => {
    this.contextLost = false;
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.renderer.setPixelRatio(this.cappedPixelRatio(this.preset.pixelRatioCap, this.currentScale));
    this.onRestored?.();
  };

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.contextLost) return;
    this.renderer.info.reset();
    this.renderer.render(scene, camera);
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  get triangles(): number {
    return this.renderer.info.render.triangles;
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored);
    this.renderer.dispose();
  }
}
