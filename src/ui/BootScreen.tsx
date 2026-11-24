import { useEffect, useState } from 'react';
import { useGame } from '../game/store';

const STEPS = [
  'Mapping the valley…',
  'Raising the mountains…',
  'Planting the forests…',
  'Lighting the waystones…',
  'Waking the villagers…',
  'Opening the horizon…',
];

export function BootScreen({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const [step, setStep] = useState(0);
  const bootProgress = useGame((s) => s.bootProgress);

  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const id = window.setTimeout(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 420);
    return () => window.clearTimeout(id);
  }, [step]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(onDone, 520);
    return () => window.clearTimeout(id);
  }, [ready, onDone]);

  const pct = Math.max((step / (STEPS.length - 1)) * 100, bootProgress);

  return (
    <div className="boot-screen">
      <div className="boot-inner">
        <div className="boot-mark">◈</div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 200,
            letterSpacing: '0.3em',
            marginLeft: '0.3em',
            color: '#f2e6cf',
          }}
        >
          LOST HORIZON
        </h1>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="boot-label">{ready ? 'Ready.' : STEPS[step]}</div>
        <div className="boot-tip">
          Tip: the game saves automatically. Close the tab whenever you like — your last position, quests and satchel
          will be waiting.
        </div>
      </div>
    </div>
  );
}
