/**
 * Euchre rules, scoring and AI (pure functions).
 *
 * 24 cards (9 to ace in each suit), five each. Once trump is named, the jack of
 * trump (the right bower) is the highest card, then the other jack of the same
 * colour (the left bower), which counts as a trump card — not as its own suit
 * — then A, K, Q, 10, 9 of trump. The helpers below take the trump suit and
 * give the shared trick code (cards/tricks.js) each card's suit and rank.
 *
 * Teams: 0 = seats 0 & 2 (you and partner), 1 = seats 1 & 3.
 */
import { SUITS, RANK_VALUES } from '../../utils/cardEngine.js';
import { followSuit, winningIndex, sortHand as sortBy } from '../cards/tricks.js';
import { choosePartnershipCard } from '../cards/ai.js';

export const RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
export const HAND_SIZE = 5;
export const WINNING_SCORE = 10;
export const RIGHT = 16, LEFT = 15;           // the bowers' ranks, above the ace (14)

export function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank, id: `${rank}-${suit}`, faceUp: false })));
}

const PAIRS = { spades: 'clubs', clubs: 'spades', hearts: 'diamonds', diamonds: 'hearts' };
/** The other suit of the same colour. */
export const sameColour = suit => PAIRS[suit];

export const isRight = (card, trump) => card.rank === 'J' && card.suit === trump;
export const isLeft = (card, trump) => card.rank === 'J' && card.suit === sameColour(trump);

/** The suit a card belongs to once trump is named: the left bower is a trump. */
export const suitWith = trump => card => (trump && isLeft(card, trump) ? trump : card.suit);
/** Card ranks with the bowers on top. */
export const rankWith = trump => card => {
  if (trump && isRight(card, trump)) return RIGHT;
  if (trump && isLeft(card, trump)) return LEFT;
  return RANK_VALUES[card.rank];
};

export const legalPlays = (hand, trick, trump) =>
  followSuit(hand, trick.length ? suitWith(trump)(trick[0].card) : null, suitWith(trump));

export const winnerOf = (trick, trump) =>
  trick[winningIndex(trick, { trump, suitOf: suitWith(trump), rankOf: rankWith(trump) })].seat;

/** Trump first (bowers on top), then the other suits alternating colours. */
export function sortHand(hand, trump = null) {
  const offColour = SUITS.filter(s => s !== trump && s !== sameColour(trump));
  // Colours alternate: trump, a suit of the other colour, trump's partner suit, the last suit
  const order = trump ? [trump, offColour[0], sameColour(trump), offColour[1]] : ['spades', 'hearts', 'clubs', 'diamonds'];
  return sortBy(hand, { suitOrder: order, suitOf: suitWith(trump), rankOf: rankWith(trump) });
}

/**
 * Score a hand. The makers (the team that named trump) need 3 tricks:
 * 3 or 4 = 1 point, all 5 (a march) = 2, or 4 when going alone; fewer than 3
 * and they're euchred, and the other team scores 2.
 */
export function scoreHand(makerTeam, tricks, alone) {
  const made = tricks[makerTeam];
  const delta = [0, 0];
  let result;
  if (made >= 5) { result = 'march'; delta[makerTeam] = alone ? 4 : 2; }
  else if (made >= 3) { result = 'made'; delta[makerTeam] = 1; }
  else { result = 'euchred'; delta[1 - makerTeam] = 2; }
  return { delta, result };
}

export const gameWinner = scores => {
  if (Math.max(...scores) < WINNING_SCORE) return null;
  return scores[0] > scores[1] ? 0 : 1;
};

// ── AI: naming trump ─────────────────────────────────────────────────────────
const TRUMP_VALUE = { [RIGHT]: 3, [LEFT]: 2.5, 14: 2, 13: 1.5, 12: 1.2, 10: 1, 9: 0.9 };

/**
 * How strong `hand` would be with `trump` (about 6 is worth calling, 10 or so
 * could go alone): trumps, side aces, and suits you could trump in.
 */
export function handValue(hand, trump) {
  const suitOf = suitWith(trump), rankOf = rankWith(trump);
  let value = 0;
  const trumps = hand.filter(c => suitOf(c) === trump);
  for (const c of trumps) value += TRUMP_VALUE[rankOf(c)];
  const side = hand.filter(c => suitOf(c) !== trump);
  for (const c of side) if (c.rank === 'A') value += 1;
  if (trumps.length >= 2) {
    const sideSuits = new Set(side.map(suitOf));
    value += 0.5 * (3 - sideSuits.size);           // each missing side suit can be trumped
  }
  return value;
}

/** The card the dealer should throw away after picking up (keeps trump and aces; shortens a side suit). */
export function chooseDiscard(hand, trump) {
  const suitOf = suitWith(trump), rankOf = rankWith(trump);
  const side = hand.filter(c => suitOf(c) !== trump);
  if (!side.length) return hand.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
  const count = s => side.filter(c => suitOf(c) === s).length;
  // A lone low card: throwing it away leaves that suit empty, so we can trump it
  const singles = side.filter(c => c.rank !== 'A' && count(suitOf(c)) === 1);
  const pool = singles.length ? singles : side.filter(c => c.rank !== 'A').length ? side.filter(c => c.rank !== 'A') : side;
  return pool.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
}

const CALL_AT = { easy: 6.5, medium: 6, hard: 5.7 };
const ALONE_AT = { medium: 10, hard: 9.5 };   // Easy never goes alone

/**
 * A computer player's call. Round 1: order the up-card's suit or pass. Round
 * 2: name another suit or pass — except the dealer, who must name one.
 * @returns { call: false } or { call: true, suit, alone }
 */
export function chooseCall({ hand, seat, dealer, upcard, round, turnedDown, level }) {
  const partnerDeals = (seat + 2) % 4 === dealer;
  const iDeal = seat === dealer;
  const noise = level === 'easy' ? Math.random() * 2 - 1 : 0;

  let suit, value;
  if (round === 1) {
    suit = upcard.suit;
    if (iDeal) {
      const withUp = [...hand, upcard];
      value = handValue(withUp.filter(c => c !== chooseDiscard(withUp, suit)), suit);
    } else {
      value = handValue(hand, suit);
      // The up-card goes to the dealer: a help to our side, or to theirs
      const up = TRUMP_VALUE[rankWith(suit)(upcard)] ?? 0;
      value += partnerDeals ? up * 0.6 : -up * 0.5;
    }
  } else {
    const options = SUITS.filter(s => s !== turnedDown).map(s => [s, handValue(hand, s)]);
    [suit, value] = options.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (iDeal) return { call: true, suit, alone: level !== 'easy' && value >= ALONE_AT[level] };
  }
  if (value + noise < CALL_AT[level]) return { call: false };
  return { call: true, suit, alone: level !== 'easy' && value >= ALONE_AT[level] };
}

// ── AI: playing ──────────────────────────────────────────────────────────────
export function chooseCard({ legal, trick, seat, level, trump, makerTeam, sittingOut, memory }) {
  return choosePartnershipCard({
    legal, trick, seat, difficulty: level, trump, suitOf: suitWith(trump), rankOf: rankWith(trump),
    sittingOut, memory, trumpTeam: makerTeam,
  });
}
