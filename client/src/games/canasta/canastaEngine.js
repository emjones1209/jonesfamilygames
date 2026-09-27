/**
 * A whole game of partnership Canasta (hand after hand, to 5000) as a pure
 * state machine, shared by the single-player game (run in the browser) and
 * play-together tables (run on the server). The rules of a hand are in
 * canastaRules.js and the computer players in canastaAI.js.
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2. `act(state, action)` returns the
 * next state or throws an Error explaining why the move isn't allowed. Moves
 * name the acting seat (see canastaRules.js for what each does):
 *   { type: 'draw', seat }  { type: 'takePile', seat, ids }  { type: 'meld', seat, ids, rank? }
 *   { type: 'undo', seat }  { type: 'discard', seat, id }
 *   { type: 'nextHand' }    { type: 'newGame' }
 *
 * A computer player plans its whole turn at once but plays it a step at a
 * time (so people can follow it): the rest of the plan waits in `robotPlan`,
 * which nobody is ever sent.
 */
import {
  dealHand, act as rulesAct, scoreHand, gameWinner, teamOf, nextSeat, topOfPile, isWild,
} from './canastaRules.js';
import { chooseDraw, choosePlay } from './canastaAI.js';

const SEATS = [0, 1, 2, 3];
const MOVES = ['draw', 'takePile', 'meld', 'undo', 'discard'];

function deal(game, dealer) {
  return { ...dealHand({ dealer, scores: game.scores }), handNo: game.handNo, moves: [], robotPlan: null, result: null, winner: null };
}

export function newGame({ dealer = 3 } = {}) {
  return deal({ scores: [0, 0], handNo: 0 }, dealer);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** The seat whose move it is (null between hands). Phases: draw | play | handOver | gameOver. */
export const waitingFor = s => (s.phase === 'draw' || s.phase === 'play' ? s.turn : null);

/** What a move did, for "Phoebe takes the pile (7 cards) with the 9s!" */
function describe(before, after, seat, a) {
  const team = teamOf(seat);
  switch (a.type) {
    case 'draw': return { seat, kind: 'draw', reds: after.redThrees[team].length - before.redThrees[team].length };
    case 'takePile': return { seat, kind: 'takePile', count: before.discard.length, rank: topOfPile(before).rank };
    case 'meld': {
      const cards = a.ids.map(id => before.hands[seat].find(c => c.id === id)).filter(Boolean);
      const rank = cards.find(c => !isWild(c))?.rank ?? a.rank;
      return { seat, kind: 'meld', rank, count: cards.length, added: before.melds[team].some(m => m.rank === rank) };
    }
    case 'discard': return { seat, kind: 'discard', card: before.hands[seat].find(c => c.id === a.id) };
    default: return { seat, kind: a.type };
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  if (MOVES.includes(a.type)) {
    if (s.phase !== 'draw' && s.phase !== 'play') throw new Error('The hand is over.');
    if (a.seat !== s.turn) throw new Error('It\'s not your turn.');
    const { seat, plan, ...move } = a;
    const next = rulesAct(s, move);
    const moved = {
      ...next,
      moves: [describe(s, next, seat, a), ...s.moves].slice(0, 2),     // the latest move, and the one before
      robotPlan: Array.isArray(plan) && plan.length && next.phase === 'play' ? { seat, steps: plan } : null,
    };
    return next.phase === 'over' ? finishHand(moved) : moved;
  }
  switch (a.type) {
    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return { ...deal({ scores: s.scores, handNo: s.handNo + 1 }, nextSeat(s.dealer)) };
    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ dealer: nextSeat(s.dealer) });
    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

function finishHand(s) {
  const res = scoreHand(s);
  const scores = [s.scores[0] + res[0].total, s.scores[1] + res[1].total];
  const winner = gameWinner(scores);
  return { ...s, scores, result: { res, outBy: s.outBy }, winner, robotPlan: null, phase: winner != null ? 'gameOver' : 'handOver' };
}

// ── Computer players ─────────────────────────────────────────────────────────
const works = (s, step) => { try { rulesAct(s, step); return true; } catch { return false; } };

/** The next step of a computer player's turn (it must be their turn). */
export function robotAction(s, seat, level) {
  if (s.phase === 'draw') return { ...chooseDraw(s, level), seat };
  let steps = s.robotPlan?.seat === seat ? s.robotPlan.steps : null;
  if (!steps?.length || !works(s, steps[0])) steps = choosePlay(s, level);     // plan (or re-plan) the turn
  const [step, ...rest] = steps;
  return { ...step, seat, plan: rest };
}

// ── What each player may see ─────────────────────────────────────────────────
/** Only your own hand; the stock is face down; nobody sees a computer player's plans. */
export function viewFor(s, seat) {
  const hide = cards => cards.map(() => null);
  return {
    ...s,
    robotPlan: undefined,                 // (left out when sent)
    hands: s.hands.map((h, i) => (i === seat ? h : hide(h))),
    stock: hide(s.stock),
    turnStart: s.turn === seat ? s.turnStart : null,
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. Teams swap when `seat` is odd. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);
  const arr = a => SEATS.map(i => a[(i + seat) % 4]);
  const teams = a => (a && seat % 2 ? [a[1], a[0]] : a);
  const team = t => (t == null ? t : seat % 2 ? 1 - t : t);
  return {
    ...s,
    turn: r(s.turn), dealer: r(s.dealer), outBy: r(s.outBy),
    hands: arr(s.hands),
    redThrees: teams(s.redThrees), melds: teams(s.melds), initialDone: teams(s.initialDone), scores: teams(s.scores),
    discardLog: s.discardLog.map(d => ({ ...d, seat: r(d.seat) })),
    moves: s.moves.map(m => ({ ...m, seat: r(m.seat) })),
    result: s.result && { res: teams(s.result.res), outBy: r(s.result.outBy) },
    winner: team(s.winner),
  };
}
