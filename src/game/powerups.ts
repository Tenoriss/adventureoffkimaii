/**
 * Collectible pickups scattered along paths and landmarks.
 * "spark" pickups restore stamina; "boost" pickups grant a short speed surge.
 */

export type PowerupKind = 'stamina' | 'speed' | 'mist';

export interface PowerupDef {
  kind: PowerupKind;
  name: string;
  icon: string;
  color: number;
  description: string;
  duration: number;
  amount: number;
}

export const POWER_UPS: Record<PowerupKind, PowerupDef> = {
  stamina: {
    kind: 'stamina',
    name: 'Wind Sprite',
    icon: 'spark',
    color: 0xa8f0ff,
    description: 'Restores 45 stamina.',
    duration: 0,
    amount: 45,
  },
  speed: {
    kind: 'speed',
    name: 'Trail Shoes',
    icon: 'speed',
    color: 0xffd479,
    description: 'A short burst of speed.',
    duration: 7,
    amount: 1,
  },
  mist: {
    kind: 'mist',
    name: 'Mist Bloom',
    icon: 'mist',
    color: 0xd9b3ff,
    description: 'A soft glow that slows your fall.',
    duration: 9,
    amount: 1,
  },
};

export interface PowerupSpot {
  id: string;
  kind: PowerupKind;
  x: number;
  z: number;
}

export const POWERUP_SPOTS: PowerupSpot[] = [
  { id: 'pu-1', kind: 'stamina', x: 48, z: 108 },
  { id: 'pu-2', kind: 'stamina', x: -18, z: 74 },
  { id: 'pu-3', kind: 'speed', x: 96, z: 30 },
  { id: 'pu-4', kind: 'speed', x: -150, z: 30 },
  { id: 'pu-5', kind: 'mist', x: -286, z: 96 },
  { id: 'pu-6', kind: 'stamina', x: 244, z: 130 },
  { id: 'pu-7', kind: 'speed', x: 230, z: 238 },
  { id: 'pu-8', kind: 'mist', x: -60, z: -240 },
  { id: 'pu-9', kind: 'stamina', x: 380, z: 120 },
  { id: 'pu-10', kind: 'speed', x: -250, z: 240 },
];
