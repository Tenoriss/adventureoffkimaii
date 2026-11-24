import type { AudioSettings, ControlSettings, GraphicsSettings, QuestState, SaveData } from './types';
import { SAVE_KEY, SETTINGS_KEY, SAVE_VERSION, saveSeen, savePlaytime, saveFlags } from './saveRuntime';
import { POWER_UPS } from './powerups';
import { ITEMS } from '../config/items';
import { SPAWN } from '../world/features';

/** Kept local so a corrupt save never has to import the whole world graph. */
const DEFAULT_SPAWN = SPAWN;

interface StoredSettings {
  graphics: GraphicsSettings;
  controls: ControlSettings;
  audio: AudioSettings;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * True when the storage slot holds *something*, but it could not be parsed into
 * a usable save. Lets the menu tell the player why their progress is gone
 * instead of silently offering "New journey".
 */
export function saveUnreadable(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return !!raw && readSave() === null;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const data = safeParse<SaveData>(localStorage.getItem(SAVE_KEY));
    if (!data || typeof data !== 'object') return null;
    const migrated = data.version !== SAVE_VERSION ? migrate(data) : data;
    if (!migrated) return null;
    // A half-written or hand-edited save used to reach the store with missing
    // arrays and crash `Object.keys(save.quests)` on the Continue button.
    return sanitize(migrated);
  } catch {
    return null;
  }
}

/** Coerce every field to the shape the rest of the game assumes. */
function sanitize(data: SaveData): SaveData | null {
  if (!data || typeof data !== 'object') return null;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const raw = (data.player ?? {}) as Partial<SaveData['player']>;
  // A corrupt position used to discard the whole save, which silently threw
  // away every quest and item. Only the unused default spawn needs coordinates,
  // so fall back to it and keep the rest of the progress.
  const spawn = Number.isFinite(raw.x) && Number.isFinite(raw.z) ? { x: raw.x as number, z: raw.z as number } : { x: DEFAULT_SPAWN[0], z: DEFAULT_SPAWN[1] };
  const p = { x: spawn.x, z: spawn.z, y: num(raw.y, 0), yaw: num(raw.yaw, 0) };
  // Unknown ids can no longer be resolved (no icon, no stack size).
  const inventory = (Array.isArray(data.inventory) ? data.inventory : [])
    .filter((slot) => !!slot && typeof slot.id === 'string' && slot.id in ITEMS && Number.isFinite(slot.qty) && slot.qty > 0)
    .map((slot) => ({ id: slot.id, qty: Math.min(ITEMS[slot.id].maxStack, Math.floor(slot.qty)) }));
  const quests: Record<string, QuestState> = {};
  if (data.quests && typeof data.quests === 'object') {
    for (const [id, q] of Object.entries(data.quests)) {
      if (!q || typeof q !== 'object') continue;
      const status = q.status;
      if (status !== 'active' && status !== 'complete' && status !== 'available' && status !== 'locked') continue;
      quests[id] = { status, progress: Math.max(0, Math.floor(num(q.progress, 0))) };
    }
  }
  const maxHealth = 100;
  return {
    ...data,
    player: p,
    time: Math.min(24, Math.max(0, num(data.time, 8))),
    health: Math.min(maxHealth, Math.max(1, num(data.health, maxHealth))),
    stamina: Math.min(100, Math.max(0, num(data.stamina, 100))),
    inventory,
    quests,
    flags: data.flags && typeof data.flags === 'object' ? data.flags : {},
    seen: Array.isArray(data.seen) ? data.seen.filter((x) => typeof x === 'string') : [],
    collected: Array.isArray(data.collected) ? data.collected.filter((x) => typeof x === 'string') : [],
    playtime: Math.max(0, num(data.playtime, 0)),
    updatedAt: num(data.updatedAt, Date.now()),
  };
}

function migrate(data: SaveData): SaveData | null {
  // Older saves simply reset progress-critical fields but keep the player put.
  if (typeof data.version === 'number' && data.version < SAVE_VERSION) {
    return {
      ...data,
      version: SAVE_VERSION,
      quests: data.quests ?? {},
      inventory: data.inventory ?? [],
      seen: data.seen ?? [],
      flags: data.flags ?? {},
    };
  }
  return null;
}

let saveTimer: number | null = null;
let pendingSave: (() => SaveData) | null = null;

/** Debounced writer so we never thrash localStorage during play. */
export function queueSave(getData: () => SaveData, onSaved?: () => void): void {
  pendingSave = getData;
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    const data = pendingSave?.();
    if (!data) return;
    try {
      data.seen = saveSeen;
      data.playtime = savePlaytime;
      data.flags = { ...saveFlags };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      onSaved?.();
    } catch {
      /* storage full or disabled — keep playing */
    }
  }, 900);
}

export function writeSaveNow(data: SaveData): void {
  try {
    data.seen = saveSeen;
    data.playtime = savePlaytime;
    data.flags = { ...saveFlags };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function readSettings(): Partial<StoredSettings> | null {
  try {
    return safeParse<StoredSettings>(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return null;
  }
}

export function writeSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/**
 * Hooks for a future cloud save. A backend just has to implement this
 * interface and the rest of the game keeps working unchanged.
 */
export interface CloudSaveAdapter {
  pull(): Promise<SaveData | null>;
  push(data: SaveData): Promise<void>;
}

let cloudAdapter: CloudSaveAdapter | null = null;

export function setCloudAdapter(adapter: CloudSaveAdapter | null): void {
  cloudAdapter = adapter;
}

export async function syncToCloud(data: SaveData): Promise<boolean> {
  if (!cloudAdapter) return false;
  try {
    await cloudAdapter.push(data);
    return true;
  } catch {
    return false;
  }
}

export async function syncFromCloud(): Promise<SaveData | null> {
  if (!cloudAdapter) return null;
  try {
    return await cloudAdapter.pull();
  } catch {
    return null;
  }
}

/** Stable ids for quests granted as rewards of other quests. */
export const REWARD_TABLE: Record<string, { itemId: string; qty: number }[]> = {
  q2_long_dark: [{ itemId: 'waystone_shard', qty: 1 }],
  q4_dead_mans_lure: [{ itemId: 'fishermans_lure', qty: 1 }],
  q6_starlit_ascent: [{ itemId: 'horizon_compass', qty: 1 }],
};

export const POWERUP_TABLE = POWER_UPS;
