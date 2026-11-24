import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { useT } from '../i18n';
import type { TKey } from '../i18n/ui';

const STEP_KEYS: TKey[] = [
  'boot.step1',
  'boot.step2',
  'boot.step3',
  'boot.step4',
  'boot.step5',
  'boot.step6',
];

export function BootScreen({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const STEPS = STEP_KEYS;
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
        <div className="boot-label">{ready ? t('boot.ready') : t(STEPS[step])}</div>
        <div className="boot-tip">{t('boot.tip')}</div>
      </div>
    </div>
  );
}
