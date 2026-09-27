/**
 * A game of Chess as a pure state machine, shared by the single-player game
 * (run in the browser) and play-together tables (run on the server). Two
 * players; `white` is the seat playing White, and the colours swap each game.
 *
 * `act(state, action)` returns the next state or throws an Error whose
 * message explains why the move isn't allowed:
 *   { type: 'move', seat, from, to, promo? }   squares 0-63 (see chessRules.js); promo = N/B/R/Q type
 *   { type: 'resign', seat }
 *   { type: 'newGame' }
 *
 * The game ends in checkmate, stalemate, by resigning, or in a draw by the
 * 50-move rule, threefold repetition, or when neither side can checkmate.
 */
import {
  START, fromFen, legalMoves, afterMove, outcome, san, positionKey, sameSquares, inCheck, typeOf, colourOf,
} from './chessRules.js';
import { chooseMove } from './chessAI.js';

// Each piece keeps an id as it moves, so the board can slide it
function startIds(pos) {
  return pos.sq.map((p, i) => (p ? `${p > 0 ? 'w' : 'b'}${typeOf(p)}-${i}` : null));
}

export function newGame({ white = 0, wins = [0, 0], draws = 0, fen = START } = {}) {
  const pos = fromFen(fen);
  return {
    pos,
    ids: startIds(pos),
    white,                       // the seat playing White
    phase: 'playing',            // playing | gameOver
    winner: null,                // seat, or null for a draw
    reason: null,                // 'checkmate' | 'stalemate' | 'resigned' | 'fifty' | 'repetition' | 'material'
    lastMove: null,              // { seat, from, to, san, piece, captured, promo, flag }
    history: [],                 // moves so far, in SAN
    seen: { [positionKey(pos)]: 1 },
    wins, draws,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────
export const colourFor = (s, seat) => (seat === s.white ? 1 : -1);
export const seatFor = (s, colour) => (colour === 1 ? s.white : 1 - s.white);
export const waitingFor = s => (s.phase === 'playing' ? seatFor(s, s.pos.turn) : null);
export const legalFor = (s, seat) => (waitingFor(s) === seat ? legalMoves(s.pos) : []);

// ── Actions ──────────────────────────────────────────────────────────────────
function finish(s, winner, reason) {
  const wins = winner == null ? s.wins : s.wins.map((n, i) => (i === winner ? n + 1 : n));
  return { ...s, phase: 'gameOver', winner, reason, wins, draws: winner == null ? s.draws + 1 : s.draws };
}

function moveIds(ids, m) {
  const next = [...ids];
  next[m.to] = next[m.from];
  next[m.from] = null;
  if (m.flag === 'ep') next[m.to + (colourOf(m.piece) > 0 ? 8 : -8)] = null;
  if (m.flag === 'castle') {
    const kingSide = m.to > m.from;
    const rookFrom = kingSide ? m.from + 3 : m.from - 4, rookTo = kingSide ? m.from + 1 : m.from - 1;
    next[rookTo] = next[rookFrom];
    next[rookFrom] = null;
  }
  return next;
}

export function act(s, a) {
  switch (a.type) {
    case 'move': {
      if (s.phase !== 'playing') throw new Error('The game is over.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const moves = legalMoves(s.pos);
      const m = moves.find(x => sameSquares(x, a.from, a.to, a.promo));
      if (!m) {
        const mine = moves.some(x => x.from === a.from);
        throw new Error(inCheck(s.pos) && mine ? 'Your king is in check — you must get it out of check.'
          : mine ? 'That piece can\'t move there.' : 'Pick one of your pieces that can move.');
      }
      const name = san(s.pos, m, moves);
      const pos = afterMove(s.pos, m);
      const k = positionKey(pos);
      const next = {
        ...s, pos, ids: moveIds(s.ids, m),
        lastMove: { seat: a.seat, from: m.from, to: m.to, san: name, piece: m.piece, captured: m.captured, promo: m.promo, flag: m.flag },
        history: [...s.history, name],
        seen: { ...s.seen, [k]: (s.seen[k] ?? 0) + 1 },
      };
      const end = outcome(pos);
      if (end === 'checkmate') return finish(next, a.seat, 'checkmate');
      if (end) return finish(next, null, end);
      if (next.seen[k] >= 3) return finish(next, null, 'repetition');
      return next;
    }

    case 'resign':
      if (s.phase !== 'playing') throw new Error('The game is over.');
      return finish(s, 1 - a.seat, 'resigned');

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ white: 1 - s.white, wins: s.wins, draws: s.draws });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  const m = chooseMove(s.pos, level);
  return { type: 'move', seat, from: m.from, to: m.to, promo: m.promo || undefined };
}

// ── What each player may see ─────────────────────────────────────────────────
export const viewFor = s => s;                       // nothing is hidden in chess

/**
 * Turn a state round so that `seat` becomes seat 0. The board itself isn't
 * turned (the screen shows it from the player's colour); only who's who.
 */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : 1 - x);
  return {
    ...s, white: r(s.white), winner: r(s.winner), wins: [s.wins[1], s.wins[0]],
    lastMove: s.lastMove && { ...s.lastMove, seat: r(s.lastMove.seat) },
  };
}
