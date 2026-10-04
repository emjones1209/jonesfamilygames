/**
 * Cribbage rules, scoring and AI (pure functions). Two players, a standard
 * 52-card deck. Cards count A = 1, 2–10 their number, J/Q/K = 10 (for fifteens
 * and the count of 31); for runs they go A-2-3 … J-Q-K (aces low).
 *
 * The show (a hand of 4 counted with the starter card):
 *   fifteens  2 for every different set of cards adding up to 15
 *   pairs     2 for every pair of the same rank (three of a kind = 3 pairs = 6)
 *   runs      3+ ranks in a row: the run's length, for every way to make it
 *   flush     4 in a hand of one suit (5 with the starter); a crib needs all 5
 *   nobs      1 for the Jack of the starter's suit
 * Pegging (each card as it's played, counting up to 31):
 *   15 or 31 → 2; a pair with the card before → 2, three in a row → 6, four → 12;
 *   a run among the last cards played (in any order) → its length;
 *   "go" (the other player can't play) → 1, the last card of the hand → 1.
 */
import { buildDeck } from '../../utils/cardEngine.js';

export const GAME_TARGET = 121;
export const SKUNK = 91;                  // a loser short of this has been skunked
export const HAND_SIZE = 6;
export const KEEP = 4;
export const MAX_COUNT = 31;
export const HEELS = 2;                   // a Jack turned up as the starter, for the dealer

const ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
export const order = c => ORDER[c.rank];
export const value = c => Math.min(10, ORDER[c.rank]);
export const sumValue = cards => cards.reduce((n, c) => n + value(c), 0);

/** All subsets of `cards` with `min` or more cards. */
function subsets(cards, min = 1) {
  const out = [];
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    const pick = cards.filter((_, i) => mask & (1 << i));
    if (pick.length >= min) out.push(pick);
  }
  return out;
}

const isRun = cards => {
  const o = cards.map(order).sort((a, b) => a - b);
  return o.every((x, i) => i === 0 || x === o[i - 1] + 1);
};

/**
 * Score a hand of 4 with the starter: { total, items } where each item is
 * { kind: 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs', cards, points }.
 * `crib` — a crib only scores a flush when all five cards share a suit.
 */
export function scoreHand(hand, starter, { crib = false } = {}) {
  const all = starter ? [...hand, starter] : [...hand];
  const items = [];
  for (const pick of subsets(all, 2)) if (sumValue(pick) === 15) items.push({ kind: 'fifteen', cards: pick, points: 2 });
  for (const pick of subsets(all, 2)) if (pick.length === 2 && pick[0].rank === pick[1].rank) items.push({ kind: 'pair', cards: pick, points: 2 });
  // Runs: the longest length that makes any run; every different way of making it counts
  for (let len = all.length; len >= 3; len--) {
    const runs = subsets(all, len).filter(pick => pick.length === len && isRun(pick));
    if (runs.length) {
      for (const run of runs) items.push({ kind: 'run', cards: run, points: len });
      break;
    }
  }
  if (hand.length === KEEP && hand.every(c => c.suit === hand[0].suit)) {
    const withStarter = starter && starter.suit === hand[0].suit;
    if (withStarter) items.push({ kind: 'flush', cards: all, points: 5 });
    else if (!crib) items.push({ kind: 'flush', cards: [...hand], points: 4 });
  }
  if (starter) {
    const nobs = hand.find(c => c.rank === 'J' && c.suit === starter.suit);
    if (nobs) items.push({ kind: 'nobs', cards: [nobs], points: 1 });
  }
  return { total: items.reduce((n, i) => n + i.points, 0), items };
}

/**
 * Points for playing `card` onto the cards played since the count was last
 * reset (`seq`, oldest first): { points, reasons }.
 */
export function pegPoints(seq, card) {
  const cards = [...seq, card];
  const count = sumValue(cards);
  const reasons = [];
  if (count === 15) reasons.push({ why: 'fifteen', points: 2 });
  if (count === MAX_COUNT) reasons.push({ why: 'thirty-one', points: 2 });
  // Pairs: how many cards in a row at the end share this card's rank
  let same = 1;
  while (same < cards.length && cards[cards.length - 1 - same].rank === card.rank) same++;
  if (same >= 2) reasons.push({ why: ['pair', 'pair royal', 'double pair royal'][same - 2], points: [2, 6, 12][same - 2] });
  // Runs: the longest stretch at the end whose ranks (in any order) are all different and in a row
  for (let len = cards.length; len >= 3; len--) {
    const tail = cards.slice(-len);
    if (new Set(tail.map(order)).size === len && isRun(tail)) { reasons.push({ why: `run of ${len}`, points: len }); break; }
  }
  return { points: reasons.reduce((n, r) => n + r.points, 0), reasons, count };
}

/** Cards in `hand` that can be played without going past 31. */
export const playable = (hand, count) => hand.filter(c => count + value(c) <= MAX_COUNT);

// ── Computer players ─────────────────────────────────────────────────────────
/** Every way to pick two of `n` cards, as index pairs. */
const twoOf = n => {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
};

/** A rough worth of two cards in a crib (points they make between them, plus 5s and near-15s). */
function cribWorth([a, b]) {
  let n = 0;
  if (value(a) + value(b) === 15) n += 2;
  if (a.rank === b.rank) n += 2;
  if (Math.abs(order(a) - order(b)) <= 2 && a.rank !== b.rank) n += 1;      // could become a run
  n += [a, b].filter(c => c.rank === '5').length * 1.5;                      // 5s make fifteens with all the 10s
  return n;
}

/**
 * Which two of six cards to throw into the crib (returns their ids).
 *   easy   – keeps the four that already score best (ignores the starter and the crib)
 *   medium – also counts what the throw gives the crib: good if it's ours, bad if it's theirs
 *   hard   – averages the kept hand over every possible starter card
 */
export function chooseDiscard(hand, { dealer, level, rng = Math.random }) {
  const options = twoOf(hand.length).map(([i, j]) => {
    const thrown = [hand[i], hand[j]];
    const kept = hand.filter((_, k) => k !== i && k !== j);
    return { thrown, kept };
  });
  if (level === 'easy') {
    // Mostly sensible, now and then not
    if (rng() < 0.3) return options[Math.floor(rng() * options.length)].thrown.map(c => c.id);
    return best(options, o => scoreHand(o.kept, null).total).thrown.map(c => c.id);
  }
  const seen = new Set(hand.map(c => c.id));
  const starters = level === 'hard' ? FULL_DECK.filter(c => !seen.has(c.id)) : null;
  return best(options, o => {
    const kept = starters
      ? starters.reduce((n, st) => n + scoreHand(o.kept, st).total, 0) / starters.length
      : scoreHand(o.kept, null).total;
    const crib = cribWorth(o.thrown);
    return kept + (dealer ? crib : -crib);
  }).thrown.map(c => c.id);
}

const best = (options, score) => options.reduce((a, b) => (score(b) > score(a) ? b : a));

const FULL_DECK = buildDeck();

/**
 * Which card to play while pegging.
 *   easy   – any card that fits
 *   medium – the one scoring most now
 *   hard   – most now, minus what it gives the other player to answer with (a count of 5 or
 *            21 invites a ten for 15 or 31; a lone card invites a pair), and leads safely
 * (Simulated games: Medium beats Easy 85% of the time, Hard beats Easy 88% and Medium 55–60% —
 * Cribbage has a lot of luck in it. Hard's careful pegging is worth about 10 percentage points of that.)
 */
export function choosePegCard(hand, seq, { level, rng = Math.random }) {
  const count = sumValue(seq);
  const legal = playable(hand, count);
  if (!legal.length) return null;
  if (level === 'easy') return legal[Math.floor(rng() * legal.length)];
  const scored = legal.map(card => {
    const { points, count: after } = pegPoints(seq, card);
    let risk = 0;
    if (level === 'hard') {
      if (after === 5 || after === 21) risk += 2 * 0.3;                   // a ten-card makes 15 or 31
      if (after < 15 && after + 10 >= 15 && after !== 5) risk += 0.2;
      if (points === 0) risk += 0.6;                                        // they may pair it
      if (seq.length === 0 && card.rank === '5') risk += 1;                 // never lead a 5
      if (seq.length === 0 && value(card) < 5) risk -= 0.3;                 // low leads are safe
      // Keep low cards for later "go"s: a slight preference to play high early
      risk -= value(card) * 0.02;
    }
    return { card, worth: points - risk };
  });
  return scored.reduce((a, b) => (b.worth > a.worth ? b : a)).card;
}
