import { useGame } from './store';
import { bus } from './bus';
import { readSave, queueSave, writeSaveNow } from './save';
import type { SaveData } from './types';
import { setSaveFlag, setSaveSeen, setSavePlaytime } from './saveRuntime';

/**
 * One place that knows how to translate between the live store, the engine's
 * runtime position and the persisted SaveData shape. Swapping localStorage for
 * a cloud adapter later only touches this file.
 */

export function loadSaveDataIntoGame(): SaveData | null {
  const save = readSave();
  if (!save) return null;
  const store = useGame.getState();
  store.hydrateFromSave(save);
  setSaveSeen(save.seen ?? []);
  setSavePlaytime(save.playtime ?? 0);
  for (const [key, value] of Object.entries(save.flags ?? {})) setSaveFlag(key, value);
  return save;
}

let saveUnsub: (() => void) | null = null;

/** Wires the debounced writer to the store's `requestSave` event. */
export function startAutosave(): () => void {
  saveUnsub = bus.on('requestSave', () => {
    queueSave(() => useGame.getState().toSaveData(), () => {
      useGame.getState().markSaved();
    });
  });
  // NOTE: save diagnostics / future cloud-sync hooks belong here.
  return () => {
    saveUnsub?.();
    saveUnsub = null;
  };
}

export function saveImmediately(): void {
  writeSaveNow(useGame.getState().toSaveData());
  useGame.getState().markSaved();
}

/** Called when the tab is hidden — never lose progress on mobile. */
export function setupUnloadSave(): () => void {
  const handler = () => {
    if (useGame.getState().started) writeSaveNow(useGame.getState().toSaveData());
  };
  window.addEventListener('pagehide', handler);
  window.addEventListener('beforeunload', handler);
  // Keep the reference so the listener can be removed again; the anonymous
  // arrow used to leak (and kept firing after the app unmounted).
  const onVisibility = () => {
    if (document.hidden) handler();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', handler);
    window.removeEventListener('beforeunload', handler);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
