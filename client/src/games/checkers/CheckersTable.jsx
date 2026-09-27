/**
 * CheckersTable — the Checkers screen, drawn from a game view (see
 * checkersEngine.js) in which the player looking at it is seat 0, playing up
 * from the bottom. Used by the single-player game and by play-together tables.
 *
 * Help for beginners: dots show where the piece you picked up can go, pieces
 * that must jump are outlined, your pieces that could be captured get a red
 * ring, and Suggest shows a good move and says why.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Lightbulb, Undo2, Flag } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import { BoardGrid } from '../board/BoardGrid';
import { threatened, chooseMove, explainMove } from './checkersRules';
import { waitingFor, legalFor, colourOf, pieces } from './checkersEngine';

const BG = 'from-game-bg to-amber-950';
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const key = ([r, c]) => `${r},${c}`;
const COLOURS = {
  black: { fill: 'radial-gradient(circle at 35% 30%, #4b5563, #111827 70%)', ring: '#9ca3af', name: 'Black' },
  red: { fill: 'radial-gradient(circle at 35% 30%, #f87171, #b91c1c 70%)', ring: '#fecaca', name: 'Red' },
};

function Piece({ colour, king }) {
  const c = COLOURS[colour];
  return (
    <div className="rounded-full flex items-center justify-center shadow-lg"
      style={{ width: '78%', height: '78%', background: c.fill, boxShadow: `inset 0 0 0 3px ${c.ring}55, 0 3px 6px rgba(0,0,0,.45)` }}>
      <div className="rounded-full" style={{ width: '62%', height: '62%', boxShadow: `inset 0 0 0 2px ${c.ring}88` }}>
        {king && <div className="w-full h-full flex items-center justify-center" style={{ fontSize: '5.5cqw' }}>👑</div>}
      </div>
    </div>
  );
}

const describe = (m, names) => {
  if (!m) return '';
  const who = names[m.seat], you = m.seat === 0;
  const n = m.captures.length;
  const jumped = n ? `${who} ${you ? 'jump' : 'jumps'} ${n === 1 ? 'a piece' : `${n} pieces`}!` : `${who} ${you ? 'move' : 'moves'}.`;
  return m.crowned ? `${jumped} ${you ? 'Your' : `${who}'s`} piece is crowned king 👑` : jumped;
};

const REASONS = {
  noMoves: 'No moves left',
  resigned: 'Resigned',
  quiet: 'Draw: 40 moves each with no captures',
  repetition: 'Draw: the same position three times',
};

/**
 * @param view        game view with the viewer as seat 0 (at the bottom)
 * @param names       [you, opponent]
 * @param onUndo      single-player only: take back your last move
 */
export function CheckersTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions, onUndo }) {
  const [path, setPath] = useState([]);           // the squares of the move you're making
  const [hint, setHint] = useState(null);         // { move, reasons } from Suggest
  const [confirmResign, setConfirmResign] = useState(false);
  const myTurn = waitingFor(view) === 0;
  const moves = useMemo(() => legalFor(view, 0), [view]);
  const mustJump = myTurn && moves[0]?.captures.length > 0;
  const danger = useMemo(() => (myTurn ? threatened(view.board, 0) : []), [view, myTurn]);
  const myColour = colourOf(view, 0), theirColour = colourOf(view, 1);
  const count = pieces(view);

  // Moves that begin with the squares picked so far
  const matching = path.length ? moves.filter(m => path.every((sq, i) => m.path[i] && same(m.path[i], sq))) : [];
  const nextSquares = matching.map(m => m.path[path.length]).filter(Boolean);

  const reset = () => { setPath([]); };
  const send = move => {
    setPath([]); setHint(null);
    onAction({ type: 'move', seat: 0, path: move.path });
  };

  const tap = (r, c) => {
    if (!myTurn) return;
    const sq = [r, c];
    // Carry on the move you've started
    if (path.length && nextSquares.some(n => same(n, sq))) {
      const next = [...path, sq];
      const done = matching.filter(m => m.path.length === next.length && same(m.path[next.length - 1], sq));
      const longer = matching.filter(m => m.path.length > next.length && same(m.path[next.length], sq));
      if (done.length && !longer.length) return send(done[0]);
      return setPath(next);
    }
    // Pick up one of your pieces that can move
    if (moves.some(m => same(m.path[0], sq))) return setPath([sq]);
    reset();
  };

  const suggest = () => {
    if (!myTurn || !moves.length) return;
    const move = chooseMove(view.board, 0, 'hard');
    setHint({ move, reasons: explainMove(view.board, 0, move) });
    setPath([]);
  };

  // Marks on the board
  const marks = {};
  const mark = (sq, kind) => { (marks[key(sq)] ||= []).push(kind); };
  if (view.lastMove) { mark(view.lastMove.path[0], 'last'); mark(view.lastMove.path[view.lastMove.path.length - 1], 'last'); }
  if (myTurn) {
    for (const sq of danger) mark(sq, 'danger');
    if (hint) for (const sq of hint.move.path) mark(sq, 'hint');
    if (path.length) {
      mark(path[0], 'selected');
      for (const sq of path.slice(1)) mark(sq, 'hint');
      for (const sq of nextSquares) mark(sq, matching.some(m => m.captures.length) ? 'capture' : 'target');
    } else if (mustJump) {
      for (const m of moves) mark(m.path[0], 'movable');
    }
  }

  const boardPieces = [];
  view.board.forEach((row, r) => row.forEach((p, c) => {
    if (p) boardPieces.push({ id: p.id, row: r, col: c, node: <Piece colour={colourOf(view, p.seat)} king={p.king} /> });
  }));

  const over = view.phase === 'gameOver';
  const status = over ? '' : myTurn
    ? (mustJump ? 'You must jump! Tap an outlined piece.' : path.length ? 'Tap a dot to move there (or another piece).' : 'Your turn — tap a piece to move.')
    : `${names[1]} is thinking…`;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col items-center gap-2 select-none`}>
      <header className="self-stretch flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="checkers" title="Checkers" />
        </div>
        <div className="text-white/80 text-sm font-semibold">Checkers{subtitle ? ` · ${subtitle}` : ''}</div>
        <div className="text-white/70 text-xs text-right">
          <div className="font-semibold text-white/90">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}</div>
          {view.draws > 0 && <div>{view.draws} drawn</div>}
        </div>
      </header>

      <PlayerLine name={names[1]} colour={theirColour} count={count[1]} active={waitingFor(view) === 1} reaction={reactions[1]} />
      <BoardGrid marks={marks} pieces={boardPieces} onSquare={myTurn ? tap : undefined} />
      <PlayerLine name={names[0]} colour={myColour} count={count[0]} active={myTurn} reaction={reactions[0]} />

      <div className="text-center min-h-[3rem] max-w-md">
        <p className={`font-semibold ${error ? 'text-red-300' : mustJump ? 'text-game-gold' : 'text-white/80'}`}>{error || status}</p>
        <p className="text-white/50 text-sm">{describe(view.lastMove, names)}</p>
        {myTurn && danger.length > 0 && !hint && (
          <p className="text-red-300 text-xs">Red ring: {danger.length === 1 ? 'that piece' : 'those pieces'} could be captured next turn.</p>
        )}
      </div>
      {hint && myTurn && (
        <div className="max-w-md bg-green-500/15 border border-green-400/40 rounded-2xl px-4 py-2 text-sm text-white/90">
          <div className="font-semibold text-green-300 mb-0.5">💡 Try the green move:</div>
          {hint.reasons.map(t => <div key={t}>• {t}</div>)}
        </div>
      )}

      {!over && (
        <div className="flex gap-2 flex-wrap justify-center">
          <Button variant="ghost" disabled={!myTurn} onClick={suggest}><Lightbulb size={16} className="inline -mt-0.5" /> Suggest</Button>
          {onUndo && <Button variant="ghost" disabled={!onUndo.enabled} onClick={() => { reset(); setHint(null); onUndo.run(); }}><Undo2 size={16} className="inline -mt-0.5" /> Undo</Button>}
          <Button variant={confirmResign ? 'danger' : 'ghost'} onClick={() => {
            if (!confirmResign) { setConfirmResign(true); setTimeout(() => setConfirmResign(false), 3000); return; }
            setConfirmResign(false); onAction({ type: 'resign', seat: 0 });
          }}>
            <Flag size={16} className="inline -mt-0.5" /> {confirmResign ? 'Tap again to resign' : 'Resign'}
          </Button>
        </div>
      )}
      {overlay}

      {over && (
        <ResultPanel>
          <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : view.winner == null ? '🤝' : '😢'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-1">
            {view.winner == null ? 'It\'s a draw' : view.winner === 0 ? `${names[0]} win!` : `${names[1]} wins!`}
          </h2>
          <p className="text-white/60 text-sm mb-3">
            {view.reason === 'noMoves' ? `${names[view.winner === 0 ? 1 : 0]} ${view.winner === 0 ? 'has' : 'have'} no moves left.`
              : view.reason === 'resigned' ? `${names[view.winner === 0 ? 1 : 0]} resigned.` : REASONS[view.reason]}
          </p>
          <p className="text-white/80 text-sm mb-4">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}{view.draws ? ` · ${view.draws} drawn` : ''}</p>
          {gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}

function PlayerLine({ name, colour, count, active, reaction }) {
  const lost = 12 - count.men - count.kings;
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${active ? 'bg-game-gold text-game-bg font-bold' : 'text-white/70'}`}>
      <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: COLOURS[colour].fill }} />
      {name} · {COLOURS[colour].name} · {count.men + count.kings} left{count.kings ? ` (${count.kings} 👑)` : ''}
      {lost > 0 && <span className="opacity-70">· lost {lost}</span>}
      {reaction && <span>{reaction}</span>}
    </div>
  );
}
