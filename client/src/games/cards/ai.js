/**
 * Card-play AI for partnership trick-taking games (Spades, Bridge, Rook).
 * Hearts has its own AI in hearts/heartsRules.js because everyone plays alone
 * and the aim is to avoid tricks.
 *
 * easy   – plays any legal card
 * medium – sensible single-trick play: win cheaply, don't overtake partner,
 *          throw away low cards
 * hard   – also remembers the cards (see memory.js): cashes cards that can't
 *          be beaten, draws the other side's trumps, leads suits partner can
 *          trump and avoids suits the opponents can trump, and only wins a
 *          trick early when the card can't be beaten later (otherwise leaves
 *          it to partner)
 */
import {
  partnerOf, teamOf, winningIndex, wouldWin, highest, standardSuit, standardRank,
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
 * @param memory      tableMemory() for this seat — Hard play needs it
 * @param trumpTeam   team that chose trump (Bridge declarer, Rook bidder); null in Spades
 */
export function choosePartnershipCard({
  legal, trick, seat, difficulty = 'medium', trump = null,
  suitOf = standardSuit, rankOf = standardRank, pointsOf = () => 0, seats = 4,
  memory = null, trumpTeam = null,
}) {
  if (legal.length === 1) return legal[0];
  if (difficulty === 'easy') return legal[Math.floor(Math.random() * legal.length)];
  const hard = difficulty === 'hard' && memory != null;

  const opts = { trump, suitOf, rankOf };
  const lowestOf = cards => cards.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
  const cheapest = cards => cards.reduce((a, b) => {
    const pa = pointsOf(a), pb = pointsOf(b);
    if (pa !== pb) return pb < pa ? b : a;
    const ta = suitOf(a) === trump, tb = suitOf(b) === trump;   // keep trumps
    if (ta !== tb) return tb ? a : b;
    return rankOf(b) < rankOf(a) ? b : a;
  });
  const opponents = [1, 3].map(d => (seat + d) % 4);

  // ── Leading ──────────────────────────────────────────────────────────────
  if (trick.length === 0) {
    if (hard) {
      const lead = hardLead();
      if (lead) return lead;
    }
    const nonTrump = legal.filter(c => suitOf(c) !== trump);
    const pool = nonTrump.length ? nonTrump : legal;
    // Cash a top card (an ace, or 14 in Rook) some of the time
    const top = highest(pool, rankOf);
    if (rankOf(top) >= 14 && Math.random() < 0.6) return top;
    // Otherwise lead low from the longest side suit, keeping honours back
    return cheapest(longestSuit(pool));
  }

  // ── Following ────────────────────────────────────────────────────────────
  const winnerSeat = trick[winningIndex(trick, opts)].seat;
  const partnerWinning = winnerSeat === partnerOf(seat);
  const lastToPlay = trick.length === seats - 1;
  const later = Array.from({ length: seats - 1 - trick.length }, (_, i) => (seat + 1 + i) % seats);
  const laterOpponents = later.filter(s => teamOf(s) !== teamOf(seat));
  const winners = legal.filter(c => wouldWin(trick, c, seat, opts));
  const losers = legal.filter(c => !winners.includes(c));
  const trickPoints = trick.reduce((s, p) => s + pointsOf(p.card), 0);

  if (partnerWinning) {
    const partnerCard = trick.find(p => p.seat === winnerSeat).card;
    // Medium trusts a high card or a high trump; a low trump (like the Rook bird) can still be overtrumped
    const partnerSafe = hard
      ? safeFrom(partnerCard, laterOpponents)
      : lastToPlay || rankOf(partnerCard) >= (suitOf(partnerCard) === trump ? 12 : 13);
    if (partnerSafe && losers.length) {
      // Don't overtake partner; give them points if the game has any
      const pointy = losers.filter(c => pointsOf(c) > 0);
      return pointy.length ? highest(pointy, pointsOf) : cheapest(losers);
    }
  }

  if (winners.length) {
    if (hard && !lastToPlay) {
      // Win with the cheapest card nobody still to play can beat…
      const safe = winners.filter(c => safeFrom(c, laterOpponents));
      if (safe.length) return lowestOf(safe);
      // …or, with partner still to play and nothing worth taking, play low and leave it to them
      if (later.includes(partnerOf(seat)) && trickPoints === 0 && losers.length) return cheapest(losers);
    }
    // Win as cheaply as possible (lowest trump if trumping in). Unless we play
    // last, a later player could still beat it, so don't risk a points card.
    const risk = c => (lastToPlay ? 0 : pointsOf(c));
    return winners.reduce((a, b) => (risk(b) !== risk(a) ? (risk(b) < risk(a) ? b : a) : rankOf(b) < rankOf(a) ? b : a));
  }
  return cheapest(losers.length ? losers : legal);

  // ── Hard helpers ─────────────────────────────────────────────────────────
  function longestSuit(cards) {
    const bySuit = {};
    for (const c of cards) (bySuit[suitOf(c)] ||= []).push(c);
    return Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
  }

  /** Could an opponent trump a lead of `suit`? */
  function opponentsCanRuff(suit) {
    return trump != null && suit !== trump
      && opponents.some(o => memory.voids[o].has(suit) && memory.mayHold(o, trump));
  }

  /** Can none of `seatsAfter` beat `card` in the current trick? */
  function safeFrom(card, seatsAfter) {
    if (!seatsAfter.length) return true;
    const lead = suitOf(trick[0].card);
    const suit = suitOf(card);
    const higherOut = memory.outOf(suit).some(c => rankOf(c) > rankOf(card));
    if (higherOut && seatsAfter.some(s => memory.mayHold(s, suit))) return false;
    // A non-trump card can also be trumped by someone who has run out of the suit led
    if (trump != null && suit !== trump
        && seatsAfter.some(s => memory.voids[s].has(lead) && memory.mayHold(s, trump))) return false;
    return true;
  }

  function hardLead() {
    const myTeam = teamOf(seat);
    const partner = partnerOf(seat);

    // 1. Draw trumps: lead a trump that can't be beaten while the opponents still hold some
    if (trump != null && (trumpTeam == null || trumpTeam === myTeam)) {
      const myTrumps = legal.filter(c => suitOf(c) === trump);
      const outTrumps = memory.outOf(trump).length;
      const theyHaveTrumps = opponents.some(o => memory.mayHold(o, trump));
      const master = myTrumps.find(memory.isMaster);
      if (master && theyHaveTrumps && (trumpTeam === myTeam || myTrumps.length >= outTrumps)) return master;
    }

    // 2. Cash side-suit winners the opponents can't trump (points first in Rook)
    const cash = legal.filter(c => suitOf(c) !== trump && memory.isMaster(c) && !opponentsCanRuff(suitOf(c))
      && memory.outOf(suitOf(c)).length > 0);
    if (cash.length) return cash.reduce((a, b) => (pointsOf(b) - pointsOf(a) || rankOf(b) - rankOf(a)) > 0 ? b : a);

    // 3. Lead a suit partner has run out of, so partner can trump it
    if (trump != null) {
      const ruffable = legal.filter(c => suitOf(c) !== trump && memory.voids[partner].has(suitOf(c))
        && memory.mayHold(partner, trump) && !opponentsCanRuff(suitOf(c)) && pointsOf(c) === 0);
      if (ruffable.length) return lowestOf(ruffable);
    }

    // 4. Lead low from the longest suit the opponents can't trump
    const sideSuits = legal.filter(c => suitOf(c) !== trump && !opponentsCanRuff(suitOf(c)));
    if (sideSuits.length) return cheapest(longestSuit(sideSuits));
    return null;
  }
}
