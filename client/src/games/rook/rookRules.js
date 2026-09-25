/**
 * Rook rules and AI (pure functions).
 *
 * Deck: 1–14 in four colours plus the Rook bird (57 cards). 13 cards each and a
 * 5-card nest. The bird belongs to the trump suit as its LOWEST card: it loses
 * to every other trump but still beats any card of another colour.
 * Counters: 5s = 5, 10s & 14s = 10, Rook = 20 (120 in the deck); the nest's
 * points go to whoever takes the last trick.
 */
import { followSuit, winningIndex } from '../cards/tricks.js';
import { choosePartnershipCard } from '../cards/ai.js';

export const COLOURS = ['black', 'green', 'red', 'yellow'];
export const COLOUR_STYLE = {
  black:  { label: 'Black',  color: '#94a3b8' },
  green:  { label: 'Green',  color: '#4ade80' },
  red:    { label: 'Red',    color: '#f87171' },
  yellow: { label: 'Yellow', color: '#facc15' },
};
export const ROOK_ID = 'ROOK';
export const WINNING_SCORE = 300;
export const MIN_BID = 70, MAX_BID = 120, BID_STEP = 5;
export const NEST_SIZE = 5;

export function makeDeck() {
  const deck = [];
  for (const colour of COLOURS) {
    for (let value = 1; value <= 14; value++) deck.push({ id: `${colour}-${value}`, colour, value });
  }
  deck.push({ id: ROOK_ID, colour: null, value: 20, isRook: true });
  return deck;
}

export const cardPoints = card =>
  card.isRook ? 20 : card.value === 5 ? 5 : card.value === 10 || card.value === 14 ? 10 : 0;

/** Suit accessor for the shared trick helpers: the bird counts as trump. */
export const suitWith = trump => card => (card.isRook ? trump : card.colour);
export const rankOf = card => (card.isRook ? 0 : card.value);   // bird ranks below the 1

export const legalPlays = (hand, trick, trump) =>
  followSuit(hand, trick.length ? suitWith(trump)(trick[0].card) : null, suitWith(trump));

export const winnerOf = (trick, trump) =>
  trick[winningIndex(trick, { trump, suitOf: suitWith(trump), rankOf })].seat;

export const sortHand = (hand, trump = null) => {
  // Trump first (the bird at the end of trump, as its lowest card), then the
  // other colours; before trump is named the bird goes first
  const order = trump ? [trump, ...COLOURS.filter(c => c !== trump)] : COLOURS;
  const key = c => (c.isRook ? (trump ? 0 : -1) : order.indexOf(c.colour));
  return [...hand].sort((a, b) => key(a) - key(b) || rankOf(b) - rankOf(a));
};

/**
 * Score a hand. `taken[team]` = points captured by each team (nest included).
 * The bidding team scores its points if it made the bid, otherwise loses the bid.
 */
export function scoreHand(bidTeam, bid, taken) {
  const delta = [0, 0];
  const made = taken[bidTeam] >= bid;
  delta[bidTeam] = made ? taken[bidTeam] : -bid;
  delta[1 - bidTeam] = taken[1 - bidTeam];
  return { delta, made };
}

/** Winning team once someone reaches 300 (higher score wins; null on a tie). */
export function gameWinner(scores) {
  const [a, b] = scores;
  if (Math.max(a, b) < WINNING_SCORE || a === b) return null;
  return a > b ? 0 : 1;
}

// ── AI ───────────────────────────────────────────────────────────────────────
/** Rough hand strength in points this hand could capture with the nest. */
export function handStrength(hand) {
  let strength = 60;
  const counts = Object.fromEntries(COLOURS.map(c => [c, 0]));
  for (const c of hand) {
    if (c.isRook) strength += 8;        // 20 points, but the lowest trump can be overtrumped
    else {
      counts[c.colour]++;
      if (c.value === 14) strength += 6;
      else if (c.value === 13) strength += 3;
      else if (c.value === 10) strength += 1;
    }
  }
  // A long suit makes a strong trump suit
  strength += Math.max(0, Math.max(...Object.values(counts)) - 4) * 5;
  return strength;
}

/** Next bid, or 'pass'. `high` is the current high bid (0 if none yet). */
export function chooseBid(hand, high, difficulty) {
  const next = high ? high + BID_STEP : MIN_BID;
  if (next > MAX_BID) return 'pass';
  if (difficulty === 'easy') return next <= 90 && Math.random() < 0.5 ? next : 'pass';
  let limit = Math.floor(handStrength(hand) / BID_STEP) * BID_STEP;
  if (difficulty === 'hard') limit += BID_STEP;       // bid a little more boldly
  return next <= Math.min(limit, MAX_BID) ? next : 'pass';
}

/** Best trump colour: most cards, weighted by high cards. */
export function chooseTrump(hand) {
  const score = Object.fromEntries(COLOURS.map(c => [c, 0]));
  for (const c of hand) if (!c.isRook) score[c.colour] += 2 + (c.value >= 12 ? 1 : 0);
  return COLOURS.reduce((a, b) => (score[b] > score[a] ? b : a));
}

/**
 * Bid winner with the nest merged in (18 cards): choose trump, then discard 5.
 * Medium keeps trump, the bird, high cards and counters, discarding low cards
 * from short side suits. Hard also empties a short side suit where it can (so
 * it can trump that suit) and buries counters it would likely lose in the nest,
 * which usually comes back to the bidder's side with the last trick.
 */
export function chooseNestDiscard(hand, difficulty = 'medium') {
  const trump = chooseTrump(hand);
  const length = colour => hand.filter(c => !c.isRook && c.colour === colour).length;
  const hasTop = colour => hand.some(c => c.colour === colour && c.value === 14);
  const keepValue = c => {
    if (c.isRook || c.colour === trump) return 1000 + c.value;
    if (difficulty !== 'hard') return (c.value >= 13 ? 500 : 0) + cardPoints(c) * 20 + c.value;
    if (c.value === 14) return 800;                                   // a sure winner
    const lonelyCounter = cardPoints(c) > 0 && !hasTop(c.colour);     // likely captured by a 14
    return length(c.colour) * 10 + c.value - (lonelyCounter ? 30 : 0);
  };
  const discard = [...hand].sort((a, b) => keepValue(a) - keepValue(b)).slice(0, NEST_SIZE);
  return { trump, discard };
}

export function chooseCard({ legal, trick, seat, difficulty, trump, memory = null, trumpTeam = null }) {
  return choosePartnershipCard({
    legal, trick, seat, difficulty, trump, suitOf: suitWith(trump), rankOf, pointsOf: cardPoints, memory, trumpTeam,
  });
}
