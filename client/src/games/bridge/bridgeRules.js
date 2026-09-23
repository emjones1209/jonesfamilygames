/**
 * Contract Bridge rules, scoring and AI bidding (pure functions).
 * Seats: 0 = South (you), 1 = West, 2 = North (partner), 3 = East.
 * Bids are strings: '1C'…'7NT' or 'Pass'.
 */
import { partnerOf } from '../cards/tricks';

export const DENOMINATIONS = ['C', 'D', 'H', 'S', 'NT'];
export const SUIT_OF_DENOM = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades', NT: null };
export const PASS = 'Pass';

export const bidLevel = bid => (bid === PASS ? 0 : parseInt(bid, 10));
export const bidDenom = bid => (bid === PASS ? null : bid.slice(String(bidLevel(bid)).length));

/** True if `bid` outranks `prev` (any real bid outranks no bid). */
export function bidHigher(bid, prev) {
  if (bid === PASS) return false;
  if (!prev) return true;
  const [bl, pl] = [bidLevel(bid), bidLevel(prev)];
  if (bl !== pl) return bl > pl;
  return DENOMINATIONS.indexOf(bidDenom(bid)) > DENOMINATIONS.indexOf(bidDenom(prev));
}

/** The highest bid so far, or null. auction: [{ seat, bid }] */
export const currentBid = auction => [...auction].reverse().find(b => b.bid !== PASS)?.bid ?? null;

/** Auction ends after 4 passes, or 3 passes following a bid. */
export function auctionOver(auction) {
  if (auction.length < 4) return false;
  return auction.slice(-3).every(b => b.bid === PASS);
}

/**
 * Final contract, or null if everyone passed.
 * Declarer = the first player of the winning side to name the final denomination.
 */
export function contractOf(auction) {
  const last = [...auction].reverse().find(b => b.bid !== PASS);
  if (!last) return null;
  const denom = bidDenom(last.bid);
  const side = last.seat % 2;
  const declarer = auction.find(b => b.seat % 2 === side && b.bid !== PASS && bidDenom(b.bid) === denom).seat;
  return { bid: last.bid, level: bidLevel(last.bid), denom, trump: SUIT_OF_DENOM[denom], declarer, dummy: partnerOf(declarer) };
}

/**
 * Score a played contract (not vulnerable, undoubled).
 * @returns { ns, ew, made, overtricks, down }
 */
export function scoreContract(contract, declarerTricks) {
  const { level, denom, declarer } = contract;
  const needed = level + 6;
  const nsDeclared = declarer % 2 === 0;
  const minor = denom === 'C' || denom === 'D';
  const perTrick = minor ? 20 : 30;
  let points, made = declarerTricks >= needed;
  if (made) {
    const trickScore = denom === 'NT' ? 40 + 30 * (level - 1) : perTrick * level;
    const bonus = level === 7 ? 1000 : level === 6 ? 500 : 0;          // grand / small slam
    const gameBonus = trickScore >= 100 ? 300 : 50;                    // game or part-score
    points = trickScore + gameBonus + bonus + (declarerTricks - needed) * perTrick;
    return { ns: nsDeclared ? points : 0, ew: nsDeclared ? 0 : points, made, overtricks: declarerTricks - needed, down: 0 };
  }
  const down = needed - declarerTricks;
  points = 50 * down;
  return { ns: nsDeclared ? 0 : points, ew: nsDeclared ? points : 0, made, overtricks: 0, down };
}

// ── Hand evaluation & AI bidding ─────────────────────────────────────────────
export const highCardPoints = hand =>
  hand.reduce((s, c) => s + ({ A: 4, K: 3, Q: 2, J: 1 }[c.rank] || 0), 0);

const suitLengths = hand => {
  const n = { C: 0, D: 0, H: 0, S: 0 };
  for (const c of hand) n[{ clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }[c.suit]]++;
  return n;
};

const isBalanced = lengths => {
  const l = Object.values(lengths).sort((a, b) => a - b);
  return l[0] >= 2 && l[3] <= 5 && !(l[0] === 2 && l[1] === 2);
};

/** Level the partnership should bid to, from combined points. */
const targetLevel = (points, denom) => {
  if (points >= 33) return 6;
  if (points >= 25) return denom === 'NT' ? 3 : (denom === 'H' || denom === 'S') ? 4 : 5;
  if (points >= 22) return 3;
  if (points >= 18) return 2;
  return 1;
};

/**
 * AI bid for `seat`. Always returns a legal bid (or Pass).
 * A simple natural system: open 1 of the longest suit with 12+ points, 1NT with a
 * balanced 15-17, support partner's suit with 3+ cards, stop at the level the
 * combined points justify.
 */
export function chooseBid({ hand, auction, seat, difficulty }) {
  const current = currentBid(auction);
  const legalBids = [1, 2, 3, 4, 5, 6, 7].flatMap(l => DENOMINATIONS.map(d => `${l}${d}`))
    .filter(b => bidHigher(b, current));

  if (difficulty === 'easy') {
    if (Math.random() < 0.65 || !legalBids.length) return PASS;
    return legalBids[Math.floor(Math.random() * Math.min(3, legalBids.length))];
  }

  const hcp = highCardPoints(hand);
  const lengths = suitLengths(hand);
  const partnerBids = auction.filter(b => b.seat === partnerOf(seat) && b.bid !== PASS);
  const partnerSuit = partnerBids.length ? bidDenom(partnerBids[partnerBids.length - 1].bid) : null;
  // Assume partner's bidding shows about 12 points (16 for a 1NT opening)
  const partnerPoints = partnerBids.length ? (partnerSuit === 'NT' ? 16 : 12) : 0;
  const combined = hcp + partnerPoints;

  let denom;
  if (partnerSuit && partnerSuit !== 'NT' && lengths[partnerSuit] >= 3) denom = partnerSuit;
  else if (!partnerBids.length && isBalanced(lengths) && hcp >= 15 && hcp <= 17) denom = 'NT';
  else if (partnerSuit === 'NT' && isBalanced(lengths)) denom = 'NT';
  else {
    const longest = Object.entries(lengths).sort((a, b) =>
      b[1] - a[1] || DENOMINATIONS.indexOf(b[0]) - DENOMINATIONS.indexOf(a[0]))[0][0];
    denom = lengths[longest] >= 5 || !partnerBids.length ? longest : (isBalanced(lengths) ? 'NT' : longest);
  }

  // Opening needs 12+ of our own; responding needs 6+
  const minOwn = partnerBids.length ? 6 : 12;
  if (hcp < minOwn) return PASS;

  if (!partnerBids.length) {
    // Open (or overcall) at the cheapest legal level, up to the 2 level
    const bid = legalBids.find(b => bidDenom(b) === denom);
    return bid && bidLevel(bid) <= 2 ? bid : PASS;
  }
  // Respond / rebid by jumping straight to the level our combined points justify;
  // pass once the partnership is already there
  const bonus = difficulty === 'hard' && denom !== 'NT' ? distributionBonus(lengths) : 0;
  const target = `${targetLevel(combined + bonus, denom)}${denom}`;
  return bidHigher(target, current) ? target : PASS;
}

/** Extra value for long suits and short side suits (hard AI). */
const distributionBonus = lengths =>
  Object.values(lengths).reduce((s, n) => s + (n >= 6 ? n - 5 : 0) + (n === 0 ? 3 : n === 1 ? 2 : 0), 0);

/** Sort order used to display Bridge hands. */
export const BRIDGE_SUIT_ORDER = ['spades', 'hearts', 'clubs', 'diamonds'];
