/**
 * A whole game of partnership Pinochle (hand after hand, to 1,500) as a pure
 * state machine, shared by the single-player game (run in the browser) and
 * play-together tables (run on the server). See pinochleRules.js for the rules.
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2, team 1 = seats 1 & 3.
 * Phases: bidding → trump → passing (partner to bidder) → passBack → meld
 * (everyone sees all the meld and taps Ready) → playing → handOver | gameOver.
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed:
 *   { type: 'bid', seat, bid }          a number (250+, in tens) or 'pass'
 *   { type: 'trump', seat, suit }       the bidder names trump
 *   { type: 'pass', seat, cardIds }     the bidder's partner passes 3 cards
 *   { type: 'passBack', seat, cardIds } the bidder passes 3 back
 *   { type: 'ready', seat }             done looking at the meld
 *   { type: 'play', seat, cardId }
 *   { type: 'collect' }                 move a finished trick to its winner (after a pause)
 *   { type: 'nextHand' }  { type: 'newGame' }
 *
 * `waitingOn(state)` says who must move (everyone, while looking at the meld);
 * `robotAction(state, seat, level)` picks a computer player's move;
 * `viewFor(state, seat)` hides the other hands (and the cards passed, from
 * everyone but the two partners passing them).
 */
import { shuffle } from '../../utils/cardEngine.js';
import { nextSeat, teamOf, partnerOf } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick, rotateTable, tableViewFor } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import { choosePartnershipCard } from '../cards/ai.js';
import {
  SUITS, HAND_SIZE, MIN_BID, BID_STEP, PASS_COUNT, GAME_TARGET, LAST_TRICK, PASS,
  buildPinochleDeck, meldOf, legalPlays, trickWinner, scoreHand, sumPoints, rankOf, pointsOf,
  chooseBid, bestTrump, choosePassToBidder, choosePassBack,
} from './pinochleRules.js';

const DECK = buildPinochleDeck();
const SEATS = [0, 1, 2, 3];

function deal(game, dealer, deck = shuffle(buildPinochleDeck())) {
  return {
    ...game,
    phase: 'bidding',
    dealer,
    hands: SEATS.map(seat => deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)),
    bids: [null, null, null, null],          // each seat's last bid: a number, 'pass' or null (not yet)
    bidTurn: nextSeat(dealer),
    high: null,                              // { seat, amount }
    bidder: null,
    trump: null,
    passed: { toBidder: [], back: [] },      // the cards that changed hands (seen only by the two partners)
    meld: null,                              // per seat: { total, items } once trump is known and cards passed
    ready: [false, false, false, false],
    table: null,
    lastHand: null,
  };
}

/** Seat 3 deals first, so seat 0 bids first. */
export function newGame({ dealer = 3, deck } = {}) {
  return deal({ scores: [0, 0], handNo: 0, winner: null }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export function waitingOn(s) {
  switch (s.phase) {
    case 'bidding': return [s.bidTurn];
    case 'trump': return [s.bidder];
    case 'passing': return [partnerOf(s.bidder)];
    case 'passBack': return [s.bidder];
    case 'meld': return SEATS.filter(seat => !s.ready[seat]);
    case 'playing': return s.table.status === 'playing' ? [s.table.turn] : [];
    default: return [];
  }
}
export const waitingFor = s => waitingOn(s)[0] ?? null;

export const legalFor = (s, seat) => (s.phase === 'playing' && s.table.status === 'playing' && s.table.turn === seat
  ? legalPlays(s.table.hands[seat], s.table.trick, s.trump) : []);

/** The smallest bid allowed now. */
export const minBid = s => (s.high ? s.high.amount + BID_STEP : MIN_BID);

/** Is `seat` the dealer, with everyone else passed and no bid — so they must bid? */
export const dealerStuck = (s, seat) => seat === s.dealer && !s.high && SEATS.every(x => x === seat || s.bids[x] === PASS);

/** Each team's meld (from both partners). */
export const teamMeld = s => [0, 1].map(team => (s.meld ? SEATS.filter(x => teamOf(x) === team).reduce((n, x) => n + s.meld[x].total, 0) : 0));

// ── Actions ──────────────────────────────────────────────────────────────────
const takeCards = (hand, ids) => {
  const cards = (ids ?? []).map(id => hand.find(c => c.id === id));
  if (cards.length !== PASS_COUNT || cards.some(c => !c) || new Set(ids).size !== PASS_COUNT) throw new Error(`Choose ${PASS_COUNT} cards to pass.`);
  return cards;
};

export function act(s, a) {
  const turnCheck = (phase, seat, message) => {
    if (s.phase !== phase) throw new Error(message);
    if (!waitingOn(s).includes(a.seat) || a.seat !== seat) throw new Error('It\'s not your turn.');
  };
  switch (a.type) {
    case 'bid': {
      turnCheck('bidding', s.bidTurn, 'Bidding is over.');
      const bids = [...s.bids];
      let high = s.high;
      if (a.bid === PASS) {
        if (dealerStuck(s, a.seat)) throw new Error(`Everyone else passed — as the dealer you must bid at least ${MIN_BID}.`);
        bids[a.seat] = PASS;
      } else {
        if (!Number.isInteger(a.bid) || a.bid % BID_STEP || a.bid < minBid(s)) throw new Error(`Bid at least ${minBid(s)}, in tens.`);
        bids[a.seat] = a.bid;
        high = { seat: a.seat, amount: a.bid };
      }
      const active = SEATS.filter(x => bids[x] !== PASS);
      if (high && active.length === 1) {
        return { ...s, bids, high, bidder: high.seat, phase: 'trump', bidTurn: null };
      }
      let next = nextSeat(a.seat);
      while (bids[next] === PASS) next = nextSeat(next);
      return { ...s, bids, high, bidTurn: next };
    }

    case 'trump': {
      turnCheck('trump', s.bidder, 'Trump has been named.');
      if (!SUITS.includes(a.suit)) throw new Error('Choose a suit for trump.');
      return { ...s, trump: a.suit, phase: 'passing' };
    }

    case 'pass': {
      const partner = partnerOf(s.bidder);
      turnCheck('passing', partner, 'The cards have been passed.');
      const cards = takeCards(s.hands[partner], a.cardIds);
      const hands = s.hands.map((h, i) => (i === partner ? h.filter(c => !cards.includes(c)) : i === s.bidder ? [...h, ...cards] : h));
      return { ...s, hands, phase: 'passBack', passed: { toBidder: cards, back: [] } };
    }

    case 'passBack': {
      turnCheck('passBack', s.bidder, 'The cards have been passed back.');
      const partner = partnerOf(s.bidder);
      const cards = takeCards(s.hands[s.bidder], a.cardIds);
      const hands = s.hands.map((h, i) => (i === s.bidder ? h.filter(c => !cards.includes(c)) : i === partner ? [...h, ...cards] : h));
      return {
        ...s, hands, phase: 'meld', passed: { ...s.passed, back: cards },
        meld: hands.map(h => meldOf(h, s.trump)), ready: [false, false, false, false],
      };
    }

    case 'ready': {
      if (s.phase !== 'meld') throw new Error('Not now.');
      if (!SEATS.includes(a.seat)) throw new Error('Not your seat.');
      const ready = s.ready.map((r, i) => r || i === a.seat);
      if (!ready.every(Boolean)) return { ...s, ready };
      return { ...s, ready, phase: 'playing', table: dealTable(s.hands, s.bidder) };    // the bidder leads
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (s.table.status !== 'playing' || a.seat !== s.table.turn) throw new Error('It\'s not your turn.');
      const card = s.table.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!legalFor(s, a.seat).includes(card)) {
        const lead = s.table.trick[0].card.suit;
        const has = s.table.hands[a.seat].some(c => c.suit === lead);
        throw new Error(has ? 'Follow suit — and beat the winning card if you can.' : 'You have no cards of that suit, so you must trump (and beat any trump played if you can).');
      }
      return { ...s, table: playCard(s.table, a.seat, card, { winnerOf: trick => trickWinner(trick, s.trump) }) };
    }

    case 'collect': {
      if (s.phase !== 'playing' || s.table.status !== 'collecting') return s;
      const table = collectTrick(s.table);
      if (table.status !== 'done') return { ...s, table };
      return finishHand({ ...s, table });
    }

    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return { ...deal(s, nextSeat(s.dealer)), handNo: s.handNo + 1 };

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ dealer: nextSeat(s.dealer) });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

function finishHand(s) {
  const t = s.table;
  const last = teamOf(t.lastTrick.winner);
  const counters = [0, 1].map(team => SEATS.filter(x => teamOf(x) === team).reduce((n, x) => n + sumPoints(t.taken[x]), 0) + (team === last ? LAST_TRICK : 0));
  const tricks = [0, 1].map(team => SEATS.filter(x => teamOf(x) === team).reduce((n, x) => n + t.tricksWon[x], 0));
  const meld = teamMeld(s);
  const bid = { team: teamOf(s.bidder), seat: s.bidder, amount: s.high.amount };
  const res = scoreHand({ bid, meld, counters, tricks });
  const scores = s.scores.map((n, team) => n + res[team].delta);
  // First to 1,500 wins; if both get there together, the bidding side does
  const over = scores.filter(n => n >= GAME_TARGET).length;
  const winner = over === 2 ? bid.team : over === 1 ? scores.findIndex(n => n >= GAME_TARGET) : null;
  return { ...s, scores, lastHand: { bid, meld, counters, tricks, res }, winner, phase: winner != null ? 'gameOver' : 'handOver' };
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  switch (s.phase) {
    case 'bidding':
      return { type: 'bid', seat, bid: chooseBid(s.hands[seat], { high: s.high?.amount ?? null, forced: dealerStuck(s, seat), level }) };
    case 'trump':
      return { type: 'trump', seat, suit: bestTrump(s.hands[seat]).suit };
    case 'passing':
      return { type: 'pass', seat, cardIds: choosePassToBidder(s.hands[seat], s.trump) };
    case 'passBack':
      return { type: 'passBack', seat, cardIds: choosePassBack(s.hands[seat], s.trump) };
    case 'meld':
      return { type: 'ready', seat };
    default: {
      const t = s.table;
      const card = choosePartnershipCard({
        legal: legalFor(s, seat), trick: t.trick, seat, difficulty: level, trump: s.trump,
        rankOf, pointsOf, trumpTeam: teamOf(s.bidder),
        memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[seat], deck: DECK, rankOf }),
      });
      return { type: 'play', seat, cardId: card.id };
    }
  }
}

// ── What each player may see ─────────────────────────────────────────────────
export function viewFor(s, seat) {
  const hide = cards => cards.map(() => null);
  const inPass = s.bidder != null && (seat === s.bidder || seat === partnerOf(s.bidder));
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? h : hide(h))),
    passed: inPass ? s.passed : { toBidder: hide(s.passed.toBidder), back: hide(s.passed.back) },
    table: s.table && tableViewFor(s.table, seat),
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. Teams swap when `seat` is odd. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);
  const arr = a => a && SEATS.map(i => a[(i + seat) % 4]);
  const teams = a => (a && seat % 2 ? [a[1], a[0]] : a);
  const team = t => (t == null ? t : seat % 2 ? 1 - t : t);
  return {
    ...s,
    dealer: r(s.dealer), bidTurn: r(s.bidTurn), bidder: r(s.bidder),
    high: s.high && { ...s.high, seat: r(s.high.seat) },
    hands: arr(s.hands), bids: arr(s.bids), ready: arr(s.ready), meld: arr(s.meld),
    scores: teams(s.scores), winner: team(s.winner),
    lastHand: s.lastHand && {
      ...s.lastHand, bid: { ...s.lastHand.bid, team: team(s.lastHand.bid.team), seat: r(s.lastHand.bid.seat) },
      meld: teams(s.lastHand.meld), counters: teams(s.lastHand.counters), tricks: teams(s.lastHand.tricks), res: teams(s.lastHand.res),
    },
    table: rotateTable(s.table, seat),
  };
}
