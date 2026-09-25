/**
 * A whole game of Rook as a pure state machine, shared by the single-player
 * game (run in the browser) and multiplayer tables (run on the server).
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2, team 1 = seats 1 & 3.
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed. Every action names the acting seat:
 *   { type: 'bid', seat, bid }             bid = a number (70-120, steps of 5) or 'pass'
 *   { type: 'nest', seat, discard, trump } bid winner puts 5 card ids back and names trump
 *   { type: 'play', seat, cardId }
 *   { type: 'collect' }                    move the finished trick to its winner (after a pause)
 *   { type: 'nextHand' }                   deal the next hand after the scores are shown
 *   { type: 'newGame' }                    start again after a game is won
 *
 * `waitingFor(state)` says whose move it is; `robotAction(state, seat, level)`
 * picks a computer player's move; `viewFor(state, seat)` hides what that seat
 * mustn't see (other hands, the nest) before a state is sent to a player.
 */
import { shuffle } from '../../utils/cardEngine.js';
import { teamOf, nextSeat } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import {
  makeDeck, cardPoints, legalPlays, winnerOf, scoreHand, gameWinner, chooseBid, chooseNestDiscard, chooseCard,
  suitWith, rankOf, COLOURS, MIN_BID, MAX_BID, BID_STEP, NEST_SIZE,
} from './rookRules.js';

const DECK = makeDeck();

// ── Dealing ──────────────────────────────────────────────────────────────────
function deal(state, dealer, deck = shuffle(makeDeck())) {
  return {
    ...state,
    phase: 'bidding',                          // bidding | nest | playing | handOver | gameOver
    dealer,
    hands: [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13)),
    nest: deck.slice(52),
    bids: [null, null, null, null],            // number | 'pass' | null
    high: { bid: 0, seat: null },
    bidTurn: nextSeat(dealer),
    bidWinner: null,
    trump: null,
    buried: [],                                // the 5 cards put back in the nest
    fromNest: [],                              // ids of the cards the bid winner picked up from the nest
    table: null,                               // trick-play state (cards/trickTable.js)
    lastHand: null,
  };
}

export function newGame({ dealer = 3, deck } = {}) {
  return deal({ scores: [0, 0], handNo: 0 }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** The seat whose move it is, or null while waiting on the table (a trick being collected, scores shown). */
export function waitingFor(s) {
  if (s.phase === 'bidding') return s.bidTurn;
  if (s.phase === 'nest') return s.bidWinner;
  if (s.phase === 'playing' && s.table.status === 'playing') return s.table.turn;
  return null;
}

/** The lowest bid `seat` may make now (null if bidding has gone past the maximum). */
export const nextBid = s => {
  const b = s.high.bid ? s.high.bid + BID_STEP : MIN_BID;
  return b > MAX_BID ? null : b;
};

/** Everyone else passed without a bid: the last player has to take it. */
export const mustBid = s => s.high.seat == null && s.bids.filter(b => b === 'pass').length === 3;

/** Points each team has captured so far this hand (the nest is added after the last trick). */
export const handPoints = s => [0, 1].map(team => (s.table?.taken ?? []).reduce((sum, cards, seat) =>
  sum + (teamOf(seat) === team ? cards.reduce((a, c) => a + cardPoints(c), 0) : 0), 0));

export const legalFor = (s, seat) =>
  (waitingFor(s) === seat && s.phase === 'playing' ? legalPlays(s.table.hands[seat], s.table.trick, s.trump) : []);

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  switch (a.type) {
    case 'bid': {
      if (s.phase !== 'bidding') throw new Error('Bidding is over.');
      if (a.seat !== s.bidTurn) throw new Error('It\'s not your turn to bid.');
      let bid = a.bid;
      if (bid !== 'pass') {
        if (!Number.isInteger(bid) || bid % BID_STEP || bid < (nextBid(s) ?? Infinity) || bid > MAX_BID) {
          throw new Error(`Bid at least ${nextBid(s)}, in steps of ${BID_STEP}.`);
        }
      }
      const bids = s.bids.map((b, i) => (i === a.seat ? bid : b));
      const passed = bids.map(b => b === 'pass');
      // If everyone else has passed without a bid, the last player must take it at the minimum
      if (bid === 'pass' && s.high.seat == null && passed.filter(Boolean).length === 4) {
        bid = bids[a.seat] = MIN_BID;
        passed[a.seat] = false;
      }
      const high = typeof bid === 'number' ? { bid, seat: a.seat } : s.high;
      const next = { ...s, bids, high };
      const active = [0, 1, 2, 3].filter(x => !passed[x]);
      if ((active.length === 1 && high.seat === active[0]) || high.bid >= MAX_BID) {
        // The bid winner picks up the nest
        const winner = high.seat;
        return {
          ...next, phase: 'nest', bidWinner: winner, fromNest: s.nest.map(c => c.id),
          hands: s.hands.map((h, i) => (i === winner ? [...h, ...s.nest] : h)),
        };
      }
      let turn = nextSeat(a.seat);
      while (passed[turn]) turn = nextSeat(turn);
      return { ...next, bidTurn: turn };
    }

    case 'nest': {
      if (s.phase !== 'nest') throw new Error('It\'s not time to choose the nest.');
      if (a.seat !== s.bidWinner) throw new Error('Only the bid winner chooses the nest.');
      const hand = s.hands[a.seat];
      const ids = new Set(a.discard);
      const discard = hand.filter(c => ids.has(c.id));
      if (ids.size !== NEST_SIZE || discard.length !== NEST_SIZE) throw new Error(`Choose exactly ${NEST_SIZE} cards to put back.`);
      if (!COLOURS.includes(a.trump)) throw new Error('Choose a trump colour.');
      const hands = s.hands.map((h, i) => (i === a.seat ? h.filter(c => !ids.has(c.id)) : h));
      return { ...s, phase: 'playing', trump: a.trump, buried: discard, hands, table: dealTable(hands, a.seat) };
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const card = s.table.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!legalFor(s, a.seat).includes(card)) throw new Error('You must follow the colour led if you can.');
      return { ...s, table: playCard(s.table, a.seat, card, { winnerOf: trick => winnerOf(trick, s.trump) }) };
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
  const taken = handPoints(s);
  const nestPoints = s.buried.reduce((sum, c) => sum + cardPoints(c), 0);
  const nestTo = teamOf(t.lastTrick.winner);
  taken[nestTo] += nestPoints;                  // the last trick takes the nest
  const res = scoreHand(teamOf(s.bidWinner), s.high.bid, taken);
  const scores = [s.scores[0] + res.delta[0], s.scores[1] + res.delta[1]];
  const winner = gameWinner(scores);
  return {
    ...s, scores,
    phase: winner != null ? 'gameOver' : 'handOver',
    winner,
    lastHand: { ...res, taken, nestPoints, nestTo, bid: s.high.bid, bidTeam: teamOf(s.bidWinner) },
  };
}

// ── Computer players ─────────────────────────────────────────────────────────
/** The move a computer player at `seat` makes now (it must be their turn). */
export function robotAction(s, seat, level) {
  if (s.phase === 'bidding') return { type: 'bid', seat, bid: chooseBid(s.hands[seat], s.high.bid, level) };
  if (s.phase === 'nest') {
    const { trump, discard } = chooseNestDiscard(s.hands[seat], level);
    return { type: 'nest', seat, trump, discard: discard.map(c => c.id) };
  }
  const t = s.table;
  const memory = tableMemory({
    history: t.history, trick: t.trick, deck: DECK, suitOf: suitWith(s.trump), rankOf,
    hand: seat === s.bidWinner ? [...t.hands[seat], ...s.buried] : t.hands[seat],   // the bidder knows the nest
  });
  const card = chooseCard({
    legal: legalFor(s, seat), trick: t.trick, seat, difficulty: level, trump: s.trump,
    trumpTeam: teamOf(s.bidWinner), memory,
  });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
const hide = cards => cards.map(() => null);   // keeps the count, drops the cards

/** The state as `seat` may see it: other players' hands and the nest are hidden. */
export function viewFor(s, seat) {
  const own = (cards, i) => (i === seat ? cards : hide(cards));
  return {
    ...s,
    hands: s.hands.map(own),
    nest: hide(s.nest),
    fromNest: seat === s.bidWinner ? s.fromNest : [],
    buried: seat === s.bidWinner || s.phase === 'handOver' || s.phase === 'gameOver' ? s.buried : hide(s.buried),
    table: s.table && { ...s.table, hands: s.table.hands.map(own) },
  };
}

/**
 * Turn a state (or view) round so that `seat` becomes seat 0 — each player's
 * screen always shows them at the bottom. Teams swap when `seat` is odd.
 */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);                  // seat number
  const arr = a => a && [0, 1, 2, 3].map(i => a[(i + seat) % 4]);      // array indexed by seat
  const team = t => (t == null ? t : seat % 2 ? 1 - t : t);
  const teams = a => (a && seat % 2 ? [a[1], a[0]] : a);
  const plays = p => p.map(x => ({ ...x, seat: r(x.seat) }));
  const t = s.table;
  return {
    ...s,
    dealer: r(s.dealer), bidTurn: r(s.bidTurn), bidWinner: r(s.bidWinner),
    hands: arr(s.hands), bids: arr(s.bids),
    high: { ...s.high, seat: r(s.high.seat) },
    scores: teams(s.scores),
    winner: team(s.winner),
    lastHand: s.lastHand && {
      ...s.lastHand, delta: teams(s.lastHand.delta), taken: teams(s.lastHand.taken),
      nestTo: team(s.lastHand.nestTo), bidTeam: team(s.lastHand.bidTeam),
    },
    table: t && {
      ...t,
      hands: arr(t.hands), taken: arr(t.taken), tricksWon: arr(t.tricksWon),
      trick: plays(t.trick), history: t.history.map(plays),
      turn: r(t.turn), leader: r(t.leader), winner: r(t.winner),
      lastTrick: t.lastTrick && { plays: plays(t.lastTrick.plays), winner: r(t.lastTrick.winner) },
    },
  };
}
