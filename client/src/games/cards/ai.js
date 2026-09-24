/**
 * Card-play AI for partnership trick-taking games (Spades, Bridge, Rook).
 * Hearts has its own AI in hearts/heartsRules.js because everyone plays alone
 * and the aim is to avoid tricks.
 */
import {
  partnerOf, winningIndex, wouldWin, highest, standardSuit, standardRank,
} from './tricks';

/**
 * @param legal       cards this seat may play
 * @param trick       [{ card, seat }] played so far
 * @param seat        the seat choosing
 * @param difficulty  'easy' | 'medium' | 'hard'
 * @param trump       trump suit or null
 * @param suitOf/rankOf  card accessors (Rook treats the Rook bird as trump)
 * @param pointsOf    card → points it is worth (Rook); 0 for other games
 * @param seats       players per trick
 */
export function choosePartnershipCard({
  legal, trick, seat, difficulty = 'medium', trump = null,
  suitOf = standardSuit, rankOf = standardRank, pointsOf = () => 0, seats = 4,
}) {
  if (legal.length === 1) return legal[0];
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)];

  const opts = { trump, suitOf, rankOf };
  const cheapest = cards => cards.reduce((a, b) => {
    const pa = pointsOf(a), pb = pointsOf(b);
    if (pa !== pb) return pb < pa ? b : a;
    const ta = suitOf(a) === trump, tb = suitOf(b) === trump;   // keep trumps
    if (ta !== tb) return tb ? a : b;
    return rankOf(b) < rankOf(a) ? b : a;
  });

  // ── Leading ──────────────────────────────────────────────────────────────
  if (trick.length === 0) {
    const nonTrump = legal.filter(c => suitOf(c) !== trump);
    const pool = nonTrump.length ? nonTrump : legal;
    // Cash a top card (an ace, or 14 in Rook) when we hold one
    const top = highest(pool, rankOf);
    if (rankOf(top) >= 14 && (difficulty === 'hard' || Math.random() < 0.6)) return top;
    // Otherwise lead low from the longest side suit, keeping honours back
    const bySuit = {};
    for (const c of pool) (bySuit[suitOf(c)] ||= []).push(c);
    const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
    return cheapest(longest);
  }

  // ── Following ────────────────────────────────────────────────────────────
  const winnerSeat = trick[winningIndex(trick, opts)].seat;
  const partnerWinning = winnerSeat === partnerOf(seat);
  const lastToPlay = trick.length === seats - 1;
  const winners = legal.filter(c => wouldWin(trick, c, seat, opts));
  const losers = legal.filter(c => !winners.includes(c));

  if (partnerWinning) {
    const partnerCard = trick.find(p => p.seat === winnerSeat).card;
    const partnerSafe = lastToPlay || suitOf(partnerCard) === trump || rankOf(partnerCard) >= 13;
    if (partnerSafe && losers.length) {
      // Don't overtake partner; give them points if the game has any
      const pointy = losers.filter(c => pointsOf(c) > 0);
      return pointy.length ? highest(pointy, pointsOf) : cheapest(losers);
    }
  }

  if (winners.length) {
    // Win as cheaply as possible (lowest trump if trumping in). Unless we play
    // last, a later player could still beat it, so don't risk a points card.
    const risk = c => (lastToPlay ? 0 : pointsOf(c));
    return winners.reduce((a, b) => (risk(b) !== risk(a) ? (risk(b) < risk(a) ? b : a) : rankOf(b) < rankOf(a) ? b : a));
  }
  return cheapest(losers.length ? losers : legal);
}
