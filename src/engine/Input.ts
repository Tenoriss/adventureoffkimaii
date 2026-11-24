/**
 * Unified input: keyboard + mouse (with optional pointer lock), touch
 * joystick/swipe (written to by React), and standard gamepad mapping.
 *
 * The engine polls a single mutable `InputState` every frame, so all sources
 * compose naturally instead of fighting each other.
 */

export interface InputState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  zoom: number;
  sprint: boolean;
  jump: boolean;
  jumpQueued: boolean;
  interact: boolean;
  interactQueued: boolean;
  pointerLocked: boolean;
  usingTouch: boolean;
  usingGamepad: boolean;
}

export interface InputHandlers {
  onPause: () => void;
  onInventory: () => void;
  onQuests: () => void;
  onMap: () => void;
  onHeal: () => void;
  onInteract: () => void;
  onCameraReset: () => void;
  onAnyInput: () => void;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class Input {
  readonly state: InputState = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    zoom: 0,
    sprint: false,
    jump: false,
    jumpQueued: false,
    interact: false,
    interactQueued: false,
    pointerLocked: false,
    usingTouch: false,
    usingGamepad: false,
  };

  /** Touch input written by the React overlay. */
  readonly touch = {
    active: false,
    joyX: 0,
    joyY: 0,
    lookX: 0,
    lookY: 0,
    sprint: false,
    jump: false,
    jumpQueued: false,
    interactQueued: false,
    camera: { dx: 0, dy: 0 },
  };

  private keys = new Set<string>();
  private handlers: InputHandlers;
  private el: HTMLElement;
  private gamepadIndex: number | null = null;
  private prevButtons: boolean[] = [];
  private destroyed = false;
  private dragLook = { active: false, lastX: 0, lastY: 0, pointerId: -1 };
  private sensitivity = 1;
  private enabled = true;

  constructor(element: HTMLElement, handlers: InputHandlers) {
    this.el = element;
    this.handlers = handlers;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.el.addEventListener('wheel', this.onWheel, { passive: false });
    this.el.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.state.moveX = 0;
      this.state.moveY = 0;
      this.state.sprint = false;
      this.touch.joyX = 0;
      this.touch.joyY = 0;
      this.touch.active = false;
    }
  }

  setSensitivity(s: number): void {
    this.sensitivity = s;
  }

  requestPointerLock(): void {
    if (this.state.usingTouch) return;
    const el = this.el as HTMLElement & { requestPointerLock?: (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void };
    try {
      const res = el.requestPointerLock?.({ unadjustedMovement: true });
      if (res && typeof (res as Promise<void>).catch === 'function') {
        (res as Promise<void>).catch(() => {
          try {
            el.requestPointerLock?.();
          } catch {
            /* ignore */
          }
        });
      }
    } catch {
      /* pointer lock unavailable — drag look still works */
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private isTypingTarget(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.isTypingTarget(e)) return;
    if (e.repeat) return;

    // Menu / panel shortcuts must keep working while gameplay input is off,
    // otherwise a paused player could not get back out of a panel.
    const uiCode =
      e.code === 'Escape' ||
      e.code === 'KeyI' ||
      e.code === 'KeyJ' ||
      e.code === 'KeyM' ||
      e.code === 'KeyH';
    if (!this.enabled && !uiCode) return;

    if (e.code === 'Tab') e.preventDefault();
    if (e.code === 'Space' || e.code.startsWith('Arrow')) {
      if (this.enabled) e.preventDefault();
    }

    if (this.enabled) {
      this.keys.add(e.code);
      this.handlers.onAnyInput();
    }
    switch (e.code) {
      case 'Escape':
        this.handlers.onPause();
        return;
      case 'KeyE':
        if (!this.enabled) return;
        this.state.interactQueued = true;
        this.handlers.onInteract();
        break;
      case 'Space':
        if (!this.enabled) return;
        this.state.jumpQueued = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.enabled) this.state.sprint = true;
        break;
      case 'KeyI':
        this.handlers.onInventory();
        break;
      case 'KeyJ':
        this.handlers.onQuests();
        break;
      case 'KeyM':
        this.handlers.onMap();
        break;
      case 'KeyH':
        this.handlers.onHeal();
        break;
      case 'KeyR':
        if (!this.enabled) return;
        this.handlers.onCameraReset();
        break;
      case 'KeyF':
        if (!this.enabled) return;
        this.state.interactQueued = true;
        break;
      default:
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.state.sprint = false;
    }
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.state.sprint = false;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.dragLook.active = false;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled) return;
    this.handlers.onAnyInput();
    if (e.button === 0) {
      if (!document.pointerLockElement) this.requestPointerLock();
    } else if (e.button === 2) {
      // Right-drag look fallback (no pointer lock available).
      this.dragLook.active = true;
      this.dragLook.lastX = e.clientX;
      this.dragLook.lastY = e.clientY;
      this.dragLook.pointerId = -1;
    }
  };

  private onMouseUp = (): void => {
    this.dragLook.active = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;
    if (document.pointerLockElement === this.el) {
      this.state.lookX += e.movementX * 0.0022 * this.sensitivity;
      this.state.lookY += e.movementY * 0.0022 * this.sensitivity;
    } else if (this.dragLook.active) {
      const dx = e.clientX - this.dragLook.lastX;
      const dy = e.clientY - this.dragLook.lastY;
      this.dragLook.lastX = e.clientX;
      this.dragLook.lastY = e.clientY;
      this.state.lookX += dx * 0.004 * this.sensitivity;
      this.state.lookY += dy * 0.004 * this.sensitivity;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.state.zoom += Math.sign(e.deltaY) * 0.6;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onPointerLockChange = (): void => {
    this.state.pointerLocked = document.pointerLockElement === this.el;
  };

  private onGamepadConnected = (e: Event): void => {
    this.gamepadIndex = (e as GamepadEvent).gamepad.index;
    this.state.usingGamepad = true;
  };

  private onGamepadDisconnected = (): void => {
    this.gamepadIndex = null;
    this.state.usingGamepad = false;
    this.state.sprint = false;
  };

  private pollGamepad(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    let pad: Gamepad | null = null;
    if (this.gamepadIndex !== null) pad = pads[this.gamepadIndex];
    if (!pad) {
      for (const p of pads) {
        if (p && p.connected) {
          pad = p;
          this.gamepadIndex = p.index;
          break;
        }
      }
    }
    if (!pad) return;

    const dead = 0.18;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    const mag = Math.hypot(ax, ay);
    if (mag > dead) {
      const norm = Math.min(1, (mag - dead) / (1 - dead)) / mag;
      this.state.moveX += ax * norm;
      this.state.moveY += -ay * norm;
    }
    if (Math.abs(rx) > dead) this.state.lookX += rx * 0.045 * this.sensitivity;
    if (Math.abs(ry) > dead) this.state.lookY += ry * 0.035 * this.sensitivity;

    const btn = (i: number) => !!pad.buttons[i]?.pressed;
    const value = (i: number) => pad.buttons[i]?.value ?? 0;
    const pressedEdge = (i: number, key: string) => {
      const now = btn(i);
      const was = this.prevButtons[i] ?? false;
      if (now && !was) this.keys.add(key);
      if (!now && was) this.keys.delete(key);
      this.prevButtons[i] = now;
      return now;
    };

    const jump = pressedEdge(0, 'Space');
    if (jump) {
      this.state.jumpQueued = true;
      this.handlers.onAnyInput();
    }
    this.state.jump = this.state.jump || jump;
    this.state.sprint = this.state.sprint || value(7) > 0.4 || value(2) > 0.4;
    if (pressedEdge(1, 'KeyE') || pressedEdge(3, 'KeyE')) {
      this.state.interactQueued = true;
      this.handlers.onInteract();
    }
    if (pressedEdge(9, 'Escape')) this.handlers.onPause();
    if (pressedEdge(8, 'KeyJ')) this.handlers.onQuests();
    if (pressedEdge(4, 'KeyI')) this.handlers.onInventory();
    if (pressedEdge(5, 'KeyH')) this.handlers.onHeal();
    if (pressedEdge(6, 'KeyM')) this.handlers.onMap();
    // D-pad camera reset.
    pressedEdge(12, 'KeyR');
  }

  /** Called once per frame before the engine reads state. */
  update(): void {
    if (this.destroyed) return;

    const moveX = this.state.moveX;
    const moveY = this.state.moveY;
    this.state.moveX = 0;
    this.state.moveY = 0;

    if (this.enabled) {
      let kx = 0;
      let ky = 0;
      for (const code of this.keys) {
        const v = MOVE_KEYS[code];
        if (v) {
          kx += v[0];
          ky += v[1];
        }
      }
      const len = Math.hypot(kx, ky);
      if (len > 0) {
        kx /= len;
        ky /= len;
      }
      this.state.moveX = moveX + kx + this.touch.joyX;
      this.state.moveY = moveY + ky + this.touch.joyY;
      const mlen = Math.hypot(this.state.moveX, this.state.moveY);
      if (mlen > 1) {
        this.state.moveX /= mlen;
        this.state.moveY /= mlen;
      }
      if (this.touch.active) this.state.usingTouch = true;
      this.pollGamepad();
    } else {
      this.state.moveX = 0;
      this.state.moveY = 0;
    }

    this.state.lookX += this.touch.camera.dx;
    this.state.lookY += this.touch.camera.dy;
    this.touch.camera.dx = 0;
    this.touch.camera.dy = 0;

    if (this.state.jumpQueued) this.touch.jumpQueued = false;
    if (this.touch.jumpQueued) this.state.jumpQueued = true;
    if (this.touch.interactQueued) this.state.interactQueued = true;
    this.state.sprint = this.state.sprint || this.touch.sprint;
  }

  /** Consume one-shot flags after the engine processed them. */
  endFrame(): void {
    this.state.jumpQueued = false;
    this.state.interactQueued = false;
    this.state.lookX = 0;
    this.state.lookY = 0;
    this.state.zoom = 0;
    this.touch.jumpQueued = false;
    this.touch.interactQueued = false;
    this.touch.jump = false;
    this.state.jump = false;
  }

  dispose(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }
}
