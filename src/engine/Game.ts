import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Sky } from './Sky';
import { Weather } from './weather';
import { Particles } from './Particles';
import { AudioEngine } from './AudioEngine';
import { Input } from './Input';
import { Player } from './Player';
import { CameraRig } from './CameraRig';
import { ObjectiveBeacon } from './ObjectiveBeacon';
import { ChunkManager } from '../world/ChunkManager';
import {
  Scenery,
  buildNPCActors,
  updateNPCActors,
  buildFishSchool,
  peakLocation,
  type NPCActor,
} from '../world/scenery';
import { sampleHeight, WATER_LEVEL } from '../world/terrain';
import { VILLAGES, WAYSTONES, CAVE, SPAWN, SHORE_STONES, LURE, WORLD_SEED } from '../world/features';
import { NPCS } from '../game/dialogue';
import { tryAdvance } from '../game/questRuntime';
import { DialogueController } from '../game/dialogueRuntime';
import { loadSaveDataIntoGame, startAutosave } from '../game/persistence';
import { notifyCairnReached, notifyInventoryChange, notifyPosition, notifyTalked } from '../game/questRuntime';
import { useGame } from '../game/store';
import { bus } from '../game/bus';
import { t, onLanguageSwitch } from '../i18n';
import { placeName, presetLabel } from '../i18n/content';
import type { TKey } from '../i18n/ui';
import { getPreset, type QualityPreset } from '../config/quality';
import { savePlayer, setSavePlaytime } from '../game/saveRuntime';
import { clamp } from '../world/noise';
import type { Interactable } from '../game/types';
import { ITEMS } from '../config/items';
import { POWER_UPS, type PowerupKind } from '../game/powerups';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  onReady?: () => void;
  onPointerLockChange?: (locked: boolean) => void;
}

const DAY_LENGTH_SECONDS = 780; // 13 real minutes = 24 in-game hours

export class Game {
  readonly scene: THREE.Scene;
  readonly renderer: Renderer;
  readonly sky: Sky;
  readonly weather: Weather;
  readonly particles: Particles;
  readonly audio = new AudioEngine();
  readonly input: Input;
  readonly player: Player;
  readonly cameraRig: CameraRig;
  readonly chunks: ChunkManager;
  readonly scenery: Scenery;
  readonly beacon = new ObjectiveBeacon();

  private running = false;
  private paused = false;
  private rafId = 0;
  private frameCount = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lastStatsPush = 0;
  private timeOfDay = 8.4;
  private playtime = 0;
  private interactables: Interactable[] = [];
  private npcActors: NPCActor[] = [];
  private fish: ReturnType<typeof buildFishSchool> | null = null;
  private nearest: Interactable | null = null;
  private lastArea = '';
  private weatherLevel = 0;
  private weatherTarget = 0;
  private weatherTimer = 60;
  private rainOn = false;
  private staminaDrain = 0;
  private invulnerableUntil = 0;
  private dialogue: DialogueController;
  private disposed = false;
  private preset: QualityPreset;
  private visibilityHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readyCalled = false;
  private autoQualityTimer = 0;
  private lowFpsStreak = 0;
  private highFpsStreak = 0;
  private onReady?: () => void;

  constructor(opts: EngineOptions) {
    this.onReady = opts.onReady;
    const store = useGame.getState();
    this.preset = getPreset(store.graphics.level);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc8e2ef);

    this.renderer = new Renderer(opts.canvas, this.preset, {
      onLost: () => {
        useGame.getState().set({ webglLost: true });
        this.running = false;
      },
      onRestored: () => {
        useGame.getState().set({ webglLost: false });
        this.running = true;
        this.lastFrameTime = performance.now();
      },
    });

    this.sky = new Sky(this.scene, this.preset);
    this.weather = new Weather(this.scene, this.preset);
    this.particles = new Particles(this.scene, this.preset.maxParticles);
    this.cameraRig = new CameraRig(this.aspect);
    this.player = new Player(this.scene);
    this.chunks = new ChunkManager(this.scene, this.preset, WORLD_SEED);
    this.scenery = new Scenery();
    this.scene.add(this.scenery.group);
    this.scene.add(this.beacon.group);

    this.input = new Input(opts.canvas, {
      onPause: () => this.togglePause(),
      onInventory: () => this.toggleUi('inventoryOpen'),
      onQuests: () => this.toggleUi('questLogOpen'),
      onMap: () => this.toggleUi('mapOpen'),
      onHeal: () => this.quickHeal(),
      onInteract: () => this.tryInteract(),
      onCameraReset: () => this.cameraRig.reset(this.player.yaw + Math.PI),
      onAnyInput: () => this.audio.resume(),
    });
    this.input.setSensitivity(store.controls.sensitivity);
    this.audio.setVolumes({
      master: store.audio.master,
      music: store.audio.music,
      sfx: store.audio.sfx,
      muted: store.audio.muted,
    });

    this.scenery.build(this.preset, this.interactables);
    // Switching language must relabel prompts and tracker text that were
    // captured in the interactable list at build time.
    const stopLangListener = onLanguageSwitch(() => this.refreshLocalizedLabels());
    this.onDispose.push(stopLangListener);
    this.npcActors = buildNPCActors(this.scene);
    for (const npc of NPCS) {
      this.interactables.push({
        id: `npc:${npc.id}`,
        kind: 'npc',
        label: t('act.talkTo', { name: npc.name }),
        x: npc.x,
        y: sampleHeight(npc.x, npc.z),
        z: npc.z,
        radius: 5.6,
        data: { npcId: npc.id },
      });
    }
    if (this.preset.maxParticles > 140) {
      this.fish = buildFishSchool();
      this.scene.add(this.fish.group);
    }
    this.buildNightLights();

    // Start the camera behind the player facing the village, not the horizon.
    this.cameraRig.yaw = this.player.yaw + Math.PI;
    this.cameraRig.pitch = -0.12;

    // Restore the saved position if there is one, otherwise spawn at the
    // authored starting point. Seed the world around it before frame one so
    // the player never sees empty void.
    const saved = loadSaveDataIntoGame();
    const spawnX = saved ? clamp(saved.player.x, -950, 950) : SPAWN[0];
    const spawnZ = saved ? clamp(saved.player.z, -950, 950) : SPAWN[1];
    this.player.spawn(spawnX, spawnZ);
    if (saved) {
      this.player.yaw = saved.player.yaw;
      this.timeOfDay = saved.time;
    }
    this.dialogue = new DialogueController(() => this.onDialogueChanged());
    this.chunks.update(this.player.position.x, this.player.position.z);
    this.chunks.processQueue(60);
    this.cameraRig.update(0.016, this.player.position, true);

    this.bindEvents();
    this.resize();

    // Debug handle for automated smoke tests and support diagnostics.
    (window as unknown as { __lh?: Game }).__lh = this;
  }

  /** Warm point lights at each village, faded in after dusk. */
  private nightLights: { light: THREE.PointLight; base: number }[] = [];

  private buildNightLights(): void {
    for (let i = 0; i < VILLAGES.length; i++) {
      const v = VILLAGES[i];
      const light = new THREE.PointLight(0xffb86b, 0, 34, 1.7);
      light.position.set(v.x, sampleHeight(v.x, v.z) + 3.2, v.z);
      this.scene.add(light);
      this.nightLights.push({ light, base: 1 });
    }
    // The campfires share a single extra light near the first village.
    const fire = new THREE.PointLight(0xff9a4a, 0, 18, 1.9);
    fire.position.set(VILLAGES[0].x + 10, sampleHeight(VILLAGES[0].x + 10, VILLAGES[0].z + 6) + 1.2, VILLAGES[0].z + 6);
    this.scene.add(fire);
    this.nightLights.push({ light: fire, base: 0.9 });
  }

  private get aspect(): number {
    return window.innerWidth / Math.max(1, window.innerHeight);
  }

  private bindEvents(): void {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.body);

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.audio.suspend();
      } else {
        // Reset the frame timer so returning to the tab never produces a huge dt.
        this.lastFrameTime = performance.now();
        if (!this.paused) this.audio.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('orientationchange', this.resize);

    const unsubs = [
      bus.on('playSfx', ({ name }) => this.audio.play(name)),
      bus.on('qualityChanged', () => this.applyQuality()),
      bus.on('volumesChanged', () => {
        const a = useGame.getState().audio;
        this.audio.setVolumes({ master: a.master, music: a.music, sfx: a.sfx, muted: a.muted });
      }),
      bus.on('requestSave', () => this.syncSaveRuntime()),
      bus.on('itemCollected', () => notifyInventoryChange()),
      bus.on('waystoneActivated', () => this.checkQuestProgress()),
      bus.on('areaDiscovered', () => this.checkQuestProgress()),
    ];
    this.cleanupFns = unsubs;
    this.cleanupFns.push(startAutosave());
  }

  private cleanupFns: (() => void)[] = [];

  private syncSaveRuntime(): void {
    savePlayer.x = this.player.position.x;
    savePlayer.y = this.player.position.y;
    savePlayer.z = this.player.position.z;
    savePlayer.yaw = this.player.yaw;
    setSavePlaytime(this.playtime);
  }

  private checkQuestProgress(): void {
    notifyInventoryChange();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.cameraRig.setAspect(w / Math.max(1, h));
  }

  private applyQuality(): void {
    const store = useGame.getState();
    const preset = getPreset(store.graphics.level);
    this.preset = preset;
    this.renderer.setPreset(preset);
    this.sky.setPreset(preset);
    this.weather.setPreset(preset);
    this.chunks.setPreset(preset);
    this.renderer.setRenderScale(store.graphics.renderScale);
    this.syncSaveRuntime();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.setEnabled(!paused);
    if (paused) {
      this.input.exitPointerLock();
      this.audio.suspend();
      this.syncSaveRuntime();
    } else {
      this.audio.resume();
      this.lastFrameTime = performance.now();
    }
  }

  togglePause(): void {
    const store = useGame.getState();
    // Conversations own the Escape key while they are open.
    if (store.dialogueOpen) return;
    if (store.inventoryOpen || store.questLogOpen || store.mapOpen) {
      store.set({ dialogueOpen: false, inventoryOpen: false, questLogOpen: false, mapOpen: false });
      this.setPaused(false);
      bus.emit('playSfx', { name: 'close' });
      return;
    }
    if (this.paused) {
      store.setScreen('playing');
      this.setPaused(false);
      bus.emit('playSfx', { name: 'close' });
    } else {
      store.setScreen('paused');
      this.setPaused(true);
      bus.emit('playSfx', { name: 'open' });
    }
  }

  private toggleUi(key: 'inventoryOpen' | 'questLogOpen' | 'mapOpen'): void {
    const store = useGame.getState();
    if (store.dialogueOpen) return;
    const next = !store[key];
    store.set({
      inventoryOpen: key === 'inventoryOpen' ? next : false,
      questLogOpen: key === 'questLogOpen' ? next : false,
      mapOpen: key === 'mapOpen' ? next : false,
    });
    const anyOpen = next;
    this.setPaused(anyOpen);
    bus.emit('playSfx', { name: next ? 'open' : 'close' });
  }

  private quickHeal(): void {
    const store = useGame.getState();
    if (store.countItem('trail_ration') > 0 && store.health < store.maxHealth) {
      store.removeItem('trail_ration', 1);
      store.heal(30);
      store.pushToast({ text: t('toast.rationEaten'), kind: 'heal', icon: 'trail_ration' });
    } else if (store.countItem('sunleaf') > 0) {
      store.removeItem('sunleaf', 1);
      store.setStamina(store.maxStamina);
      store.pushToast({ text: t('toast.sunleafChewed'), kind: 'heal', icon: 'sunleaf' });
    } else {
      store.pushToast({ text: t('toast.nothingToEat'), kind: 'info' });
    }
  }

  tryInteract(): void {
    const store = useGame.getState();
    if (!this.nearest || store.dialogueOpen) return;
    this.performInteract(this.nearest);
  }

  private performInteract(target: Interactable): void {
    const store = useGame.getState();
    switch (target.kind) {
      case 'npc': {
        const npcId = String(target.data?.npcId ?? '');
        if (!npcId) return;
        store.set({ dialogueOpen: true });
        this.setPaused(true);
        const state = this.dialogue.start(npcId);
        store.set({ dialogueState: state });
        notifyTalked(npcId);
        bus.emit('dialogueStart', { npcId, nodeId: state.nodeId });
        bus.emit('playSfx', { name: 'open' });
        break;
      }
      case 'herb': {
        const itemId = String(target.data?.itemId ?? 'sunleaf');
        const def = ITEMS[itemId];
        if (store.addItem(itemId, 1)) {
          store.pushToast({ text: t('toast.herbCollected', { name: placeName(def?.name ?? 'Sunleaf') }), kind: 'item', icon: def?.icon });
          this.particles.spawn(new THREE.Vector3(target.x, target.y + 0.6, target.z), 0xa8f0a0, { count: 14, speed: 1.6 });
          const herbId = String(target.id).split(':')[1];
          this.scenery.hideHerb(herbId);
          this.audio.play('pickup');
          this.removeInteractable(target.id);
        } else {
          store.pushToast({ text: t('inv.full'), kind: 'info' });
        }
        break;
      }
      case 'stone': {
        const itemId = String(target.data?.itemId ?? 'riverstone');
        const qty = Number(target.data?.qty ?? 1);
        const def = ITEMS[itemId];
        if (store.addItem(itemId, qty)) {
          store.pushToast({ text: t('toast.stoneCollected', { name: placeName(def?.name ?? 'Riverstone') }), kind: 'item', icon: def?.icon });
          this.particles.spawn(new THREE.Vector3(target.x, target.y + 0.4, target.z), 0xbfe6f2, { count: 12, speed: 1.4 });
          this.audio.play('pickup');
          this.removeInteractable(target.id);
        }
        break;
      }
      case 'chest': {
        const itemId = String(target.data?.item ?? 'trail_ration');
        const qty = Number(target.data?.qty ?? 1);
        const def = ITEMS[itemId];
        if (store.addItem(itemId, qty)) {
          store.pushToast({ text: t('toast.itemQty', { name: placeName(def?.name ?? 'Item'), qty }), kind: 'item', icon: def?.icon });
          this.particles.spawn(new THREE.Vector3(target.x, target.y + 0.8, target.z), 0xffd479, { count: 26, speed: 3 });
          this.audio.play('pickup');
          this.removeInteractable(target.id);
        }
        break;
      }
      case 'waystone': {
        const name = String(target.data?.name ?? 'Waystone');
        const id = String(target.data?.id ?? '');
        if (store.discovered.includes(name)) {
          store.pushToast({ text: t('toast.waystoneAwake', { name: placeName(name) }), kind: 'info' });
          return;
        }
        store.discover(name);
        store.setFlag(`waystone_${id}`, true);
        store.pushToast({ text: t('toast.waystoneWakes', { name: placeName(name) }), kind: 'quest' });
        this.audio.play('waystone');
        this.particles.spawn(new THREE.Vector3(target.x, target.y + 2.2, target.z), 0x8fe3ff, {
          count: 40,
          speed: 4.5,
          life: 1.8,
          gravity: -1.2,
          size: 0.3,
        });
        this.cameraRig.shake(0.25, 0.5);
        bus.emit('waystoneActivated', { name });
        getPeakQuestTrigger(store);
        break;
      }
      case 'campfire': {
        store.heal(store.maxHealth);
        store.setStamina(store.maxStamina);
        this.timeOfDay = Math.min(23.5, this.timeOfDay + 2);
        store.pushToast({ text: t('toast.rested'), kind: 'heal' });
        this.audio.play('heal');
        break;
      }
      case 'cave': {
        store.setFlag('visited_cave', true);
        if (store.quests['q2_long_dark']?.status === 'active' && (store.quests['q2_long_dark'].progress ?? 0) <= 1) {
          tryAdvance('q2_long_dark');
          tryAdvance('q2_long_dark');
        }
        if (store.countItem('waystone_shard') === 0) {
          store.addItem('waystone_shard', 1);
          store.pushToast({ text: t('toast.shardFound'), kind: 'item', icon: 'waystone_shard' });
        } else {
          store.pushToast({ text: t('toast.caveHums'), kind: 'info' });
        }
        notifyInventoryChange();
        this.audio.play('discover');
        this.cameraRig.shake(0.15, 0.6);
        break;
      }
      case 'signpost': {
        if (target.data?.cairn) {
          // Only reachable while the final quest is running: the cairn is the
          // objective, not a free item dispenser.
          const finalState = store.quests['q6_starlit_ascent'];
          if (finalState?.status !== 'active') {
            store.pushToast({ text: t('toast.cairnQuiet'), kind: 'info' });
            break;
          }
          store.setFlag('cairn_reached', true);
          // Climbing the peak and reaching the cairn are the same arrival.
          notifyCairnReached();
          if (store.countItem('horizon_compass') === 0) {
            store.addItem('horizon_compass', 1);
            store.pushToast({ text: t('toast.compassFound'), kind: 'item', icon: 'horizon_compass' });
          }
          store.pushToast({ text: t('toast.cairnAnswers'), kind: 'quest' });
          this.particles.spawn(new THREE.Vector3(target.x, target.y + 1.6, target.z), 0xcfe8ff, {
            count: 50,
            speed: 5,
            life: 2.2,
            gravity: -0.6,
            size: 0.28,
          });
          this.audio.play('waystone');
        } else {
          const textKey = target.data?.textKey as TKey | undefined;
          const text = textKey ? t(textKey) : String(target.data?.text ?? 'The stone is worn smooth.');
          store.pushToast({ text, kind: 'info' });
        }
        break;
      }
      default:
        break;
    }
  }

  private removeInteractable(id: string): void {
    const idx = this.interactables.findIndex((i) => i.id === id);
    if (idx >= 0) this.interactables.splice(idx, 1);
    if (this.nearest?.id === id) {
      this.nearest = null;
      bus.emit('interactAvailable', null);
      useGame.getState().set({ interactLabel: null });
    }
  }

  /** Public API used by the UI for pickups / consumables. */
  applyPowerup(kind: PowerupKind): void {
    const def = POWER_UPS[kind];
    const store = useGame.getState();
    const now = performance.now();
    if (kind === 'stamina') store.setStamina(Math.min(store.maxStamina, store.stamina + def.amount));
    if (kind === 'speed') this.player.speedBoostUntil = now + def.duration * 1000;
    if (kind === 'mist') this.player.mistUntil = now + def.duration * 1000;
    store.pushToast({ text: def.name, kind: 'item', icon: def.icon });
    this.audio.play('pickup');
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  /** Boot-time warmup used by the loading screen. */
  warmup(step: number): number {
    this.chunks.update(this.player.position.x, this.player.position.z);
    const built = this.chunks.processQueue(14);
    return built > 0 ? step + 1 : step;
  }

  private lastFrameTime = 0;

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    if (document.hidden) return;

    const dt = Math.min(0.05, Math.max(0.0001, rawDt));
    this.frameCount++;

    // Full stop while paused: no simulation, but keep one static render so the
    // pause menu has a live backdrop. Rendering is skipped entirely when hidden.
    if (this.paused) {
      this.renderer.render(this.scene, this.cameraRig.camera);
      this.pushStats(now, rawDt * 1000);
      return;
    }

    // Sub-step so physics stays stable and a jump reaches the same height even
    // when the frame rate dips (a single clamped 50ms step over-integrates
    // gravity and swallows most of the arc).
    const steps = dt > 0.034 ? 2 : 1;
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) this.update(sub, now);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.pushStats(now, rawDt * 1000);

    if (!this.readyCalled && this.chunks.activeCount > 0) {
      this.readyCalled = true;
      this.onReady?.();
    }
  };

  private update(dt: number, now: number): void {
    const store = useGame.getState();
    this.playtime += dt;

    // Compose keyboard, mouse, touch and gamepad into one input state, then
    // read it below. Must run before any movement code.
    this.input.update();

    // ---- input -> camera ----
    this.cameraRig.applyLook(this.input.state.lookX, this.input.state.lookY, store.controls.invertY);
    if (this.input.state.zoom !== 0) this.cameraRig.addZoom(this.input.state.zoom * 1.2);
    if (store.isTablet || store.isMobile) {
      if (this.input.touch.active) this.input.state.usingTouch = true;
    }

    // ---- player ----
    const useSprint = this.input.state.sprint;
    const moveY = this.input.state.moveY;
    const jumpPressed = this.input.state.jumpQueued;
    const result = this.player.update(
      dt,
      { x: this.input.state.moveX, y: moveY, sprint: useSprint, jump: jumpPressed },
      this.cameraRig.yaw,
    );
    this.input.endFrame();

    // ---- stamina ----
    if (this.player.sprinting && this.player.horizontalSpeed > 3.2) {
      this.staminaDrain = 16;
      store.setStamina(store.stamina - this.staminaDrain * dt);
      if (store.stamina <= 0) this.player.sprinting = false;
    } else {
      const regen = this.player.grounded ? 22 : 8;
      store.setStamina(store.stamina + regen * dt);
    }
    if (store.stamina <= 0.5) this.player.sprinting = false;

    if (result.jumped) this.audio.play('jump');
    if (result.landed) {
      this.audio.play('land');
      if (this.player.lastLandVy < -14) {
        const dmg = Math.min(40, Math.round((-this.player.lastLandVy - 14) * 2.2));
        if (dmg > 0) this.applyDamage(dmg, 'fall');
      }
      this.particles.spawn(this.player.position.clone().setY(this.player.position.y + 0.1), 0xcbb894, {
        count: 10,
        speed: 1.4,
        life: 0.5,
        gravity: -2,
        size: 0.16,
        spread: 0.4,
      });
    }

    // Water splash / ambient cues.
    if (this.player.inWater && !this.wasInWater) {
      this.audio.play('splash');
      this.particles.spawn(this.player.position.clone().setY(WATER_LEVEL + 0.1), 0xd9f0ff, {
        count: 16,
        speed: 2.4,
        life: 0.6,
        gravity: -6,
        size: 0.14,
      });
    }
    this.wasInWater = this.player.inWater;

    this.audio.updateFootsteps(dt, this.player.horizontalSpeed, this.player.grounded);

    // ---- camera ----
    this.cameraRig.update(dt, this.player.position);
    this.cameraRig.camera.updateMatrixWorld();

    // ---- world streaming ----
    this.chunks.update(this.player.position.x, this.player.position.z);
    this.chunks.processQueue(now < 6000 ? 12 : 5);
    this.chunks.applyDistanceLod(this.player.position.x, this.player.position.z);

    this.updateBeacon(dt);

    // ---- day / night ----
    const prevTime = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + (dt / DAY_LENGTH_SECONDS) * 24) % 24;
    if (this.timeOfDay < prevTime && prevTime > 12) {
      // Crossed midnight.
      store.set({ day: store.day + 1 });
    }
    store.set({ timeOfDay: this.timeOfDay });
    this.sky.update(this.timeOfDay, this.cameraRig.camera.position, this.weatherLevel);
    this.weatherTick(dt);
    this.weather.update(dt, this.cameraRig.camera.position, now / 1000, 0.4, 0.2);
    const nightAmount = 1 - clamp(Math.sin(((this.timeOfDay - 6) / 12.6) * Math.PI) * 1.4, 0, 1);
    const night = nightAmount > 0.6;
    this.weather.setTint(night ? WEATHER_NIGHT : WEATHER_DAY, night ? 1.5 : 0.75, night ? 1.5 : 1);

    this.audio.setWind(clamp(this.player.position.y / 90, 0, 1) * 0.8 + this.weatherLevel * 0.4, nightAmount > 0.55);

    // Village lights fade in after dusk and stay cheap (a few point lights).
    const lampIntensity = clamp((nightAmount - 0.25) / 0.6, 0, 1) * 1.35;
    for (const nl of this.nightLights) {
      nl.light.intensity = lampIntensity * nl.base;
      nl.light.visible = lampIntensity > 0.01;
    }

    // ---- scenery animation ----
    this.scenery.updatePickups(now / 1000);
    updateNPCActors(this.npcActors, now / 1000, this.player.position);
    this.fish?.update(now / 1000);
    this.particles.update(dt);

    // ---- interactions ----
    this.updateNearest();

    // ---- environment: exhaustion in deep water ----
    const stamina = useGame.getState().stamina;
    if (this.player.swimming && stamina <= 0.1 && now > this.invulnerableUntil) {
      this.applyDamage(3 * dt, 'water');
    }

    // ---- one-off world pickups that are not interaction prompts ----
    this.checkShorePickups(now);
    this.updateCameraFoliage();

    // ---- area discovery + quest zones ----
    this.updateArea();
    notifyPosition(this.player.position.x, this.player.position.z);

    // ---- autosave + stats ----
    this.autosaveTick(now);
    this.syncSaveRuntime();
    this.autoQuality(dt, now);
  }

  /** Feed the nearby tree canopies to the camera so it can dodge them. */
  private updateCameraFoliage(): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const out: { x: number; z: number; y: number; r: number }[] = [];
    for (const chunk of this.chunks.loadedChunks) {
      const cxp = chunk.cx * 64 + 32;
      const czp = chunk.cz * 64 + 32;
      if (Math.abs(cxp - px) > 96 || Math.abs(czp - pz) > 96) continue;
      for (const f of chunk.foliage) {
        const dx = f.x - px;
        const dz = f.z - pz;
        if (dx * dx + dz * dz > 144) continue;
        out.push(f);
      }
    }
    this.cameraRig.setFoliage(out);
  }

  private wasInWater = false;
  private lureTaken = false;

  /** The fisherman's lure sits in the stones on the northern lake shore. */
  private checkShorePickups(_now: number): void {
    const store = useGame.getState();
    const p = this.player.position;
    if (!this.lureTaken) {
      const d = Math.hypot(p.x - LURE.x, p.z - LURE.z);
      const inQuest = store.quests['q4_dead_mans_lure']?.status === 'active';
      if (inQuest && d < LURE.radius) {
        this.lureTaken = true;
        this.scenery.hideLure();
        store.addItem('fishermans_lure', 1);
        store.pushToast({ text: t('toast.lureRecovered'), kind: 'item', icon: 'fishermans_lure' });
        // Picking the lure up satisfies the first objective (find it).
        if ((store.quests['q4_dead_mans_lure']?.progress ?? 0) < 1) tryAdvance('q4_dead_mans_lure');
        this.particles.spawn(new THREE.Vector3(LURE.x, sampleHeight(LURE.x, LURE.z) + 0.8, LURE.z), 0xffd479, { count: 22, speed: 2.4 });
        this.audio.play('pickup');
      }
    }
  }

  private onDialogueChanged(): void {
    // Dialogue choices can change health/stamina/quests; mirror time of day.
    const store = useGame.getState();
    this.timeOfDay = store.timeOfDay;
  }

  get dialogueController(): DialogueController {
    return this.dialogue;
  }

  closeDialogue(): void {
    const store = useGame.getState();
    store.set({ dialogueOpen: false, dialogueState: null });
    this.setPaused(store.inventoryOpen || store.questLogOpen || store.mapOpen);
  }

  advanceDialogue(): void {
    const store = useGame.getState();
    const state = store.dialogueState;
    if (!state) return;
    const next = this.dialogue.advance(state);
    if (next) {
      store.set({ dialogueState: next });
    } else {
      const node = this.dialogue.currentNode(state);
      if (node?.options && node.options.length > 0 && state.lineIndex >= node.lines.length - 1 && !node.next) {
        return;
      }
      this.closeDialogue();
    }
  }

  chooseDialogue(index: number): void {
    const store = useGame.getState();
    const state = store.dialogueState;
    if (!state) return;
    const next = this.dialogue.choose(state, index);
    if (next) store.set({ dialogueState: next });
    else this.closeDialogue();
  }


  private updateArea(): void {
    const p = this.player.position;
    let area = 'Emberfall Vale';
    for (const v of VILLAGES) {
      if (Math.hypot(p.x - v.x, p.z - v.z) < v.radius + 24) {
        area = v.name;
        break;
      }
    }
    if (Math.hypot(p.x - CAVE.x, p.z - CAVE.z) < CAVE.radius + 20) area = CAVE.name;
    if (area === 'Emberfall Vale') {
      if (p.z < -240) area = 'Northwind Peaks';
      else if (p.x > 260) area = 'Saltmarsh Coast';
      else if (p.x < -240) area = 'Westwoods';
      else if (p.z > 330) area = 'Southern Meadows';
    }
    if (area !== this.lastArea) {
      this.lastArea = area;
      const store = useGame.getState();
      store.set({ area });
      if (area !== 'Emberfall Vale') {
        const isNew = !store.discovered.includes(area);
        if (isNew) {
          store.discover(area);
          store.pushToast({ text: t('toast.discovered', { area: placeName(area) }), kind: 'quest' });
          this.audio.play('discover');
        }
      }
    }
  }

  /** Re-translate all interactable prompts after a language change. */
  private refreshLocalizedLabels(): void {
    for (const item of this.interactables) {
      if (item.kind === 'npc') {
        const npc = NPCS.find((n) => `npc:${n.id}` === item.id);
        if (npc) item.label = t('act.talkTo', { name: npc.name });
      } else if (item.kind === 'waystone') {
        item.label = t('act.touchWaystone', { name: placeName(String(item.data?.name ?? 'Waystone')) });
      } else if (item.kind === 'cave') {
        item.label = t('act.enterCave', { name: CAVE.name });
      } else if (item.kind === 'chest') {
        item.label = t('act.openCache');
      } else if (item.kind === 'campfire') {
        item.label = t('act.restFire');
      } else if (item.kind === 'stone') {
        item.label = t('act.pickStone');
      } else if (item.kind === 'herb') {
        item.label = t('act.pickHerb', { name: placeName(String(item.data?.name ?? 'Sunleaf')) });
      } else if (item.kind === 'signpost') {
        item.label = item.data?.cairn ? t('act.readCairn') : t('act.studyRuins');
      }
    }
    // Push the fresh label for whatever the player is standing next to.
    this.nearest = null;
    const current = useGame.getState().interactLabel;
    if (current) useGame.getState().set({ interactLabel: null });
  }

  private onDispose: (() => void)[] = [];

  private updateNearest(): void {
    const p = this.player.position;
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      const dx = item.x - p.x;
      const dz = item.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > item.radius) continue;
      // Auto-collect powerups on touch.
      if (item.data?.auto && d < item.radius * 0.8) {
        const kind = item.data.kind as PowerupKind;
        this.applyPowerup(kind);
        this.scenery.hidePickup(String(item.data.pickup));
        this.particles.spawn(new THREE.Vector3(item.x, item.y + 1, item.z), POWER_UPS[kind].color, {
          count: 18,
          speed: 2.2,
          life: 0.8,
        });
        this.removeInteractable(item.id);
        return;
      }
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    if (best?.id !== this.nearest?.id) {
      this.nearest = best;
      const label = best ? best.label : null;
      useGame.getState().set({ interactLabel: label });
      bus.emit('interactAvailable', best ? { label: best.label } : null);
    }
  }

  private weatherTick(dt: number): void {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 90 + Math.random() * 150;
      const roll = Math.random();
      this.weatherTarget = roll < 0.32 ? 0.75 : roll < 0.6 ? 0.3 : 0;
    }
    this.weatherLevel += (this.weatherTarget - this.weatherLevel) * Math.min(1, dt * 0.25);
    const shouldRain = this.weatherLevel > 0.6 && this.preset.maxParticles > 120;
    if (shouldRain !== this.rainOn) {
      this.rainOn = shouldRain;
      this.weather.setRain(this.scene, shouldRain, this.preset);
    }
  }

  private applyDamage(amount: number, _source: string): void {
    const store = useGame.getState();
    if (amount >= 1) this.invulnerableUntil = performance.now() + 700;
    store.damage(amount);
    this.cameraRig.shake(Math.min(0.5, amount * 0.05), 0.4);
    if (store.health <= 0) this.respawn();
  }

  private respawn(): void {
    const store = useGame.getState();
    const home = VILLAGES[0];
    this.player.spawn(home.x + 6, home.z + 6);
    store.setHealth(store.maxHealth);
    store.setStamina(store.maxStamina);
    store.pushToast({ text: t('toast.wakeByFire'), kind: 'info' });
    this.cameraRig.update(0.016, this.player.position, true);
    this.audio.play('heal');
  }

  private autosaveTimer = 0;
  private autosaveTick(now: number): void {
    if (now - this.autosaveTimer < 20000) return;
    this.autosaveTimer = now;
    bus.emit('requestSave', undefined);
  }

  /** Public: triggered by the UI save button. */
  saveNow(): void {
    this.syncSaveRuntime();
    bus.emit('requestSave', undefined);
  }

  /** Adaptive quality: if auto mode and we are consistently slow, step down. */
  private autoQuality(dt: number, _now: number): void {
    const store = useGame.getState();
    if (!store.graphics.auto) return;
    this.autoQualityTimer += dt;
    if (this.autoQualityTimer < 5) return;
    this.autoQualityTimer = 0;
    const fps = store.stats.fps;
    if (fps > 0 && fps < 26) {
      this.lowFpsStreak++;
      this.highFpsStreak = 0;
    } else if (fps > 57) {
      this.highFpsStreak++;
      this.lowFpsStreak = 0;
    } else {
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
    }
    const order: string[] = ['verylow', 'low', 'medium', 'high'];
    const idx = order.indexOf(store.graphics.level);
    if (this.lowFpsStreak >= 2 && idx > 0) {
      this.lowFpsStreak = 0;
      const next = order[idx - 1] as 'verylow' | 'low' | 'medium' | 'high';
      store.setQuality(next);
      store.pushToast({ text: t('toast.graphicsLowered', { level: presetLabel(next, getPreset(next).label) }), kind: 'info' });
    } else if (this.highFpsStreak >= 6 && idx < 3 && window.innerWidth > 900) {
      this.highFpsStreak = 0;
      const next = order[idx + 1] as 'verylow' | 'low' | 'medium' | 'high';
      store.setQuality(next);
    }
  }

  private pushStats(now: number, frameMs: number): void {
    this.fpsAccum += frameMs;
    this.fpsFrames++;
    this.renderer.sampleFrame(frameMs, now);
    if (now - this.lastStatsPush < 500) return;
    this.lastStatsPush = now;
    const fps = this.fpsFrames > 0 ? 1000 / (this.fpsAccum / this.fpsFrames) : 60;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    const store = useGame.getState();
    store.setStats({
      fps: Math.round(fps),
      frameMs: Math.round((1000 / Math.max(1, fps)) * 10) / 10,
      drawCalls: this.renderer.drawCalls,
      triangles: this.renderer.triangles,
      chunks: this.chunks.activeCount,
      renderScale: Math.round(this.renderer.renderScale * 100) / 100,
    });

  }

  /** Keep the in-world beacon planted on the current tracked objective. */
  private updateBeacon(dt: number): void {
    const target = this.activeObjective();
    if (!target) {
      this.beacon.hide();
      return;
    }
    const y = sampleHeight(target.x, target.z);
    this.beacon.setTarget(target.x, y, target.z);
    this.beacon.update(dt, this.cameraRig.camera.position);
  }

  /** The tracked objective's world position, if a quest is running. */
  private activeObjective(): { x: number; z: number; label: string } | null {
    const store = useGame.getState();
    const questId = store.trackedQuest;
    if (!questId) return null;
    const quest = store.quests[questId];
    if (!quest || quest.status !== 'active') return null;
    return this.objectiveTarget(questId, quest.progress);
  }

  /**
   * Screen-space guidance for the 2D pointer: the heading toward the tracked
   * objective plus where it ends up on screen (or whether it is off-screen and
   * on which edge).
   */
  guidance(): {
    angle: number;
    distance: number;
    label: string;
    x: number;
    y: number;
    onScreen: boolean;
    /** 0 at the screen centre, 1 at the edge — used to aim the off-screen arrow. */
    edgeAngle: number;
  } | null {
    const target = this.activeObjective();
    if (!target) return null;
    const pos = this.player.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const distance = Math.hypot(dx, dz);
    const angle = (Math.atan2(dx, dz) * 180) / Math.PI;

    const camera = this.cameraRig.camera;
    // Anchor on the floating diamond so the on-screen chip sits right under it.
    const v = new THREE.Vector3(target.x, sampleHeight(target.x, target.z) + 9, target.z);
    v.project(camera);
    // Behind the camera: force the pointer to the side it actually belongs on.
    const behind = v.z > 1;
    let nx = v.x;
    let ny = v.y;
    if (behind) {
      nx = -nx;
      ny = -ny;
    }
    const onScreen = !behind && nx >= -0.94 && nx <= 0.94 && ny >= -0.88 && ny <= 0.88;

    // Map normalised device coords to percentages inside the viewport. When the
    // target is off-screen, slide it along its own direction until it meets the
    // safe rectangle, so the arrow sits on the edge the player should turn to.
    // Keep the edge arrow clear of the HUD corners (vitals top-left, clock top
    // centre/right, objective pill bottom-left).
    const LIMIT_X = 0.82;
    const LIMIT_Y = 0.66;
    let px = nx;
    let py = ny;
    if (!onScreen) {
      const overX = Math.abs(nx) / LIMIT_X;
      const overY = Math.abs(ny) / LIMIT_Y;
      const shrink = 1 / Math.max(overX, overY, 0.0001);
      px = nx * shrink;
      py = ny * shrink;
    }
    px = THREE.MathUtils.clamp(px, -LIMIT_X, LIMIT_X);
    py = THREE.MathUtils.clamp(py, -LIMIT_Y, LIMIT_Y);
    const edgeAngle = (Math.atan2(py, px) * 180) / Math.PI + 90;

    return {
      angle,
      distance,
      label: target.label,
      // Lift the on-screen arrow clear of the beacon column so the two do not
      // sit on top of each other (and so gold-on-yellow stays readable).
      x: ((px + 1) / 2) * 100,
      y: ((1 - py) / 2) * 100 + (onScreen ? 4 : 0),
      onScreen,
      edgeAngle,
    };
  }

  /** Compass heading (degrees) toward the tracked objective. */
  objectiveHeading(): { angle: number; distance: number; label: string } | null {
    const store = useGame.getState();
    const questId = store.trackedQuest;
    if (!questId) return null;
    const quest = store.quests[questId];
    if (!quest || quest.status !== 'active') return null;
    const target = this.objectiveTarget(questId, quest.progress);
    if (!target) return null;
    const dx = target.x - this.player.position.x;
    const dz = target.z - this.player.position.z;
    const angle = (Math.atan2(dx, dz) * 180) / Math.PI;
    return { angle, distance: Math.hypot(dx, dz), label: target.label };
  }

  private objectiveTarget(questId: string, progress: number): { x: number; z: number; label: string } | null {
    const store = useGame.getState();
    switch (questId) {
      case 'q1_first_steps':
        return progress >= 2
          ? { x: 28, z: 215, label: t('obj.sunleafMeadow') }
          : { x: VILLAGES[0].x, z: VILLAGES[0].z, label: placeName('Emberfall') };
      case 'q2_long_dark':
        if (progress <= 1) return { x: CAVE.x, z: CAVE.z, label: placeName('Echo Hollow') };
        return { x: -176, z: -52, label: 'Bram' };
      case 'q3_bright_water':
        if (progress === 0) return { x: -210, z: 190, label: placeName('Mirror Lake') };
        if (progress === 1) {
          // Point at the closest shore stone the player has not picked up.
          let best = SHORE_STONES[0];
          let bestD = Infinity;
          for (const s of SHORE_STONES) {
            const d = Math.hypot(s.x - this.player.position.x, s.z - this.player.position.z);
            if (d < bestD) {
              bestD = d;
              best = s;
            }
          }
          return { x: best.x, z: best.z, label: t('obj.riverstones') };
        }
        return { x: 112, z: 158, label: 'Sela' };
      case 'q4_dead_mans_lure':
        if (progress === 0) return { x: LURE.x, z: LURE.z, label: t('obj.northernLake') };
        return { x: 336, z: 312, label: 'Tovin' };
      case 'q5_stone_song': {
        const lit = store.discovered.filter((d) => d.startsWith('Waystone of')).length;
        const w = WAYSTONES[Math.min(lit, WAYSTONES.length - 1)];
        return { x: w.x, z: w.z, label: placeName(w.name) };
      }
      case 'q6_starlit_ascent': {
        const peak = peakLocation();
        if (progress === 0) return { x: peak.x, z: peak.z, label: t('obj.northernPeak') };
        return { x: VILLAGES[0].x, z: VILLAGES[0].z, label: placeName('Emberfall') };
      }
      default:
        return null;
    }
  }

  /** World positions of interest for the minimap. */
  mapMarkers(): {
    villages: { x: number; z: number; name: string }[];
    waystones: { x: number; z: number; name: string }[];
    cave: { x: number; z: number; name: string };
    objective: { x: number; z: number; label: string } | null;
  } {
    const store = useGame.getState();
    const quest = store.trackedQuest ? store.quests[store.trackedQuest] : undefined;
    const objective = quest && quest.status === 'active' && store.trackedQuest
      ? (() => {
          const t = this.objectiveTarget(store.trackedQuest, quest.progress);
          return t ? { x: t.x, z: t.z, label: t.label } : null;
        })()
      : null;
    return {
      villages: VILLAGES.map((v) => ({ x: v.x, z: v.z, name: v.name })),
      waystones: WAYSTONES.map((w) => ({ x: w.x, z: w.z, name: w.name })),
      cave: { x: CAVE.x, z: CAVE.z, name: CAVE.name },
      objective,
    };
  }

  get playerPosition(): THREE.Vector3 {
    return this.player.position;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('orientationchange', this.resize);
    this.resizeObserver?.disconnect();
    this.input.dispose();
    this.chunks.dispose();
    this.scenery.dispose();
    this.sky.dispose();
    this.weather.dispose();
    this.particles.dispose();
    this.fish?.dispose();
    this.player.rig.dispose();
    this.scene.remove(this.player.group);
    for (const actor of this.npcActors) {
      this.scene.remove(actor.group);
      actor.rig.dispose();
    }
    for (const fn of this.onDispose) fn();
    this.onDispose = [];
    this.beacon.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.scene.clear();
  }
}

const WEATHER_DAY = new THREE.Color(0xfff2c4);
const WEATHER_NIGHT = new THREE.Color(0xcfe0ff);

function getPeakQuestTrigger(store: ReturnType<typeof useGame.getState>): void {
  // Waking all three stones unlocks the scholar's final conversation.
  const lit = store.discovered.filter((d) => d.startsWith('Waystone of')).length;
  if (lit >= 3) store.setFlag('stones_lit', true);
}
