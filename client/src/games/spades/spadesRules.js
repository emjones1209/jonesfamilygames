/**
 * Spades rules, scoring and AI (pure functions).
 * Teams: 0 = seats 0 & 2 (you and partner), 1 = seats 1 & 3.
 */
import { followSuit, partnerOf, winningIndex, wouldWin, standardRank, lowest, highest } from '../cards/tricks';
import { choosePartnershipCard } from '../cards/ai';

export const TRUMP = 'spades';
export const WINNING_SCORE = 500;
export const BAG_LIMIT = 10;       // every 10 overtricks costs 100 points
export const NIL = 0;

export function legalPlays(hand, trick, { spadesBroken }) {
  if (trick.length === 0) {
    if (!spadesBroken) {
      const nonSpades = hand.filter(c => c.suit !== TRUMP);
      if (nonSpades.length) return nonSpades;
    }
    return hand;
  }
  return followSuit(hand, trick[0].card.suit);
}

/**
 * Score one hand for both teams.
 * @param bids   bid per seat (0 = Nil)
 * @param tricks tricks won per seat
 * @param bags   overtricks carried by each team before this hand
 * @returns { delta: [team0, team1], bags: [team0, team1], detail }
 */
export function scoreHand(bids, tricks, bags = [0, 0]) {
  const delta = [0, 0], newBags = [...bags], detail = [{}, {}];
  for (const team of [0, 1]) {
    const seats = [team, team + 2];
    let contract = 0, made = 0, points = 0;
    for (const s of seats) {
      if (bids[s] === NIL) points += tricks[s] === 0 ? 100 : -100;
      else contract += bids[s];
      made += tricks[s];      // a failed Nil's tricks still count as bags
    }
    const contractTricks = seats.filter(s => bids[s] !== NIL).reduce((n, s) => n + tricks[s], 0);
    if (contract > 0) {
      if (contractTricks >= contract) points += contract * 10;
      else points -= contract * 10;
    }
    const over = Math.max(0, made - contract);
    const madeContract = contract === 0 || contractTricks >= contract;
    let bagCount = newBags[team] + (madeContract ? over : 0);
    let bagPenalty = 0;
    if (madeContract) points += over;
    while (bagCount >= BAG_LIMIT) { bagCount -= BAG_LIMIT; bagPenalty += 100; }
    points -= bagPenalty;
    newBags[team] = bagCount;
    delta[team] = points;
    detail[team] = { contract, won: made, madeContract, overtricks: madeContract ? over : 0, bagPenalty };
  }
  return { delta, bags: newBags, detail };
}

/** Winning team index, or null if nobody has reached the target (or it's tied). */
export function winnerOf(scores) {
  const [a, b] = scores;
  if (Math.max(a, b) < WINNING_SCORE || a === b) return null;
  return a > b ? 0 : 1;
}

// ── AI bidding ───────────────────────────────────────────────────────────────
/** Estimate how many tricks a hand should take. */
export function estimateTricks(hand) {
  let tricks = 0;
  const bySuit = {};
  for (const c of hand) (bySuit[c.suit] ||= []).push(standardRank(c));
  for (const [suit, ranks] of Object.entries(bySuit)) {
    const has = r => ranks.includes(r);
    if (suit === TRUMP) {
      if (has(14)) tricks += 1;
      if (has(13) && ranks.length >= 2) tricks += 1;
      if (has(12) && ranks.length >= 3) tricks += 1;
      tricks += Math.max(0, ranks.length - 3);            // long spades win late
    } else {
      if (has(14)) tricks += 1;
      if (has(13) && ranks.length >= 2 && ranks.length <= 5) tricks += 1;
      if (has(12) && ranks.length >= 3 && ranks.length <= 4) tricks += 0.5;
    }
  }
  // Short side suits let you trump in
  const spades = (bySuit[TRUMP] || []).length;
  for (const suit of ['hearts', 'diamonds', 'clubs']) {
    const n = (bySuit[suit] || []).length;
    if (spades > 3 && n <= 1) tricks += n === 0 ? 1 : 0.5;
  }
  return tricks;
}

export function chooseBid(hand, difficulty, partnerBid = null) {
  const est = estimateTricks(hand);
  if (difficulty === 'easy') return Math.max(1, Math.round(est + (Math.random() * 2 - 1)));
  const highCards = hand.filter(c => standardRank(c) >= 12).length;
  const spades = hand.filter(c => c.suit === TRUMP);
  // Nil only with a very weak hand and no high spades (and not both partners)
  if (difficulty === 'hard' && partnerBid !== NIL && est < 1 && highCards <= 1
      && !spades.some(c => standardRank(c) >= 11)) {
    return NIL;
  }
  const bid = Math.max(1, Math.round(est));
  // Keep the table's total bid realistic
  return partnerBid ? Math.min(bid, 13 - partnerBid) : bid;
}

// ── AI card play ─────────────────────────────────────────────────────────────
export function chooseCard({ legal, trick, seat, difficulty, bids }) {
  if (bids[seat] === NIL && difficulty !== 'easy') return chooseNilCard(legal, trick, seat);
  // Protect a partner who bid Nil: cover their card when they're winning
  if (bids[partnerOf(seat)] === NIL && trick.length && difficulty !== 'easy') {
    const winner = trick[winningIndex(trick, { trump: TRUMP })].seat;
    if (winner === partnerOf(seat)) {
      const covers = legal.filter(c => wouldWin(trick, c, seat, { trump: TRUMP }));
      if (covers.length) return lowest(covers);
    }
  }
  return choosePartnershipCard({ legal, trick, seat, difficulty, trump: TRUMP });
}

/** Nil bidder: never win a trick if it can be avoided. */
function chooseNilCard(legal, trick, seat) {
  const losers = legal.filter(c => trick.length > 0 && !wouldWin(trick, c, seat, { trump: TRUMP }));
  if (losers.length) return highest(losers);   // shed high cards while it's safe
  return lowest(legal);
}
