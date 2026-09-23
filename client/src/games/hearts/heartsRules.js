/**
 * Hearts rules and AI (pure functions).
 * Seats: 0 = You, 1 = Left, 2 = Across, 3 = Right (clockwise).
 */
import { followSuit, wouldWin, lowest, highest, standardRank } from '../cards/tricks';

export const TWO_OF_CLUBS = '2-clubs';
export const QUEEN_OF_SPADES = 'Q-spades';

export const isHeart = card => card.suit === 'hearts';
export const isQueenOfSpades = card => card.id === QUEEN_OF_SPADES;
export const cardPoints = card => (isHeart(card) ? 1 : isQueenOfSpades(card) ? 13 : 0);

// ── Passing ──────────────────────────────────────────────────────────────────
export const PASS_DIRECTIONS = ['left', 'right', 'across', 'hold'];
export const passDirection = handNumber => PASS_DIRECTIONS[handNumber % 4];

/** Seat that receives `seat`'s passed cards. */
export function passTarget(seat, direction) {
  const offset = { left: 1, right: 3, across: 2 }[direction];
  return offset == null ? seat : (seat + offset) % 4;
}

/** passes[seat] = the 3 cards that seat gives away. Returns the new hands. */
export function applyPasses(hands, passes, direction) {
  if (direction === 'hold') return hands;
  const next = hands.map((h, seat) => h.filter(c => !passes[seat].some(p => p.id === c.id)));
  passes.forEach((cards, seat) => { next[passTarget(seat, direction)].push(...cards); });
  return next;
}

/** AI: pass the three most dangerous cards. */
export function choosePass(hand) {
  const spades = hand.filter(c => c.suit === 'spades');
  const lowSpades = spades.filter(c => standardRank(c) < 12).length;
  const danger = card => {
    const r = standardRank(card);
    if (isQueenOfSpades(card)) return lowSpades >= 4 ? 5 : 100;   // keep a well-guarded queen
    if (card.suit === 'spades' && r > 12) return lowSpades >= 4 ? 5 : 60; // A♠/K♠ attract the queen
    if (isHeart(card)) return 20 + r;
    return r;
  };
  return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

// ── Legal plays ──────────────────────────────────────────────────────────────
/**
 * @param firstTrick   true for the first trick of the hand
 * @param heartsBroken true once a heart has been played
 */
export function legalPlays(hand, trick, { firstTrick, heartsBroken }) {
  if (trick.length === 0) {
    if (firstTrick) {
      const two = hand.find(c => c.id === TWO_OF_CLUBS);
      if (two) return [two];
    }
    if (!heartsBroken) {
      const nonHearts = hand.filter(c => !isHeart(c));
      if (nonHearts.length) return nonHearts;
    }
    return hand;
  }
  const options = followSuit(hand, trick[0].card.suit);
  // No points on the first trick, unless the hand holds nothing else
  if (firstTrick && options === hand) {
    const safe = hand.filter(c => cardPoints(c) === 0);
    if (safe.length) return safe;
  }
  return options;
}

// ── Scoring ──────────────────────────────────────────────────────────────────
/**
 * Points each seat scores for the hand from the cards they took.
 * Shooting the moon (all 26) scores 0 for the shooter and 26 for everyone else.
 */
export function scoreHand(taken) {
  const points = taken.map(cards => cards.reduce((s, c) => s + cardPoints(c), 0));
  const shooter = points.findIndex(p => p === 26);
  if (shooter < 0) return { points, shooter: null };
  return { points: points.map((_, i) => (i === shooter ? 0 : 26)), shooter };
}

export const GAME_OVER_SCORE = 100;
export const isGameOver = totals => totals.some(t => t >= GAME_OVER_SCORE);
/** Seats with the lowest total (more than one on a tie). */
export const leaders = totals => {
  const min = Math.min(...totals);
  return totals.map((t, i) => (t === min ? i : -1)).filter(i => i >= 0);
};

// ── Card-play AI ─────────────────────────────────────────────────────────────
/**
 * @param queenPlayed true once Q♠ has been played this hand (hard AI uses it)
 */
export function chooseCard({ legal, trick, seat, difficulty, queenPlayed = false }) {
  if (legal.length === 1) return legal[0];
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)];
  const hard = difficulty === 'hard';

  // Leading: lead low, and never a card that just hands over points
  if (trick.length === 0) {
    const safe = legal.filter(c => cardPoints(c) === 0);
    const pool = safe.length ? safe : legal;
    if (hard && !queenPlayed && !legal.some(isQueenOfSpades)) {
      // Flush out the queen with a low spade when we can't be forced to take it
      const lowSpades = pool.filter(c => c.suit === 'spades' && standardRank(c) < 12);
      const highSpades = legal.filter(c => c.suit === 'spades' && standardRank(c) > 12);
      if (lowSpades.length && !highSpades.length) return lowest(lowSpades);
    }
    return lowest(pool);
  }

  const lead = trick[0].card.suit;
  const following = legal.some(c => c.suit === lead);
  const trickPoints = trick.reduce((s, p) => s + cardPoints(p.card), 0);
  const lastToPlay = trick.length === 3;

  if (following) {
    // Duck: highest card that still loses the trick (this also drops Q♠ under A♠/K♠)
    const duckers = legal.filter(c => !wouldWin(trick, c, seat));
    if (duckers.length) return highest(duckers);
    // Every card wins. If last and the trick is clean, win with the highest
    // (getting rid of a dangerous high card); otherwise take it as cheaply as possible.
    if (lastToPlay && trickPoints === 0) {
      const nonQueen = legal.filter(c => !isQueenOfSpades(c));
      return highest(nonQueen.length ? nonQueen : legal);
    }
    return lowest(legal);
  }

  // Void in the suit led: dump the most dangerous card
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;
  if (hard && !queenPlayed) {
    const bigSpades = legal.filter(c => c.suit === 'spades' && standardRank(c) > 12);
    if (bigSpades.length) return highest(bigSpades);
  }
  const hearts = legal.filter(isHeart);
  if (hearts.length) return highest(hearts);
  return highest(legal);
}
