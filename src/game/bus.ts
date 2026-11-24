/** Tiny typed event bus used to decouple the engine from React UI. */
type Handler<T> = (payload: T) => void;

class Bus<Events extends object> {
  private map = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      set!.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.map.clear();
  }
}

export interface GameEvents {
  interactAvailable: { label: string } | null;
  dialogueStart: { npcId: string; nodeId: string };
  dialogueEnd: void;
  toast: { text: string; kind: 'info' | 'item' | 'quest' | 'damage' | 'heal'; icon?: string };
  questUpdated: { questId: string };
  playerDamaged: { amount: number };
  playerHealed: { amount: number };
  itemCollected: { itemId: string; qty: number };
  areaDiscovered: { name: string };
  waystoneActivated: { name: string };
  requestSave: void;
  playSfx: { name: string; volume?: number };
  pause: void;
  resume: void;
  qualityChanged: void;
  volumesChanged: void;
  dialogueEnded: void;
}

export const bus = new Bus<GameEvents>();
