/**
 * A whole game of Hand and Foot (four rounds) as a pure state machine, shared
 * by the single-player game (run in the browser) and play-together tables (run
 * on the server). The rules of a round are in handFootRules.js and the
 * computer players in handFootAI.js.
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2. `act(state, action)` returns the
 * next state or throws an Error explaining why the move isn't allowed. Moves
 * name the acting seat (see handFootRules.js):
 *   { type: 'draw', seat }  { type: 'takePile', seat, ids }  { type: 'meld', seat, ids, rank? }
 *   { type: 'undo', seat }  { type: 'discard', seat, id }
 *   { type: 'nextHand' }    { type: 'newGame' }
 *
 * A computer player plans its whole turn at once but plays it a step at a
 * time: the rest of the plan waits in `robotPlan`, which nobody is ever sent.
 */
import { dealRound, act as rulesAct, scoreHand, teamOf, nextSeat, topOfPile, isNatural, ROUNDS } from './handFootRules.js';
import { chooseDraw, choosePlay } from './handFootAI.js';

const SEATS = [0, 1, 2, 3];
const MOVES = ['draw', 'takePile', 'meld', 'undo', 'discard'];

function deal({ scores, history }, round, dealer) {
  return { ...dealRound({ round, dealer, scores }), history, moves: [], robotPlan: null, result: null, winners: null };
}

export function newGame({ dealer = 3 } = {}) {
  return deal({ scores: [0, 0], history: [] }, 0, dealer);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** The seat whose move it is (null between hands). Phases: draw | play | handOver | gameOver. */
export const waitingFor = s => (s.phase === 'draw' || s.phase === 'play' ? s.turn : null);

/** What a move did, for "Phoebe takes the pile (7 cards) with the 9s!" */
function describe(before, after, seat, a) {
  const team = teamOf(seat);
  const foot = !before.inFoot[seat] && after.inFoot[seat];
  switch (a.type) {
    case 'draw': return { seat, kind: 'draw', reds: after.redThrees[team].length - before.redThrees[team].length };
    case 'takePile': return { seat, kind: 'takePile', count: Math.min(before.discard.length, 7), rank: topOfPile(before).rank };
    case 'meld': {
      const cards = a.ids.map(id => before.hands[seat].find(c => c.id === id)).filter(Boolean);
      const rank = cards.find(isNatural)?.rank ?? a.rank;
      const meld = after.melds[team].find(m => m.rank === rank && cards.every(c => m.cards.some(x => x.id === c.id)));
      return { seat, kind: 'meld', rank, count: cards.length, book: meld?.cards.length >= 7, foot };
    }
    case 'discard': return { seat, kind: 'discard', card: before.hands[seat].find(c => c.id === a.id), foot };
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
      return deal(s, s.round + 1, nextSeat(s.dealer));
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
  const last = s.round + 1 >= ROUNDS;
  const best = Math.max(...scores);
  return {
    ...s, scores, robotPlan: null,
    history: [...s.history, [res[0].total, res[1].total]],
    result: { res, outBy: s.outBy },
    phase: last ? 'gameOver' : 'handOver',
    winners: last ? [0, 1].filter(t => scores[t] === best) : null,
  };
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
/** Only your own hand. Feet stay face down (yours too, until you pick it up), and so does the stock. */
export function viewFor(s, seat) {
  const hide = cards => cards.map(() => null);
  return {
    ...s,
    robotPlan: undefined, turnStart: undefined,          // (left out when sent)
    hands: s.hands.map((h, i) => (i === seat ? h : hide(h))),
    feet: s.feet.map(hide),
    stock: hide(s.stock),
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. Teams swap when `seat` is odd. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);
  const arr = a => SEATS.map(i => a[(i + seat) % 4]);
  const teams = a => (a && seat % 2 ? [a[1], a[0]] : a);
  return {
    ...s,
    turn: r(s.turn), dealer: r(s.dealer), outBy: r(s.outBy),
    hands: arr(s.hands), feet: arr(s.feet), inFoot: arr(s.inFoot),
    redThrees: teams(s.redThrees), melds: teams(s.melds), initialDone: teams(s.initialDone), scores: teams(s.scores),
    history: s.history.map(teams),
    discardLog: s.discardLog.map(d => ({ ...d, seat: r(d.seat) })),
    moves: s.moves.map(m => ({ ...m, seat: r(m.seat) })),
    result: s.result && { res: teams(s.result.res), outBy: r(s.result.outBy) },
    winners: s.winners && s.winners.map(t => (seat % 2 ? 1 - t : t)).sort(),
  };
}
