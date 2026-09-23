/**
 * Pure rules shared by the trick-taking games (Hearts, Spades, Bridge, Rook).
 *
 * Seats are numbered clockwise from the human player:
 *   0 = You (bottom), 1 = Left, 2 = Across (partner), 3 = Right
 *
 * Cards are plain objects. Standard cards look like { id, suit, rank } (see
 * utils/cardEngine); Rook cards differ, so the helpers take `suitOf` / `rankOf`
 * functions where the card shape matters.
 */
import { RANK_VALUES } from '../../utils/cardEngine';

export const SEATS = 4;

export const standardSuit = card => card.suit;
export const standardRank = card => RANK_VALUES[card.rank];

export const nextSeat = (seat, n = SEATS) => (seat + 1) % n;
export const partnerOf = seat => (seat + 2) % 4;
/** Team 0 = seats 0 & 2 (you and partner), team 1 = seats 1 & 3. */
export const teamOf = seat => seat % 2;

/**
 * Sort a hand by suit, then rank high→low within each suit. Suits alternate
 * colours in the default order so neighbouring groups are easy to tell apart.
 */
export function sortHand(hand, {
  suitOrder = ['spades', 'hearts', 'clubs', 'diamonds'],
  suitOf = standardSuit,
  rankOf = standardRank,
} = {}) {
  const suitIdx = card => {
    const i = suitOrder.indexOf(suitOf(card));
    return i < 0 ? suitOrder.length : i;
  };
  return [...hand].sort((a, b) => suitIdx(a) - suitIdx(b) || rankOf(b) - rankOf(a));
}

/** Cards that follow the lead suit if possible; otherwise the whole hand. */
export function followSuit(hand, leadSuit, suitOf = standardSuit) {
  if (!leadSuit) return hand;
  const following = hand.filter(c => suitOf(c) === leadSuit);
  return following.length ? following : hand;
}

/**
 * Index (into `trick`) of the winning play.
 * trick: [{ card, seat }] in play order.
 * Highest trump wins; otherwise the highest card of the suit led.
 */
export function winningIndex(trick, { trump = null, suitOf = standardSuit, rankOf = standardRank } = {}) {
  if (!trick.length) return -1;
  const lead = suitOf(trick[0].card);
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const cur = trick[i].card, top = trick[best].card;
    const curTrump = trump != null && suitOf(cur) === trump;
    const topTrump = trump != null && suitOf(top) === trump;
    if (curTrump && !topTrump) best = i;
    else if (curTrump === topTrump && suitOf(cur) === suitOf(top) && rankOf(cur) > rankOf(top)) best = i;
    else if (!curTrump && !topTrump && suitOf(cur) === lead && suitOf(top) !== lead) best = i;
  }
  return best;
}

/** Seat that wins the trick. */
export function trickWinner(trick, opts) {
  const i = winningIndex(trick, opts);
  return i < 0 ? null : trick[i].seat;
}

/** Would playing `card` from `seat` make it the current winner of `trick`? */
export function wouldWin(trick, card, seat, opts) {
  const next = [...trick, { card, seat }];
  return winningIndex(next, opts) === next.length - 1;
}

/** Lowest / highest card by rank (ties keep the first). */
export const lowest = (cards, rankOf = standardRank) =>
  cards.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
export const highest = (cards, rankOf = standardRank) =>
  cards.reduce((a, b) => (rankOf(b) > rankOf(a) ? b : a));

export const sameCard = (a, b) => a?.id === b?.id;
export const removeCard = (hand, card) => hand.filter(c => c.id !== card.id);
