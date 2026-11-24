import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Game } from '../engine/Game';
import { useGame } from '../game/store';
import { bus } from '../game/bus';

interface EngineContextValue {
  game: Game | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ready: boolean;
}

const EngineContext = createContext<EngineContextValue>({ game: null, canvasRef: { current: null }, ready: false });

export function EngineProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [ready, setReady] = useState(false);
  const started = useGame((s) => s.started);

  useEffect(() => {
    if (!started || !canvasRef.current || gameRef.current) return;
    let cancelled = false;
    // Let the loading screen paint before we build the world (a few hundred ms
    // of terrain work on low-end phones).
    const timer = window.setTimeout(() => {
      if (cancelled || !canvasRef.current) return;
      try {
        const instance = new Game({
          canvas: canvasRef.current,
          onReady: () => setReady(true),
        });
        gameRef.current = instance;
        setGame(instance);
        instance.start();
      } catch (err) {
        console.error('Failed to start Lost Horizon', err);
        useGame.getState().set({ screen: 'menu', started: false });
        useGame.getState().pushToast({ text: 'WebGL could not start on this device.', kind: 'info' });
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (gameRef.current) {
        gameRef.current.dispose();
        gameRef.current = null;
        setGame(null);
        setReady(false);
      }
    };
  }, [started]);

  // Global pause / UI events that only the engine knows about.
  useEffect(() => {
    if (!game) return;
    const unsub = bus.on('pause', () => game.togglePause());
    return () => unsub();
  }, [game]);

  return <EngineContext.Provider value={{ game, canvasRef, ready }}>{children}</EngineContext.Provider>;
}

export function useEngine(): EngineContextValue {
  return useContext(EngineContext);
}

/** True once the renderer has produced its first frames. */
export function useEngineReady(): boolean {
  return useContext(EngineContext).ready;
}
