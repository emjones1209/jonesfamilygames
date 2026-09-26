/**
 * A whole game of Mexican Train (several rounds) as a pure state machine,
 * shared by the single-player game (run in the browser) and play-together
 * tables (run on the server). The rules of a round are in trainRules.js and
 * the computer players in trainAI.js.
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed. Every move names the acting seat:
 *   { type: 'play', seat, tileId, train }   train = index into state.trains
 *   { type: 'draw', seat }
 *   { type: 'pass', seat }
 *   { type: 'nextRound' }                   deal the next round after the scores are shown
 *   { type: 'newGame' }                     start again after the last round
 *
 * `waitingFor(state)` says whose move it is; `robotAction(state, seat, level)`
 * picks a computer player's move; `viewFor(state, seat)` hides the other hands
 * and the boneyard.
 */
import { dealRound, act as rulesAct, roundScores, isDouble, MEXICAN } from './trainRules.js';
import { chooseAction } from './trainAI.js';

export const ROUND_CHOICES = [3, 7, 13];

// Phases: play | roundOver | gameOver (trainRules marks a finished round 'over')
function deal({ players, rounds, totals, history, lastRound, winners }, round) {
  return { ...dealRound({ players, round }), rounds, totals, history, lastRound, winners, lastMove: null };
}

export function newGame({ players = 4, rounds = 13 } = {}) {
  return deal({ players, rounds, totals: Array(players).fill(0), history: [], lastRound: null, winners: null }, 0);
}

/** The seat whose move it is, or null between rounds. */
export const waitingFor = s => (s.phase === 'play' ? s.turn : null);

/** What just happened, for "Dad plays 5|9 on the Mexican Train". */
function moveOf(before, after, seat, action) {
  if (action.type !== 'play') return { seat, kind: action.type };
  const train = action.train;
  const tiles = after.trains[train].tiles;
  return { seat, kind: 'play', tile: tiles[tiles.length - 1], train, double: isDouble(tiles[tiles.length - 1]) };
}

export function act(s, a) {
  switch (a.type) {
    case 'play': case 'draw': case 'pass': {
      if (s.phase !== 'play') throw new Error('The round is over.');
      if (a.seat !== s.turn) throw new Error('It\'s not your turn.');
      const next = rulesAct(s, { type: a.type, tileId: a.tileId, train: a.train });
      const moved = { ...next, lastMove: moveOf(s, next, a.seat, a) };
      return next.phase === 'over' ? finishRound(moved) : moved;
    }

    case 'nextRound':
      if (s.phase !== 'roundOver') return s;
      return deal(s, s.round + 1);

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ players: s.players, rounds: s.rounds });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

function finishRound(s) {
  const scores = roundScores(s);
  const totals = s.totals.map((t, i) => t + scores[i]);
  const last = s.round + 1 >= s.rounds;
  const best = Math.min(...totals);
  return {
    ...s, totals,
    history: [...s.history, scores],
    lastRound: { scores, outBy: s.outBy },
    phase: last ? 'gameOver' : 'roundOver',
    winners: last ? totals.map((t, i) => (t === best ? i : -1)).filter(i => i >= 0) : null,
  };
}

// ── Computer players ─────────────────────────────────────────────────────────
/** The move a computer player at `seat` makes now (it must be their turn). */
export const robotAction = (s, seat, level) => ({ ...chooseAction(s, level), seat });

// ── What each player may see ─────────────────────────────────────────────────
const hide = tiles => tiles.map(() => null);   // keeps the count, drops the tiles

/** The state as `seat` may see it: only their own hand; the boneyard is face down. */
export function viewFor(s, seat) {
  return { ...s, hands: s.hands.map((h, i) => (i === seat ? h : hide(h))), boneyard: hide(s.boneyard) };
}

/**
 * Turn a state (or view) round so that `seat` becomes seat 0 — each player's
 * screen always shows them first. The players' trains turn round with them;
 * the Mexican Train stays last.
 */
export function rotate(s, seat) {
  if (!seat) return s;
  const n = s.players;
  const r = x => (x == null ? x : (x - seat + n) % n);
  const arr = a => a && a.map((_, i) => a[(i + seat) % n]);
  const train = i => (i == null || i >= n ? i : r(i));                   // train index (the Mexican Train is n)
  const trains = [...arr(s.trains.slice(0, n)), s.trains[n]]
    .map(t => ({ ...t, owner: t.owner === MEXICAN ? MEXICAN : r(t.owner) }));
  return {
    ...s,
    turn: r(s.turn), outBy: r(s.outBy),
    hands: arr(s.hands), totals: arr(s.totals), history: s.history.map(arr),
    trains, pendingDouble: train(s.pendingDouble),
    winners: s.winners && s.winners.map(r),
    lastMove: s.lastMove && { ...s.lastMove, seat: r(s.lastMove.seat), train: train(s.lastMove.train) },
    lastRound: s.lastRound && { scores: arr(s.lastRound.scores), outBy: r(s.lastRound.outBy) },
  };
}
