import { useGame } from '../game/store';
import { QUALITY_LEVELS, getPreset } from '../config/quality';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import type { QualityLevel } from '../config/quality';
import { Icon } from './Icon';
import { useT } from '../i18n';
import { LanguagePicker } from './MainMenu';
import { presetLabel } from '../i18n/content';

interface Props {
  onClose: () => void;
  embedded?: boolean;
}

const QUALITY_NOTE_KEYS = {
  verylow: 'set.verylowNote',
  low: 'set.lowNote',
  medium: 'set.mediumNote',
  high: 'set.highNote',
} as const satisfies Record<QualityLevel, string>;

export function SettingsPanel({ onClose, embedded }: Props) {
  const t = useT();
  const graphics = useGame((s) => s.graphics);
  const controls = useGame((s) => s.controls);
  const audio = useGame((s) => s.audio);
  const { setQuality, setGraphics, setControls, setAudio } = useGame.getState();
  const stats = useGame((s) => s.stats);
  const isTouch = useGame((s) => s.isTouch);
  const { game } = useEngine();

  const body = (
    <div className="panel-body">
      <div>
        <div className="section-label">{t('set.graphics')}</div>
        <div className="pill-row" role="radiogroup" aria-label={t('set.graphics')}>
          {QUALITY_LEVELS.map((level) => (
            <button
              key={level}
              role="radio"
              aria-checked={graphics.level === level}
              className={`pill${graphics.level === level ? ' active' : ''}`}
              onClick={() => {
                setQuality(level);
                bus.emit('playSfx', { name: 'ui' });
              }}
            >
              {presetLabel(level, getPreset(level).label)}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
          {t(QUALITY_NOTE_KEYS[graphics.level])}
        </div>
      </div>

      <div className="setting-row">
        <div>
          <div className="label">{t('set.adaptive')}</div>
          <div className="hint">{t('set.adaptiveHint')}</div>
        </div>
        <button
          className={`switch${graphics.auto ? ' on' : ''}`}
          role="switch"
          aria-checked={graphics.auto}
          aria-label={t('set.adaptive')}
          onClick={() => setGraphics({ auto: !graphics.auto })}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="label">{t('set.renderScale')}</div>
          <div className="hint">{t('set.renderScaleHint', { pct: Math.round(graphics.renderScale * 100) })}</div>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={Math.round(graphics.renderScale * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            setGraphics({ renderScale: v });
            game?.renderer.setRenderScale(v);
          }}
          aria-label={t('set.renderScale')}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="label">{t('set.showPerf')}</div>
          <div className="hint">{t('set.showPerfHint')}</div>
        </div>
        <button
          className={`switch${graphics.showFps ? ' on' : ''}`}
          role="switch"
          aria-checked={graphics.showFps}
          aria-label={t('set.showPerf')}
          onClick={() => setGraphics({ showFps: !graphics.showFps })}
        />
      </div>

      <div>
        <div className="section-label">{t('set.controls')}</div>
        <div className="setting-row">
          <div>
            <div className="label">{isTouch ? t('set.lookSens') : t('set.mouseSens')}</div>
            <div className="hint">{controls.sensitivity.toFixed(2)}×</div>
          </div>
          <input
            type="range"
            min={30}
            max={250}
            value={Math.round(controls.sensitivity * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setControls({ sensitivity: v });
              game?.input.setSensitivity(v);
            }}
            aria-label={t('set.lookSens')}
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="label">{t('set.invertY')}</div>
          </div>
          <button
            className={`switch${controls.invertY ? ' on' : ''}`}
            role="switch"
            aria-checked={controls.invertY}
            aria-label={t('set.invertY')}
            onClick={() => setControls({ invertY: !controls.invertY })}
          />
        </div>
        {isTouch && (
          <>
            <div className="setting-row">
              <div>
                <div className="label">{t('set.joystickSide')}</div>
                <div className="hint">{t('set.joystickHint')}</div>
              </div>
              <div className="pill-row">
                <button
                  className={`pill${controls.joystickSide === 'left' ? ' active' : ''}`}
                  onClick={() => setControls({ joystickSide: 'left' })}
                >
                  {t('set.left')}
                </button>
                <button
                  className={`pill${controls.joystickSide === 'right' ? ' active' : ''}`}
                  onClick={() => setControls({ joystickSide: 'right' })}
                >
                  {t('set.right')}
                </button>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">{t('set.haptics')}</div>
                <div className="hint">{t('set.hapticsHint')}</div>
              </div>
              <button
                className={`switch${controls.haptics ? ' on' : ''}`}
                role="switch"
                aria-checked={controls.haptics}
                aria-label={t('set.haptics')}
                onClick={() => setControls({ haptics: !controls.haptics })}
              />
            </div>
          </>
        )}
      </div>

      <div>
        <div className="section-label">{t('set.audio')}</div>
        {/* Audio sliders */}
        {(['master', 'music', 'sfx'] as const).map((key) => (
          <div className="setting-row" key={key}>
            <div>
              <div className="label" style={{ textTransform: 'capitalize' }}>
                {key === 'sfx' ? t('set.sfx') : key === 'music' ? t('set.music') : t('set.master')}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audio[key] * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setAudio({ [key]: v });
                game?.audio.setVolumes({ master: useGame.getState().audio.master, music: useGame.getState().audio.music, sfx: useGame.getState().audio.sfx, muted: useGame.getState().audio.muted });
              }}
              aria-label={`${key} volume`}
            />
          </div>
        ))}
        <div className="setting-row">
          <div>
            <div className="label">{t('set.mute')}</div>
          </div>
          <button
            className={`switch${audio.muted ? ' on' : ''}`}
            role="switch"
            aria-checked={audio.muted}
            aria-label={t('set.mute')}
            onClick={() => {
              const next = !audio.muted;
              setAudio({ muted: next });
              game?.audio.setVolumes({ muted: next });
            }}
          />
        </div>
      </div>

      <div>
        <div className="section-label">{t('set.language')}</div>
        <LanguagePicker compact />
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
          {t('set.languageHint')}
        </div>
      </div>

      <div>
        <div className="section-label">{t('set.system')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.7 }}>
          {stats.gpu && <div>GPU: {stats.gpu}</div>}
          <div>
            {t('set.systemLine', {
              level: presetLabel(graphics.level, getPreset(graphics.level).label),
              chunks: stats.chunks,
              draws: stats.drawCalls,
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="panel-backdrop" onClick={onClose} role="presentation">
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('set.title')}>
        <div className="panel-head">
          <h2>{t('set.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('set.title')}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
