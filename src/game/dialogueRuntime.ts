import { useGame } from './store';
import { DIALOGUE, NPC_MAP, resolveEntry, type DlgCtx } from './dialogue';
import type { DialogueAction, DialogueNode } from './types';
import { bus } from './bus';
import { ITEMS } from '../config/items';
import { POWER_UPS, type PowerupKind } from './powerups';

export interface DialogueRuntimeState {
  npcId: string;
  nodeId: string;
  lineIndex: number;
  typing: boolean;
}

/**
 * Bridges dialogue trees to the game store. The React UI only renders;
 * all state transitions happen here so quest logic stays in one place.
 */
export class DialogueController {
  private ctx: DlgCtx;

  constructor(private onChange: () => void) {
    this.ctx = {
      quest: (id) => useGame.getState().quests[id],
      isComplete: (id) => useGame.getState().quests[id]?.status === 'complete',
      isActive: (id) => useGame.getState().quests[id]?.status === 'active',
      countItem: (id) => useGame.getState().countItem(id),
      flag: (key) => !!useGame.getState().flags[key],
      hasFlag: (key) => !!useGame.getState().flags[key],
    };
  }

  currentNode(state: DialogueRuntimeState): DialogueNode | null {
    return DIALOGUE[state.nodeId] ?? null;
  }

  start(npcId: string): DialogueRuntimeState {
    const npc = NPC_MAP[npcId];
    const nodeId = npc ? resolveEntry(npcId, this.ctx) : 'mira_start';
    return { npcId, nodeId, lineIndex: 0, typing: true };
  }

  advance(state: DialogueRuntimeState): DialogueRuntimeState | null {
    const node = this.currentNode(state);
    if (!node) return null;
    if (state.lineIndex < node.lines.length - 1) {
      return { ...state, lineIndex: state.lineIndex + 1, typing: true };
    }
    if (node.next) {
      return { ...state, nodeId: node.next, lineIndex: 0, typing: true };
    }
    return null;
  }

  /** Returns the next state, or null when the conversation ends. */
  choose(state: DialogueRuntimeState, optionIndex: number): DialogueRuntimeState | null {
    const node = this.currentNode(state);
    const option = node?.options?.[optionIndex];
    if (!option) return null;
    if (option.action) {
      this.applyAction(option.action);
      if (option.action.type === 'close') return null;
    }
    if (option.next) {
      return { ...state, nodeId: option.next, lineIndex: 0, typing: true };
    }
    if (option.action) return null;
    return null;
  }

  private applyAction(action: DialogueAction): void {
    // Read the freshest state: a quest accepted mid-conversation must not be
    // re-accepted by the next line of the same tree.
    const store = () => useGame.getState();
    switch (action.type) {
      case 'giveQuest': {
        const quest = action.questId;
        const state = store().quests[quest];
        if (!state || state.status === 'locked') {
          store().startQuest(quest);
          bus.emit('playSfx', { name: 'quest' });
          store().pushToast({ text: 'New quest accepted', kind: 'quest' });
        }
        break;
      }
      case 'openQuest': {
        store().startQuest(action.questId);
        break;
      }
      case 'completeQuest': {
        if (store().quests[action.questId]?.status !== 'complete') {
          store().completeQuest(action.questId);
          store().pushToast({ text: 'Quest complete', kind: 'quest' });
          bus.emit('playSfx', { name: 'quest' });
        }
        break;
      }
      case 'giveItem': {
        const def = ITEMS[action.itemId];
        if (store().addItem(action.itemId, action.qty) && def) {
          store().pushToast({ text: `${def.name} received`, kind: 'item', icon: def.icon });
          bus.emit('playSfx', { name: 'pickup' });
        }
        break;
      }
      case 'takeItem': {
        store().removeItem(action.itemId, action.qty);
        break;
      }
      case 'setFlag': {
        store().setFlag(action.key, action.value);
        break;
      }
      case 'reveal': {
        store().pushToast({ text: 'Location marked on your map', kind: 'info' });
        break;
      }
      case 'trade': {
        if (store().countItem(action.give) >= 2) {
          store().removeItem(action.give, 2);
          const def = ITEMS[action.take];
          if (store().addItem(action.take, 1) && def) {
            store().pushToast({ text: `${def.name} traded`, kind: 'item', icon: def.icon });
            bus.emit('playSfx', { name: 'pickup' });
          }
        } else {
          store().pushToast({ text: 'Pell needs 2 Embercaps for that', kind: 'info', icon: 'embercap' });
        }
        break;
      }
      case 'turnIn': {
        if (action.itemId) store().removeItem(action.itemId, action.qty ?? 1);
        if (store().quests[action.questId]?.status !== 'complete') {
          store().completeQuest(action.questId);
          store().pushToast({ text: 'Quest complete', kind: 'quest' });
          bus.emit('playSfx', { name: 'quest' });
        }
        break;
      }
      case 'openShop':
      case 'close':
      default:
        break;
    }
    this.onChange();
  }

  /** Applies a consumable and returns a toast string. */
  useConsumable(itemId: string): string | null {
    const store = useGame.getState();
    if (itemId === 'trail_ration') {
      if (store.countItem('trail_ration') <= 0) return null;
      store.removeItem('trail_ration', 1);
      store.heal(30);
      bus.emit('playSfx', { name: 'heal' });
      return 'Ate a trail ration (+30 health)';
    }
    if (itemId === 'sunleaf') {
      if (store.countItem('sunleaf') <= 0) return null;
      store.removeItem('sunleaf', 1);
      store.setStamina(store.maxStamina);
      bus.emit('playSfx', { name: 'heal' });
      return 'Chewed sunleaf (stamina restored)';
    }
    return null;
  }

  applyPowerup(kind: PowerupKind): string {
    const def = POWER_UPS[kind];
    const store = useGame.getState();
    if (kind === 'stamina') {
      store.setStamina(Math.min(store.maxStamina, store.stamina + def.amount));
    }
    return def.name;
  }
}
