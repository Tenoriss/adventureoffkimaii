import type { QualityLevel } from '../config/quality';

export interface GraphicsSettings {
  level: QualityLevel;
  /** true when the level came from auto-detection and may be nudged. */
  auto: boolean;
  renderScale: number;
  showFps: boolean;
}

export interface ControlSettings {
  sensitivity: number;
  invertY: boolean;
  joystickSide: 'left' | 'right';
  haptics: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export interface SaveData {
  version: number;
  seed: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  time: number;
  health: number;
  stamina: number;
  inventory: { id: string; qty: number }[];
  quests: Record<string, QuestState>;
  flags: Record<string, boolean | number>;
  seen: string[];
  playtime: number;
  updatedAt: number;
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'complete';

export interface QuestState {
  status: QuestStatus;
  progress: number;
  /** Which objective indices timed out or failed (used for branching text). */
  failed?: number[];
}

export interface Objective {
  text: string;
  /** Optional target used for compass hints. */
  target?: 'cave' | 'village' | 'waystone' | 'lake' | 'peak' | 'shore';
  hint?: string;
  /** Advances automatically when you talk to this NPC. */
  onTalk?: string;
  /** Advances automatically when you walk within `radius` of `at`. */
  zone?: { x: number; z: number; radius: number };
}

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  summary: string;
  /** Chain prerequisites. */
  requires?: string[];
  objectives: Objective[];
  finalQuest?: boolean;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  /** Emote / mood used by the portrait. */
  mood?: 'neutral' | 'happy' | 'worried' | 'mysterious';
}

export interface DialogueOption {
  label: string;
  next?: string;
  action?: DialogueAction;
}

export type DialogueAction =
  | { type: 'giveQuest'; questId: string }
  | { type: 'openQuest'; questId: string }
  | { type: 'trade'; give: string; take: string }
  | { type: 'turnIn'; questId: string; itemId?: string; qty?: number }
  | { type: 'completeQuest'; questId: string }
  | { type: 'giveItem'; itemId: string; qty: number }
  | { type: 'takeItem'; itemId: string; qty: number }
  | { type: 'setFlag'; key: string; value: boolean | number }
  | { type: 'reveal'; target: 'cave' | 'village' | 'waystone' | 'lake' }
  | { type: 'close' }
  | { type: 'openShop' };

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  options?: DialogueOption[];
  next?: string;
}

export interface NPCDef {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  palette: { robe: string; trim: string; skin: string; hair: string };
  greeting: string;
  /** Entry node resolver key. */
  dialogue: string;
}

export type InteractableKind = 'npc' | 'herb' | 'waystone' | 'cave' | 'signpost' | 'chest' | 'campfire';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  data?: Record<string, unknown>;
}

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'info' | 'item' | 'quest' | 'damage' | 'heal';
  icon?: string;
}
