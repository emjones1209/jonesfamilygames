/**
 * Pinochle rules, meld, scoring and AI (pure functions): four players in two
 * partnerships (seats 0 & 2 against 1 & 3), the most widely played way.
 *
 * - A 48-card deck: two each of A, 10, K, Q, J, 9 in all four suits. Cards
 *   rank A (high), 10, K, Q, J, 9; of two identical cards in a trick, the one
 *   played first wins.
 * - Twelve cards each. One round of bidding (at least 250, in tens): pass and
 *   you're out. If everyone passes, the dealer must take it at 250.
 * - The winner names trump; their partner passes them 3 cards, and they pass 3 back.
 * - Everyone lays down their meld (below), then the bidder leads. Follow suit if
 *   you can — and beat the winning card if you can; with none of the suit, trump
 *   (beating any trump already played if you can); otherwise play anything.
 * - Aces, 10s and Kings are worth 10 each in the tricks you win, and the last
 *   trick 10 more: 250 in all. A side's meld only counts if it wins a trick.
 * - The bidding side scores its meld and trick points if together they make the
 *   bid; if not, it's "set" and loses the bid. The other side scores its meld
 *   and trick points. First side to 1,500 wins (if both get there in the same
 *   hand, the bidding side wins).
 */
export const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS = ['A', '10', 'K', 'Q', 'J', '9'];
export const HAND_SIZE = 12;
export const MIN_BID = 250;
export const BID_STEP = 10;
export const PASS_COUNT = 3;
export const GAME_TARGET = 1500;
export const LAST_TRICK = 10;
export const PASS = 'pass';

// Ranks as numbers (an ace is 14, as in the other card games, so the shared card-play AI reads them right)
const RANK = { A: 14, '10': 13, K: 12, Q: 11, J: 10, '9': 9 };
export const rankOf = c => RANK[c.rank];
export const pointsOf = c => (c.rank === 'A' || c.rank === '10' || c.rank === 'K' ? 10 : 0);
export const sumPoints = cards => cards.reduce((n, c) => n + pointsOf(c), 0);

/** Two of every card; ids tell the twins apart (A-spades-1, A-spades-2). */
export function buildPinochleDeck() {
  const deck = [];
  for (const copy of [1, 2]) for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: `${rank}-${suit}-${copy}`, suit, rank });
  return deck;
}

/** Hand order: trump first (if chosen), then the other suits; A down to 9 within each. */
export function sortPinochle(hand, trump = null) {
  const order = trump ? [trump, ...SUITS.filter(s => s !== trump)] : SUITS;
  return [...hand].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || rankOf(b) - rankOf(a));
}

// ── Meld ─────────────────────────────────────────────────────────────────────
const AROUND = { A: [100, 1000], K: [80, 800], Q: [60, 600], J: [40, 400] };
const AROUND_NAME = { A: 'Aces', K: 'Kings', Q: 'Queens', J: 'Jacks' };

/**
 * A hand's meld with `trump`: { total, items: [{ name, points, cards }] }.
 * A card can count in different kinds of meld (the Q♠ in a pinochle and a
 * marriage) but not twice in the same kind.
 *   run (A 10 K Q J of trump) 150, double 1500 · royal marriage (K Q of trump) 40 ·
 *   marriage 20 · dix (9 of trump) 10 · pinochle (J♦ Q♠) 40, double 300 ·
 *   aces around 100 (double 1000), kings 80 (800), queens 60 (600), jacks 40 (400)
 */
export function meldOf(hand, trump) {
  const cardsOf = (rank, suit) => hand.filter(c => c.rank === rank && c.suit === suit);
  const n = (rank, suit) => cardsOf(rank, suit).length;
  const take = (rank, suit, k) => cardsOf(rank, suit).slice(0, k);
  const items = [];
  const add = (name, points, cards) => items.push({ name, points, cards });

  if (trump) {
    const runs = Math.min(...['A', '10', 'K', 'Q', 'J'].map(r => n(r, trump)));
    if (runs) add(runs === 2 ? 'Double run' : 'Run', runs === 2 ? 1500 : 150, ['A', '10', 'K', 'Q', 'J'].flatMap(r => take(r, trump, runs)));
    // Royal marriages beyond the ones inside the run(s)
    const royal = Math.min(n('K', trump), n('Q', trump)) - runs;
    for (let i = 0; i < royal; i++) add('Royal marriage', 40, [cardsOf('K', trump)[runs + i], cardsOf('Q', trump)[runs + i]]);
    for (const dix of cardsOf('9', trump)) add('Dix', 10, [dix]);
  }
  for (const suit of SUITS.filter(s => s !== trump)) {
    const pairs = Math.min(n('K', suit), n('Q', suit));
    for (let i = 0; i < pairs; i++) add('Marriage', 20, [cardsOf('K', suit)[i], cardsOf('Q', suit)[i]]);
  }
  const pinochles = Math.min(n('J', 'diamonds'), n('Q', 'spades'));
  if (pinochles) add(pinochles === 2 ? 'Double pinochle' : 'Pinochle', pinochles === 2 ? 300 : 40, [...take('J', 'diamonds', pinochles), ...take('Q', 'spades', pinochles)]);
  for (const rank of ['A', 'K', 'Q', 'J']) {
    const arounds = Math.min(...SUITS.map(s => n(rank, s)));
    if (arounds) add(`${arounds === 2 ? 'Double ' : ''}${AROUND_NAME[rank]} around`, AROUND[rank][arounds - 1], SUITS.flatMap(s => take(rank, s, arounds)));
  }
  return { total: items.reduce((t, i) => t + i.points, 0), items };
}

// ── Tricks ───────────────────────────────────────────────────────────────────
/** Index of the winning play: highest trump, else highest of the suit led; the first of two equal cards. */
export function winningIndex(trick, trump) {
  if (!trick.length) return -1;
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const cur = trick[i].card, top = trick[best].card;
    const curT = cur.suit === trump, topT = top.suit === trump;
    if (curT && !topT) best = i;
    else if (cur.suit === top.suit && rankOf(cur) > rankOf(top)) best = i;
  }
  return best;
}
export const trickWinner = (trick, trump) => (trick.length ? trick[winningIndex(trick, trump)].seat : null);
const beats = (trick, card, trump) => winningIndex([...trick, { card, seat: -1 }], trump) === trick.length;

/**
 * Cards `hand` may play to `trick`: follow suit (beating the winning card if you
 * can); with none of the suit, trump (beating any trump played if you can);
 * otherwise anything.
 */
export function legalPlays(hand, trick, trump) {
  if (!trick.length) return hand;
  const lead = trick[0].card.suit;
  const follow = hand.filter(c => c.suit === lead);
  const pick = cards => {
    const win = cards.filter(c => beats(trick, c, trump));
    return win.length ? win : cards;
  };
  if (follow.length) return pick(follow);
  const trumps = hand.filter(c => c.suit === trump);
  if (trumps.length) return pick(trumps);
  return hand;
}

// ── Scoring a hand ───────────────────────────────────────────────────────────
/**
 * @param bid       { team, amount }
 * @param meld      [team 0 meld, team 1 meld]
 * @param counters  [team 0 trick points (with the last trick), team 1]
 * @param tricks    [tricks won by team 0, team 1]
 * Returns per team: { meld (counted), counters, made (bidding team only), delta }.
 */
export function scoreHand({ bid, meld, counters, tricks }) {
  return [0, 1].map(team => {
    const savedMeld = tricks[team] > 0 ? meld[team] : 0;      // meld only counts with a trick
    const total = savedMeld + counters[team];
    if (team !== bid.team) return { meld: savedMeld, counters: counters[team], delta: total };
    const made = total >= bid.amount;
    return { meld: savedMeld, counters: counters[team], made, delta: made ? total : -bid.amount };
  });
}

// ── Computer players ─────────────────────────────────────────────────────────
const count = (hand, pred) => hand.filter(pred).length;

/** What a hand looks worth with `suit` as trump: its meld plus a guess at its share of the tricks. */
export function handWorth(hand, suit) {
  const { total } = meldOf(hand, suit);
  const trumps = count(hand, c => c.suit === suit);
  const aces = count(hand, c => c.rank === 'A');
  const trumpPower = count(hand, c => c.suit === suit && (c.rank === 'A' || c.rank === '10'));
  // An average side takes about half the 250 trick points; trump length, aces and
  // top trumps add to that, and the partner brings meld (and 3 good cards) too
  return total + 40 + 110 + 12 * aces + 12 * Math.max(0, trumps - 4) + 8 * trumpPower;
}

/** The best trump for this hand, and what the hand is worth with it. */
export function bestTrump(hand) {
  return SUITS.map(suit => ({ suit, worth: handWorth(hand, suit) })).reduce((a, b) => (b.worth > a.worth ? b : a));
}

/**
 * A bid (or PASS). `high` is the bid to beat (null if none); `forced` = the dealer, stuck.
 *   easy   – bids on a rough feel for the hand (sometimes too high)
 *   medium – bids up to what the hand looks worth, less a margin
 *   hard   – bids up to what the hand looks worth
 */
export function chooseBid(hand, { high, forced, level, rng = Math.random }) {
  const next = high == null ? MIN_BID : high + BID_STEP;
  if (forced) return MIN_BID;
  let worth = bestTrump(hand).worth;
  if (level === 'easy') worth += Math.round((rng() - 0.4) * 80);
  if (level === 'medium') worth -= 20;
  const limit = Math.floor(worth / BID_STEP) * BID_STEP;
  return next <= limit ? next : PASS;
}

/** The three cards the bidder's partner passes: trumps (highest first), then aces, keeping their own meld where they can. */
export function choosePassToBidder(hand, trump) {
  const own = new Set(meldOf(hand, trump).items.filter(i => !i.cards.every(c => c.suit === trump)).flatMap(i => i.cards.map(c => c.id)));
  const worth = c => (c.suit === trump ? 100 + rankOf(c) : c.rank === 'A' ? 60 : pointsOf(c)) - (own.has(c.id) && c.suit !== trump ? 40 : 0);
  return [...hand].sort((a, b) => worth(b) - worth(a)).slice(0, PASS_COUNT).map(c => c.id);
}

/** The three cards the bidder passes back: whichever three leave the best hand (meld, trumps, aces). */
export function choosePassBack(hand, trump) {
  let best = null;
  for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) for (let k = j + 1; k < hand.length; k++) {
    const kept = hand.filter((_, x) => x !== i && x !== j && x !== k);
    const thrown = [hand[i], hand[j], hand[k]];
    // Never pass trumps; passing points to your partner is fine (they stay on your side)
    if (thrown.some(c => c.suit === trump)) continue;
    const worth = meldOf(kept, trump).total + 15 * count(kept, c => c.suit === trump) + 12 * count(kept, c => c.rank === 'A') + sumPoints(thrown) * 0.2;
    if (!best || worth > best.worth) best = { worth, ids: thrown.map(c => c.id) };
  }
  // (Only possible with 13+ trumps — then pass the lowest cards)
  return best ? best.ids : sortPinochle(hand, trump).slice(-PASS_COUNT).map(c => c.id);
}
