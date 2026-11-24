import { useGame } from '../game/store';
import { QUALITY_LEVELS, getPreset } from '../config/quality';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import type { QualityLevel } from '../config/quality';
import { Icon } from './Icon';

interface Props {
  onClose: () => void;
  embedded?: boolean;
}

const QUALITY_NOTES: Record<QualityLevel, string> = {
  verylow: 'Low-end phones and old laptops. No shadows, short view distance.',
  low: 'Entry-level laptops and phones. Simple shadows, moderate distance.',
  medium: 'Modern phones and standard laptops. Better shadows and detail.',
  high: 'Gaming laptops and desktops. Long draw distance and full detail.',
};

export function SettingsPanel({ onClose, embedded }: Props) {
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
        <div className="section-label">Graphics</div>
        <div className="pill-row" role="radiogroup" aria-label="Graphics quality">
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
              {getPreset(level).label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
          {QUALITY_NOTES[graphics.level]}
        </div>
      </div>

      <div className="setting-row">
        <div>
          <div className="label">Adaptive quality</div>
          <div className="hint">
            Automatically lowers detail if the frame rate drops. Turn off to lock your chosen preset.
          </div>
        </div>
        <button
          className={`switch${graphics.auto ? ' on' : ''}`}
          role="switch"
          aria-checked={graphics.auto}
          aria-label="Adaptive quality"
          onClick={() => setGraphics({ auto: !graphics.auto })}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="label">Render scale</div>
          <div className="hint">Lower means sharper performance, blurrier image. Currently {Math.round(graphics.renderScale * 100)}%.</div>
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
          aria-label="Render scale"
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="label">Show performance</div>
          <div className="hint">Frame rate, draw calls and triangle counts.</div>
        </div>
        <button
          className={`switch${graphics.showFps ? ' on' : ''}`}
          role="switch"
          aria-checked={graphics.showFps}
          aria-label="Show performance stats"
          onClick={() => setGraphics({ showFps: !graphics.showFps })}
        />
      </div>

      <div>
        <div className="section-label">Controls</div>
        <div className="setting-row">
          <div>
            <div className="label">{isTouch ? 'Look sensitivity' : 'Mouse sensitivity'}</div>
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
            aria-label="Look sensitivity"
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="label">Invert vertical look</div>
          </div>
          <button
            className={`switch${controls.invertY ? ' on' : ''}`}
            role="switch"
            aria-checked={controls.invertY}
            aria-label="Invert vertical look"
            onClick={() => setControls({ invertY: !controls.invertY })}
          />
        </div>
        {isTouch && (
          <>
            <div className="setting-row">
              <div>
                <div className="label">Joystick side</div>
                <div className="hint">Left-handed layout moves the stick to the right.</div>
              </div>
              <div className="pill-row">
                <button
                  className={`pill${controls.joystickSide === 'left' ? ' active' : ''}`}
                  onClick={() => setControls({ joystickSide: 'left' })}
                >
                  Left
                </button>
                <button
                  className={`pill${controls.joystickSide === 'right' ? ' active' : ''}`}
                  onClick={() => setControls({ joystickSide: 'right' })}
                >
                  Right
                </button>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="label">Haptic feedback</div>
                <div className="hint">Short vibrations on jumps and interactions.</div>
              </div>
              <button
                className={`switch${controls.haptics ? ' on' : ''}`}
                role="switch"
                aria-checked={controls.haptics}
                aria-label="Haptic feedback"
                onClick={() => setControls({ haptics: !controls.haptics })}
              />
            </div>
          </>
        )}
      </div>

      <div>
        <div className="section-label">Audio</div>
        {/* Audio sliders */}
        {(['master', 'music', 'sfx'] as const).map((key) => (
          <div className="setting-row" key={key}>
            <div>
              <div className="label" style={{ textTransform: 'capitalize' }}>
                {key === 'sfx' ? 'Effects' : key}
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
            <div className="label">Mute all</div>
          </div>
          <button
            className={`switch${audio.muted ? ' on' : ''}`}
            role="switch"
            aria-checked={audio.muted}
            aria-label="Mute all audio"
            onClick={() => {
              const next = !audio.muted;
              setAudio({ muted: next });
              game?.audio.setVolumes({ muted: next });
            }}
          />
        </div>
      </div>

      <div>
        <div className="section-label">System</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.7 }}>
          {stats.gpu && <div>GPU: {stats.gpu}</div>}
          <div>
            Quality: {getPreset(graphics.level).label} · chunks {stats.chunks} · draw calls {stats.drawCalls}
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="panel-backdrop" onClick={onClose} role="presentation">
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="panel-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <Icon name="close" size={16} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
