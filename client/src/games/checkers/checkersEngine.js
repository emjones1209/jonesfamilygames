/**
 * A game of Checkers as a pure state machine, shared by the single-player
 * game (run in the browser) and play-together tables (run on the server).
 * Two players: seat 0 starts at the bottom of the board, seat 1 at the top
 * (see checkersRules.js). Black moves first; the players swap colours each
 * new game.
 *
 * `act(state, action)` returns the next state or throws an Error whose
 * message explains why the move isn't allowed:
 *   { type: 'move', seat, path }   path = the squares the piece visits, [[row, col], ...]
 *   { type: 'resign', seat }
 *   { type: 'newGame' }            play again (the colours swap)
 *
 * A game is drawn after 40 moves each with no capture and no man moving (only
 * kings shuffling about), or when the same position comes round a third time.
 */
import { startBoard, legalMoves, applyMove, sameMove, countPieces, chooseMove, other, SIZE } from './checkersRules.js';

export const QUIET_LIMIT = 80;       // half-moves (40 each) without a capture or a man moving

const key = s => s.turn + s.board.map(row => row.map(p => (p ? `${p.seat}${p.king ? 'K' : 'm'}` : '.')).join('')).join('/');

export function newGame({ black = 0, wins = [0, 0], draws = 0 } = {}) {
  const s = {
    board: startBoard(),
    black,                         // the seat playing Black (moves first)
    turn: black,
    phase: 'playing',              // playing | gameOver
    winner: null,                  // seat, or null for a draw
    reason: null,                  // 'noMoves' | 'resigned' | 'quiet' | 'repetition'
    lastMove: null,                // { seat, path, captures, crowned }
    quiet: 0,
    seen: {},                      // position → times seen (for the repetition draw)
    moveNo: 0,
    wins, draws,                   // running totals across games at this table
  };
  s.seen = { [key(s)]: 1 };
  return s;
}

// ── Queries ──────────────────────────────────────────────────────────────────
export const waitingFor = s => (s.phase === 'playing' ? s.turn : null);
export const legalFor = (s, seat) => (s.phase === 'playing' && s.turn === seat ? legalMoves(s.board, seat) : []);
export const colourOf = (s, seat) => (seat === s.black ? 'black' : 'red');

// ── Actions ──────────────────────────────────────────────────────────────────
function finish(s, winner, reason) {
  const wins = winner == null ? s.wins : s.wins.map((n, i) => (i === winner ? n + 1 : n));
  return { ...s, phase: 'gameOver', winner, reason, wins, draws: winner == null ? s.draws + 1 : s.draws };
}

export function act(s, a) {
  switch (a.type) {
    case 'move': {
      if (s.phase !== 'playing') throw new Error('The game is over.');
      if (a.seat !== s.turn) throw new Error('It\'s not your turn.');
      const moves = legalMoves(s.board, a.seat);
      const move = moves.find(m => sameMove(m, { path: a.path ?? [] }));
      if (!move) {
        const mustJump = moves[0]?.captures.length;
        throw new Error(mustJump ? 'You must jump! When a capture is possible you have to take it.' : 'That piece can\'t move there.');
      }
      const [[fr, fc]] = move.path;
      const piece = s.board[fr][fc];
      const board = applyMove(s.board, move);
      const [tr, tc] = move.path[move.path.length - 1];
      const crowned = !piece.king && board[tr][tc].king;
      const next = {
        ...s, board, turn: other(a.seat), moveNo: s.moveNo + 1,
        lastMove: { seat: a.seat, path: move.path, captures: move.captures, crowned },
        quiet: move.captures.length || !piece.king ? 0 : s.quiet + 1,
      };
      const k = key(next);
      next.seen = { ...s.seen, [k]: (s.seen[k] ?? 0) + 1 };
      if (!legalMoves(board, next.turn).length) return finish(next, a.seat, 'noMoves');
      if (next.quiet >= QUIET_LIMIT) return finish(next, null, 'quiet');
      if (next.seen[k] >= 3) return finish(next, null, 'repetition');
      return next;
    }

    case 'resign':
      if (s.phase !== 'playing') throw new Error('The game is over.');
      return finish(s, other(a.seat), 'resigned');

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ black: other(s.black), wins: s.wins, draws: s.draws });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  const move = chooseMove(s.board, seat, level);
  return { type: 'move', seat, path: move.path };
}

/** Pieces left for each seat: [{ men, kings }, { men, kings }]. */
export const pieces = s => countPieces(s.board);

// ── What each player may see ─────────────────────────────────────────────────
/** Nothing is hidden in Checkers. */
export const viewFor = s => s;

const flip = ([r, c]) => [SIZE - 1 - r, SIZE - 1 - c];

/** Turn the board round so that `seat` becomes seat 0, playing up from the bottom. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : other(x));
  return {
    ...s,
    board: s.board.map((row, ri) => row.map((_, ci) => {
      const p = s.board[SIZE - 1 - ri][SIZE - 1 - ci];
      return p && { ...p, seat: other(p.seat) };
    })),
    black: r(s.black), turn: r(s.turn), winner: r(s.winner),
    wins: [s.wins[1], s.wins[0]],
    lastMove: s.lastMove && {
      ...s.lastMove, seat: r(s.lastMove.seat), path: s.lastMove.path.map(flip), captures: s.lastMove.captures.map(flip),
    },
  };
}

/** A move made on a turned-round board, turned back (for play-together tables). */
export function unrotateAction(action, seat) {
  if (!seat || action.type !== 'move') return action;
  return { ...action, path: action.path.map(flip) };
}
