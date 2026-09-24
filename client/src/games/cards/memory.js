/**
 * Card memory for the Hard computer players: everything a careful player at
 * the table could know — which cards have gone, which are still out (in
 * someone else's hand), and who has shown out of a suit.
 */
import { standardSuit, standardRank } from './tricks';

/**
 * @param history  completed tricks, each [{ card, seat }] in play order
 * @param trick    the trick in progress
 * @param hand     the cards the choosing player can see in their own hand
 * @param deck     every card in the game
 */
export function tableMemory({ history = [], trick = [], hand = [], deck, suitOf = standardSuit, rankOf = standardRank }) {
  const tricks = [...history, trick];
  const played = tricks.flat().map(p => p.card);
  const gone = new Set([...played, ...hand].map(c => c.id));
  const outstanding = deck.filter(c => !gone.has(c.id));

  // A player who didn't follow the suit led has none left
  const voids = [0, 1, 2, 3].map(() => new Set());
  for (const plays of tricks) {
    if (!plays.length) continue;
    const lead = suitOf(plays[0].card);
    for (const p of plays.slice(1)) if (suitOf(p.card) !== lead) voids[p.seat].add(lead);
  }

  const outOf = suit => outstanding.filter(c => suitOf(c) === suit);
  return {
    played,
    outstanding,
    voids,
    /** Cards of `suit` still held by other players. */
    outOf,
    /** No higher card of its suit is still out, so it wins any trick in that suit. */
    isMaster: card => !outstanding.some(c => suitOf(c) === suitOf(card) && rankOf(c) > rankOf(card)),
    /** Could `seat` still hold a card of `suit`? */
    mayHold: (seat, suit) => !voids[seat].has(suit) && outOf(suit).length > 0,
  };
}
