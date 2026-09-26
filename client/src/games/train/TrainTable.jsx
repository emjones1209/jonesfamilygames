/**
 * TrainTable — the Mexican Train screen, drawn from a game view (see
 * trainEngine.js) in which the player looking at it is seat 0. Used by the
 * single-player game and by play-together tables alike: moves go out through
 * `onAction` (with seat 0), and the caller works out what they mean.
 *
 * Your hand is yours to arrange: drag tiles to reorder them, tap one to select
 * it (then ↻ turns it round, and the trains it fits light up), and play it by
 * tapping a lit-up train or dragging it there.
 */
import { useState, useRef } from 'react';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import { legalMoves, openEnd, MEXICAN, engineFor } from './trainRules';

// Each number has its own colour, like a real double-12 set
const PIP_COLOR = ['', 'text-sky-600', 'text-green-600', 'text-red-600', 'text-amber-700', 'text-blue-700', 'text-yellow-600',
  'text-purple-600', 'text-teal-600', 'text-gray-600', 'text-rose-700', 'text-emerald-700', 'text-orange-600'];

/** A domino, laid sideways: [a | b]. */
export function Domino({ a, b, small = false, selected = false, dim = false, onClick }) {
  const half = n => (
    <span className={`flex-1 flex items-center justify-center font-black ${PIP_COLOR[n]} ${small ? 'text-sm md:text-lg' : 'text-xl md:text-2xl'}`}>
      {n === 0 ? '' : n}
    </span>
  );
  return (
    <div onClick={onClick}
      className={`${small ? 'w-12 h-7 md:w-16 md:h-9' : 'w-20 h-11 md:w-24 md:h-14'} shrink-0 flex items-stretch rounded-lg bg-stone-50 border-2 select-none
        ${selected ? 'border-yellow-400 -translate-y-2 shadow-lg shadow-yellow-400/40' : 'border-stone-400'}
        ${dim ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''} transition-transform`}>
      {half(a)}
      <span className="w-0.5 my-1 bg-stone-400" />
      {half(b)}
    </div>
  );
}

const BG = 'from-game-bg to-sky-900';
const listNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`);

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextRound)
 * @param onExit      leave the table
 * @param error       a message to show (e.g. a refused move)
 * @param subtitle    shown after the round number (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function TrainTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [order, setOrder] = useState([]);                 // your tile ids as you've arranged them
  const [flipped, setFlipped] = useState(() => new Set());
  const [picked, setSelected] = useState(null);           // tile id
  const [drag, setDrag] = useState(null);                 // { id, x, y, train } while a tile is being dragged
  const [note, setNote] = useState(null);                 // { text, error, move } a hint, until the next move
  const press = useRef(null);                             // the tile under your finger, and whether it has moved

  // A new round: a fresh hand to arrange
  const [dealt, setDealt] = useState(view.round);
  if (dealt !== view.round) {
    setDealt(view.round);
    setOrder([]); setFlipped(new Set()); setSelected(null); setDrag(null); setNote(null);
  }

  const n = view.players;
  const inHand = new Map(view.hands[0].map(t => [t.id, t]));
  const selected = picked && inHand.has(picked) ? picked : null;     // a tile that's been played is no longer selected
  const playing = view.phase === 'play';
  const yourTurn = playing && view.turn === 0;
  const moves = yourTurn ? legalMoves(view, 0) : [];
  const playableIds = new Set(moves.map(m => m.tileId));
  const active = drag?.id ?? selected;
  const targets = new Set(moves.filter(m => m.tileId === active).map(m => m.train));
  const hand = [
    ...order.filter(id => inHand.has(id)).map(id => inHand.get(id)),
    ...view.hands[0].filter(t => !order.includes(t.id)).sort((x, y) => x.a - y.a || x.b - y.b),   // e.g. a tile just drawn
  ];
  const canDraw = yourTurn && !moves.length && !view.drew && view.boneyard.length > 0;
  const canPass = yourTurn && !moves.length && (view.drew || !view.boneyard.length);

  const whose = owner => (owner === MEXICAN ? 'the Mexican Train' : owner === 0 ? 'your train' : `${names[owner]}'s train`);
  const trainLabel = i => whose(view.trains[i].owner);
  const say = (text, isError = false) => setNote({ text, error: isError, move: view.lastMove });

  const playOn = (tileId, train) => {
    if (!yourTurn) { say('Wait for your turn to play a tile.', true); return; }
    if (!moves.some(m => m.tileId === tileId && m.train === train)) {
      say(`That tile can't go on ${trainLabel(train)} right now.`, true);
      return;
    }
    setSelected(null);
    onAction({ type: 'play', seat: 0, tileId, train });
  };

  const tapTile = id => {
    const options = moves.filter(m => m.tileId === id);
    if (selected === id) {
      // Tapping a selected tile that fits only one train plays it there
      if (options.length === 1) playOn(id, options[0].train); else setSelected(null);
      return;
    }
    setSelected(id);
    if (!yourTurn) say('Tap ↻ to turn it round.');
    else if (!options.length) say('That tile doesn\'t fit anywhere you can play right now. (Tap ↻ to turn it round.)', true);
    else say(options.length === 1 ? 'Tap it again (or the lit-up train) to play it. ↻ turns it round.' : 'Now tap the train to play it on. ↻ turns it round.');
  };
  const flip = id => setFlipped(f => { const next = new Set(f); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Dragging: over another tile it slides into that place; dropped on a train, it's played there
  const dropTarget = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.dataset.train !== undefined) return { train: Number(el.dataset.train) };
      if (el.dataset.tile !== undefined) return { tile: el.dataset.tile };
    }
    return {};
  };
  const onTileDown = (e, id) => {
    if (e.button > 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    press.current = { id, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTileMove = e => {
    const p = press.current;
    if (!p || (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8)) return;
    p.moved = true;
    const over = dropTarget(e.clientX, e.clientY);
    if (over.tile !== undefined && over.tile !== p.id) {
      const ids = hand.map(t => t.id);
      ids.splice(ids.indexOf(p.id), 1);
      ids.splice(hand.findIndex(t => t.id === over.tile), 0, p.id);
      setOrder(ids);
    }
    setDrag({ id: p.id, x: e.clientX - p.dx, y: e.clientY - p.dy, train: over.train ?? null });
  };
  const onTileUp = e => {
    const p = press.current;
    press.current = null;
    setDrag(null);
    if (!p) return;
    if (!p.moved) { tapTile(p.id); return; }
    const { train } = dropTarget(e.clientX, e.clientY);
    if (train !== undefined) playOn(p.id, train);
  };
  const onTileCancel = () => { press.current = null; setDrag(null); };
  const dragged = drag && inHand.get(drag.id);
  const face = t => (flipped.has(t.id) ? { a: t.b, b: t.a } : { a: t.a, b: t.b });

  // What just happened
  const m = view.lastMove;
  let happened = '';
  if (view.phase !== 'play' && view.lastRound) {
    const o = view.lastRound.outBy;
    happened = o == null ? 'Nobody can play — the round is blocked.' : `${names[o]} ${o === 0 ? 'play' : 'plays'} the last tile!`;
  } else if (m) {
    const you = m.seat === 0, who = names[m.seat];
    if (m.kind === 'draw') happened = `${who} ${you ? 'draw' : 'draws'} a tile.`;
    else if (m.kind === 'pass') happened = `${who} ${you ? 'pass' : 'passes'} — ${you ? 'your' : 'their'} train is open to everyone.`;
    else happened = `${who} ${you ? 'play' : 'plays'} ${m.tile.a}|${m.tile.b} on ${trainLabel(m.train)}${m.double ? ' — a double, which must be covered!' : ''}`;
  }
  const shownNote = note && note.move === view.lastMove ? note : null;
  const message = error ? { text: error, error: true } : shownNote ?? { text: happened, error: false };

  let hint = '';
  if (yourTurn) {
    if (view.pendingDouble != null) hint = `Cover the double on ${trainLabel(view.pendingDouble)}.`;
    else if (moves.length) hint = 'Tap a tile, then the lit-up train to play it (or drag it there). Drag tiles to arrange your hand.';
    else if (canDraw) hint = 'Nothing fits — draw a tile.';
    else hint = 'Still nothing fits — pass. Your train will be open to everyone until you play on it.';
  } else if (playing) hint = `${names[view.turn]} is playing… Drag your tiles to plan; tap one, then ↻, to turn it round.`;

  const last = view.lastRound;
  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col gap-2 select-none`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="train" title="Mexican Train" />
        </div>
        <div className="text-white/80 text-sm font-semibold text-center">
          Round {view.round + 1} of {view.rounds}{subtitle ? ` · ${subtitle}` : ''}
        </div>
        <div className="text-white/60 text-xs text-right">Boneyard: {view.boneyard.length}</div>
      </header>

      {/* Players and scores */}
      <div className="flex justify-center gap-2 flex-wrap text-xs">
        {names.map((name, seat) => (
          <div key={seat} className={`px-3 py-1 rounded-full ${view.turn === seat && playing ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {name} · {view.hands[seat].length} tiles · {view.totals[seat]} pts{reactions[seat] ? ` ${reactions[seat]}` : ''}
          </div>
        ))}
      </div>

      {/* The hub: engine and trains */}
      <div className="card-panel p-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-white/60 text-xs">
          Engine <Domino a={view.engine} b={view.engine} small />
        </div>
        {view.trains.map((train, i) => {
          const canTarget = targets.has(i);
          const hovered = canTarget && drag?.train === i;
          const pending = view.pendingDouble === i;
          const shown = train.tiles.slice(-5);
          const hidden = train.tiles.length - shown.length;
          return (
            <div key={i} data-train={i} role="button" onClick={canTarget && selected ? () => playOn(selected, i) : undefined}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 text-left min-h-[3rem] transition-colors
                ${hovered ? 'bg-game-gold/40 ring-4 ring-game-gold' : canTarget ? 'bg-game-gold/20 ring-2 ring-game-gold cursor-pointer' : 'bg-white/5'}
                ${pending ? 'ring-2 ring-red-400' : ''}`}>
              <span className="w-28 md:w-36 shrink-0 text-xs md:text-sm text-white/80">
                {train.owner === MEXICAN ? '🚂 Mexican Train' : train.owner === 0 ? 'Your train' : `${names[train.owner]}'s train`}
                {train.owner !== MEXICAN && train.open && <span title="Open to everyone"> 🚩</span>}
              </span>
              <span className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                {hidden > 0 && <span className="text-white/40 text-xs">+{hidden}</span>}
                {shown.map(t => <Domino key={t.id} a={t.a} b={t.b} small />)}
              </span>
              <span className={`shrink-0 text-xs md:text-sm rounded-full px-2 py-0.5 ${pending ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70'}`}>
                {pending ? `cover ${openEnd(view, i)}` : `needs ${openEnd(view, i)}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className={`text-center text-sm min-h-[1.25rem] ${message.error ? 'text-red-300' : 'text-amber-300'}`}>{message.text}</p>

      {/* Your tiles */}
      <div className="flex flex-wrap justify-center gap-2 pt-3">
        {hand.map(t => (
          <div key={t.id} data-tile={t.id} className={`relative touch-none cursor-grab ${drag?.id === t.id ? 'opacity-25' : ''}`}
            onPointerDown={e => onTileDown(e, t.id)} onPointerMove={onTileMove} onPointerUp={onTileUp} onPointerCancel={onTileCancel}>
            <Domino {...face(t)} selected={selected === t.id} dim={yourTurn && !playableIds.has(t.id)} />
            {selected === t.id && !drag && (
              // Turn the selected tile round (its own button, so it doesn't start a drag or a tap)
              <button aria-label="Turn this tile round"
                onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
                onClick={() => flip(t.id)}
                className="absolute -top-5 -right-3 w-9 h-9 rounded-full bg-game-gold text-game-bg shadow-lg flex items-center justify-center z-10">
                <RotateCw size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
      {/* The tile following your finger */}
      {dragged && (
        <div className="fixed z-50 pointer-events-none scale-110 drop-shadow-2xl" style={{ left: drag.x, top: drag.y }}>
          <Domino {...face(dragged)} selected />
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button variant="primary" disabled={!canDraw} onClick={() => onAction({ type: 'draw', seat: 0 })}>Draw</Button>
        <Button variant="secondary" disabled={!canPass} onClick={() => onAction({ type: 'pass', seat: 0 })}>Pass</Button>
      </div>
      <p className="text-center text-white/50 text-xs">{hint}</p>
      {overlay}

      {!playing && last && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winners.includes(0) ? '🏆' : '🚂'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">
                {view.winners.length > 1 ? `${listNames(view.winners.map(w => names[w]))} win!`
                  : view.winners[0] === 0 ? 'You win!' : `${names[view.winners[0]]} wins!`}
              </h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-white mb-2">
              {last.outBy == null ? 'Round blocked' : `${names[last.outBy]} ${last.outBy === 0 ? 'go' : 'goes'} out!`}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>This round</th><th>Total</th></tr></thead>
            <tbody>
              {Array.from({ length: n }, (_, i) => (
                <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
                  <td className="text-left truncate max-w-[9rem]">{names[i]}</td><td>{last.scores[i]}</td><td>{view.totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {view.phase === 'roundOver' ? (
            <Button variant="gold" className="w-full" onClick={() => onAction({ type: 'nextRound' })}>
              Next round (engine {engineFor(view.round + 1)}|{engineFor(view.round + 1)})
            </Button>
          ) : gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}
