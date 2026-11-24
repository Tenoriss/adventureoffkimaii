import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { detectDevice, getPreset } from '../config/quality';
import { readSave, clearSave } from '../game/save';
import { SettingsPanel } from './SettingsPanel';
import { bus } from '../game/bus';
import { Icon } from './Icon';

const TIPS = [
  'Sprint drains stamina — let it refill on flat ground before you climb.',
  'Time only passes while you play. Rest at a campfire to skip ahead.',
  'The compass at the top of your HUD points at your tracked objective.',
  'Waystones mark the land. Touch one to wake it.',
  'Caches in the wild hold rations, embercaps and riverstones.',
  'Deep water drains stamina. Do not swim when you are exhausted.',
  'Every device gets its own graphics preset — change it any time in Settings.',
];

export function MainMenu() {
  const hasSave = useGame((s) => s.hasSave);
  const stats = useGame((s) => s.stats);
  const setScreen = useGame((s) => s.setScreen);
  const set = useGame((s) => s.set);
  const [showSettings, setShowSettings] = useState(false);
  const [tip, setTip] = useState(0);
  const device = useMemo(() => detectDevice(), []);
  const quality = useGame((s) => s.graphics.level);
  const preset = getPreset(quality);

  useEffect(() => {
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 7000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const save = readSave();
    if (save) set({ hasSave: true });
  }, [set]);

  const startNew = () => {
    clearSave();
    set({
      hasSave: false,
      inventory: [],
      quests: {},
      flags: {},
      discovered: [],
      health: 100,
      stamina: 100,
      timeOfDay: 8.4,
      day: 1,
      trackedQuest: 'q1_first_steps',
    });
    setScreen('playing');
    set({ started: true });
  };

  const continueGame = () => {
    setScreen('playing');
    set({ started: true });
  };

  const deviceLabel = device.isMobile ? 'Phone' : device.isTablet ? 'Tablet' : 'Desktop';
  const gpuLabel = tidyGpu(device.gpu);

  return (
    <div className="menu-screen">
      <div className="menu-inner">
        <div className="title-block">
          <div className="title-eyebrow">An open world in your browser</div>
          <h1 className="game-title">LOST HORIZON</h1>
          <div className="title-rule" />
          <p className="title-sub">
            A quiet valley, three sleeping waystones, and a horizon that has been lost for forty years.
          </p>
        </div>

        <div className="device-badge">
          <span>{deviceLabel}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>
            <strong>{preset.label}</strong> graphics
          </span>
          {device.gpu !== 'unknown' && (
            <>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={device.gpu}>
                {gpuLabel}
              </span>
            </>
          )}
        </div>

        <div className="menu-actions">
          {hasSave && (
            <button className="menu-btn main" onClick={continueGame}>
              Continue
              <span className="sub">Pick up where you left off</span>
            </button>
          )}
          <button className={`menu-btn${hasSave ? '' : ' main'}`} onClick={startNew}>
            {hasSave ? 'New journey' : 'Begin the journey'}
            <span className="sub">{hasSave ? 'Reset the world and start over' : 'Start in the village of Emberfall'}</span>
          </button>
          <button className="menu-btn" onClick={() => setShowSettings(true)}>
            Settings
            <span className="sub">Graphics, controls and audio</span>
          </button>
        </div>

        <div className="menu-foot">
          <div>{TIPS[tip]}</div>
          <div style={{ marginTop: 10 }}>
            {device.isTouch ? 'Touch controls enabled' : 'WASD · Mouse · Shift · Space · E · ESC'} · {stats.quality} preset
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="panel-backdrop" onClick={() => setShowSettings(false)} role="presentation">
          <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
            <div className="panel-head">
              <h2>Settings</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Close settings">
                ✕
              </button>
            </div>
            <SettingsPanel onClose={() => setShowSettings(false)} embedded />
          </div>
        </div>
      )}
    </div>
  );
}

/** Turns "ANGLE (NVIDIA, GeForce RTX 3060 (0x0000))" into "GeForce RTX 3060". */
function tidyGpu(raw: string): string {
  if (!raw || raw === 'unknown') return 'GPU unknown';
  if (/swiftshader|llvmpipe|software/i.test(raw)) return 'Software renderer';
  const cleaned = raw.replace(/ANGLE \(|\)$/g, '').replace(/Direct3D.*$/i, '');
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  const named = parts.find((p) => /geforce|radeon|apple|intel|adreno|mali|arc/i.test(p));
  return (named ?? parts[parts.length - 1] ?? 'GPU').replace(/\(0x[0-9a-f]+\)/i, '').trim();
}

export function PauseMenu() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const health = useGame((s) => s.health);
  const inventory = useGame((s) => s.inventory);
  const quests = useGame((s) => s.quests);
  const discovered = useGame((s) => s.discovered);
  const set = useGame((s) => s.set);
  const [tab, setTab] = useState<'menu' | 'settings' | 'controls'>('menu');

  if (screen !== 'paused') return null;

  const resume = () => {
    setScreen('playing');
    bus.emit('resume', undefined);
    window.dispatchEvent(new CustomEvent('lh:resume'));
    setTab('menu');
  };

  const completed = Object.values(quests).filter((q) => q.status === 'complete').length;
  const active = Object.values(quests).filter((q) => q.status === 'active').length;
  const items = inventory.reduce((n, s) => n + s.qty, 0);

  return (
    <div className="panel-backdrop" onClick={resume} role="presentation">
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Paused"
        style={{ width: 'min(640px, 100%)' }}
      >
        <div className="panel-head">
          <div>
            <h2>Paused</h2>
            <div className="sub">
              {active} active quest{active === 1 ? '' : 's'} · {completed} complete · {items} items · {discovered.length} places
            </div>
          </div>
          <button className="icon-btn" onClick={resume} aria-label="Resume">
            <Icon name="play" size={16} />
          </button>
        </div>
        <div className="panel-body">
          {tab === 'menu' && (
            <>
              <div className="pause-grid">
                <button className="pause-tile" onClick={resume}>
                  <span className="title">Resume</span>
                  <span className="sub">Back to the world</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    set({ inventoryOpen: true, questLogOpen: false });
                  }}
                >
                  <span className="title">Satchel</span>
                  <span className="sub">{items} items</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    set({ questLogOpen: true, inventoryOpen: false });
                  }}
                >
                  <span className="title">Journal</span>
                  <span className="sub">
                    {active} active / {completed} done
                  </span>
                </button>
                <button className="pause-tile" onClick={() => setTab('settings')}>
                  <span className="title">Settings</span>
                  <span className="sub">Graphics and audio</span>
                </button>
                <button className="pause-tile" onClick={() => setTab('controls')}>
                  <span className="title">Controls</span>
                  <span className="sub">Keyboard and touch</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('lh:save'));
                    useGame.getState().pushToast({ text: 'Progress saved', kind: 'info' });
                  }}
                >
                  <span className="title">Save now</span>
                  <span className="sub">Autosaves too</span>
                </button>
              </div>
              <div style={{ marginTop: 4 }}>
                <button
                  className="btn ghost danger"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('lh:quit'));
                  }}
                >
                  Save and return to title
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                Health {Math.round(health)} · progress autosaves every 20 seconds and when the tab closes.
              </div>
            </>
          )}
          {tab === 'settings' && <SettingsPanel onClose={() => setTab('menu')} embedded />}
          {tab === 'controls' && <ControlsHelp onBack={() => setTab('menu')} />}
        </div>
      </div>
    </div>
  );
}

function ControlsHelp({ onBack }: { onBack: () => void }) {
  const isTouch = useGame((s) => s.isTouch);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="section-label">Keyboard and mouse</div>
        <div className="controls-grid">
          <div className="control-row">
            <span>Move</span>
            <span className="control-keys">
              <span className="key-cap">W</span>
              <span className="key-cap">A</span>
              <span className="key-cap">S</span>
              <span className="key-cap">D</span>
            </span>
          </div>
          <div className="control-row">
            <span>Camera</span>
            <span className="control-keys">
              <span className="key-cap">Mouse</span>
            </span>
          </div>
          <div className="control-row">
            <span>Sprint</span>
            <span className="control-keys">
              <span className="key-cap">Shift</span>
            </span>
          </div>
          <div className="control-row">
            <span>Jump</span>
            <span className="control-keys">
              <span className="key-cap">Space</span>
            </span>
          </div>
          <div className="control-row">
            <span>Interact</span>
            <span className="control-keys">
              <span className="key-cap">E</span>
            </span>
          </div>
          <div className="control-row">
            <span>Satchel</span>
            <span className="control-keys">
              <span className="key-cap">I</span>
            </span>
          </div>
          <div className="control-row">
            <span>Journal</span>
            <span className="control-keys">
              <span className="key-cap">J</span>
            </span>
          </div>
          <div className="control-row">
            <span>Map</span>
            <span className="control-keys">
              <span className="key-cap">M</span>
            </span>
          </div>
          <div className="control-row">
            <span>Eat / heal</span>
            <span className="control-keys">
              <span className="key-cap">H</span>
            </span>
          </div>
          <div className="control-row">
            <span>Reset camera</span>
            <span className="control-keys">
              <span className="key-cap">R</span>
            </span>
          </div>
          <div className="control-row">
            <span>Pause</span>
            <span className="control-keys">
              <span className="key-cap">Esc</span>
            </span>
          </div>
        </div>
      </div>
      {isTouch && (
        <div>
          <div className="section-label">Touch</div>
          <div className="controls-grid">
            <div className="control-row">
              <span>Move</span>
              <span className="key-cap touch">Left stick</span>
            </div>
            <div className="control-row">
              <span>Look around</span>
              <span className="key-cap touch">Swipe</span>
            </div>
            <div className="control-row">
              <span>Jump</span>
              <span className="key-cap touch">⤒</span>
            </div>
            <div className="control-row">
              <span>Sprint</span>
              <span className="key-cap touch">»</span>
            </div>
            <div className="control-row">
              <span>Interact</span>
              <span className="key-cap touch">✋</span>
            </div>
          </div>
        </div>
      )}
      <div>
        <div className="section-label">Controller</div>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.7 }}>
          Gamepads work out of the box: left stick to move, right stick for the camera, A to jump, X to interact, Y for
          the satchel, LB to sprint, Start to pause.
        </div>
      </div>
      <button className="btn ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
    </div>
  );
}
