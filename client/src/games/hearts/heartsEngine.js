/**
 * A whole game of Hearts as a pure state machine, shared by the single-player
 * game (run in the browser) and play-together tables (run on the server).
 *
 * Seats 0-3 clockwise. `act(state, action)` returns the next state or throws an
 * Error whose message explains why the move isn't allowed:
 *   { type: 'pass', seat, ids }       the 3 cards you pass (everyone chooses at once)
 *   { type: 'play', seat, cardId }
 *   { type: 'collect' }               move the finished trick to its winner (after a pause)
 *   { type: 'nextHand' }              deal the next hand after the scores are shown
 *   { type: 'newGame' }               start again after the game ends
 *
 * `waitingOn(state)` lists the seats that must move; `robotAction(state, seat,
 * level)` picks a computer player's move; `viewFor(state, seat)` hides the
 * other hands and the cards the others are passing.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';
import { trickWinner } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick, rotateTable, tableViewFor } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import {
  legalPlays, chooseCard, choosePass, applyPasses, passDirection, scoreHand, isGameOver, leaders,
  isHeart, isQueenOfSpades, TWO_OF_CLUBS, cardPoints,
} from './heartsRules.js';

const DECK = buildDeck();
const SEATS = [0, 1, 2, 3];
const playedCards = t => [...t.taken.flat(), ...t.trick.map(p => p.card)];

// ── Dealing ──────────────────────────────────────────────────────────────────
function startPlay(s, hands) {
  const leader = hands.findIndex(h => h.some(c => c.id === TWO_OF_CLUBS));
  return { ...s, phase: 'playing', table: dealTable(hands, leader) };
}

function deal(game, handNo, deck = shuffle(buildDeck())) {
  const hands = SEATS.map(seat => deck.slice(seat * 13, seat * 13 + 13));
  const s = {
    ...game, handNo,
    phase: 'passing',                        // passing | playing | handOver | gameOver
    direction: passDirection(handNo),        // left | right | across | hold
    hands,                                   // as dealt (before passing)
    passes: [null, null, null, null],        // ids each seat is passing
    received: [[], [], [], []],              // ids each seat was passed
    table: null,
    lastHand: null,
  };
  return s.direction === 'hold' ? startPlay(s, hands) : s;
}

export function newGame({ deck } = {}) {
  return deal({ totals: [0, 0, 0, 0], winners: null }, 0, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** Seats that must move now (everyone still choosing while passing). */
export function waitingOn(s) {
  if (s.phase === 'passing') return SEATS.filter(seat => s.passes[seat] == null);
  if (s.phase === 'playing' && s.table.status === 'playing') return [s.table.turn];
  return [];
}

/** The seat whose card it is, or null. */
export const waitingFor = s => (s.phase === 'playing' && s.table.status === 'playing' ? s.table.turn : null);

export const legalFor = (s, seat) => (waitingFor(s) !== seat ? [] : legalPlays(s.table.hands[seat], s.table.trick, {
  firstTrick: s.table.trickNumber === 0,
  heartsBroken: playedCards(s.table).some(isHeart),
}));

/** Points each seat has taken so far this hand. */
export const pointsTaken = s => (s.table?.taken ?? [[], [], [], []]).map(cards => cards.reduce((n, c) => n + cardPoints(c), 0));

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  switch (a.type) {
    case 'pass': {
      if (s.phase !== 'passing') throw new Error('It\'s not time to pass cards.');
      if (s.passes[a.seat] != null) throw new Error('You\'ve already passed your cards.');
      const ids = [...new Set(a.ids ?? [])];
      if (ids.length !== 3 || !ids.every(id => s.hands[a.seat].some(c => c.id === id))) throw new Error('Choose 3 of your cards to pass.');
      const passes = s.passes.map((p, i) => (i === a.seat ? ids : p));
      if (passes.some(p => p == null)) return { ...s, passes };
      // Everyone has chosen: swap the cards
      const cards = passes.map((ids_, seat) => ids_.map(id => s.hands[seat].find(c => c.id === id)));
      const hands = applyPasses(s.hands.map(h => [...h]), cards, s.direction);
      const received = hands.map((h, seat) => h.filter(c => !s.hands[seat].some(d => d.id === c.id)).map(c => c.id));
      return startPlay({ ...s, passes, received }, hands);
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const card = s.table.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!legalFor(s, a.seat).includes(card)) {
        throw new Error(s.table.trickNumber === 0 && !s.table.trick.length ? 'The 2♣ leads the first trick.' : 'You can\'t play that card now — follow suit if you can.');
      }
      return { ...s, table: playCard(s.table, a.seat, card, { winnerOf: trickWinner }) };
    }

    case 'collect': {
      if (s.phase !== 'playing' || s.table.status !== 'collecting') return s;
      const table = collectTrick(s.table);
      if (table.status !== 'done') return { ...s, table };
      const result = scoreHand(table.taken);
      const totals = s.totals.map((t, i) => t + result.points[i]);
      const over = isGameOver(totals);
      return { ...s, table, totals, lastHand: result, phase: over ? 'gameOver' : 'handOver', winners: over ? leaders(totals) : null };
    }

    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return deal(s, s.handNo + 1);

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame();

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  if (s.phase === 'passing') return { type: 'pass', seat, ids: choosePass(s.hands[seat], level).map(c => c.id) };
  const t = s.table;
  const card = chooseCard({
    legal: legalFor(s, seat), trick: t.trick, seat, difficulty: level,
    queenPlayed: playedCards(t).some(isQueenOfSpades), pointsTaken: pointsTaken(s),
    memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[seat], deck: DECK }),
  });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
export function viewFor(s, seat) {
  const own = (x, i, hidden) => (i === seat ? x : hidden);
  return {
    ...s,
    hands: s.hands.map((h, i) => own(h, i, h.map(() => null))),
    passes: s.passes.map((p, i) => own(p, i, p == null ? null : true)),     // others: only whether they've chosen
    received: s.received.map((r, i) => own(r, i, [])),
    table: tableViewFor(s.table, seat),
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : (x - seat + 4) % 4);
  const arr = a => a && SEATS.map(i => a[(i + seat) % 4]);
  return {
    ...s,
    hands: arr(s.hands), passes: arr(s.passes), received: arr(s.received), totals: arr(s.totals),
    table: rotateTable(s.table, seat),
    lastHand: s.lastHand && { points: arr(s.lastHand.points), shooter: r(s.lastHand.shooter) },
    winners: s.winners && s.winners.map(r),
  };
}
