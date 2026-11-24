import type { DialogueNode, NPCDef, QuestState } from './types';

export interface DlgCtx {
  quest: (id: string) => QuestState | undefined;
  isComplete: (id: string) => boolean;
  isActive: (id: string) => boolean;
  countItem: (id: string) => number;
  flag: (key: string) => boolean;
  hasFlag: (key: string) => boolean;
}

export const NPCS: NPCDef[] = [
  {
    id: 'mira',
    name: 'Mira',
    role: 'Village Elder',
    x: 88,
    z: 140,
    palette: { robe: '#8b5c8f', trim: '#e6c46a', skin: '#e8bd97', hair: '#cfcfcf' },
    greeting: 'The wind changed last night. I felt it in the shutters.',
    dialogue: 'mira',
  },
  {
    id: 'bram',
    name: 'Bram',
    role: 'Hunter',
    x: -176,
    z: -52,
    palette: { robe: '#5d6b45', trim: '#8a6b3f', skin: '#cf9e7a', hair: '#3b2d22' },
    greeting: 'Quiet. Even the crows are quiet.',
    dialogue: 'bram',
  },
  {
    id: 'sela',
    name: 'Sela',
    role: 'Herbalist',
    x: 112,
    z: 158,
    palette: { robe: '#4c7a5b', trim: '#d9c88a', skin: '#e6bb96', hair: '#7a4a2a' },
    greeting: 'Careful with those boots — I just swept.',
    dialogue: 'sela',
  },
  {
    id: 'tovin',
    name: 'Tovin',
    role: 'Fisher',
    x: 336,
    z: 312,
    palette: { robe: '#39607a', trim: '#c8b27a', skin: '#d9a880', hair: '#4a3a2c' },
    greeting: 'The tide keeps taking what I love.',
    dialogue: 'tovin',
  },
  {
    id: 'orin',
    name: 'Orin',
    role: 'Wandering Scholar',
    x: -280,
    z: 88,
    palette: { robe: '#3f4f7a', trim: '#b9c4dc', skin: '#dfb894', hair: '#2c2c38' },
    greeting: 'Do you hear it? The stones are humming again.',
    dialogue: 'orin',
  },
  {
    id: 'pell',
    name: 'Pell',
    role: 'Market Keeper',
    x: 78,
    z: 166,
    palette: { robe: '#a3623f', trim: '#e2cfa8', skin: '#d8a982', hair: '#2f241c' },
    greeting: 'Fresh bread, if the ovens behave.',
    dialogue: 'pell',
  },
];

export const NPC_MAP: Record<string, NPCDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/* ------------------------------------------------------------------ */
/* Dialogue trees                                                      */
/* ------------------------------------------------------------------ */

export const DIALOGUE: Record<string, DialogueNode> = {
  /* ------------------------------- Mira ------------------------------- */
  mira_start: {
    id: 'mira_start',
    lines: [
      { speaker: 'Mira', text: 'You came down from the ridge road. Alone? Most turn back at the river.', mood: 'neutral' },
      { speaker: 'Mira', text: 'Emberfall is small, but it is kind. Walk the plaza, learn the ground beneath your boots.', mood: 'happy' },
      { speaker: 'Mira', text: 'When you are ready, gather three sunleaf for Sela. The meadow past the well grows them thickest.', mood: 'neutral' },
    ],
    options: [
      { label: 'I will. Show me the village.', action: { type: 'giveQuest', questId: 'q1_first_steps' } },
      { label: 'What happened here?', next: 'mira_history' },
    ],
  },
  mira_history: {
    id: 'mira_history',
    lines: [
      { speaker: 'Mira', text: 'The waystones were lit once. Three of them, holding the valley in a quiet balance.', mood: 'neutral' },
      { speaker: 'Mira', text: 'Then the light went out, one by one, and the forest grew bolder. You will hear the humming before you see them.', mood: 'mysterious' },
      { speaker: 'Mira', text: 'Go on then. The meadow will not walk to you.', mood: 'happy' },
    ],
    options: [{ label: 'I will gather the sunleaf.', action: { type: 'giveQuest', questId: 'q1_first_steps' } }],
  },
  mira_working: {
    id: 'mira_working',
    lines: [
      { speaker: 'Mira', text: 'Walk the plaza, speak with me again, then bring Sela her sunleaf. One step at a time.', mood: 'neutral' },
    ],
    options: [{ label: 'Understood.', action: { type: 'close' } }],
  },
  mira_followup: {
    id: 'mira_followup',
    lines: [
      { speaker: 'Mira', text: 'You have the walk of someone who has seen the valley properly now.', mood: 'happy' },
      { speaker: 'Mira', text: 'Bram has been pacing the road to Thornwick. Whatever worries a hunter that much is worth hearing.', mood: 'worried' },
    ],
    options: [{ label: 'I will find Bram.', action: { type: 'close' } }],
  },
  mira_final: {
    id: 'mira_final',
    lines: [
      { speaker: 'Mira', text: 'The compass. So the summit still answers.', mood: 'mysterious' },
      { speaker: 'Mira', text: 'I was young when the last light went out. I never thought to see the horizon open again.', mood: 'mysterious' },
      { speaker: 'Mira', text: 'You have given this valley its morning back, wanderer. Rest. You have earned a long one.', mood: 'happy' },
    ],
    options: [{ label: 'It was worth the climb.', action: { type: 'completeQuest', questId: 'q6_starlit_ascent' } }],
  },
  mira_after_all: {
    id: 'mira_after_all',
    lines: [
      { speaker: 'Mira', text: 'Sit by the fire whenever you like. Emberfall keeps a seat for you.', mood: 'happy' },
    ],
    options: [{ label: 'Thank you, Mira.', action: { type: 'close' } }],
  },

  /* ------------------------------- Bram ------------------------------- */
  bram_start: {
    id: 'bram_start',
    lines: [
      { speaker: 'Bram', text: 'You are the one Mira sent. Good. I do not have the patience to explain twice.', mood: 'neutral' },
      { speaker: 'Bram', text: 'Echo Hollow, in the western hills. Something moved in there three nights past. Something that left marks on stone.', mood: 'worried' },
      { speaker: 'Bram', text: 'I am not asking you to fight it. I am asking you to look. Bring back one of the blue shards in the dark.', mood: 'neutral' },
    ],
    options: [
      { label: 'I will look. Nothing more.', action: { type: 'giveQuest', questId: 'q2_long_dark' } },
      { label: 'What are the shards?', next: 'bram_shards' },
    ],
  },
  bram_shards: {
    id: 'bram_shards',
    lines: [
      { speaker: 'Bram', text: 'Waystone glass. The old folk say the stones shed it when they dim.', mood: 'mysterious' },
      { speaker: 'Bram', text: 'Sela would pay in rations for a piece. I would pay in silence. Make your choice.', mood: 'neutral' },
    ],
    options: [{ label: 'I will bring one back.', action: { type: 'giveQuest', questId: 'q2_long_dark' } }],
  },
  bram_waiting: {
    id: 'bram_waiting',
    lines: [{ speaker: 'Bram', text: 'Echo Hollow. West, past the last fence. The dark will not bite unless you ask it to.', mood: 'neutral' }],
    options: [{ label: 'On my way.', action: { type: 'close' } }],
  },
  bram_return: {
    id: 'bram_return',
    lines: [
      { speaker: 'Bram', text: 'You have it. Hold it to the light — see how it leans? Toward the peaks.', mood: 'mysterious' },
      { speaker: 'Bram', text: 'Take it to Orin, the scholar by the western waystone. He will talk your ear off, but he knows the old songs.', mood: 'neutral' },
      { speaker: 'Bram', text: 'And wanderer — the river ran bright this morning. Sela has been muttering about it.', mood: 'worried' },
    ],
    options: [{ label: 'I will speak with Orin.', action: { type: 'turnIn', questId: 'q2_long_dark', itemId: 'waystone_shard', qty: 1 } }],
  },
  bram_done: {
    id: 'bram_done',
    lines: [{ speaker: 'Bram', text: 'Still breathing. Good.', mood: 'happy' }],
    options: [{ label: 'Still breathing.', action: { type: 'close' } }],
  },

  /* ------------------------------- Sela ------------------------------- */
  sela_start: {
    id: 'sela_start',
    lines: [
      { speaker: 'Sela', text: 'Sunleaf, three of them, leaves still warm. You can bring me the whole plant, I am not fussy.', mood: 'neutral' },
      { speaker: 'Sela', text: 'Oh — and if you pass the south meadow, do not step on the blue flowers. They are not flowers.', mood: 'mysterious' },
    ],
    options: [{ label: 'Three sunleaf. Noted.', action: { type: 'setFlag', key: 'met_sela', value: true } }],
  },
  sela_handin: {
    id: 'sela_handin',
    lines: [
      { speaker: 'Sela', text: 'Three, and not a bruise on them. You have steady hands.', mood: 'happy' },
      { speaker: 'Sela', text: 'Take these rations. And listen — the river has been running bright as glass. That is not weather.', mood: 'worried' },
    ],
    options: [{ label: 'What do you think it is?', next: 'sela_water' }],
  },
  sela_water: {
    id: 'sela_water',
    lines: [
      { speaker: 'Sela', text: 'I think the lakes are waking. Mirror Lake, down south-west, has been throwing back the wrong sky.', mood: 'worried' },
      { speaker: 'Sela', text: 'Bring me riverstones from the shore. Three should tell me what the water is doing.', mood: 'neutral' },
    ],
    options: [{ label: 'I will bring three.', action: { type: 'giveQuest', questId: 'q3_bright_water' } }],
  },
  sela_lake_waiting: {
    id: 'sela_lake_waiting',
    lines: [{ speaker: 'Sela', text: 'Mirror Lake. South-west, past the grove. The stones sit on the shore like dropped coins.', mood: 'neutral' }],
    options: [{ label: 'Going now.', action: { type: 'close' } }],
  },
  sela_lake_done: {
    id: 'sela_lake_done',
    lines: [
      { speaker: 'Sela', text: 'Cold, smooth, and humming. All three. The water is not reflecting — it is remembering.', mood: 'mysterious' },
      { speaker: 'Sela', text: 'Tovin at Saltmarsh has been asking about reflections too. Take the stones to him. He will pretend not to care.', mood: 'neutral' },
    ],
    options: [{ label: 'I will find Tovin.', action: { type: 'turnIn', questId: 'q3_bright_water', itemId: 'riverstone', qty: 3 } }],
  },
  sela_done: {
    id: 'sela_done',
    lines: [{ speaker: 'Sela', text: 'Mind the roots on the way out.', mood: 'happy' }],
    options: [{ label: 'Always.', action: { type: 'close' } }],
  },

  /* ------------------------------- Tovin ------------------------------- */
  tovin_start: {
    id: 'tovin_start',
    lines: [
      { speaker: 'Tovin', text: 'You walked the coast road for this? Sit, then. The fish are not biting and the sky is wrong.', mood: 'neutral' },
      { speaker: 'Tovin', text: 'I lost my lucky lure at the northern lake. Brass, three hooks, a stupid red feather.', mood: 'worried' },
      { speaker: 'Tovin', text: 'Find it and I will tell you what the water showed me. That is the trade.', mood: 'mysterious' },
    ],
    options: [
      { label: 'I will find your lure.', action: { type: 'giveQuest', questId: 'q4_dead_mans_lure' } },
      { label: 'What did it show you?', next: 'tovin_show' },
    ],
  },
  tovin_show: {
    id: 'tovin_show',
    lines: [
      { speaker: 'Tovin', text: 'The water went flat as a millpond and then it showed me a staircase made of light going up into the mountains.', mood: 'mysterious' },
      { speaker: 'Tovin', text: 'I am a fisherman. I do not climb. Bring me the lure and I will tell you the rest.', mood: 'neutral' },
    ],
    options: [{ label: 'I will find it.', action: { type: 'giveQuest', questId: 'q4_dead_mans_lure' } }],
  },
  tovin_waiting: {
    id: 'tovin_waiting',
    lines: [{ speaker: 'Tovin', text: 'Northern lake, past the reeds. Look where the shore turns to stone.', mood: 'neutral' }],
    options: [{ label: 'Right.', action: { type: 'close' } }],
  },
  tovin_return: {
    id: 'tovin_return',
    lines: [
      { speaker: 'Tovin', text: 'My lure. Still hooked on nothing but bad luck.', mood: 'happy' },
      { speaker: 'Tovin', text: 'Here is the rest of what I saw: the staircase of light ended at three stones. All of them dark.', mood: 'mysterious' },
      { speaker: 'Tovin', text: 'Orin knows the stones. He is up by the western one, humming to it like a madman.', mood: 'neutral' },
    ],
    options: [{ label: 'Three stones. Thank you.', action: { type: 'turnIn', questId: 'q4_dead_mans_lure', itemId: 'fishermans_lure', qty: 1 } }],
  },
  tovin_done: {
    id: 'tovin_done',
    lines: [{ speaker: 'Tovin', text: 'The water is brighter today. I will take the credit.', mood: 'happy' }],
    options: [{ label: 'Take it.', action: { type: 'close' } }],
  },

  /* ------------------------------- Orin ------------------------------- */
  orin_start: {
    id: 'orin_start',
    lines: [
      { speaker: 'Orin', text: 'Shh. Listen. Do you hear it? A low hum, like a held breath.', mood: 'mysterious' },
      { speaker: 'Orin', text: 'I am Orin. I study things that are older than my boots. This waystone has been dark for forty years.', mood: 'neutral' },
      { speaker: 'Orin', text: 'Bring me the shard Bram found and I will show you what waking a stone looks like.', mood: 'happy' },
    ],
    options: [{ label: 'I have a shard — from the cave.', action: { type: 'openQuest', questId: 'q5_stone_song' } }, { label: 'Tell me about the stones.', next: 'orin_lore' }],
  },
  orin_lore: {
    id: 'orin_lore',
    lines: [
      { speaker: 'Orin', text: 'Three waystones ring the valley: Dawn in the west, Tide in the east, Peak in the north.', mood: 'mysterious' },
      { speaker: 'Orin', text: 'They were a lock, I think. Or a door. The distinction has escaped me for eleven years.', mood: 'neutral' },
    ],
    options: [
      { label: 'I have a shard. Show me.', action: { type: 'giveQuest', questId: 'q5_stone_song' } },
      { label: 'I will come back.', action: { type: 'close' } },
    ],
  },
  orin_stones: {
    id: 'orin_stones',
    lines: [
      { speaker: 'Orin', text: 'Touch each stone and do not flinch. The hum will find you. When all three sing, come back.', mood: 'mysterious' },
    ],
    options: [{ label: 'Three stones. Understood.', action: { type: 'setFlag', key: 'met_orin', value: true } }],
  },
  orin_peak: {
    id: 'orin_peak',
    lines: [
      { speaker: 'Orin', text: 'All three! Do you hear how the valley is holding its breath?', mood: 'happy' },
      { speaker: 'Orin', text: 'The compass in my pack has not moved in years. Look at it now — the needle leans north, past the ridge, to the peak.', mood: 'mysterious' },
      { speaker: 'Orin', text: 'Climb to the Starlit Cairn. Whatever waits up there, it has been waiting a long time.', mood: 'mysterious' },
    ],
    options: [{ label: 'I will climb.', action: { type: 'giveQuest', questId: 'q6_starlit_ascent' } }],
  },
  orin_compass: {
    id: 'orin_compass',
    lines: [
      { speaker: 'Orin', text: 'The cairn answered you? Then take the compass. It is yours to follow now.', mood: 'happy' },
    ],
    options: [{ label: 'Thank you, Orin.', action: { type: 'giveItem', itemId: 'horizon_compass', qty: 1 } }],
  },
  orin_done: {
    id: 'orin_done',
    lines: [{ speaker: 'Orin', text: 'I have written four pages about you. Only one is true, but it is the good one.', mood: 'happy' }],
    options: [{ label: 'Which one?', action: { type: 'close' } }],
  },

  /* ------------------------------- Pell ------------------------------- */
  pell_start: {
    id: 'pell_start',
    lines: [
      { speaker: 'Pell', text: 'Bread, honey, and gossip. Two of those are free, and I will let you guess which.', mood: 'happy' },
      { speaker: 'Pell', text: 'If you find embercaps in the woods, I will trade rations. They make a mushroom pie worth the walk.', mood: 'neutral' },
    ],
    options: [
      { label: 'Trade embercaps for rations.', action: { type: 'trade', give: 'embercap', take: 'trail_ration' } },
      { label: 'Just passing through.', action: { type: 'close' } },
    ],
  },
};

export const NPC_ENTRY_ORDER: Record<string, { when: (c: DlgCtx) => boolean; entry: string; node: string }[]> = {
  mira: [
    { when: (c) => c.flag('q6_complete'), entry: 'mira_after_all', node: 'mira_after_all' },
    { when: (c) => c.isActive('q6_starlit_ascent') && c.flag('cairn_reached'), entry: 'mira_final', node: 'mira_final' },
    { when: (c) => c.isComplete('q1_first_steps'), entry: 'mira_followup', node: 'mira_followup' },
    { when: (c) => c.isActive('q1_first_steps'), entry: 'mira_working', node: 'mira_working' },
    {
      when: (c) => c.isComplete('q2_long_dark') || c.isComplete('q3_bright_water'),
      entry: 'mira_followup',
      node: 'mira_followup',
    },
    { when: () => true, entry: 'mira_start', node: 'mira_start' },
  ],
  bram: [
    { when: (c) => c.isComplete('q2_long_dark'), entry: 'bram_done', node: 'bram_done' },
    { when: (c) => c.isActive('q2_long_dark') && c.countItem('waystone_shard') > 0, entry: 'bram_return', node: 'bram_return' },
    { when: (c) => c.isActive('q2_long_dark'), entry: 'bram_waiting', node: 'bram_waiting' },
    { when: (c) => c.isComplete('q1_first_steps'), entry: 'bram_start', node: 'bram_start' },
    {
      when: () => true,
      entry: 'bram_waiting',
      node: 'bram_waiting',
    },
  ],
  sela: [
    { when: (c) => c.isComplete('q3_bright_water'), entry: 'sela_done', node: 'sela_done' },
    { when: (c) => c.isActive('q3_bright_water') && c.countItem('riverstone') >= 3, entry: 'sela_lake_done', node: 'sela_lake_done' },
    { when: (c) => c.isActive('q3_bright_water'), entry: 'sela_lake_waiting', node: 'sela_lake_waiting' },
    { when: (c) => c.countItem('sunleaf') >= 3, entry: 'sela_handin', node: 'sela_handin' },
    { when: () => true, entry: 'sela_start', node: 'sela_start' },
  ],
  tovin: [
    { when: (c) => c.isComplete('q4_dead_mans_lure'), entry: 'tovin_done', node: 'tovin_done' },
    { when: (c) => c.isActive('q4_dead_mans_lure') && c.countItem('fishermans_lure') > 0, entry: 'tovin_return', node: 'tovin_return' },
    { when: (c) => c.isActive('q4_dead_mans_lure'), entry: 'tovin_waiting', node: 'tovin_waiting' },
    { when: () => true, entry: 'tovin_start', node: 'tovin_start' },
  ],
  orin: [
    { when: (c) => c.isActive('q6_starlit_ascent'), entry: 'orin_peak', node: 'orin_peak' },
    { when: (c) => c.isComplete('q5_stone_song') && !c.isActive('q6_starlit_ascent'), entry: 'orin_peak', node: 'orin_peak' },
    { when: (c) => c.isActive('q5_stone_song'), entry: 'orin_stones', node: 'orin_stones' },
    { when: (c) => c.countItem('waystone_shard') > 0, entry: 'orin_start', node: 'orin_start' },
    { when: () => true, entry: 'orin_lore', node: 'orin_lore' },
  ],
  pell: [{ when: () => true, entry: 'pell_start', node: 'pell_start' }],
};

export function resolveEntry(npcId: string, ctx: DlgCtx): string {
  const order = NPC_ENTRY_ORDER[npcId];
  if (!order) return 'mira_start';
  for (const rule of order) {
    if (rule.when(ctx)) return rule.node;
  }
  return order[order.length - 1].node;
}
