import type { AudioSettings, ControlSettings, GraphicsSettings, SaveData } from './types';
import { SAVE_KEY, SETTINGS_KEY, SAVE_VERSION, saveSeen, savePlaytime, saveFlags } from './saveRuntime';
import { POWER_UPS } from './powerups';

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

export function readSave(): SaveData | null {
  try {
    const data = safeParse<SaveData>(localStorage.getItem(SAVE_KEY));
    if (!data) return null;
    if (data.version !== SAVE_VERSION) return migrate(data);
    return data;
  } catch {
    return null;
  }
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
