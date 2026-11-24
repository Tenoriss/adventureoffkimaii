import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { useEngine } from './useGameEngine';
import { bus } from '../game/bus';
import { Icon } from './Icon';
import { useT } from '../i18n';

/**
 * Virtual joystick + camera swipe + action buttons.
 * All handlers write into `game.input.touch`, which the engine reads each frame.
 */
export function TouchControls() {
  const t = useT();
  const { game } = useEngine();
  const isTouch = useGame((s) => s.isTouch);
  const joystickSide = useGame((s) => s.controls.joystickSide);
  const interactLabel = useGame((s) => s.interactLabel);
  const dialogueOpen = useGame((s) => s.dialogueOpen);
  const anyPanel = useGame((s) => s.inventoryOpen || s.questLogOpen || s.mapOpen);
  const screen = useGame((s) => s.screen);
  const haptics = useGame((s) => s.controls.haptics);

  const knobRef = useRef<HTMLDivElement | null>(null);
  const joyRef = useRef<{ id: number; cx: number; cy: number } | null>(null);
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [sprintLatched, setSprintLatched] = useState(false);
  const hiddenRef = useRef(false);
  const [pressed, setPressed] = useState<string | null>(null);

  const vibrate = useCallback(
    (ms: number) => {
      if (!haptics) return;
      try {
        navigator.vibrate?.(ms);
      } catch {
        /* unsupported */
      }
    },
    [haptics],
  );

  // Keyboard access still drives touch buttons for consistency.
  useEffect(() => {
    if (!game) return;
    const enable = screen === 'playing' && !anyPanel;
    game.input.setEnabled(enable);
  }, [game, screen, anyPanel]);

  const onJoyStart = (e: React.PointerEvent) => {
    if (!game) return;
    const zone = e.currentTarget as HTMLElement;
    const rect = zone.getBoundingClientRect();
    joyRef.current = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    game.input.touch.active = true;
    zone.setPointerCapture(e.pointerId);
    moveKnob(e.clientX, e.clientY);
  };

  const moveKnob = (clientX: number, clientY: number) => {
    const joy = joyRef.current;
    if (!joy || !game) return;
    const max = 46;
    let dx = clientX - joy.cx;
    let dy = clientY - joy.cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / max;
    const ny = dy / max;
    game.input.touch.joyX = nx;
    game.input.touch.joyY = -ny;
  };

  const onJoyMove = (e: React.PointerEvent) => {
    if (!joyRef.current || joyRef.current.id !== e.pointerId) return;
    moveKnob(e.clientX, e.clientY);
  };

  const onJoyEnd = (e: React.PointerEvent) => {
    if (joyRef.current && joyRef.current.id !== e.pointerId) return;
    joyRef.current = null;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
    if (game) {
      game.input.touch.joyX = 0;
      game.input.touch.joyY = 0;
      game.input.touch.active = false;
    }
  };

  const onLookStart = (e: React.PointerEvent) => {
    if (!game) return;
    lookRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (!game || !lookRef.current || lookRef.current.id !== e.pointerId) return;
    const dx = e.clientX - lookRef.current.x;
    const dy = e.clientY - lookRef.current.y;
    lookRef.current.x = e.clientX;
    lookRef.current.y = e.clientY;
    const sens = 0.0038 * useGame.getState().controls.sensitivity;
    game.input.touch.camera.dx += dx * sens;
    game.input.touch.camera.dy += dy * sens;
    game.input.touch.active = true;
  };

  const onLookEnd = (e: React.PointerEvent) => {
    if (!lookRef.current || lookRef.current.id === e.pointerId) lookRef.current = null;
  };

  /**
   * Safety net: if the finger lifts outside the zone, the tab loses focus or a
   * panel opens mid-drag, the browser may never deliver the element's
   * `pointerup`. Without this the joystick stays pushed forward and the
   * character walks on its own.
   */
  useEffect(() => {
    if (!game) return;
    const release = () => {
      joyRef.current = null;
      lookRef.current = null;
      if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
      game.input.releaseTouch();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') release();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [game]);

  // Opening a panel or the pause menu must stop movement immediately.
  useEffect(() => {
    if (!game) return;
    if (hiddenRef.current) {
      joyRef.current = null;
      if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
      game.input.releaseTouch();
    }
  }, [game, anyPanel, dialogueOpen, screen]);

  const jump = () => {
    if (!game) return;
    game.input.touch.jumpQueued = true;
    vibrate(8);
  };

  const interact = () => {
    if (!game) return;
    game.tryInteract();
    vibrate(12);
  };

  const toggleSprint = () => {
    if (!game) return;
    const next = !sprintLatched;
    setSprintLatched(next);
    game.input.touch.sprint = next;
    vibrate(6);
  };

  // Menu buttons
  const openInventory = () => {
    const s = useGame.getState();
    s.set({ inventoryOpen: !s.inventoryOpen });
    if (game) game.setPaused(!s.inventoryOpen);
    bus.emit('playSfx', { name: 'open' });
  };
  const openQuests = () => {
    const s = useGame.getState();
    s.set({ questLogOpen: !s.questLogOpen });
    if (game) game.setPaused(!s.questLogOpen);
    bus.emit('playSfx', { name: 'open' });
  };
  const pause = () => {
    if (game) game.togglePause();
  };

  const hidden = anyPanel || dialogueOpen || screen !== 'playing';
  hiddenRef.current = hidden;

  return (
    <div
      className="touch-layer"
      style={{
        display: isTouch && screen === 'playing' ? undefined : 'none',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : undefined,
      }}
    >
      <div
        className="camera-zone"
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />

      <div
        className={`joystick-zone${joystickSide === 'right' ? ' right' : ''}`}
        onPointerDown={onJoyStart}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyEnd}
        onPointerCancel={onJoyEnd}
        aria-label="Movement joystick"
      >
        <div className="joystick-ring" />
        <div className="joystick-knob" ref={knobRef} />
      </div>

      <div className="touch-buttons">
        <div className="touch-btn-wrap">
          <button
            className={`touch-btn small${pressed === 'sprint' ? ' pressed' : ''}${sprintLatched ? ' pressed' : ''}`}
            onPointerDown={toggleSprint}
            aria-label="Toggle sprint"
            style={{ color: sprintLatched ? '#ffe6b8' : undefined }}
          >
            <Icon name="sprint" size={20} />
            <span className="btn-label">{t('hud.touchSprint')}</span>
          </button>
        </div>
        <div className="touch-btn-wrap">
          <button
            className={`touch-btn large${pressed === 'jump' ? ' pressed' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              setPressed('jump');
              jump();
            }}
            onPointerUp={() => setPressed(null)}
            onPointerCancel={() => setPressed(null)}
            aria-label={t('hud.touchJump')}
          >
            <Icon name="jump" size={26} />
            <span className="btn-label">{t('hud.touchJump')}</span>
          </button>
        </div>
      </div>

      {interactLabel && (
        <>
          <button className="touch-interact" onPointerDown={interact} aria-label={interactLabel}>
            <Icon name="interact" size={26} />
          </button>
          <span className="touch-interact-label">{interactLabel}</span>
        </>
      )}

      <div className="touch-top-row">
        <button className="touch-menu-btn" onPointerDown={openQuests} aria-label={t('journal.title')}>
          <Icon name="journal" />
        </button>
        <button className="touch-menu-btn" onPointerDown={openInventory} aria-label={t('inv.title')}>
          <Icon name="satchel" />
        </button>
        <button className="touch-menu-btn" onPointerDown={pause} aria-label={t('pause.title')}>
          <Icon name="pause" />
        </button>
      </div>
    </div>
  );
}
