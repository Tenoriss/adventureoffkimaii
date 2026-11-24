export interface ItemDef {
  id: string;
  name: string;
  /** Key of the inline SVG icon in ui/ItemIcon. */
  icon: string;
  description: string;
  /** Stack size; 0 = not stackable / key item. */
  maxStack: number;
  rarity: 'common' | 'fine' | 'rare' | 'key';
}

export const ITEMS: Record<string, ItemDef> = {
  sunleaf: {
    id: 'sunleaf',
    icon: 'sunleaf',
    name: 'Sunleaf',
    description: 'A warm-leafed herb that grows in bright clearings. Restores stamina when brewed.',
    maxStack: 12,
    rarity: 'common',
  },
  embercap: {
    id: 'embercap',
    icon: 'embercap',
    name: 'Embercap',
    description: 'A glowing mushroom from the deep woods. The herbalist pays well for these.',
    maxStack: 8,
    rarity: 'fine',
  },
  riverstone: {
    id: 'riverstone',
    icon: 'riverstone',
    name: 'Riverstone',
    description: 'A smooth blue stone worn by the current. Traders use them as tokens.',
    maxStack: 20,
    rarity: 'common',
  },
  waystone_shard: {
    id: 'waystone_shard',
    icon: 'waystone_shard',
    name: 'Waystone Shard',
    description: 'A humming splinter of rune-carved rock. It points toward something lost.',
    maxStack: 3,
    rarity: 'key',
  },
  trail_ration: {
    id: 'trail_ration',
    icon: 'trail_ration',
    name: 'Trail Ration',
    description: 'Dense bread and honey. Press H to eat and restore health.',
    maxStack: 5,
    rarity: 'common',
  },
  fishermans_lure: {
    id: 'fishermans_lure',
    icon: 'fishermans_lure',
    name: "Fisherman's Lure",
    description: 'A bright lure from Saltmarsh. Says the current carries more than fish.',
    maxStack: 1,
    rarity: 'fine',
  },
  horizon_compass: {
    id: 'horizon_compass',
    icon: 'horizon_compass',
    name: 'Horizon Compass',
    description: 'A brass compass that does not point north. The needle trembles toward the peaks.',
    maxStack: 1,
    rarity: 'key',
  },
};

export interface InventorySlot {
  id: string;
  qty: number;
}

export const INVENTORY_SIZE = 16;
