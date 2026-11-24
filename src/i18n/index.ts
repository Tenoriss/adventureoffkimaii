/**
 * Tiny dependency-free i18n layer.
 *
 * - UI copy lives in flat key/value tables (`ui.ts`).
 * - Game content (dialogue, quests, items, places) keeps its English source of
 *   truth and layers an Indonesian overlay on top (`content.ts`), so ids,
 *   actions and quest logic never fork per language.
 *
 * Only the strings are swapped, never the data: saves, quest ids and the
 * `discovered` list keep their canonical English names.
 */

import { useSyncExternalStore } from 'react';
import { UI_EN, UI_ID, type TKey } from './ui';

export type Lang = 'en' | 'id';

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'id', label: 'Bahasa Indonesia' },
];

const STORAGE_KEY = 'lost-horizon:lang:v1';

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'id') return stored;
    const nav = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
    if (nav.startsWith('id') || nav.startsWith('in')) return 'id';
  } catch {
    /* private mode */
  }
  return 'en';
}

let current: Lang = detect();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

/** One-time hook so non-UI runtimes (quest tracker, toasts) can localise. */
const switchListeners = new Set<(lang: Lang) => void>();

/** Subscribe to language changes (used by the engine to relabel prompts). */
export function onLanguageSwitch(fn: (lang: Lang) => void): () => void {
  switchListeners.add(fn);
  return () => switchListeners.delete(fn);
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const fn of listeners) fn();
  for (const fn of switchListeners) fn(next);
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate a UI key. Missing keys fall back to English, then to the key. */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  const table = current === 'id' ? UI_ID : UI_EN;
  let s: string = table[key] ?? UI_EN[key] ?? String(key);
  if (vars) {
    for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  }
  return s;
}

/** React hook: re-renders the component whenever the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

/** React hook returning a `t` bound to the active language. */
export function useT(): typeof t {
  useLang();
  return t;
}

// Keep the document language correct from the very first paint.
if (typeof document !== 'undefined') document.documentElement.lang = current;
