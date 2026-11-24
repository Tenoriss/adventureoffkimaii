/**
 * Authored world content: villages, rivers, lakes, points of interest.
 *
 * Coordinates are in world metres. The terrain generator blends these into the
 * procedural heightfield so that hand-placed locations always sit on flat,
 * walkable ground that connects naturally to the surrounding landscape.
 */

import { WORLD_SEED } from './noise';

export { WORLD_SEED };

export type Vec2 = [number, number];

export interface RiverDef {
  points: Vec2[];
  /** Half-width of the water channel in metres. */
  width: number;
  /** Height of the carved river bed. */
  bed: number;
  /** Radius over which the surrounding terrain is pulled down into a valley. */
  influence: number;
}

export interface LakeDef {
  x: number;
  z: number;
  rx: number;
  rz: number;
  bed: number;
  influence: number;
}

export interface VillageDef {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  /** Buildings: [offsetX, offsetZ, sizeX, sizeZ, rotation, variant] */
  houses: [number, number, number, number, number, number][];
  color: string;
}

export interface WaystoneDef {
  id: string;
  name: string;
  x: number;
  z: number;
  rune: string;
}

/** A shore stone that can be picked up once for a quest. */
export interface ShoreStoneDef {
  id: string;
  x: number;
  z: number;
}

export interface HerbSpotDef {
  id: string;
  x: number;
  z: number;
  name: string;
}

export const WATER_LEVEL = 0;
export const WORLD_RADIUS = 980;
export const SPAWN: Vec2 = [76, 116];

export const RIVERS: RiverDef[] = [
  {
    // The long river that splits the starting valley from the northern peaks.
    points: [
      [-320, -210],
      [-150, -150],
      [-40, -96],
      [80, -60],
      [190, -10],
      [300, 70],
      [420, 170],
      [520, 290],
      [620, 430],
      [700, 560],
    ],
    width: 15,
    bed: -2.6,
    influence: 74,
  },
  {
    // Eastern creek winding out of the highlands.
    points: [
      [330, -300],
      [300, -220],
      [330, -150],
      [300, -60],
      [340, 30],
      [420, 60],
    ],
    width: 9,
    bed: -1.8,
    influence: 46,
  },
];

export const LAKES: LakeDef[] = [
  { x: -210, z: 190, rx: 92, rz: 64, bed: -5.5, influence: 130 },
  { x: 380, z: -210, rx: 62, rz: 48, bed: -4.5, influence: 90 },
  { x: -470, z: -300, rx: 74, rz: 58, bed: -5.0, influence: 105 },
];

export const VILLAGES: VillageDef[] = [
  {
    id: 'emberfall',
    name: 'Emberfall',
    x: 96,
    z: 148,
    radius: 30,
    color: '#f0a35e',
    houses: [
      [-14, -10, 9, 7, 0.2, 0],
      [13, -14, 8, 9, -0.35, 1],
      [-20, 9, 7, 6, 0.9, 2],
      [16, 12, 10, 7, -0.1, 0],
      [1, -22, 7, 6, 0.5, 2],
    ],
  },
  {
    id: 'thornwick',
    name: 'Thornwick',
    x: -170,
    z: -40,
    radius: 27,
    color: '#9ad06a',
    houses: [
      [-12, -8, 8, 7, 0.1, 1],
      [12, -10, 9, 8, -0.4, 0],
      [-15, 10, 7, 7, 0.7, 2],
      [10, 13, 8, 6, 0.2, 1],
    ],
  },
  {
    id: 'saltmarsh',
    name: 'Saltmarsh',
    x: 330,
    z: 300,
    radius: 26,
    color: '#7fc9d6',
    houses: [
      [-13, -12, 9, 8, 0.3, 2],
      [14, -8, 7, 7, -0.2, 0],
      [-10, 12, 8, 6, 0.6, 1],
      [12, 14, 9, 7, -0.5, 0],
    ],
  },
];

export const WAYSTONES: WaystoneDef[] = [
  { id: 'stone-dawn', name: 'Waystone of Dawn', x: -286, z: 96, rune: '☀' },
  { id: 'stone-tide', name: 'Waystone of Tide', x: 404, z: 46, rune: '≈' },
  { id: 'stone-peak', name: 'Waystone of Peak', x: -60, z: -372, rune: '▲' },
];

/**
 * Tovin's lost lure, on the shore of the northern lake (not at Saltmarsh —
 * the quest text sends the player north, so the lure has to be there).
 */
export const LURE = { x: 380, z: -174, radius: 11 } as const;

export const HERBS: HerbSpotDef[] = [
  { id: 'herb-1', x: 28, z: 215, name: 'Sunleaf' },
  { id: 'herb-2', x: 44, z: 196, name: 'Sunleaf' },
  { id: 'herb-3', x: 14, z: 188, name: 'Sunleaf' },
  { id: 'herb-4', x: 60, z: 224, name: 'Sunleaf' },
  { id: 'herb-5', x: -96, z: 186, name: 'Sunleaf' },
  { id: 'herb-6', x: -232, z: 142, name: 'Sunleaf' },
  { id: 'herb-7', x: -208, z: 156, name: 'Sunleaf' },
  { id: 'herb-8', x: 208, z: 198, name: 'Sunleaf' },
  { id: 'herb-9', x: -140, z: 268, name: 'Sunleaf' },
  { id: 'herb-10', x: 128, z: 214, name: 'Sunleaf' },
];

/**
 * Riverstones washed up on the Mirror Lake shore (q3 asks for three). Spread
 * over both banks so the search is a short walk, never a fetch quest.
 */
export const SHORE_STONES: ShoreStoneDef[] = [
  // Exactly on the waterline (sampled from the heightfield, shoreline ring).
  { id: 'stone-1', x: -157, z: 227 },
  { id: 'stone-2', x: -173, z: 234 },
  { id: 'stone-3', x: -191, z: 239 },
  { id: 'stone-4', x: -247, z: 234 },
  { id: 'stone-5', x: -263, z: 227 },
  { id: 'stone-6', x: -249, z: 143 },
  { id: 'stone-7', x: -169, z: 140 },
  { id: 'stone-8', x: -141, z: 218 },
];

export const CAVE: { id: string; name: string; x: number; z: number; radius: number } = {
  id: 'cave-echo',
  name: 'Echo Hollow',
  x: -352,
  z: 330,
  radius: 17,
};

/** Dirt roads between settlements — rendered as ribbons and tinted on terrain. */
export const ROADS: { points: Vec2[]; width: number }[] = [
  {
    points: [
      [96, 148],
      [60, 120],
      [30, 96],
      [18, 60],
      [0, 10],
      [-60, -10],
      [-120, -24],
      [-170, -40],
    ],
    width: 3.4,
  },
  {
    points: [
      [96, 148],
      [140, 190],
      [200, 230],
      [268, 268],
      [330, 300],
    ],
    width: 3.0,
  },
  {
    points: [
      [18, 60],
      [60, 30],
      [140, 20],
      [230, 30],
      [310, 40],
      [404, 46],
    ],
    width: 2.6,
  },
];

/** Forest masks make dense woodland patches instead of uniform trees. */
export const FOREST_GROVES: { x: number; z: number; r: number; strength: number }[] = [
  { x: -140, z: 200, r: 150, strength: 1 },
  { x: 180, z: 250, r: 130, strength: 0.9 },
  { x: -280, z: -120, r: 160, strength: 1 },
  { x: 210, z: -120, r: 120, strength: 0.75 },
  { x: -60, z: -250, r: 140, strength: 0.6 },
  { x: 120, z: 420, r: 180, strength: 0.85 },
  { x: -360, z: 100, r: 120, strength: 0.8 },
];
