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

/**
 * The final quest's first two steps are the same arrival: standing at the
 * Starlit Cairn. Advancing a step at a time is enough because the cairn
 * interaction loops until both route markers are satisfied.
 */
export function notifyCairnReached(): void {
  const store = useGame.getState();
  if (store.quests['q6_starlit_ascent']?.status !== 'active') return;
  while ((useGame.getState().quests['q6_starlit_ascent']?.progress ?? 0) < 2) {
    if (!tryAdvance('q6_starlit_ascent')) break;
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

/**
 * Item-driven objectives (herbs, stones, shards). Called on every inventory
 * change and on quest events; each rule checks the objective the player is
 * currently on, so a pick-up can never skip a step. Hand-ins stay in dialogue.
 */
export function notifyInventoryChange(): void {
  const store = useGame.getState();
  const onObjective = (id: string, index: number) =>
    store.quests[id]?.status === 'active' && (store.quests[id]?.progress ?? -1) === index;

  if (onObjective('q1_first_steps', 2) && store.countItem('sunleaf') >= 3) tryAdvance('q1_first_steps');
  if (onObjective('q2_long_dark', 2) && store.countItem('waystone_shard') > 0) tryAdvance('q2_long_dark');
  if (onObjective('q3_bright_water', 1) && store.countItem('riverstone') >= 3) tryAdvance('q3_bright_water');

  // Waking all three stones completes the song; the scholar's final request
  // becomes available afterwards.
  if (store.quests['q5_stone_song']?.status === 'active') {
    const lit = store.discovered.filter((d) => d.startsWith('Waystone of')).length;
    if (lit >= 3) {
      store.completeQuest('q5_stone_song');
      store.pushToast({ text: '“The Song of Stones” complete', kind: 'quest' });
      store.setQuestStatus('q6_starlit_ascent', 'available');
    }
  }
}
