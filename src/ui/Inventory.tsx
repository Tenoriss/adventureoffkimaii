import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { INVENTORY_SIZE, ITEMS } from '../config/items';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';

export function Inventory() {
  const open = useGame((s) => s.inventoryOpen);
  const inventory = useGame((s) => s.inventory);
  const set = useGame((s) => s.set);
  const { game } = useEngine();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open && inventory.length > 0 && !selected) setSelected(inventory[0].id);
  }, [open, inventory, selected]);

  if (!open) return null;

  const close = () => {
    set({ inventoryOpen: false });
    if (game) game.setPaused(false);
    bus.emit('playSfx', { name: 'close' });
  };

  const slots: ({ id: string; qty: number } | null)[] = Array.from({ length: INVENTORY_SIZE }, (_, i) => inventory[i] ?? null);
  const selectedDef = selected ? ITEMS[selected] : null;

  const useItem = () => {
    if (!selected) return;
    const ctrl = game?.dialogueController;
    const msg = ctrl?.useConsumable(selected) ?? null;
    if (msg) {
      useGame.getState().pushToast({ text: msg, kind: 'heal' });
      bus.emit('playSfx', { name: 'heal' });
      if (useGame.getState().countItem(selected) === 0) setSelected(null);
    } else {
      useGame.getState().pushToast({ text: 'That cannot be used right now.', kind: 'info' });
    }
  };

  return (
    <div className="panel-backdrop" onClick={close} role="presentation">
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Inventory">
        <div className="panel-head">
          <div>
            <h2>Satchel</h2>
            <div className="sub">
              {inventory.reduce((n, s) => n + s.qty, 0)} items · {inventory.length}/{INVENTORY_SIZE} slots
            </div>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close inventory">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="panel-body">
          {inventory.length === 0 && (
            <div className="empty-note">
              Your satchel is empty.
              <br />
              Gather sunleaf in the meadows or open a cache to fill it.
            </div>
          )}
          <div className="inv-grid">
            {slots.map((slot, i) => {
              if (!slot) {
                return <div key={`empty-${i}`} className="inv-slot" aria-hidden />;
              }
              const def = ITEMS[slot.id];
              return (
                <button
                  key={slot.id}
                  className={`inv-slot filled${selected === slot.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelected(slot.id);
                    bus.emit('playSfx', { name: 'ui' });
                  }}
                  aria-label={`${def?.name ?? slot.id}, ${slot.qty}`}
                >
                  <ItemIcon id={slot.id} size={30} />
                  {def && def.rarity !== 'common' && <span className={`inv-rare ${def.rarity}`} />}
                  {slot.qty > 1 && <span className="inv-qty">{slot.qty}</span>}
                </button>
              );
            })}
          </div>

          <div className="item-detail">
            {selectedDef ? (
              <>
                <div className="big-icon" aria-hidden>
                  <ItemIcon id={selectedDef.id} size={40} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3>{selectedDef.name}</h3>
                  <p>{selectedDef.description}</p>
                  <span className="tag">{selectedDef.rarity}</span>
                  {(selected === 'trail_ration' || selected === 'sunleaf') && (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn primary" onClick={useItem} style={{ minHeight: 38, padding: '8px 16px' }}>
                        Use item
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--ink-faint)', fontSize: 12.5, alignSelf: 'center' }}>
                Select an item to inspect it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
