/**
 * ChessTable — the Chess screen, drawn from a game view (see chessEngine.js)
 * in which the player looking at it is seat 0. The board is shown from your
 * colour's side. Used by the single-player game and by play-together tables.
 *
 * The coach (on unless you turn it off): pieces you could lose get a red ring,
 * a warning pops up before a move that gives a piece away or allows
 * checkmate, and after your opponent moves it says what they're threatening.
 * Suggest shows a good move and why.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Lightbulb, Undo2, Flag, GraduationCap, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import { ChessBoard } from './ChessBoard';
import { glyph } from './chessGlyphs';
import { P, N, B, R, Q, K, NAMES, inCheck, kingSquare, squareName, typeOf } from './chessRules';
import { rankMoves } from './chessAI';
import { hanging, warnMove, explainMove, threatsAfter } from './chessCoach';
import { waitingFor, legalFor, colourFor } from './chessEngine';

const BG = 'from-game-bg to-emerald-950';
const COACH_KEY = 'chessCoach';
const START_COUNT = { [P]: 8, [N]: 2, [B]: 2, [R]: 2, [Q]: 1 };

const TIPS = [
  ['🎯', 'Control the middle', 'Pawns and pieces in the centre (d4, e4, d5, e5) reach more of the board.'],
  ['🐴', 'Get your pieces out', 'Move your knights and bishops off the back row early — they can\'t help from there.'],
  ['🏰', 'Castle early', 'Castling tucks your king safely in the corner and wakes up a rook.'],
  ['👑', 'Keep your queen home at first', 'Bring the queen out too early and your opponent can chase it around while developing their pieces.'],
  ['🔍', 'Check before you move', 'Ask: what does their last move attack? Is the square I\'m moving to safe?'],
  ['⚖️', 'Know what pieces are worth', 'Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9. Don\'t swap a big piece for a small one.'],
];

const readCoach = () => { try { return localStorage.getItem(COACH_KEY) !== 'off'; } catch { return true; } };

function describe(m, names, sq) {
  if (!m) return '';
  const who = names[m.seat], you = m.seat === 0;
  const piece = NAMES[typeOf(m.piece)];
  if (m.flag === 'castle') return `${who} castled ${m.to > m.from ? 'on the king\'s side' : 'on the queen\'s side'}.`;
  if (m.promo) return `${who} ${you ? 'promote' : 'promoted'} a pawn to a ${NAMES[m.promo]} on ${squareName(m.to)}!`;
  if (m.captured) return `${who} took ${you ? 'their' : 'your'} ${NAMES[typeOf(m.captured)]} on ${squareName(m.to)} with ${you ? 'your' : 'a'} ${piece}${m.flag === 'ep' ? ' (en passant)' : ''}.`;
  return `${who} moved ${you ? 'your' : 'a'} ${piece} to ${squareName(m.to)}.${sq && inCheck({ sq, turn: -Math.sign(m.piece) }) ? ' Check!' : ''}`;
}

const REASONS = {
  checkmate: 'Checkmate!',
  stalemate: 'Stalemate: no legal move, but not in check — a draw.',
  resigned: 'Resigned.',
  fifty: 'Draw: 50 moves each with no capture or pawn move.',
  repetition: 'Draw: the same position three times.',
  material: 'Draw: neither side has enough pieces left to checkmate.',
};

/**
 * @param view       game view with the viewer as seat 0
 * @param names      [you, opponent]
 * @param onUndo     single-player only: { enabled, run }
 * @param onLearn    open the lessons (single-player)
 */
export function ChessTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions, onUndo, onLearn }) {
  const [sel, setSel] = useState(null);                 // the square of the piece you picked up
  const [promoAsk, setPromoAsk] = useState(null);       // { from, to } waiting for a piece choice
  const [warning, setWarning] = useState(null);         // { move, text } before a risky move
  const [hint, setHint] = useState(null);               // { move, reasons }
  const [coach, setCoach] = useState(readCoach);
  const [tips, setTips] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);

  const me = colourFor(view, 0);
  const myTurn = waitingFor(view) === 0;
  const pos = view.pos;
  const moves = useMemo(() => legalFor(view, 0), [view]);
  const loose = useMemo(() => (coach && myTurn ? hanging(pos, me) : []), [pos, me, coach, myTurn]);
  const notes = useMemo(() => (coach && myTurn ? threatsAfter(pos, me) : []), [pos, me, coach, myTurn]);
  const over = view.phase === 'gameOver';

  const toggleCoach = () => {
    setCoach(c => {
      try { localStorage.setItem(COACH_KEY, c ? 'off' : 'on'); } catch { /* private mode */ }
      return !c;
    });
  };

  const send = (m, promo) => {
    setSel(null); setPromoAsk(null); setWarning(null); setHint(null);
    onAction({ type: 'move', seat: 0, from: m.from, to: m.to, promo: promo || undefined });
  };
  const attempt = (m, promo) => {
    const text = coach ? warnMove(pos, promo ? { ...m, promo } : m) : null;
    if (text) { setWarning({ move: m, promo, text }); setPromoAsk(null); return; }
    send(m, promo);
  };

  const tap = i => {
    if (!myTurn || promoAsk || warning) return;
    if (sel != null) {
      const here = moves.filter(m => m.from === sel && m.to === i);
      if (here.length) {
        if (here.some(m => m.promo)) { setPromoAsk({ from: sel, to: i }); return; }
        attempt(here[0]);
        return;
      }
    }
    setSel(moves.some(m => m.from === i) ? i : null);
  };

  const suggest = () => {
    if (!myTurn || !moves.length) return;
    const move = rankMoves(pos, 'hard')[0].move;
    setHint({ move, reasons: explainMove(pos, move) });
    setSel(null);
  };

  // Marks on the board
  const marks = {};
  const mark = (i, kind) => { (marks[i] ||= []).push(kind); };
  if (view.lastMove) { mark(view.lastMove.from, 'last'); mark(view.lastMove.to, 'last'); }
  if (!over && inCheck(pos)) mark(kingSquare(pos.sq, pos.turn), 'check');
  for (const h of loose) mark(h.square, 'danger');
  if (hint && myTurn) { mark(hint.move.from, 'hint'); mark(hint.move.to, 'hint'); }
  if (sel != null) {
    mark(sel, 'selected');
    for (const m of moves.filter(x => x.from === sel)) mark(m.to, m.captured ? 'capture' : 'target');
  }

  // Pieces each side has lost
  const lost = colour => {
    const have = {};
    for (const p of pos.sq) if (p && Math.sign(p) === colour) have[typeOf(p)] = (have[typeOf(p)] ?? 0) + 1;
    return [Q, R, B, N, P].flatMap(t => Array(Math.max(0, START_COUNT[t] - (have[t] ?? 0))).fill(t));
  };

  const status = over ? '' : myTurn
    ? (inCheck(pos) ? 'Check! Get your king out of danger.' : sel != null ? 'Tap a dot to move there — or pick another piece.' : 'Your turn — tap a piece to move it.')
    : `${names[1]} is thinking…`;
  const lastLine = view.lastMove && view.lastMove.seat === 1 ? describe(view.lastMove, names, pos.sq) : '';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col items-center gap-2 select-none`}>
      <header className="self-stretch flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="chess" title="Chess" />
        </div>
        <div className="text-white/80 text-sm font-semibold">Chess{subtitle ? ` · ${subtitle}` : ''}</div>
        <div className="text-white/70 text-xs text-right">
          <div className="font-semibold text-white/90">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}</div>
          {view.draws > 0 && <div>{view.draws} drawn</div>}
        </div>
      </header>

      <PlayerLine name={names[1]} colour={-me} lost={lost(-me)} active={waitingFor(view) === 1} reaction={reactions[1]} />
      <ChessBoard sq={pos.sq} ids={view.ids} flip={me === -1} marks={marks} onSquare={myTurn ? tap : undefined} />
      <PlayerLine name={names[0]} colour={me} lost={lost(me)} active={myTurn} reaction={reactions[0]} />

      <div className="text-center max-w-md min-h-[3rem]">
        <p className={`font-semibold ${error ? 'text-red-300' : myTurn && inCheck(pos) ? 'text-red-300' : 'text-white/85'}`}>{error || status}</p>
        {lastLine && <p className="text-white/55 text-sm">{lastLine}</p>}
        {coach && notes.filter(n => !n.startsWith('Check!')).map(n => <p key={n} className="text-amber-300 text-sm">{n}</p>)}
      </div>

      {hint && myTurn && (
        <div className="max-w-md bg-green-500/15 border border-green-400/40 rounded-2xl px-4 py-2 text-sm text-white/90">
          <div className="font-semibold text-green-300 mb-0.5">💡 Try moving from {squareName(hint.move.from)} to {squareName(hint.move.to)} (in green):</div>
          {hint.reasons.map(t => <div key={t}>• {t}</div>)}
        </div>
      )}

      {!over && (
        <div className="flex gap-2 flex-wrap justify-center">
          <Button variant="ghost" disabled={!myTurn} onClick={suggest}><Lightbulb size={16} className="inline -mt-0.5" /> Suggest</Button>
          {onUndo && <Button variant="ghost" disabled={!onUndo.enabled} onClick={() => { setSel(null); setHint(null); onUndo.run(); }}><Undo2 size={16} className="inline -mt-0.5" /> Undo</Button>}
          <Button variant={coach ? 'gold' : 'ghost'} onClick={toggleCoach}><GraduationCap size={16} className="inline -mt-0.5" /> Coach {coach ? 'on' : 'off'}</Button>
          <Button variant="ghost" onClick={() => setTips(t => !t)}><HelpCircle size={16} className="inline -mt-0.5" /> Tips</Button>
          {onLearn && <Button variant="ghost" onClick={onLearn}>📚 Lessons</Button>}
          <Button variant={confirmResign ? 'danger' : 'ghost'} onClick={() => {
            if (!confirmResign) { setConfirmResign(true); setTimeout(() => setConfirmResign(false), 3000); return; }
            setConfirmResign(false); onAction({ type: 'resign', seat: 0 });
          }}>
            <Flag size={16} className="inline -mt-0.5" /> {confirmResign ? 'Tap again to resign' : 'Resign'}
          </Button>
        </div>
      )}
      {coach && !over && <p className="text-white/35 text-xs text-center max-w-md">Coach: a red ring means that piece could be taken for free. You&apos;ll be warned before a risky move.</p>}

      {tips && (
        <div className="max-w-md w-full card-panel text-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-white">Tips for good chess</span>
            <button className="text-white/50 text-xs" onClick={() => setTips(false)}>Close</button>
          </div>
          {TIPS.map(([emoji, head, body]) => (
            <div key={head} className="mb-2"><span className="mr-1">{emoji}</span><b className="text-white">{head}.</b> <span className="text-white/70">{body}</span></div>
          ))}
        </div>
      )}
      {overlay}

      {/* Which piece should the pawn become? */}
      {promoAsk && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setPromoAsk(null)}>
          <div className="card-panel text-center" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold mb-1">Your pawn reached the end!</p>
            <p className="text-white/60 text-sm mb-3">Choose what it becomes (a queen is almost always best):</p>
            <div className="flex gap-2 justify-center">
              {[Q, R, B, N].map(t => (
                <button key={t} onClick={() => attempt(moves.find(m => m.from === promoAsk.from && m.to === promoAsk.to && m.promo === t), t)}
                  className="w-16 h-16 rounded-xl bg-[#eeeed2] flex flex-col items-center justify-center active:scale-95">
                  <span className="text-4xl leading-none" style={{ color: me > 0 ? '#fff' : '#1c1917', textShadow: '0 0 2px #1c1917' }}>{glyph(t)}</span>
                  <span className="text-[10px] text-gray-700">{NAMES[t]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The coach's warning before a risky move */}
      {warning && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="card-panel text-center max-w-sm">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-white font-semibold mb-4">{warning.text}</p>
            <div className="flex gap-3">
              <Button variant="gold" className="flex-1" onClick={() => { setWarning(null); setSel(null); }}>Pick another move</Button>
              <Button variant="ghost" className="flex-1" onClick={() => send(warning.move, warning.promo)}>Move anyway</Button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <ResultPanel>
          <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : view.winner == null ? '🤝' : '😢'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-1">
            {view.winner == null ? 'It\'s a draw' : view.winner === 0 ? `${names[0]} win!` : `${names[1]} wins!`}
          </h2>
          <p className="text-white/60 text-sm mb-3">
            {view.reason === 'resigned' ? `${names[view.winner === 0 ? 1 : 0]} resigned.` : REASONS[view.reason]}
            {view.reason === 'checkmate' && ` ${view.winner === 0 ? 'Their' : 'Your'} king was trapped.`}
          </p>
          <p className="text-white/80 text-sm mb-4">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}{view.draws ? ` · ${view.draws} drawn` : ''}</p>
          {gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}

function PlayerLine({ name, colour, lost, active, reaction }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${active ? 'bg-game-gold text-game-bg font-bold' : 'text-white/70'}`}>
      <span className="inline-block w-3.5 h-3.5 rounded-full border border-black/40" style={{ background: colour > 0 ? '#fff' : '#1c1917' }} />
      {name} · {colour > 0 ? 'White' : 'Black'}
      {lost.length > 0 && <span className="opacity-70 tracking-tighter" title="Pieces lost">lost {lost.map(t => glyph(t)).join('')}</span>}
      {reaction && <span>{reaction}</span>}
    </div>
  );
}
