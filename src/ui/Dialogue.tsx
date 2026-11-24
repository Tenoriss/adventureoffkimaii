import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { useEngine } from './useGameEngine';
import { DIALOGUE, NPC_MAP } from '../game/dialogue';
import { bus } from '../game/bus';

/** Simple generated portrait: hood colour comes from the NPC palette. */
function Portrait({ robe, trim, skin, hair, mood }: { robe: string; trim: string; skin: string; hair: string; mood: string }) {
  const brow = mood === 'worried' ? 'M8.6 10.6c.9-.7 2-.8 3-.4' : 'M8.7 10.2h2.2';
  const brow2 = mood === 'worried' ? 'M15.4 10.6c-.9-.7-2-.8-3-.4' : 'M13.6 10.2h2.2';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <radialGradient id="pg" cx="38%" cy="30%">
          <stop offset="0%" stopColor={robe} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0e1724" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#pg)" stroke="rgba(180,210,235,0.35)" strokeWidth="1.5" />
      <path d="M20 9.5c-6 0-9.4 4-9.4 10.4V31c1.9-2.4 4.4-3.6 9.4-3.6s7.5 1.2 9.4 3.6V19.9C29.4 13.5 26 9.5 20 9.5z" fill={trim} opacity="0.92" />
      <circle cx="20" cy="18.4" r="6.1" fill={skin} />
      <path d="M13.9 17.2c0-4.1 2.4-6.6 6.1-6.6s6.1 2.5 6.1 6.6c-1.4-2-3.2-2.9-6.1-2.9s-4.7.9-6.1 2.9z" fill={hair} />
      <circle cx="17.5" cy="18.6" r="0.95" fill="#1c2531" />
      <circle cx="22.5" cy="18.6" r="0.95" fill="#1c2531" />
      <path d={brow} stroke={hair} strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d={brow2} stroke={hair} strokeWidth="0.9" strokeLinecap="round" fill="none" />
      {mood === 'happy' ? (
        <path d="M17.9 21.4c1.3 1.2 2.9 1.2 4.2 0" stroke="#8a5b45" strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M18.4 21.8h3.2" stroke="#8a5b45" strokeWidth="0.9" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function Dialogue() {
  const state = useGame((s) => s.dialogueState);
  const dialogueOpen = useGame((s) => s.dialogueOpen);
  const { game } = useEngine();
  const [typed, setTyped] = useState('');
  const [ready, setReady] = useState(false);
  const typeTimer = useRef<number | null>(null);

  const node = state ? DIALOGUE[state.nodeId] : null;
  const line = node?.lines[state?.lineIndex ?? 0];
  const npc = state ? NPC_MAP[state.npcId] : null;
  const isLastLine = node ? state!.lineIndex >= node.lines.length - 1 : false;
  const showOptions = isLastLine && !!node?.options && node.options.length > 0;

  // Typewriter effect.
  useEffect(() => {
    if (!line) return;
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    const full = line.text;
    const speed = 16;
    let i = 0;
    setTyped('');
    setReady(false);
    typeTimer.current = window.setInterval(() => {
      i += 2;
      if (i >= full.length) {
        setTyped(full);
        setReady(true);
        if (typeTimer.current) window.clearInterval(typeTimer.current);
        typeTimer.current = null;
      } else {
        setTyped(full.slice(0, i));
      }
    }, speed);
    return () => {
      if (typeTimer.current) window.clearInterval(typeTimer.current);
    };
  }, [line]);

  // Keyboard: 1..4 chooses an option, Space/Enter advances.
  useEffect(() => {
    if (!dialogueOpen || !game) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        game.closeDialogue();
        bus.emit('playSfx', { name: 'close' });
        return;
      }
      if (showOptions) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= (node?.options?.length ?? 0)) {
          e.preventDefault();
          bus.emit('playSfx', { name: 'ui' });
          game.chooseDialogue(num - 1);
        }
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        if (!ready) {
          setTyped(line?.text ?? '');
          setReady(true);
          return;
        }
        bus.emit('playSfx', { name: 'ui' });
        game.advanceDialogue();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialogueOpen, game, showOptions, ready, line, node]);

  if (import.meta.env.DEV && dialogueOpen && !node) {
    // A missing node is a content bug: fail loudly in development only.
    console.warn('Missing dialogue node', state?.nodeId);
  }
  if (!dialogueOpen || !state || !node || !line || !npc) return null;

  const handleBoxClick = () => {
    if (!ready) {
      setTyped(line.text);
      setReady(true);
      return;
    }
    if (showOptions) return;
    game?.advanceDialogue();
  };

  return (
    <div className="dialogue-wrap" role="dialog" aria-label={`Conversation with ${npc.name}`}>
      {showOptions && (
        <div className="dialogue-options">
          {node.options!.map((opt, i) => (
            <button
              key={opt.label}
              className="dialogue-option"
              onClick={() => {
                bus.emit('playSfx', { name: 'ui' });
                game?.chooseDialogue(i);
              }}
            >
              <span className="opt-index">{i + 1}.</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <div className="dialogue-box" onClick={handleBoxClick}>
        <div className="dialogue-speaker">
          <div className="portrait" aria-hidden>
            <Portrait
              robe={npc.palette.robe}
              trim={npc.palette.trim}
              skin={npc.palette.skin}
              hair={npc.palette.hair}
              mood={line.mood ?? 'neutral'}
            />
          </div>
          <div>
            <div className="name">{line.speaker}</div>
            <div className="role">{npc.role}</div>
          </div>
        </div>
        <div className="dialogue-text">{typed}</div>
        {ready && !showOptions && (
          <div className="dialogue-continue">
            {isLastLine ? 'click to end' : 'click to continue'} ▸
          </div>
        )}
      </div>
    </div>
  );
}
