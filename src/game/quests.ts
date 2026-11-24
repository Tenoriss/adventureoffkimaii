import type { QuestDef } from './types';

/**
 * Six chained quests across the valley, north forest, hidden caves and the
 * mountain peaks. Each one teaches a different system.
 */
export const QUESTS: QuestDef[] = [
  {
    id: 'q1_first_steps',
    title: 'The Long Way Home',
    giver: 'Mira, Village Elder',
    summary: 'Mira asks you to get your bearings in Emberfall before the road gets dark.',
    objectives: [
      {
        text: 'Walk to the Emberfall well',
        target: 'village',
        hint: 'The well sits in the middle of the plaza.',
        zone: { x: 98, z: 146, radius: 5.5 },
      },
      { text: 'Speak with Mira again', target: 'village', onTalk: 'mira' },
      { text: 'Gather 3 Sunleaf in the meadow', target: 'village', hint: 'Look for amber leaves near the riverbank.' },
    ],
  },
  {
    id: 'q2_long_dark',
    title: 'The Dark Under Thornwick',
    giver: 'Bram, Hunter',
    summary: 'Something has moved into Echo Hollow. Bram wants the cave checked, not cleared.',
    requires: ['q1_first_steps'],
    objectives: [
      {
        text: 'Cross the river north to Thornwick',
        target: 'village',
        zone: { x: -170, z: -40, radius: 30 },
      },
      { text: 'Find Echo Hollow in the western hills', target: 'cave' },
      { text: 'Recover a Waystone Shard from the hollow', target: 'cave' },
      { text: 'Return the shard to Bram', target: 'village' },
    ],
  },
  {
    id: 'q3_bright_water',
    title: 'Bright Water',
    giver: 'Sela, Herbalist',
    summary: 'The river is running strange colours. Sela needs samples from the lakes.',
    requires: ['q2_long_dark'],
    objectives: [
      {
        text: 'Visit Mirror Lake in the south-west',
        target: 'lake',
        zone: { x: -210, z: 190, radius: 96 },
      },
      { text: 'Collect Riverstones from the shore (3)', target: 'lake' },
      { text: 'Ask Sela about the reflections', target: 'village' },
    ],
  },
  {
    id: 'q4_dead_mans_lure',
    title: "The Fisherman's Lure",
    giver: 'Tovin, Fisher',
    summary: 'Tovin lost his lucky lure at Saltmarsh. There is more to the story.',
    requires: ['q3_bright_water'],
    objectives: [
      {
        text: 'Follow the coast road to Saltmarsh',
        target: 'village',
        zone: { x: 330, z: 300, radius: 28 },
      },
      { text: 'Recover the lure near the northern lake', target: 'lake', hint: 'Where the shore turns to stone.' },
      { text: 'Return the lure to Tovin', target: 'village' },
    ],
  },
  {
    id: 'q5_stone_song',
    title: 'The Song of Stones',
    giver: 'Orin, Wandering Scholar',
    summary: 'Three waystones hum with old power. Waking all of them might open something.',
    requires: ['q4_dead_mans_lure'],
    objectives: [
      { text: 'Activate the Waystone of Dawn', target: 'waystone' },
      { text: 'Activate the Waystone of Tide', target: 'waystone' },
      { text: 'Activate the Waystone of Peak', target: 'waystone' },
    ],
  },
  {
    id: 'q6_starlit_ascent',
    title: 'Starlit Ascent',
    giver: 'Orin, Wandering Scholar',
    summary: 'The compass points to the frozen summit. Climb, and see what waits in the cold light.',
    requires: ['q5_stone_song'],
    finalQuest: true,
    objectives: [
      { text: 'Climb to the northern peak', target: 'peak', hint: 'Follow the compass needle north.' },
      { text: 'Reach the Starlit Cairn', target: 'peak' },
      { text: 'Return to any village with the Horizon Compass', target: 'village' },
    ],
  },
];

export const QUEST_MAP: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function nextQuestId(completed: Record<string, { status: string }>): string | null {
  for (const q of QUESTS) {
    const state = completed[q.id];
    if (state && (state.status === 'active' || state.status === 'complete')) continue;
    const reqs = q.requires ?? [];
    if (reqs.every((r) => completed[r]?.status === 'complete')) return q.id;
    if (reqs.length === 0) return q.id;
    return null;
  }
  return null;
}
