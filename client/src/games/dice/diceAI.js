/**
 * Five Dice computer players. `robotStep(card, turn, level)` returns the next
 * move: { type: 'roll', held } (which dice to keep) or { type: 'score', box }.
 *
 * easy   – keeps its most common number and scores wherever it gets the most points
 * medium – also chases straights and full houses, and aims for the upper bonus
 * hard   – works out exactly which dice to keep for the best expected result over
 *          its remaining rolls (there are only 252 different sets of five dice),
 *          valuing each box by how it helps the whole game: the upper bonus,
 *          keeping Chance and the big boxes for later, where to take a zero
 */
import { options, counts, UPPER, upperTotal, UPPER_BONUS_AT, UPPER_BONUS, ROLLS_PER_TURN } from './diceRules.js';

export function robotStep(card, turn, level) {
  if (turn.rollsLeft === ROLLS_PER_TURN) return { type: 'roll', held: [false, false, false, false, false] };
  const choose = level === 'hard' ? hardPlan : level === 'medium' ? mediumPlan : easyPlan;
  return choose(card, turn);
}

// ── Easy ─────────────────────────────────────────────────────────────────────
function easyPlan(card, { dice, rollsLeft }) {
  const opts = options(card, dice);
  const best = Object.entries(opts).reduce((a, b) => (b[1] > a[1] ? b : a));
  if (rollsLeft === 0 || best[1] >= 40) return { type: 'score', box: best[0] };
  const c = counts(dice);
  const keep = [1, 2, 3, 4, 5, 6].reduce((a, v) => (c[v] >= c[a] ? v : a), 1);
  return { type: 'roll', held: dice.map(d => d === keep) };
}

// ── Medium ───────────────────────────────────────────────────────────────────
function mediumPlan(card, { dice, rollsLeft }) {
  const opts = options(card, dice);
  const value = (box, pts) => {
    const i = UPPER.indexOf(box);
    if (i >= 0) return pts + (pts - 3 * (i + 1)) * 0.5;           // aim for three of each number
    if (box === 'chance') return pts - 8;                          // keep Chance for a bad roll
    return pts;
  };
  const best = Object.entries(opts).reduce((a, b) => (value(...b) > value(...a) ? b : a));
  const sorted = [...new Set(dice)].sort((a, b) => a - b);
  if (rollsLeft === 0 || opts.fiveKind === 50 || opts.largeStraight === 40 || (opts.fullHouse === 25 && card.fullHouse == null)) {
    return { type: 'score', box: best[0] };
  }
  // Chase a straight when four in a row are showing and a straight box is open
  if ((card.largeStraight == null || card.smallStraight == null)) {
    for (const start of [1, 2, 3]) {
      const run = [start, start + 1, start + 2, start + 3];
      if (run.every(v => sorted.includes(v))) {
        const used = new Set();
        return { type: 'roll', held: dice.map(d => (run.includes(d) && !used.has(d) ? (used.add(d), true) : false)) };
      }
    }
  }
  const c = counts(dice);
  const keep = [1, 2, 3, 4, 5, 6].reduce((a, v) => (c[v] > c[a] || (c[v] === c[a] && v > a) ? v : a), 1);
  const held = dice.map(d => d === keep);
  // Two pairs and the full house is open: keep both pairs
  const pairs = [1, 2, 3, 4, 5, 6].filter(v => c[v] === 2);
  if (pairs.length === 2 && card.fullHouse == null) return { type: 'roll', held: dice.map(d => pairs.includes(d)) };
  return { type: 'roll', held };
}

// ── Hard: exact expected value over the rest of the turn ────────────────────
// A set of dice is identified by a number: how many of each face, in base 6.
// Keeping some dice and rolling the rest then just adds two numbers together.
const FACES = [1, 2, 3, 4, 5, 6];
const codeOf = dice => dice.reduce((k, d) => k + 6 ** (d - 1), 0);
const diceOf = code => FACES.flatMap(f => Array(Math.floor(code / 6 ** (f - 1)) % 6).fill(f));

/** For n = 0…5 dice: every distinct result, as { code, p }. */
const DIST = [];
for (let n = 0; n <= 5; n++) {
  const tally = new Map();
  const walk = (code, left) => {
    if (!left) { tally.set(code, (tally.get(code) ?? 0) + 1); return; }
    for (const f of FACES) walk(code + 6 ** (f - 1), left - 1);
  };
  walk(0, n);
  DIST[n] = [...tally].map(([code, count]) => ({ code, p: count / 6 ** n }));
}
const HANDS = DIST[5].map(d => d.code);          // the 252 different sets of five dice

/** The different sets of dice that can be kept from a hand: [{ code, size }]. */
const KEEPS = new Map();
for (const hand of HANDS) {
  const dice = diceOf(hand);
  const seen = new Map();
  for (let mask = 0; mask < 32; mask++) {
    const kept = dice.filter((_, i) => mask & (1 << i));
    seen.set(codeOf(kept), kept.length);
  }
  KEEPS.set(hand, [...seen].map(([code, size]) => ({ code, size })));
}

/** What each box typically scores over a well-played game: scoring less than this "costs" the difference. */
const TYPICAL = {
  ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2,
  threeKind: 21.7, fourKind: 13.1, fullHouse: 22.6, smallStraight: 29.5, largeStraight: 32.7, fiveKind: 16.9, chance: 22,
};

/** How much scoring `pts` in `box` is worth to the whole game, not just now. */
function boxValue(card, box, pts) {
  let v = pts - TYPICAL[box];
  const i = UPPER.indexOf(box);
  if (i >= 0) {
    const before = upperTotal(card);
    if (before < UPPER_BONUS_AT) {
      if (before + pts >= UPPER_BONUS_AT) v += UPPER_BONUS;           // this secures the bonus
      else v += (pts - 3 * (i + 1)) * 2.5;                              // ahead of / behind the pace for it
    }
  }
  if (box === 'fiveKind' && pts === 50) v += 20;                      // later Five of a Kinds earn 100 bonuses
  return v;
}

function hardPlan(card, { dice, rollsLeft }) {
  // Best box value for every possible set of five dice (with no rolls left)
  const final = new Float64Array(6 ** 6);
  for (const hand of HANDS) {
    let best = -Infinity;
    for (const [box, pts] of Object.entries(options(card, diceOf(hand)))) best = Math.max(best, boxValue(card, box, pts));
    final[hand] = best;
  }
  // Expected worth of keeping a set of dice and rolling the rest
  const expect = ({ code, size }, worth) => {
    let e = 0;
    for (const { code: rolled, p } of DIST[5 - size]) e += p * worth[code + rolled];
    return e;
  };
  // Worth of each hand with r rolls still to come: stop now, or keep the best set and roll
  let worth = final;
  for (let r = 1; r < rollsLeft; r++) {
    const next = new Float64Array(6 ** 6);
    for (const hand of HANDS) {
      let best = final[hand];
      for (const keep of KEEPS.get(hand)) best = Math.max(best, expect(keep, worth));
      next[hand] = best;
    }
    worth = next;
  }

  // Now: stop and score, or keep the best set and roll again
  const [bestBox, bestNow] = Object.entries(options(card, dice))
    .map(([box, pts]) => [box, boxValue(card, box, pts)])
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  if (rollsLeft > 0) {
    let bestKeep = null, bestE = -Infinity;
    for (const keep of KEEPS.get(codeOf(dice))) {
      const e = expect(keep, worth);
      if (e > bestE) { bestE = e; bestKeep = keep; }
    }
    if (bestE > bestNow + 1e-9) {
      // Hold the dice that make up the chosen set
      const need = counts(diceOf(bestKeep.code));
      return { type: 'roll', held: dice.map(d => (need[d] > 0 ? (need[d]--, true) : false)) };
    }
  }
  return { type: 'score', box: bestBox };
}
