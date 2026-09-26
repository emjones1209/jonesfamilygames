import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import { ResultPanel } from '../cards/GameSetup';
import { dealRound, act, legalMoves, openEnd, roundScores, isDouble, MEXICAN, MAX_PIP } from './trainRules';
import { chooseAction } from './trainAI';
import api from '../../utils/api';

const NAMES_FOR = { 2: ['You', 'Computer'], 3: ['You', 'Left', 'Right'], 4: ['You', 'Left', 'Across', 'Right'] };
const LENGTHS = [[13, 'Full game (13 rounds)'], [7, 'Half game (7 rounds)'], [3, 'Quick game (3 rounds)']];
const AI_MS = 900;
// Each number has its own colour, like a real double-12 set
const PIP_COLOR = ['', 'text-sky-600', 'text-green-600', 'text-red-600', 'text-amber-700', 'text-blue-700', 'text-yellow-600',
  'text-purple-600', 'text-teal-600', 'text-gray-600', 'text-rose-700', 'text-emerald-700', 'text-orange-600'];

/** A domino, laid sideways: [a | b]. */
function Domino({ a, b, small = false, selected = false, dim = false, onClick }) {
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

export default function MexicanTrainGame() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ players: 4, rounds: 13 });
  const [difficulty, setDifficulty] = useState(null);
  const [round, setRound] = useState(0);
  const [totals, setTotals] = useState([]);
  const [game, setGame] = useState(null);
  // Your hand is yours to arrange: tiles in the order you've dragged them, and which ones you've turned round
  const [order, setOrder] = useState([]);                 // tile ids (tiles not in it go at the end, sorted)
  const [flipped, setFlipped] = useState(() => new Set());
  const [drag, setDrag] = useState(null);                 // { id, x, y, train } while a tile is being dragged
  const press = useRef(null);                             // the tile under your finger, and whether it has moved
  const [msg, setMsg] = useState({ text: '', error: false });
  const [result, setResult] = useState(null);
  const [moveNo, setMoveNo] = useState(0);                // restarts the computer-turn timer after every move
  const [showTutorial, setShowTutorial] = useState(false);
  const latest = useRef(null);
  useEffect(() => { latest.current = game; });

  const names = NAMES_FOR[settings.players];

  const startRound = (r, players) => {
    setRound(r);
    setGame(dealRound({ players, round: r }));
    setOrder([]); setFlipped(new Set()); setDrag(null); setResult(null);
    setMsg({ text: '', error: false });
    setMoveNo(n => n + 1);
  };
  const startGame = diff => {
    setDifficulty(diff);
    setTotals(Array(settings.players).fill(0));
    startRound(0, settings.players);
  };

  const trainLabel = (s, i) => {
    const owner = s.trains[i].owner;
    return owner === MEXICAN ? 'the Mexican Train' : owner === 0 ? 'your train' : `${names[owner]}'s train`;
  };

  /** Apply a move; report a problem instead of throwing. */
  const apply = (action, describe) => {
    try {
      const before = latest.current;
      const next = act(before, action);
      latest.current = next;
      setGame(next);
      setMoveNo(n => n + 1);
      setMsg({ text: describe ? describe(before, next) : '', error: false });
      if (next.phase === 'over') finishRound(next);
      return next;
    } catch (e) {
      setMsg({ text: e.message, error: true });
      return null;
    }
  };

  const finishRound = s => {
    const pts = roundScores(s);
    const nt = totals.map((v, i) => v + pts[i]);
    const last = round + 1 >= settings.rounds;
    setTotals(nt);
    setResult({ pts, totals: nt, outBy: s.outBy, last });
    if (last) api.post('/scores', { game: 'train', score: -nt[0], difficulty }).catch(() => {});   // negated: low scores rank high
  };

  const describe = seat => (before, next) => {
    const who = names[seat];
    if (next.phase === 'over') return next.outBy == null ? 'Nobody can play — the round is blocked.' : `${who === 'You' ? 'You play' : `${who} plays`} the last tile!`;
    if (next.hands[seat].length > before.hands[seat].length) return `${who === 'You' ? 'You draw' : `${who} draws`} a tile.`;
    const played = before.hands[seat].find(t => !next.hands[seat].some(n => n.id === t.id));
    if (!played) return `${who === 'You' ? 'You pass' : `${who} passes`} — ${who === 'You' ? 'your' : 'their'} train is open to everyone.`;
    const train = next.trains.findIndex((tr, i) => tr.tiles.length > before.trains[i].tiles.length);
    const placed = next.trains[train].tiles[next.trains[train].tiles.length - 1];   // as laid on the train
    const tileText = `${placed.a}|${placed.b}`;
    const extra = isDouble(played) ? ' — a double, which must be covered!' : '';
    return `${who === 'You' ? 'You play' : `${who} plays`} ${tileText} on ${trainLabel(next, train)}${extra}`;
  };

  // ── Computer turns ───────────────────────────────────────────────────────
  useEffect(() => {
    const g = latest.current;
    if (!g || g.phase !== 'play' || g.turn === 0) return;
    const seat = g.turn;
    const timer = setTimeout(() => apply(chooseAction(latest.current, difficulty), describe(seat)), AI_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNo]);

  // ── Setup ────────────────────────────────────────────────────────────────
  if (!difficulty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-sky-900 p-5 flex flex-col">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6 self-start min-h-[44px]">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <div className="text-6xl mb-3">🚂</div>
          <h1 className="game-title text-3xl mb-2">Mexican Train</h1>
          <p className="text-white/50 mb-5 text-center">Dominoes — play out your tiles, lowest score wins!</p>
          <p className="text-white/60 text-sm mb-2">Players (including you)</p>
          <div className="flex gap-3 mb-4">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setSettings(s => ({ ...s, players: n }))}
                className={`w-14 h-14 rounded-2xl font-bold text-xl border-2 ${settings.players === n ? 'border-game-gold bg-white/20 text-white' : 'border-white/20 bg-white/5 text-white/60'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="w-full space-y-2 mb-5">
            {LENGTHS.map(([n, text]) => (
              <button key={n} onClick={() => setSettings(s => ({ ...s, rounds: n }))}
                className={`w-full rounded-xl py-2 text-sm border-2 ${settings.rounds === n ? 'border-game-gold bg-white/20 text-white' : 'border-white/20 bg-white/5 text-white/60'}`}>
                {text}
              </button>
            ))}
          </div>
          <div className="w-full space-y-3">
            {[['easy', '😊 Easy'], ['medium', '🤔 Medium'], ['hard', '🔥 Hard']].map(([d, l]) => (
              <Button key={d} variant="primary" className="w-full text-lg" onClick={() => startGame(d)}>{l}</Button>
            ))}
          </div>
          <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mt-4 min-h-[44px]">
            <HelpCircle size={16} /> How to play
          </button>
        </div>
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Mexican Train" slides={TUTORIALS.train} />
      </div>
    );
  }
  if (!game) return null;

  // ── Table ────────────────────────────────────────────────────────────────
  const yourTurn = game.turn === 0 && game.phase === 'play';
  const moves = yourTurn ? legalMoves(game, 0) : [];
  const playableIds = new Set(moves.map(m => m.tileId));
  const targets = new Set(drag ? moves.filter(m => m.tileId === drag.id).map(m => m.train) : []);
  const inHand = new Map(game.hands[0].map(t => [t.id, t]));
  const hand = [
    ...order.filter(id => inHand.has(id)).map(id => inHand.get(id)),
    ...game.hands[0].filter(t => !order.includes(t.id)).sort((x, y) => x.a - y.a || x.b - y.b),   // e.g. a tile just drawn
  ];
  const canDraw = yourTurn && !moves.length && !game.drew && game.boneyard.length > 0;
  const canPass = yourTurn && !moves.length && (game.drew || !game.boneyard.length);

  const playOn = (tileId, train) => {
    if (!yourTurn) { setMsg({ text: 'Wait for your turn to play a tile.', error: true }); return; }
    if (!moves.some(m => m.tileId === tileId && m.train === train)) {
      setMsg({ text: `That tile can't go on ${trainLabel(game, train)} right now.`, error: true });
      return;
    }
    apply({ type: 'play', tileId, train }, describe(0));
  };

  // Tiles in your hand: a tap turns one round; drag to move it within your hand, or onto a train to play it
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
      // Slide the tile into the place of the one it's over
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
    if (!p.moved) {
      setFlipped(f => { const n = new Set(f); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; });
      return;
    }
    const { train } = dropTarget(e.clientX, e.clientY);
    if (train !== undefined) playOn(p.id, train);
  };
  const onTileCancel = () => { press.current = null; setDrag(null); };
  const dragged = drag && inHand.get(drag.id);
  const face = t => (flipped.has(t.id) ? { a: t.b, b: t.a } : { a: t.a, b: t.b });

  let hint = '';
  if (yourTurn) {
    if (game.pendingDouble != null) hint = `Cover the double on ${trainLabel(game, game.pendingDouble)}.`;
    else if (moves.length) hint = 'Drag a tile onto a lit-up train to play it. Tap a tile to turn it round.';
    else if (canDraw) hint = 'Nothing fits — draw a tile.';
    else hint = 'Still nothing fits — pass. Your train will be open to everyone until you play on it.';
  } else if (game.phase === 'play') hint = `${names[game.turn]} is playing… Drag your tiles to plan, and tap to turn them round.`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-sky-900 p-3 flex flex-col gap-2 select-none">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="train" title="Mexican Train" />
        </div>
        <div className="text-white/80 text-sm font-semibold text-center">
          Round {round + 1} of {settings.rounds} · {difficulty}
        </div>
        <div className="text-white/60 text-xs text-right">Boneyard: {game.boneyard.length}</div>
      </header>

      {/* Players and scores */}
      <div className="flex justify-center gap-2 flex-wrap text-xs">
        {names.map((name, seat) => (
          <div key={name} className={`px-3 py-1 rounded-full ${game.turn === seat && game.phase === 'play' ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {name} · {game.hands[seat].length} tiles · {totals[seat]} pts
          </div>
        ))}
      </div>

      {/* The hub: engine and trains */}
      <div className="card-panel p-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-white/60 text-xs">
          Engine <Domino a={game.engine} b={game.engine} small />
        </div>
        {game.trains.map((train, i) => {
          const canTarget = targets.has(i);
          const hovered = canTarget && drag?.train === i;
          const pending = game.pendingDouble === i;
          const shown = train.tiles.slice(-5);
          const hidden = train.tiles.length - shown.length;
          return (
            <div key={i} data-train={i}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 text-left min-h-[3rem] transition-colors
                ${hovered ? 'bg-game-gold/40 ring-4 ring-game-gold' : canTarget ? 'bg-game-gold/20 ring-2 ring-game-gold' : 'bg-white/5'}
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
                {pending ? `cover ${openEnd(game, i)}` : `needs ${openEnd(game, i)}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className={`text-center text-sm min-h-[1.25rem] ${msg.error ? 'text-red-300' : 'text-amber-300'}`}>{msg.text}</p>

      {/* Your tiles */}
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {hand.map(t => (
          <div key={t.id} data-tile={t.id} className={`touch-none cursor-grab ${drag?.id === t.id ? 'opacity-25' : ''}`}
            onPointerDown={e => onTileDown(e, t.id)} onPointerMove={onTileMove} onPointerUp={onTileUp} onPointerCancel={onTileCancel}>
            <Domino {...face(t)} dim={yourTurn && !playableIds.has(t.id)} />
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
        <Button variant="primary" disabled={!canDraw} onClick={() => apply({ type: 'draw' }, describe(0))}>Draw</Button>
        <Button variant="secondary" disabled={!canPass} onClick={() => apply({ type: 'pass' }, describe(0))}>Pass</Button>
      </div>
      <p className="text-center text-white/50 text-xs">{hint}</p>

      {result && (
        <ResultPanel>
          {result.last ? (() => {
            const best = Math.min(...result.totals);
            const winners = names.filter((_, i) => result.totals[i] === best);
            return (
              <>
                <div className="text-5xl mb-2">{winners.includes('You') ? '🏆' : '🚂'}</div>
                <h2 className="text-2xl font-bold text-game-gold mb-2">
                  {winners.includes('You') ? 'You win!' : `${winners.join(' & ')} ${winners.length > 1 ? 'win' : 'wins'}!`}
                </h2>
              </>
            );
          })() : (
            <h2 className="text-xl font-bold text-white mb-2">
              {result.outBy == null ? 'Round blocked' : `${names[result.outBy]} ${result.outBy === 0 ? 'go' : 'goes'} out!`}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>This round</th><th>Total</th></tr></thead>
            <tbody>
              {names.map((name, i) => (
                <tr key={name} className={i === 0 ? 'font-semibold' : ''}>
                  <td className="text-left">{name}</td><td>{result.pts[i]}</td><td>{result.totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.last ? (
            <Button variant="gold" className="w-full" onClick={() => startRound(round + 1, settings.players)}>
              Next round (engine {MAX_PIP - round - 1}|{MAX_PIP - round - 1})
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
              <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
            </div>
          )}
        </ResultPanel>
      )}
    </div>
  );
}
