import { create } from 'zustand';
import type {
  AudioSettings,
  ControlSettings,
  GraphicsSettings,
  QuestState,
  SaveData,
  ToastMessage,
} from './types';
import type { QualityLevel } from '../config/quality';
import { INVENTORY_SIZE, ITEMS } from '../config/items';
import { getPreset, detectDevice } from '../config/quality';
import { WORLD_SEED } from '../world/noise';
import {
  SAVE_VERSION,
  saveFlags,
  savePlayer,
  savePlaytime,
  saveSeen,
} from './saveRuntime';
import { bus } from './bus';
import { QUESTS } from './quests';
import { t, onLanguageSwitch } from '../i18n';

export type Screen = 'boot' | 'menu' | 'playing' | 'paused' | 'codex';

export interface RuntimeStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  chunks: number;
  renderScale: number;
  quality: QualityLevel;
  gpu: string;
  memoryMB?: number;
}

interface GameState {
  screen: Screen;
  started: boolean;
  bootProgress: number;
  bootLabel: string;
  hasSave: boolean;

  playerName: string;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  timeOfDay: number; // 0..24
  day: number;
  area: string;
  compass: number;
  isSprinting: boolean;
  grounded: boolean;

  inventory: { id: string; qty: number }[];
  quests: Record<string, QuestState>;
  trackedQuest: string | null;
  flags: Record<string, boolean | number>;
  discovered: string[];
  /** Spent world nodes; never respawn after a reload. */
  collected: string[];

  graphics: GraphicsSettings;
  controls: ControlSettings;
  audio: AudioSettings;

  stats: RuntimeStats;
  toasts: ToastMessage[];
  interactLabel: string | null;
  settingsOpen: boolean;
  dialogueOpen: boolean;
  dialogueState: import('./dialogueRuntime').DialogueRuntimeState | null;
  inventoryOpen: boolean;
  questLogOpen: boolean;
  mapOpen: boolean;
  hasController: boolean;
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  webglLost: boolean;
  saveIndicatorAt: number;

  set: (partial: Partial<GameState>) => void;
  setScreen: (screen: Screen) => void;
  setBoot: (progress: number, label: string) => void;
  setStats: (stats: Partial<RuntimeStats>) => void;
  setGraphics: (g: Partial<GraphicsSettings>) => void;
  setQuality: (level: QualityLevel) => void;
  setControls: (c: Partial<ControlSettings>) => void;
  setAudio: (a: Partial<AudioSettings>) => void;

  addItem: (id: string, qty: number) => boolean;
  removeItem: (id: string, qty: number) => boolean;
  countItem: (id: string) => number;

  startQuest: (id: string) => void;
  advanceQuest: (id: string) => void;
  completeQuest: (id: string) => void;
  setQuestStatus: (id: string, status: QuestState['status']) => void;
  setFlag: (key: string, value: boolean | number) => void;
  getFlag: (key: string) => boolean | number | undefined;
  discover: (name: string) => void;
  /** Mark a world node as spent (collected) and persist it. */
  collectNode: (id: string) => void;

  setHealth: (v: number) => void;
  damage: (amount: number) => void;
  heal: (amount: number) => void;
  setStamina: (v: number) => void;

  pushToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: number) => void;

  hydrateFromSave: (save: SaveData) => void;
  toSaveData: () => SaveData;
  markSaved: () => void;
}

let toastSeq = 1;

// Keep the boot label in the active language.
onLanguageSwitch(() => useGame.setState({ bootLabel: t('boot.warming') }));

const device = detectDevice();
const initialGraphics: GraphicsSettings = {
  level: device.suggested,
  auto: true,
  renderScale: 1,
  showFps: false,
};

export const useGame = create<GameState>((set, get) => ({
  screen: 'boot',
  started: false,
  bootProgress: 0,
  bootLabel: t('boot.warming'),
  hasSave: false,

  playerName: 'Wanderer',
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  timeOfDay: 8.2,
  day: 1,
  area: 'Emberfall Vale',
  compass: 0,
  isSprinting: false,
  grounded: true,

  inventory: [],
  quests: {},
  trackedQuest: 'q1_first_steps',
  flags: {},
  discovered: [],
  collected: [],
  graphics: initialGraphics,
  controls: {
    sensitivity: device.isTouch ? 1.15 : 1,
    invertY: false,
    joystickSide: 'left',
    haptics: true,
  },
  audio: { master: 0.7, music: 0.55, sfx: 0.8, muted: false },

  stats: {
    fps: 60,
    frameMs: 16,
    drawCalls: 0,
    triangles: 0,
    chunks: 0,
    renderScale: 1,
    quality: device.suggested,
    gpu: device.gpu,
  },
  toasts: [],
  interactLabel: null,
  settingsOpen: false,
  dialogueOpen: false,
  dialogueState: null,
  inventoryOpen: false,
  questLogOpen: false,
  mapOpen: false,
  hasController: false,
  isTouch: device.isTouch,
  isMobile: device.isMobile,
  isTablet: device.isTablet,
  webglLost: false,
  saveIndicatorAt: 0,

  set: (partial) => set(partial),
  setScreen: (screen) => set({ screen }),
  setBoot: (bootProgress, bootLabel) => set({ bootProgress, bootLabel }),
  setStats: (stats) => set((s) => ({ stats: { ...s.stats, ...stats } })),

  setGraphics: (g) => {
    const next = { ...get().graphics, ...g };
    set({ graphics: next });
    get().setStats({ quality: next.level });
    bus.emit('qualityChanged', undefined);
    bus.emit('requestSave', undefined);
  },

  setQuality: (level) => {
    const preset = getPreset(level);
    set((s) => ({
      graphics: { ...s.graphics, level, auto: false, renderScale: Math.max(s.graphics.renderScale, preset.minRenderScale) },
    }));
    get().setStats({ quality: level });
    bus.emit('qualityChanged', undefined);
    bus.emit('requestSave', undefined);
  },

  setControls: (c) => {
    set((s) => ({ controls: { ...s.controls, ...c } }));
    bus.emit('requestSave', undefined);
  },
  setAudio: (a) => {
    set((s) => ({ audio: { ...s.audio, ...a } }));
    bus.emit('requestSave', undefined);
  },

  addItem: (id, qty) => {
    const inv = get().inventory.map((slot) => ({ ...slot }));
    const maxStack = ITEMS[id]?.maxStack ?? 99;
    let remaining = qty;
    const existing = inv.find((slot) => slot.id === id);
    if (existing) {
      const room = Math.max(0, maxStack - existing.qty);
      const taken = Math.min(room, remaining);
      existing.qty += taken;
      remaining -= taken;
    }
    while (remaining > 0 && inv.length < INVENTORY_SIZE) {
      const taken = Math.min(maxStack, remaining);
      inv.push({ id, qty: taken });
      remaining -= taken;
    }
    set({ inventory: inv });
    const added = qty - remaining;
    if (added > 0) bus.emit('itemCollected', { itemId: id, qty: added });
    bus.emit('requestSave', undefined);
    return remaining === 0;
  },

  removeItem: (id, qty) => {
    const inv = get().inventory.map((s) => ({ ...s }));
    const slot = inv.find((s) => s.id === id);
    if (!slot || slot.qty < qty) return false;
    slot.qty -= qty;
    set({ inventory: inv.filter((s) => s.qty > 0) });
    bus.emit('requestSave', undefined);
    return true;
  },

  countItem: (id) => get().inventory.find((s) => s.id === id)?.qty ?? 0,

  startQuest: (id) => {
    const quests = { ...get().quests };
    if (quests[id]?.status === 'complete' || quests[id]?.status === 'active') return;
    quests[id] = { status: 'active', progress: 0 };
    set({ quests, trackedQuest: get().trackedQuest ?? id });
    bus.emit('questUpdated', { questId: id });
    bus.emit('requestSave', undefined);
  },

  advanceQuest: (id) => {
    const quests = { ...get().quests };
    const state = quests[id];
    if (!state) return;
    const def = QUESTS.find((q) => q.id === id);
    if (!def) return;
    const progress = Math.min(state.progress + 1, def.objectives.length);
    quests[id] = { ...state, progress };
    set({ quests });
    bus.emit('questUpdated', { questId: id });
    bus.emit('requestSave', undefined);
    if (progress >= def.objectives.length) get().completeQuest(id);
  },

  completeQuest: (id) => {
    const quests = { ...get().quests };
    if (quests[id]?.status === 'complete') return;
    const def = QUESTS.find((q) => q.id === id);
    quests[id] = { status: 'complete', progress: def?.objectives.length ?? 0 };
    const following = QUESTS.find((q) => (q.requires ?? []).includes(id));
    set({ quests, trackedQuest: following?.id ?? get().trackedQuest });
    bus.emit('questUpdated', { questId: id });
    bus.emit('requestSave', undefined);
  },

  setQuestStatus: (id, status) => {
    const quests = { ...get().quests };
    quests[id] = { status, progress: quests[id]?.progress ?? 0 };
    set({ quests });
    bus.emit('questUpdated', { questId: id });
  },

  setFlag: (key, value) => {
    const flags = { ...get().flags, [key]: value };
    set({ flags });
    bus.emit('requestSave', undefined);
  },
  getFlag: (key) => get().flags[key],
  discover: (name) => {
    if (get().discovered.includes(name)) return;
    set((s) => ({ discovered: [...s.discovered, name], area: name }));
    bus.emit('areaDiscovered', { name });
  },

  collectNode: (id) => {
    if (get().collected.includes(id)) return;
    set((s) => ({ collected: [...s.collected, id] }));
    bus.emit('requestSave', undefined);
  },

  setHealth: (v) => set({ health: Math.max(0, Math.min(get().maxHealth, v)) }),
  damage: (amount) => {
    const before = get().health;
    const health = Math.max(0, before - amount);
    set({ health });
    if (health < before) {
      bus.emit('playerDamaged', { amount: Math.round(before - health) });
      bus.emit('playSfx', { name: 'hurt' });
    }
  },
  heal: (amount) => {
    const before = get().health;
    const health = Math.min(get().maxHealth, before + amount);
    set({ health });
    if (health > before) bus.emit('playerHealed', { amount: Math.round(health - before) });
  },
  // Guard the no-op writes: the engine tops stamina up every frame, and while
  // it sits at full that used to notify every subscriber 60x/s.
  setStamina: (v) => {
    const next = Math.max(0, Math.min(get().maxStamina, v));
    if (next === get().stamina) return;
    set({ stamina: next });
  },

  pushToast: (t) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }));
    window.setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  hydrateFromSave: (save) => {
    // Without a persisted tracker the guidance beacon silently disappears after
    // "Continue", so fall back to a sane active quest (or the first one).
    const tracked =
      save.trackedQuest && save.quests[save.trackedQuest]?.status === 'active'
        ? save.trackedQuest
        : (Object.entries(save.quests ?? {}).find(([, q]) => q.status === 'active')?.[0] ?? null);
    set({
      hasSave: true,
      health: save.health,
      stamina: save.stamina,
      inventory: (save.inventory ?? []).filter((slot) => !!ITEMS[slot.id]),
      quests: save.quests,
      trackedQuest: tracked,
      flags: save.flags ?? {},
      discovered: save.seen ?? [],
      collected: save.collected ?? [],
      timeOfDay: save.time,
      started: true,
    });
  },

  toSaveData: () => {
    const s = get();
    return {
      version: SAVE_VERSION,
      seed: WORLD_SEED,
      player: savePlayer,
      time: s.timeOfDay,
      health: s.health,
      stamina: s.stamina,
      inventory: s.inventory,
      quests: s.quests,
      trackedQuest: s.trackedQuest,
      flags: { ...s.flags, ...saveFlags },
      collected: s.collected,
      seen: saveSeen,
      playtime: savePlaytime,
      updatedAt: Date.now(),
    };
  },

  markSaved: () => set({ saveIndicatorAt: Date.now() }),
}));

// Debug/automation handle (also handy for support: window.__lhStore.getState()).
if (typeof window !== 'undefined') {
  (window as unknown as { __lhStore: typeof useGame }).__lhStore = useGame;
}
