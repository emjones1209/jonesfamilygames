/**
 * Contract bridge, hand after hand, as a pure state machine shared by the
 * single-player game (run in the browser) and play-together tables (run on the
 * server).
 *
 * Seats 0-3 clockwise (seat 0 is South in the single-player game); North-South
 * (seats 0 & 2) play East-West (1 & 3). `act(state, action)` returns the next
 * state or throws an Error whose message explains why the move isn't allowed:
 *   { type: 'bid', seat, bid }        '1C' … '7NT', or 'Pass'
 *   { type: 'play', seat, cardId }    the declarer plays dummy's cards too
 *   { type: 'collect' }               move the finished trick to its winner (after a pause)
 *   { type: 'nextHand' }              deal the next hand after the result is shown
 *
 * `waitingFor(state)` is the seat that must choose (the declarer when it's
 * dummy's turn); `robotAction(state, seat, level)` picks a computer player's
 * move; `viewFor(state, seat)` hides the other hands, but shows dummy's to
 * everyone once the opening lead is made.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';
import { trickWinner, followSuit, nextSeat, teamOf } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick, rotateTable } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import { choosePartnershipCard } from '../cards/ai.js';
import {
  DENOMINATIONS, PASS, bidHigher, currentBid, auctionOver, contractOf, scoreContract, chooseBid,
} from './bridgeRules.js';

const DECK = buildDeck();
const SEATS = [0, 1, 2, 3];
const VALID_BIDS = new Set([1, 2, 3, 4, 5, 6, 7].flatMap(level => DENOMINATIONS.map(d => `${level}${d}`)));

function deal(game, dealer, deck = shuffle(buildDeck())) {
  return {
    ...game,
    phase: 'bidding',                        // bidding | playing | handOver
    dealer,
    hands: SEATS.map(seat => deck.slice(seat * 13, seat * 13 + 13)),
    auction: [],                             // [{ seat, bid }]
    contract: null,                          // { bid, level, denom, trump, declarer, dummy }
    table: null,
    result: null,                            // { ns, ew, made, overtricks, down, declarerTricks } or { passedOut }
  };
}

export function newGame({ dealer = 0, deck } = {}) {
  return deal({ scores: { ns: 0, ew: 0 }, handNo: 0 }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export const bidTurn = s => (s.dealer + s.auction.length) % 4;

/** Dummy's cards are on the table once the opening lead has been made. */
export const dummyShown = s => !!s.table && (s.table.trickNumber > 0 || s.table.trick.length > 0);

/** The seat choosing now: the bidder, the player to play, or the declarer for dummy. */
export function waitingFor(s) {
  if (s.phase === 'bidding') return bidTurn(s);
  if (s.phase === 'playing' && s.table.status === 'playing') {
    return s.table.turn === s.contract.dummy ? s.contract.declarer : s.table.turn;
  }
  return null;
}

/** Cards that may be played now (from whichever hand is to play). */
export const legalCards = s => (s.phase === 'playing' && s.table.status === 'playing'
  ? followSuit(s.table.hands[s.table.turn], s.table.trick[0]?.card.suit) : []);

/** Tricks won by the declaring side so far. */
export const declarerTricks = s => (s.contract && s.table ? s.table.tricksWon[s.contract.declarer] + s.table.tricksWon[s.contract.dummy] : 0);

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  switch (a.type) {
    case 'bid': {
      if (s.phase !== 'bidding') throw new Error('The bidding is over.');
      if (a.seat !== bidTurn(s)) throw new Error('It\'s not your turn to bid.');
      if (a.bid !== PASS && !(VALID_BIDS.has(a.bid) && bidHigher(a.bid, currentBid(s.auction)))) {
        throw new Error('Bid higher than the last bid, or pass.');
      }
      const auction = [...s.auction, { seat: a.seat, bid: a.bid }];
      if (!auctionOver(auction)) return { ...s, auction };
      const contract = contractOf(auction);
      if (!contract) return { ...s, auction, phase: 'handOver', result: { passedOut: true } };
      // The player on declarer's left leads
      return { ...s, auction, contract, phase: 'playing', table: dealTable(s.hands, nextSeat(contract.declarer)) };
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const turn = s.table.turn;
      const card = s.table.hands[turn].find(c => c.id === a.cardId);
      if (!card) throw new Error(turn === a.seat ? 'That card isn\'t in your hand.' : 'Play a card from dummy.');
      if (!legalCards(s).includes(card)) throw new Error('You must follow suit if you can.');
      return { ...s, table: playCard(s.table, turn, card, { winnerOf: trick => trickWinner(trick, { trump: s.contract.trump }) }) };
    }

    case 'collect': {
      if (s.phase !== 'playing' || s.table.status !== 'collecting') return s;
      const table = collectTrick(s.table);
      if (table.status !== 'done') return { ...s, table };
      const done = { ...s, table };
      const tricks = declarerTricks(done);
      const res = scoreContract(s.contract, tricks);
      return {
        ...done, phase: 'handOver',
        scores: { ns: s.scores.ns + res.ns, ew: s.scores.ew + res.ew },
        result: { ...res, declarerTricks: tricks },
      };
    }

    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return { ...deal(s, nextSeat(s.dealer)), handNo: s.handNo + 1 };

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
/** The move for `seat` (which must be `waitingFor`); a computer declarer plays dummy's cards as well. */
export function robotAction(s, seat, level) {
  if (s.phase === 'bidding') return { type: 'bid', seat, bid: chooseBid({ hand: s.hands[seat], auction: s.auction, seat, difficulty: level }) };
  const t = s.table, turn = t.turn;
  const card = choosePartnershipCard({
    legal: legalCards(s), trick: t.trick, seat: turn, difficulty: level, trump: s.contract.trump,
    trumpTeam: teamOf(s.contract.declarer),
    memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[turn], deck: DECK }),
  });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
export function viewFor(s, seat) {
  const shown = i => i === seat || (dummyShown(s) && i === s.contract.dummy);
  const hide = h => h.map(() => null);
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? h : hide(h))),
    table: s.table && { ...s.table, hands: s.table.hands.map((h, i) => (shown(i) ? h : hide(h))) },
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0 (South); NS and EW swap when `seat` is odd. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);
  const arr = a => a && SEATS.map(i => a[(i + seat) % 4]);
  const sides = o => (o && seat % 2 ? { ...o, ns: o.ew, ew: o.ns } : o);
  return {
    ...s,
    dealer: r(s.dealer), hands: arr(s.hands),
    auction: s.auction.map(b => ({ ...b, seat: r(b.seat) })),
    contract: s.contract && { ...s.contract, declarer: r(s.contract.declarer), dummy: r(s.contract.dummy) },
    table: rotateTable(s.table, seat),
    scores: sides(s.scores),
    result: sides(s.result),
  };
}
