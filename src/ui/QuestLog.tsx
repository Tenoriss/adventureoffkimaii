import { useGame } from '../game/store';
import { QUESTS } from '../game/quests';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import { Icon } from './Icon';

export function QuestLog() {
  const open = useGame((s) => s.questLogOpen);
  const quests = useGame((s) => s.quests);
  const tracked = useGame((s) => s.trackedQuest);
  const set = useGame((s) => s.set);
  const discovered = useGame((s) => s.discovered);
  const { game } = useEngine();

  if (!open) return null;

  const close = () => {
    set({ questLogOpen: false });
    if (game) game.setPaused(false);
    bus.emit('playSfx', { name: 'close' });
  };

  const visible = QUESTS.filter((q) => {
    const state = quests[q.id];
    if (state) return true;
    const reqs = q.requires ?? [];
    return reqs.every((r) => quests[r]?.status === 'complete');
  });
  const active = visible.filter((q) => quests[q.id]?.status === 'active');
  const done = visible.filter((q) => quests[q.id]?.status === 'complete');
  const locked = QUESTS.filter((q) => !visible.includes(q));

  return (
    <div className="panel-backdrop" onClick={close} role="presentation">
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quest log">
        <div className="panel-head">
          <div>
            <h2>Journal</h2>
            <div className="sub">
              {active.length} {active.length === 1 ? 'quest' : 'quests'} active · {done.length} complete ·{' '}
              {discovered.length} {discovered.length === 1 ? 'place' : 'places'} discovered
            </div>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close journal">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="panel-body">
          {visible.length === 0 && (
            <div className="empty-note">Speak with Mira in Emberfall to begin your journey.</div>
          )}

          {active.map((q) => {
            const state = quests[q.id];
            const isTracked = tracked === q.id;
            return (
              <div key={q.id} className={`quest-card${isTracked ? ' tracked' : ''}`}>
                <h3>
                  <span>{q.title}</span>
                  {q.finalQuest && <span className="tag" style={{ marginTop: 0 }}>Final</span>}
                </h3>
                <div className="giver">{q.giver}</div>
                <div className="summary">{q.summary}</div>
                <ul className="objectives">
                  {q.objectives.map((obj, i) => {
                    const doneObj = i < state.progress;
                    const current = i === state.progress;
                    return (
                      <li key={obj.text} className={doneObj ? 'done' : current ? 'current' : ''}>
                        <span className="obj-marker" aria-hidden>
                          {doneObj ? '✔' : current ? '▸' : '·'}
                        </span>
                        <span>
                          {obj.text}
                          {current && obj.hint && (
                            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{obj.hint}</div>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="quest-actions">
                  <button
                    className={`chip-btn${isTracked ? ' active' : ''}`}
                    onClick={() => {
                      set({ trackedQuest: q.id });
                      bus.emit('playSfx', { name: 'ui' });
                    }}
                  >
                    {isTracked ? '◉ Tracking' : 'Track this quest'}
                  </button>
                </div>
              </div>
            );
          })}

          {done.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 6 }}>
                Completed
              </div>
              {done.map((q) => (
                <div key={q.id} className="quest-card done">
                  <h3>
                    <span>{q.title}</span>
                    <span style={{ color: 'var(--success)', fontSize: 13 }}>✔</span>
                  </h3>
                  <div className="giver">{q.giver}</div>
                </div>
              ))}
            </>
          )}

          {locked.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 6 }}>
                Rumours
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
                {locked.length} more stor{locked.length === 1 ? 'y' : 'ies'} wait in the valley. Keep talking to
                people and the road will open.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
