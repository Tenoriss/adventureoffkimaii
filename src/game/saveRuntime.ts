/**
 * Mutable save "runtime" shared between the engine and the store without
 * causing React re-renders. The engine writes player position here every few
 * frames; the store reads it when serialising a save.
 */
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'lost-horizon:save:v2';
export const SETTINGS_KEY = 'lost-horizon:settings:v2';

export const savePlayer = { x: 0, y: 0, z: 0, yaw: 0 };
export const saveFlags: Record<string, boolean | number> = {};
export let saveSeen: string[] = [];
export let savePlaytime = 0;

export function setSaveSeen(next: string[]): void {
  saveSeen = next;
}

export function setSavePlaytime(next: number): void {
  savePlaytime = next;
}

export function setSaveFlag(key: string, value: boolean | number): void {
  saveFlags[key] = value;
}
