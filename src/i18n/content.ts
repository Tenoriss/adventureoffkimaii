/**
 * Indonesian overlay for authored game content.
 *
 * The English structures in `game/dialogue.ts`, `game/quests.ts`,
 * `config/items.ts` and `world/features.ts` stay the canonical data (ids,
 * actions, objective order). This file only replaces the display strings, keyed
 * by the same ids, so nothing about progression can drift between languages.
 */

import { DIALOGUE, NPCS } from '../game/dialogue';
import { QUESTS } from '../game/quests';
import { ITEMS } from '../config/items';
import { VILLAGES, WAYSTONES, CAVE } from '../world/features';
import { POWER_UPS } from '../game/powerups';
import { getLang } from './index';

/* ------------------------------------------------------------------ */
/* NPCs                                                               */
/* ------------------------------------------------------------------ */

const NPC_ID: Record<string, { name: string; role: string }> = {
  mira: { name: 'Mira', role: 'Tetua Desa' },
  bram: { name: 'Bram', role: 'Pemburu' },
  sela: { name: 'Sela', role: 'Peramu Jamu' },
  tovin: { name: 'Tovin', role: 'Nelayan' },
  orin: { name: 'Orin', role: 'Cendekiawan Pengembara' },
  pell: { name: 'Pell', role: 'Penjaga Pasar' },
};

/* ------------------------------------------------------------------ */
/* Quests                                                             */
/* ------------------------------------------------------------------ */

interface QuestText {
  title: string;
  giver: string;
  summary: string;
  objectives: string[];
  hints?: (string | undefined)[];
}

const QUESTS_ID: Record<string, QuestText> = {
  q1_first_steps: {
    title: 'Jalan Pulang yang Panjang',
    giver: 'Mira, Tetua Desa',
    summary: 'Mira memintamu mengenali Emberfall sebelum jalan menjadi gelap.',
    objectives: [
      'Berjalan ke sumur Emberfall',
      'Bicara lagi dengan Mira',
      'Kumpulkan 3 Sunleaf di padang rumput',
    ],
    hints: ['Sumur itu berada di tengah alun-alun.', undefined, 'Cari daun kuning keemasan di tepi sungai.'],
  },
  q2_long_dark: {
    title: 'Kegelapan di Bawah Thornwick',
    giver: 'Bram, Pemburu',
    summary: 'Sesuatu telah masuk ke Echo Hollow. Bram ingin gua itu diperiksa, bukan dibersihkan.',
    objectives: [
      'Seberangi sungai ke utara menuju Thornwick',
      'Temukan Echo Hollow di perbukitan barat',
      'Ambil Waystone Shard dari gua',
      'Kembalikan shard itu ke Bram',
    ],
  },
  q3_bright_water: {
    title: 'Air yang Bercahaya',
    giver: 'Sela, Peramu Jamu',
    summary: 'Sungai mengalir dengan warna yang aneh. Sela butuh sampel dari danau.',
    objectives: [
      'Kunjungi Mirror Lake di barat daya',
      'Kumpulkan Riverstone dari tepi danau (3)',
      'Tanya Sela soal pantulan itu',
    ],
  },
  q4_dead_mans_lure: {
    title: 'Lure Si Nelayan',
    giver: 'Tovin, Nelayan',
    summary: 'Tovin kehilangan lure keberuntungannya di Saltmarsh. Ada cerita lain di baliknya.',
    objectives: ['Temukan lure di dekat danau utara', 'Kembalikan lure itu ke Tovin'],
    hints: ['Di tempat tepi danau berubah menjadi batu.', undefined],
  },
  q5_stone_song: {
    title: 'Nyanyian Batu',
    giver: 'Orin, Cendekiawan Pengembara',
    summary: 'Tiga waystone berdengung dengan kekuatan lama. Membangunkan semuanya mungkin membuka sesuatu.',
    objectives: [
      'Aktifkan Waystone of Dawn',
      'Aktifkan Waystone of Tide',
      'Aktifkan Waystone of Peak',
    ],
  },
  q6_starlit_ascent: {
    title: 'Pendakian Berbintang',
    giver: 'Orin, Cendekiawan Pengembara',
    summary: 'Kompas menunjuk ke puncak beku. Naiklah, dan lihat apa yang menunggu dalam cahaya dingin itu.',
    objectives: [
      'Daki puncak di utara',
      'Capai Starlit Cairn',
      'Kembali ke desa mana pun dengan Horizon Compass',
    ],
    hints: ['Ikuti jarum kompas ke utara.', undefined, undefined],
  },
};

/* ------------------------------------------------------------------ */
/* Items                                                              */
/* ------------------------------------------------------------------ */

const ITEMS_ID: Record<string, { name: string; description: string; rarity: string }> = {
  sunleaf: {
    name: 'Sunleaf',
    description: 'Herbal berdaun hangat yang tumbuh di tempat terbuka. Memulihkan stamina bila diseduh.',
    rarity: 'umum',
  },
  embercap: {
    name: 'Embercap',
    description: 'Jamur bercahaya dari hutan dalam. Peramu jamu membayarnya mahal.',
    rarity: 'bagus',
  },
  riverstone: {
    name: 'Riverstone',
    description: 'Batu biru halus yang dibentuk arus. Para pedagang memakainya sebagai koin.',
    rarity: 'umum',
  },
  waystone_shard: {
    name: 'Waystone Shard',
    description: 'Serpihan batu berukir rune yang berdening. Ia menunjuk ke sesuatu yang hilang.',
    rarity: 'kunci',
  },
  trail_ration: {
    name: 'Ransum Perjalanan',
    description: 'Roti padat dan madu. Tekan H untuk makan dan memulihkan nyawa.',
    rarity: 'umum',
  },
  fishermans_lure: {
    name: 'Lure Si Nelayan',
    description: 'Lure berkilau dari Saltmarsh. Katanya arus membawa lebih dari sekadar ikan.',
    rarity: 'bagus',
  },
  horizon_compass: {
    name: 'Horizon Compass',
    description: 'Kompas kuningan yang tidak menunjuk utara. Jarumnya bergetar ke arah pegunungan.',
    rarity: 'kunci',
  },
};

/* ------------------------------------------------------------------ */
/* Places                                                             */
/* ------------------------------------------------------------------ */

const PLACES_ID: Record<string, string> = {
  Emberfall: 'Emberfall',
  Thornwick: 'Thornwick',
  Saltmarsh: 'Saltmarsh',
  'Echo Hollow': 'Echo Hollow',
  'Waystone of Dawn': 'Waystone of Dawn',
  'Waystone of Tide': 'Waystone of Tide',
  'Waystone of Peak': 'Waystone of Peak',
  'Mirror Lake': 'Mirror Lake',
  'Emberfall Vale': 'Lembah Emberfall',
  'Northwind Peaks': 'Puncak Northwind',
  'Saltmarsh Coast': 'Pesisir Saltmarsh',
  Westwoods: 'Hutan Barat',
  'Southern Meadows': 'Padang Selatan',
  Sunleaf: 'Sunleaf',
  Embercap: 'Embercap',
  Riverstone: 'Riverstone',
  'Northern lake': 'Danau utara',
  'The northern peak': 'Puncak utara',
  'Sunleaf meadow': 'Padang sunleaf',
  Riverstones: 'Riverstone',
};

/* ------------------------------------------------------------------ */
/* Dialogue                                                           */
/* ------------------------------------------------------------------ */

interface NodeText {
  lines: string[];
  /** Option labels in the same order as the English node. */
  options?: string[];
}

const DLG_ID: Record<string, NodeText> = {
  /* Mira */
  mira_start: {
    lines: [
      'Kamu turun dari jalan punggung bukit. Sendiri? Kebanyakan orang berbalik di sungai.',
      'Emberfall kecil, tapi baik hati. Jelajahi alun-alunnya, kenali tanah di bawah sepatumu.',
      'Kalau sudah siap, petik tiga sunleaf untuk Sela. Padang di balik sumur paling subur.',
    ],
    options: ['Baiklah. Tunjukkan desamu.', 'Apa yang terjadi di sini?'],
  },
  mira_history: {
    lines: [
      'Dulu waystone pernah menyala. Tiga buah, menjaga lembah ini dalam keseimbangan yang tenang.',
      'Lalu cahayanya padam, satu per satu, dan hutan jadi semakin berani. Kamu akan mendengar dengungnya sebelum melihatnya.',
      'Pergilah. Padang rumput itu tidak akan berjalan menghampirimu.',
    ],
    options: ['Aku akan memetik sunleaf-nya.'],
  },
  mira_working: {
    lines: [
      'Jelajahi alun-alun, bicaralah denganku lagi, lalu antar sunleaf ke Sela. Satu langkah demi satu langkah.',
    ],
    options: ['Mengerti.'],
  },
  mira_followup: {
    lines: [
      'Langkahmu seperti orang yang sudah benar-benar mengenal lembah ini.',
      'Bram mondar-mandir di jalan ke Thornwick. Apa pun yang membuat pemburu secemas itu layak didengar.',
    ],
    options: ['Aku akan mencari Bram.'],
  },
  mira_final: {
    lines: [
      'Kompas itu. Jadi puncaknya masih menjawab.',
      'Aku masih muda saat cahaya terakhir padam. Tak pernah kubayangkan melihat cakrawala terbuka lagi.',
      'Kamu sudah mengembalikan pagi lembah ini, pengembara. Beristirahatlah. Kamu pantas istirahat panjang.',
    ],
    options: ['Pendakian itu layak.'],
  },
  mira_after_all: {
    lines: ['Duduklah dekat api kapan pun kamu mau. Emberfall menyimpan kursi untukmu.'],
    options: ['Terima kasih, Mira.'],
  },

  /* Bram */
  bram_start: {
    lines: [
      'Kamu yang dikirim Mira. Bagus. Aku tidak sabar menjelaskan dua kali.',
      'Echo Hollow, di perbukitan barat. Sesuatu bergerak di sana tiga malam lalu. Sesuatu yang meninggalkan bekas di batu.',
      'Aku tidak minta kamu melawannya. Aku minta kamu melihat. Bawa pulang satu serpihan biru dari dalam gelap.',
    ],
    options: ['Aku akan melihat. Tidak lebih.', 'Apa itu serpihan-serpihan ini?'],
  },
  bram_shards: {
    lines: [
      'Kaca waystone. Kata orang tua, batu-batu itu menumpahkan serpihannya saat meredup.',
      'Sela akan membayar dengan ransum untuk sekeping. Aku membayar dengan diam. Pilih sendiri.',
    ],
    options: ['Aku akan membawa satu kembali.'],
  },
  bram_waiting: {
    lines: ['Echo Hollow. Barat, lewat pagar terakhir. Kegelapan tidak akan menggigit kalau tidak kamu undang.'],
    options: ['Aku jalan sekarang.'],
  },
  bram_return: {
    lines: [
      'Kamu membawanya. Angkat ke cahaya — lihat bagaimana ia condong? Ke arah puncak.',
      'Bawa ke Orin, cendekiawan di dekat waystone barat. Dia akan membuat telingamu panas, tapi dia tahu nyanyian lama.',
      'Dan pengembara — sungai mengalir terang pagi ini. Sela terus bergumam soal itu.',
    ],
    options: ['Aku akan bicara dengan Orin.'],
  },
  bram_done: {
    lines: ['Masih bernapas. Bagus.'],
    options: ['Masih bernapas.'],
  },

  /* Sela */
  sela_start: {
    lines: [
      'Sunleaf, tiga lembar, daunnya masih hangat. Boleh bawa seluruh tanamannya, aku tidak pilih-pilih.',
      'Oh — dan kalau lewat padang selatan, jangan injak bunga biru itu. Itu bukan bunga.',
    ],
    options: ['Tiga sunleaf. Tercatat.'],
  },
  sela_handin: {
    lines: [
      'Tiga, dan tidak ada yang memar. Tanganmu mantap.',
      'Bawa ransum ini. Dan dengar — sungai mengalir sebening kaca akhir-akhir ini. Itu bukan cuaca.',
    ],
    options: ['Menurutmu itu apa?'],
  },
  sela_water: {
    lines: [
      'Kurasa danau-danau mulai terbangun. Mirror Lake, di barat daya, memantulkan langit yang salah.',
      'Bawakan aku riverstone dari tepiannya. Tiga butir cukup untuk memberitahuku apa yang sedang dilakukan air.',
    ],
    options: ['Aku akan bawa tiga.'],
  },
  sela_lake_waiting: {
    lines: ['Mirror Lake. Barat daya, lewat rimbunan pohon. Batu-batunya bertebaran di tepi seperti koin jatuh.'],
    options: ['Aku berangkat.'],
  },
  sela_lake_done: {
    lines: [
      'Dingin, halus, dan berdening. Ketiganya. Air itu bukan memantulkan — dia mengingat.',
      'Tovin di Saltmarsh juga bertanya soal pantulan. Bawa batu itu padanya. Dia akan pura-pura tidak peduli.',
    ],
    options: ['Aku akan mencari Tovin.'],
  },
  sela_done: {
    lines: ['Hati-hati dengan akar saat keluar.'],
    options: ['Selalu.'],
  },

  /* Tovin */
  tovin_start: {
    lines: [
      'Kamu menempuh jalan pesisir untuk ini? Duduklah. Ikan tidak mau makan dan langitnya salah.',
      'Aku kehilangan lure keberuntunganku di danau utara. Kuningan, tiga kail, bulu merah yang bodoh.',
      'Temukan itu dan aku akan ceritakan apa yang diperlihatkan air padaku. Itu tawaranku.',
    ],
    options: ['Aku akan mencari lure-mu.', 'Apa yang diperlihatkannya?'],
  },
  tovin_show: {
    lines: [
      'Airnya jadi rata seperti kolam kilang, lalu memperlihatkan tangga dari cahaya yang naik ke pegunungan.',
      'Aku nelayan. Aku tidak mendaki. Bawa lure-ku dan akan kuceritakan sisanya.',
    ],
    options: ['Aku akan menemukannya.'],
  },
  tovin_waiting: {
    lines: ['Danau utara, lewat ilalang. Cari tempat tepiannya berubah jadi batu.'],
    options: ['Baiklah.'],
  },
  tovin_return: {
    lines: [
      'Lure-ku. Masih tersangkut pada nasib buruk saja.',
      'Ini sisa yang kulihat: tangga cahaya itu berakhir di tiga batu. Semuanya gelap.',
      'Orin tahu soal batu-batu itu. Dia ada di dekat batu barat, bersenandung padanya seperti orang gila.',
    ],
    options: ['Tiga batu. Terima kasih.'],
  },
  tovin_done: {
    lines: ['Airnya lebih terang hari ini. Aku ambil pujiannya.'],
    options: ['Ambil saja.'],
  },

  /* Orin */
  orin_start: {
    lines: [
      'Ssst. Dengar. Kamu dengar itu? Dengung rendah, seperti napas yang ditahan.',
      'Aku Orin. Aku mempelajari hal-hal yang lebih tua dari sepatuku. Waystone ini sudah padam empat puluh tahun.',
      'Bawa serpihan yang ditemukan Bram dan akan kutunjukkan bagaimana membangunkan batu.',
    ],
    options: ['Aku punya serpihan — dari gua.', 'Ceritakan soal batu-batu ini.'],
  },
  orin_lore: {
    lines: [
      'Tiga waystone mengelilingi lembah: Dawn di barat, Tide di timur, Peak di utara.',
      'Dulu mereka sebuah kunci, kurasa. Atau sebuah pintu. Bedanya sudah menghindar dariku sebelas tahun.',
    ],
    options: ['Aku punya serpihan. Tunjukkan.', 'Aku akan kembali lagi.'],
  },
  orin_stones: {
    lines: ['Sentuh setiap batu dan jangan mundur. Dengungnya akan menemukanmu. Saat ketiganya bernyanyi, kembalilah.'],
    options: ['Tiga batu. Mengerti.'],
  },
  orin_peak: {
    lines: [
      'Ketiganya! Kamu dengar bagaimana lembah ini menahan napas?',
      'Kompas di tasku tak bergerak bertahun-tahun. Lihat sekarang — jarumnya condong ke utara, lewat punggung bukit, ke puncak.',
      'Daki ke Starlit Cairn. Apa pun yang menunggu di sana sudah menunggu sangat lama.',
    ],
    options: ['Aku akan mendaki.'],
  },
  orin_follow: {
    lines: [
      'Jarumnya masih condong ke utara, pengembara. Puncaknya juga belum berpindah.',
      'Saat cairn menjawabmu, bawa kompas itu ke desa. Mereka harus melihat cakrawala terbuka.',
    ],
    options: ['Aku jalan sekarang.'],
  },
  orin_compass: {
    lines: ['Cairn itu menjawabmu? Kalau begitu bawa kompasnya. Sekarang ia milikmu untuk diikuti.'],
    options: ['Terima kasih, Orin.'],
  },
  orin_done: {
    lines: ['Aku sudah menulis empat halaman tentangmu. Hanya satu yang benar, tapi itulah yang bagus.'],
    options: ['Yang mana?'],
  },

  /* Pell */
  pell_start: {
    lines: [
      'Roti, madu, dan gosip. Dua di antaranya gratis, dan aku biarkan kamu menebak yang mana.',
      'Kalau kamu menemukan embercap di hutan, aku akan menukarnya dengan ransum. Jamur itu membuat pai yang layak diperjuangkan.',
    ],
    options: ['Tukar embercap dengan ransum.', 'Cuma lewat.'],
  },
};

/* ------------------------------------------------------------------ */
/* Public helpers                                                     */
/* ------------------------------------------------------------------ */

/** Localised graphics preset label (Very Low → Sangat Rendah). */
export function presetLabel(level: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  const map: Record<string, string> = {
    verylow: 'Sangat Rendah',
    low: 'Rendah',
    medium: 'Sedang',
    high: 'Tinggi',
  };
  return map[level] ?? fallback;
}

/** Localised NPC display name/role. */
export function npcName(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return NPC_ID[id]?.name ?? fallback;
}

export function npcRole(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return NPC_ID[id]?.role ?? fallback;
}

export function questTitle(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return QUESTS_ID[id]?.title ?? fallback;
}

export function questGiver(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return QUESTS_ID[id]?.giver ?? fallback;
}

export function questSummary(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return QUESTS_ID[id]?.summary ?? fallback;
}

export function objectiveText(questId: string, index: number, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return QUESTS_ID[questId]?.objectives[index] ?? fallback;
}

export function objectiveHint(questId: string, index: number, fallback: string | undefined): string | undefined {
  if (getLang() !== 'id') return fallback;
  return QUESTS_ID[questId]?.hints?.[index] ?? fallback;
}

export function itemName(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return ITEMS_ID[id]?.name ?? fallback;
}

export function itemDescription(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return ITEMS_ID[id]?.description ?? fallback;
}

export function itemRarity(id: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return ITEMS_ID[id]?.rarity ?? fallback;
}

/** Localise a place name ("Emberfall", "Mirror Lake", …). */
export function placeName(name: string): string {
  if (getLang() !== 'id') return name;
  return PLACES_ID[name] ?? name;
}

export function powerupName(kind: string, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  const map: Record<string, string> = {
    stamina: 'Peri Angin',
    speed: 'Sepatu Jalan',
    mist: 'Mekar Kabut',
  };
  void POWER_UPS;
  return map[kind] ?? fallback;
}

/** Dialogue line text for the active language. */
export function dialogueLine(
  nodeId: string,
  index: number,
  fallback: { speaker: string; text: string; mood?: 'neutral' | 'happy' | 'worried' | 'mysterious' },
): { speaker: string; text: string; mood?: 'neutral' | 'happy' | 'worried' | 'mysterious' } {
  if (getLang() !== 'id') return fallback;
  const node = DLG_ID[nodeId];
  const text = node?.lines[index];
  return text ? { speaker: fallback.speaker, text, mood: fallback.mood } : fallback;
}

export function dialogueOptionLabel(nodeId: string, index: number, fallback: string): string {
  if (getLang() !== 'id') return fallback;
  return DLG_ID[nodeId]?.options?.[index] ?? fallback;
}

/**
 * Dev-time guard: every translated node/quest must keep the same shape as its
 * English original, otherwise a language switch could hide an option.
 */
export function validateTranslations(): string[] {
  const problems: string[] = [];
  for (const [id, node] of Object.entries(DIALOGUE)) {
    const tr = DLG_ID[id];
    if (!tr) {
      problems.push(`dialogue node missing: ${id}`);
      continue;
    }
    if (tr.lines.length !== node.lines.length) problems.push(`line count mismatch: ${id}`);
    const enOpts = node.options?.length ?? 0;
    const idOpts = tr.options?.length ?? 0;
    if (enOpts !== idOpts) problems.push(`option count mismatch: ${id} (${enOpts} vs ${idOpts})`);
  }
  for (const quest of QUESTS) {
    const tr = QUESTS_ID[quest.id];
    if (!tr) {
      problems.push(`quest missing: ${quest.id}`);
      continue;
    }
    if (tr.objectives.length !== quest.objectives.length) problems.push(`objective count mismatch: ${quest.id}`);
  }
  for (const id of Object.keys(ITEMS)) if (!ITEMS_ID[id]) problems.push(`item missing: ${id}`);
  for (const npc of NPCS) if (!NPC_ID[npc.id]) problems.push(`npc missing: ${npc.id}`);
  for (const v of VILLAGES) if (!PLACES_ID[v.name]) problems.push(`village place missing: ${v.name}`);
  for (const w of WAYSTONES) if (!PLACES_ID[w.name]) problems.push(`waystone place missing: ${w.name}`);
  if (!PLACES_ID[CAVE.name]) problems.push(`cave place missing: ${CAVE.name}`);
  return problems;
}
