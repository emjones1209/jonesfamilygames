/**
 * A whole game of Spades as a pure state machine, shared by the single-player
 * game (run in the browser) and play-together tables (run on the server).
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2, team 1 = seats 1 & 3.
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed:
 *   { type: 'bid', seat, bid }        0 (Nil) to 13
 *   { type: 'play', seat, cardId }
 *   { type: 'collect' }               move the finished trick to its winner (after a pause)
 *   { type: 'nextHand' }              deal the next hand after the scores are shown
 *   { type: 'newGame' }               start again after a game is won
 *
 * `waitingFor(state)` says whose move it is; `robotAction(state, seat, level)`
 * picks a computer player's move; `viewFor(state, seat)` hides the other hands.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';
import { trickWinner, nextSeat, teamOf } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick, rotateTable, tableViewFor } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import { TRUMP, WINNING_SCORE, legalPlays, scoreHand, winnerOf, chooseBid, chooseCard } from './spadesRules.js';

const DECK = buildDeck();
const SEATS = [0, 1, 2, 3];

function deal(game, dealer, deck = shuffle(buildDeck())) {
  return {
    ...game,
    phase: 'bidding',                        // bidding | playing | handOver | gameOver
    dealer,
    hands: SEATS.map(seat => deck.slice(seat * 13, seat * 13 + 13)),
    bids: [null, null, null, null],          // tricks each seat bid (0 = Nil)
    bidTurn: nextSeat(dealer),
    table: null,
    lastHand: null,
  };
}

/** Seat 3 deals first, so seat 0 bids and leads first. The first team to `target` points wins. */
export function newGame({ dealer = 3, deck, target = WINNING_SCORE } = {}) {
  return deal({ target, scores: [0, 0], bags: [0, 0], handNo: 0, winner: null }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export function waitingFor(s) {
  if (s.phase === 'bidding') return s.bidTurn;
  if (s.phase === 'playing' && s.table.status === 'playing') return s.table.turn;
  return null;
}

const spadesBroken = t => [...t.taken.flat(), ...t.trick.map(p => p.card)].some(c => c.suit === TRUMP);

export const legalFor = (s, seat) => (s.phase === 'playing' && waitingFor(s) === seat
  ? legalPlays(s.table.hands[seat], s.table.trick, { spadesBroken: spadesBroken(s.table) }) : []);

/** Each team's tricks so far this hand, and its combined bid. */
export const teamTricks = s => [0, 1].map(team => SEATS.reduce((n, seat) => n + (teamOf(seat) === team ? s.table?.tricksWon[seat] ?? 0 : 0), 0));
export const teamBid = s => [0, 1].map(team => SEATS.reduce((n, seat) => n + (teamOf(seat) === team ? s.bids[seat] ?? 0 : 0), 0));

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  switch (a.type) {
    case 'bid': {
      if (s.phase !== 'bidding') throw new Error('Bidding is over.');
      if (a.seat !== s.bidTurn) throw new Error('It\'s not your turn to bid.');
      if (!Number.isInteger(a.bid) || a.bid < 0 || a.bid > 13) throw new Error('Bid Nil or 1 to 13 tricks.');
      const bids = s.bids.map((b, i) => (i === a.seat ? a.bid : b));
      if (bids.some(b => b == null)) return { ...s, bids, bidTurn: nextSeat(a.seat) };
      return { ...s, bids, phase: 'playing', table: dealTable(s.hands, nextSeat(s.dealer)) };
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const card = s.table.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!legalFor(s, a.seat).includes(card)) {
        throw new Error(s.table.trick.length ? 'You must follow suit if you can.' : 'Spades can\'t be led until they\'ve been broken.');
      }
      return { ...s, table: playCard(s.table, a.seat, card, { winnerOf: trick => trickWinner(trick, { trump: TRUMP }) }) };
    }

    case 'collect': {
      if (s.phase !== 'playing' || s.table.status !== 'collecting') return s;
      const table = collectTrick(s.table);
      if (table.status !== 'done') return { ...s, table };
      const result = scoreHand(s.bids, table.tricksWon, s.bags);
      const scores = [s.scores[0] + result.delta[0], s.scores[1] + result.delta[1]];
      const winner = winnerOf(scores, s.target);
      return { ...s, table, scores, bags: result.bags, lastHand: result, winner, phase: winner != null ? 'gameOver' : 'handOver' };
    }

    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return { ...deal(s, nextSeat(s.dealer)), handNo: s.handNo + 1 };

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ dealer: nextSeat(s.dealer), target: s.target });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  if (s.phase === 'bidding') return { type: 'bid', seat, bid: chooseBid(s.hands[seat], level, s.bids[(seat + 2) % 4]) };
  const t = s.table;
  const card = chooseCard({
    legal: legalFor(s, seat), trick: t.trick, seat, difficulty: level, bids: s.bids, tricksWon: t.tricksWon,
    memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[seat], deck: DECK }),
  });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
export function viewFor(s, seat) {
  return { ...s, hands: s.hands.map((h, i) => (i === seat ? h : h.map(() => null))), table: tableViewFor(s.table, seat) };
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
    dealer: r(s.dealer), bidTurn: r(s.bidTurn),
    hands: arr(s.hands), bids: arr(s.bids),
    scores: teams(s.scores), bags: teams(s.bags), winner: team(s.winner),
    lastHand: s.lastHand && { delta: teams(s.lastHand.delta), bags: teams(s.lastHand.bags), detail: teams(s.lastHand.detail) },
    table: rotateTable(s.table, seat),
  };
}
