import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { detectDevice, getPreset } from '../config/quality';
import { readSave, clearSave } from '../game/save';
import { SettingsPanel } from './SettingsPanel';
import { bus } from '../game/bus';
import { Icon } from './Icon';
import { useT, useLang, setLang, LANGUAGES } from '../i18n';
import { presetLabel } from '../i18n/content';
import type { TKey } from '../i18n/ui';

const TIP_KEYS: TKey[] = [
  'menu.tip1',
  'menu.tip2',
  'menu.tip3',
  'menu.tip4',
  'menu.tip5',
  'menu.tip6',
  'menu.tip7',
];

export function MainMenu() {
  const t = useT();
  const hasSave = useGame((s) => s.hasSave);
  const stats = useGame((s) => s.stats);
  const setScreen = useGame((s) => s.setScreen);
  const set = useGame((s) => s.set);
  const [showSettings, setShowSettings] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [tip, setTip] = useState(0);
  const device = useMemo(() => detectDevice(), []);
  const quality = useGame((s) => s.graphics.level);
  const preset = getPreset(quality);

  useEffect(() => {
    const id = window.setInterval(() => setTip((n) => (n + 1) % TIP_KEYS.length), 7000);
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
      // Forgetting this would keep every herb, cache and stone invisible in a
      // brand new world.
      collected: [],
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

  const deviceLabel = device.isMobile
    ? t('menu.device.phone')
    : device.isTablet
      ? t('menu.device.tablet')
      : t('menu.device.desktop');
  const gpuLabel = tidyGpu(device.gpu);

  return (
    <div className="menu-screen">
      <div className="menu-inner">
        <div className="title-block">
          <div className="title-eyebrow">{t('menu.eyebrow')}</div>
          <h1 className="game-title">LOST HORIZON</h1>
          <div className="title-rule" />
          <p className="title-sub">{t('menu.subtitle')}</p>
        </div>

        <div className="device-badge">
          <span>{deviceLabel}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{t('menu.preset', { level: presetLabel(preset.level, preset.label) })}</span>
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
              {t('menu.continue')}
              <span className="sub">{t('menu.continueSub')}</span>
            </button>
          )}
          <button className={`menu-btn${hasSave ? '' : ' main'}`} onClick={startNew}>
            {hasSave ? t('menu.new') : t('menu.newMain')}
            <span className="sub">{hasSave ? t('menu.newSub') : t('menu.newMainSub')}</span>
          </button>
          <button className="menu-btn" onClick={() => setShowSettings(true)}>
            {t('menu.settings')}
            <span className="sub">{t('menu.settingsSub')}</span>
          </button>
          <button className="menu-btn" onClick={() => setShowLanguage(true)}>
            {t('menu.language')}
            <span className="sub">{t('menu.languageSub')}</span>
          </button>
        </div>

        <div className="menu-foot">
          <div>{t(TIP_KEYS[tip])}</div>
          <div style={{ marginTop: 10 }}>
            {device.isTouch ? t('menu.touchOn') : t('menu.keysHint')} ·{' '}
            {t('menu.preset', { level: presetLabel(stats.quality, getPreset(stats.quality).label) })}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="panel-backdrop" onClick={() => setShowSettings(false)} role="presentation">
          <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('set.title')}>
            <div className="panel-head">
              <h2>{t('set.title')}</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label={t('set.title')}>
                ✕
              </button>
            </div>
            <SettingsPanel onClose={() => setShowSettings(false)} embedded />
          </div>
        </div>
      )}

      {showLanguage && (
        <div className="panel-backdrop" onClick={() => setShowLanguage(false)} role="presentation">
          <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('menu.language')}>
            <div className="panel-head">
              <h2>{t('menu.language')}</h2>
              <button className="icon-btn" onClick={() => setShowLanguage(false)} aria-label={t('menu.language')}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              <LanguagePicker />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Two large, obvious language buttons (also used inside Settings). */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <div>
      <div className="pill-row" role="radiogroup" aria-label={t('set.language')}>
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={lang === l.id}
            className={`pill${lang === l.id ? ' active' : ''}`}
            onClick={() => {
              setLang(l.id);
              bus.emit('playSfx', { name: 'ui' });
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      {!compact && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
          {t('set.languageHint')}
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
  const t = useT();
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
    // Engine-side resume plus the screen flip: emitting only `lh:resume` left
    // `screen === 'paused'`, so tapping the backdrop did nothing visible.
    window.dispatchEvent(new CustomEvent('lh:resume-ui'));
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
        aria-label={t('pause.title')}
        style={{ width: 'min(640px, 100%)' }}
      >
        <div className="panel-head">
          <div>
            <h2>{t('pause.title')}</h2>
            <div className="sub">
              {t('pause.summary', { active, done: completed, items, places: discovered.length })}
            </div>
          </div>
          <button className="icon-btn" onClick={resume} aria-label={t('pause.resume')}>
            <Icon name="play" size={16} />
          </button>
        </div>
        <div className="panel-body">
          {tab === 'menu' && (
            <>
              <div className="pause-grid">
                <button className="pause-tile" onClick={resume}>
                  <span className="title">{t('pause.resume')}</span>
                  <span className="sub">{t('pause.resumeSub')}</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    set({ inventoryOpen: true, questLogOpen: false });
                  }}
                >
                  <span className="title">{t('pause.satchel')}</span>
                  <span className="sub">{t('pause.items', { n: items })}</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    set({ questLogOpen: true, inventoryOpen: false });
                  }}
                >
                  <span className="title">{t('pause.journal')}</span>
                  <span className="sub">{t('pause.journalSub', { active, done: completed })}</span>
                </button>
                <button className="pause-tile" onClick={() => setTab('settings')}>
                  <span className="title">{t('pause.settings')}</span>
                  <span className="sub">{t('pause.settingsSub')}</span>
                </button>
                <button className="pause-tile" onClick={() => setTab('controls')}>
                  <span className="title">{t('pause.controls')}</span>
                  <span className="sub">{t('pause.controlsSub')}</span>
                </button>
                <button
                  className="pause-tile"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('lh:save'));
                    useGame.getState().pushToast({ text: t('pause.savedToast'), kind: 'info' });
                  }}
                >
                  <span className="title">{t('pause.save')}</span>
                  <span className="sub">{t('pause.saveSub')}</span>
                </button>
              </div>
              <div style={{ marginTop: 4 }}>
                <button
                  className="btn ghost danger"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('lh:quit'));
                  }}
                >
                  {t('pause.quit')}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                {t('pause.footer', { health: Math.round(health) })}
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
  const t = useT();
  const isTouch = useGame((s) => s.isTouch);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="section-label">{t('controls.kbm')}</div>
        <div className="controls-grid">
          <div className="control-row">
            <span>{t('controls.move')}</span>
            <span className="control-keys">
              <span className="key-cap">W</span>
              <span className="key-cap">A</span>
              <span className="key-cap">S</span>
              <span className="key-cap">D</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.camera')}</span>
            <span className="control-keys">
              <span className="key-cap">Mouse</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.sprint')}</span>
            <span className="control-keys">
              <span className="key-cap">Shift</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.jump')}</span>
            <span className="control-keys">
              <span className="key-cap">Space</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.interact')}</span>
            <span className="control-keys">
              <span className="key-cap">E</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.satchel')}</span>
            <span className="control-keys">
              <span className="key-cap">I</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.journal')}</span>
            <span className="control-keys">
              <span className="key-cap">J</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.map')}</span>
            <span className="control-keys">
              <span className="key-cap">M</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.eat')}</span>
            <span className="control-keys">
              <span className="key-cap">H</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.resetCam')}</span>
            <span className="control-keys">
              <span className="key-cap">R</span>
            </span>
          </div>
          <div className="control-row">
            <span>{t('controls.pause')}</span>
            <span className="control-keys">
              <span className="key-cap">Esc</span>
            </span>
          </div>
        </div>
      </div>
      {isTouch && (
        <div>
          <div className="section-label">{t('controls.touch')}</div>
          <div className="controls-grid">
            <div className="control-row">
              <span>{t('controls.move')}</span>
              <span className="key-cap touch">{t('controls.leftStick')}</span>
            </div>
            <div className="control-row">
              <span>{t('controls.look')}</span>
              <span className="key-cap touch">{t('controls.swipe')}</span>
            </div>
            <div className="control-row">
              <span>{t('controls.jump')}</span>
              <span className="key-cap touch">⤒</span>
            </div>
            <div className="control-row">
              <span>{t('controls.sprint')}</span>
              <span className="key-cap touch">»</span>
            </div>
            <div className="control-row">
              <span>{t('controls.interact')}</span>
              <span className="key-cap touch">✋</span>
            </div>
          </div>
        </div>
      )}
      <div>
        <div className="section-label">{t('controls.gamepad')}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.7 }}>{t('controls.gamepadBody')}</div>
      </div>
      <button className="btn ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        {t('controls.back')}
      </button>
    </div>
  );
}
