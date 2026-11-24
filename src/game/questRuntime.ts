import { useGame } from './store';
import { QUESTS, QUEST_MAP } from './quests';
import { bus } from './bus';
import type { Objective, QuestState } from './types';

/**
 * Single authority for quest progression. Objectives advance from three
 * sources: talking to the right NPC, walking into a zone, or collecting items.
 * Everything funnels through `tryAdvance` so state can never desync.
 */

export function currentObjective(questId: string): { index: number; def: Objective | null } {
  const quest = QUEST_MAP[questId];
  const state = useGame.getState().quests[questId];
  if (!quest || !state || state.status !== 'active') return { index: -1, def: null };
  const index = Math.min(state.progress, quest.objectives.length - 1);
  return { index, def: quest.objectives[index] ?? null };
}

/** Advance one objective, firing toasts and rewards. */
export function tryAdvance(questId: string): boolean {
  const store = useGame.getState();
  const quest = QUEST_MAP[questId];
  const state: QuestState | undefined = store.quests[questId];
  if (!quest || !state || state.status !== 'active') return false;

  store.advanceQuest(questId);
  const after = useGame.getState().quests[questId];
  const objective = quest.objectives[Math.min(state.progress, quest.objectives.length - 1)];

  if (after?.status === 'complete') {
    store.pushToast({ text: `“${quest.title}” complete`, kind: 'quest' });
  } else {
    const next = quest.objectives[after?.progress ?? 0];
    if (next) store.pushToast({ text: next.text, kind: 'quest' });
  }
  void objective;
  bus.emit('questUpdated', { questId });
  return true;
}

/** Called when a conversation with `npcId` opens. */
export function notifyTalked(npcId: string): void {
  const store = useGame.getState();
  for (const quest of QUESTS) {
    const state = store.quests[quest.id];
    if (!state || state.status !== 'active') continue;
    const obj = quest.objectives[state.progress];
    if (obj?.onTalk === npcId) {
      // Defer a tick so the dialogue UI can mount first.
      window.setTimeout(() => tryAdvance(quest.id), 400);
    }
  }
}

/** Called every frame with the player position. */
export function notifyPosition(x: number, z: number): void {
  const store = useGame.getState();
  for (const quest of QUESTS) {
    const state = store.quests[quest.id];
    if (!state || state.status !== 'active') continue;
    const obj = quest.objectives[state.progress];
    if (!obj?.zone) continue;
    const d = Math.hypot(x - obj.zone.x, z - obj.zone.z);
    if (d < obj.zone.radius) tryAdvance(quest.id);
  }
}

/** Item-driven objectives (herbs, stones, shards). */
export function notifyInventoryChange(): void {
  const store = useGame.getState();
  const active = (id: string) => store.quests[id]?.status === 'active';
  const progress = (id: string) => store.quests[id]?.progress ?? 0;

  if (active('q1_first_steps') && progress('q1_first_steps') === 2 && store.countItem('sunleaf') >= 3) {
    tryAdvance('q1_first_steps');
  }
  if (active('q2_long_dark') && progress('q2_long_dark') === 2 && store.countItem('waystone_shard') > 0) {
    tryAdvance('q2_long_dark');
  }
  if (active('q3_bright_water') && progress('q3_bright_water') === 1 && store.countItem('riverstone') >= 3) {
    tryAdvance('q3_bright_water');
  }
  if (active('q4_dead_mans_lure') && progress('q4_dead_mans_lure') === 1 && store.countItem('fishermans_lure') > 0) {
    tryAdvance('q4_dead_mans_lure');
  }
  if (active('q5_stone_song')) {
    const lit = store.discovered.filter((d) => d.startsWith('Waystone of')).length;
    if (lit >= 3 && progress('q5_stone_song') < 3) {
      store.completeQuest('q5_stone_song');
      store.pushToast({ text: '“The Song of Stones” complete', kind: 'quest' });
      // Wake the scholar's final request.
      store.setQuestStatus('q6_starlit_ascent', 'available');
    }
  }
}
