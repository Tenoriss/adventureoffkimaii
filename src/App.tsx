import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from './game/store';
import { EngineProvider, useEngine } from './ui/useGameEngine';
import { HUD } from './ui/HUD';
import { TouchControls } from './ui/TouchControls';
import { Dialogue } from './ui/Dialogue';
import { Inventory } from './ui/Inventory';
import { QuestLog } from './ui/QuestLog';
import { WorldMap } from './ui/WorldMap';
import { MainMenu, PauseMenu } from './ui/MainMenu';
import { BootScreen } from './ui/BootScreen';
import { readSave, readSettings, writeSettings, writeSaveNow, setCloudAdapter, type CloudSaveAdapter } from './game/save';
import { bus } from './game/bus';
import { setupUnloadSave } from './game/persistence';
import { useT } from './i18n';

/**
 * Placeholder adapter. A real backend only has to implement pull/push — every
 * call site in the game already goes through this interface.
 */
const cloudAdapterStub: CloudSaveAdapter = {
  pull: async () => null,
  push: async () => undefined,
};

function GameShell() {
  const t = useT();
  const started = useGame((s) => s.started);
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const webglLost = useGame((s) => s.webglLost);
  const set = useGame((s) => s.set);
  const { game, canvasRef } = useEngine();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!started) {
      setBooting(true);
      return;
    }
    setBooting(true);
    const timeout = window.setTimeout(() => setBooting(false), 7000);
    return () => window.clearTimeout(timeout);
  }, [started]);

  // Engine <-> screen bridge.
  useEffect(() => {
    if (!game) return;
    const onResume = () => game.setPaused(false);
    const onSave = () => game.saveNow();
    const onPause = () => game.setPaused(true);
    const onQuit = () => {
      game.saveNow();
      writeSaveNow(useGame.getState().toSaveData());
      set({ started: false, screen: 'menu', inventoryOpen: false, questLogOpen: false, mapOpen: false, dialogueOpen: false });
      setScreen('menu');
    };
    window.addEventListener('lh:resume', onResume);
    window.addEventListener('lh:save', onSave);
    window.addEventListener('lh:pause', onPause);
    window.addEventListener('lh:quit', onQuit);
    document.addEventListener('visibilitychange', onPause);
    return () => {
      window.removeEventListener('lh:resume', onResume);
      window.removeEventListener('lh:save', onSave);
      window.removeEventListener('lh:pause', onPause);
      window.removeEventListener('lh:quit', onQuit);
      document.removeEventListener('visibilitychange', onPause);
    };
  }, [game, set, setScreen]);

  useEffect(() => {
    if (screen === 'paused' && game) game.setPaused(true);
  }, [screen, game]);

  if (!started) return <MainMenu />;

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label={t('gl.canvasLabel')} />

      <div className="ui-layer">
        <HUD />
      </div>

      <TouchControls />
      <Dialogue />
      <Inventory />
      <QuestLog />
      <WorldMap />
      <PauseMenu />

      {booting && (
        <BootScreen
          ready={!!game && game.chunks.activeCount > 0}
          onDone={() => {
            setBooting(false);
            setScreen('playing');
          }}
        />
      )}

      {webglLost && (
        <div className="context-lost">
          <div className="box">
            <div style={{ fontSize: 30 }} aria-hidden>
              ⚠
            </div>
            <h2 style={{ fontSize: 16, letterSpacing: '0.06em' }}>{t('gl.title')}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.6 }}>{t('gl.body')}</p>
            <button className="btn primary" onClick={() => window.location.reload()}>
              {t('gl.reload')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Top-level app: loads settings and the save, then mounts the engine. */
export default function App() {
  const [deviceReady, setDeviceReady] = useState(false);

  useEffect(() => {
    const settings = readSettings();
    const store = useGame.getState();
    if (settings?.graphics) {
      store.set({ graphics: { ...store.graphics, ...settings.graphics } });
      store.setStats({ quality: settings.graphics.level });
    }
    if (settings?.controls) store.set({ controls: { ...store.controls, ...settings.controls } });
    if (settings?.audio) store.set({ audio: { ...store.audio, ...settings.audio } });
    if (readSave()) store.set({ hasSave: true });
    setCloudAdapter(cloudAdapterStub);
    const cleanup = setupUnloadSave();
    setDeviceReady(true);
    return cleanup;
  }, []);

  // Settings are written only when they actually change (the main store ticks
  // every frame for stamina and time, so an unselective subscription here would
  // hammer localStorage and drain the battery).
  useEffect(() => {
    if (!deviceReady) return;
    const initial = useGame.getState();
    let lastGraphics = initial.graphics;
    let lastControls = initial.controls;
    let lastAudio = initial.audio;
    let timer: number | null = null;
    const flush = () => {
      timer = null;
      writeSettings({ graphics: lastGraphics, controls: lastControls, audio: lastAudio });
    };
    const unsub = useGame.subscribe((state) => {
      const graphicsChanged = state.graphics !== lastGraphics;
      const controlsChanged = state.controls !== lastControls;
      const audioChanged = state.audio !== lastAudio;
      if (!graphicsChanged && !controlsChanged && !audioChanged) return;
      lastGraphics = state.graphics;
      lastControls = state.controls;
      lastAudio = state.audio;
      if (audioChanged) bus.emit('volumesChanged', undefined);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(flush, 400);
    });
    return () => {
      unsub();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [deviceReady]);

  // Keep mobile browsers from zooming / showing context menus on the canvas.
  useEffect(() => {
    const prevent = (e: Event) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'CANVAS') e.preventDefault();
    };
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('dblclick', prevent, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('dblclick', prevent);
    };
  }, []);

  if (!deviceReady) {
    return (
      <div className="game-root" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'var(--ink-faint)', fontSize: 12, letterSpacing: '0.2em' }}>LOST HORIZON</div>
      </div>
    );
  }

  return (
    <EngineProvider>
      <GameShell />
    </EngineProvider>
  );
}

/** Small helper for components that need to know whether we are on a small screen. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  const handler = useCallback(() => setMatches(matchMedia(query).matches), [query]);
  const ref = useRef<MediaQueryList | null>(null);
  useEffect(() => {
    const mql = matchMedia(query);
    ref.current = mql;
    mql.addEventListener('change', handler);
    handler();
    return () => mql.removeEventListener('change', handler);
  }, [handler, query]);
  return matches;
}
