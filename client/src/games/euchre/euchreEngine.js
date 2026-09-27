/**
 * A whole game of Euchre as a pure state machine, shared by the single-player
 * game (run in the browser) and play-together tables (run on the server).
 *
 * Seats 0-3 clockwise; team 0 = seats 0 & 2, team 1 = seats 1 & 3. Five cards
 * each; one of the four left over is turned up.
 *   Round 1: starting left of the dealer, each player may "order up" the
 *            up-card, making its suit trump (the dealer picks it up and
 *            throws a card away), or pass.
 *   Round 2: if everyone passed, each player may name any other suit, or
 *            pass — but the dealer can't pass ("stick the dealer").
 * Whoever names trump may go alone: their partner sits the hand out.
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed:
 *   { type: 'call', seat, suit, alone }   name trump (round 1: the up-card's suit)
 *   { type: 'pass', seat }
 *   { type: 'discard', seat, cardId }     the dealer throws a card away after picking up
 *   { type: 'play', seat, cardId }
 *   { type: 'collect' }                   move the finished trick to its winner (after a pause)
 *   { type: 'nextHand' }                  deal the next hand after the scores are shown
 *   { type: 'newGame' }                   start again after a game is won
 *
 * `waitingFor(state)` says whose move it is; `robotAction(state, seat, level)`
 * picks a computer player's move; `viewFor(state, seat)` hides the other hands
 * and the cards left in the pack.
 */
import { shuffle } from '../../utils/cardEngine.js';
import { nextSeat, partnerOf, teamOf } from '../cards/tricks.js';
import { dealTable, playCard, collectTrick, rotateTable, tableViewFor } from '../cards/trickTable.js';
import { tableMemory } from '../cards/memory.js';
import {
  makeDeck, HAND_SIZE, legalPlays, winnerOf, scoreHand, gameWinner, chooseCall, chooseDiscard, chooseCard,
  suitWith, rankWith,
} from './euchreRules.js';

const DECK = makeDeck();
const SEATS = [0, 1, 2, 3];

function deal(game, dealer, deck = shuffle(makeDeck())) {
  return {
    ...game,
    phase: 'bidding',                          // bidding | discard | playing | handOver | gameOver
    round: 1,                                  // bidding round 1 (the up-card) or 2 (any other suit)
    dealer,
    hands: SEATS.map(seat => deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)),
    upcard: deck[4 * HAND_SIZE],
    kitty: deck.slice(4 * HAND_SIZE + 1),      // the other three, never seen
    turnedDown: null,                          // the up-card's suit once everyone has passed it
    calls: [null, null, null, null],           // this round: 'pass' | { suit, alone }
    bidTurn: nextSeat(dealer),
    trump: null,
    maker: null,                               // the seat that named trump
    alone: false,
    sittingOut: null,                          // the lone player's partner
    discarded: null,                           // the card the dealer threw away
    table: null,
    lastHand: null,
  };
}

/** Seat 3 deals first, so seat 0 speaks and leads first. */
export function newGame({ dealer = 3, deck } = {}) {
  return deal({ scores: [0, 0], handNo: 0, winner: null }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export function waitingFor(s) {
  if (s.phase === 'bidding') return s.bidTurn;
  if (s.phase === 'discard') return s.dealer;
  if (s.phase === 'playing' && s.table.status === 'playing') return s.table.turn;
  return null;
}

/** The dealer can't pass in round 2. */
export const mustCall = s => s.phase === 'bidding' && s.round === 2 && s.bidTurn === s.dealer;

export const legalFor = (s, seat) =>
  (s.phase === 'playing' && waitingFor(s) === seat ? legalPlays(s.table.hands[seat], s.table.trick, s.trump) : []);

/** Tricks each team has taken this hand. */
export const teamTricks = s => [0, 1].map(team => SEATS.reduce((n, seat) => n + (teamOf(seat) === team ? s.table?.tricksWon[seat] ?? 0 : 0), 0));

// The next seat that's playing this hand
const nextPlaying = (s, seat) => {
  let n = nextSeat(seat);
  if (n === s.sittingOut) n = nextSeat(n);
  return n;
};

function startPlay(s) {
  // The lone player's partner puts their cards down for this hand
  const hands = s.hands.map((h, seat) => (seat === s.sittingOut ? [] : h));
  const leader = nextPlaying(s, s.dealer);
  return { ...s, phase: 'playing', table: dealTable(hands, leader) };
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  switch (a.type) {
    case 'call': {
      if (s.phase !== 'bidding') throw new Error('Trump has already been named.');
      if (a.seat !== s.bidTurn) throw new Error('It\'s not your turn.');
      const suit = s.round === 1 ? s.upcard.suit : a.suit;
      if (s.round === 2 && (!suit || suit === s.turnedDown)) throw new Error('Name a suit other than the one turned down.');
      if (s.round === 1 && a.suit != null && a.suit !== suit) throw new Error('In the first round you can only order up the turned card\'s suit.');
      const alone = !!a.alone;
      const called = {
        ...s,
        calls: s.calls.map((c, i) => (i === a.seat ? { suit, alone } : c)),
        trump: suit, maker: a.seat, alone, sittingOut: alone ? partnerOf(a.seat) : null,
      };
      // Round 1: the dealer picks up the up-card and throws one away — unless they're sitting out
      if (s.round === 1 && called.sittingOut !== s.dealer) {
        return {
          ...called, phase: 'discard',
          hands: s.hands.map((h, i) => (i === s.dealer ? [...h, s.upcard] : h)),
        };
      }
      return startPlay(called);
    }

    case 'pass': {
      if (s.phase !== 'bidding') throw new Error('Trump has already been named.');
      if (a.seat !== s.bidTurn) throw new Error('It\'s not your turn.');
      if (mustCall(s)) throw new Error('The dealer has to name trump now.');
      const calls = s.calls.map((c, i) => (i === a.seat ? 'pass' : c));
      if (s.round === 1 && a.seat === s.dealer) {
        // Everyone passed: turn the card down and go round again
        return { ...s, round: 2, turnedDown: s.upcard.suit, calls: [null, null, null, null], bidTurn: nextSeat(s.dealer) };
      }
      return { ...s, calls, bidTurn: nextSeat(a.seat) };
    }

    case 'discard': {
      if (s.phase !== 'discard') throw new Error('It\'s not time to throw a card away.');
      if (a.seat !== s.dealer) throw new Error('Only the dealer throws a card away.');
      const card = s.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      const hands = s.hands.map((h, i) => (i === a.seat ? h.filter(c => c.id !== card.id) : h));
      return startPlay({ ...s, hands, discarded: card });
    }

    case 'play': {
      if (s.phase !== 'playing') throw new Error('It\'s not time to play a card.');
      if (waitingFor(s) !== a.seat) throw new Error('It\'s not your turn.');
      const card = s.table.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!legalFor(s, a.seat).includes(card)) {
        throw new Error('You must follow suit if you can (remember the left bower counts as trump).');
      }
      const players = s.sittingOut == null ? 4 : 3;
      let table = playCard(s.table, a.seat, card, { winnerOf: trick => winnerOf(trick, s.trump), seats: players });
      if (table.status === 'playing') table = { ...table, turn: nextPlaying(s, a.seat) };
      return { ...s, table };
    }

    case 'collect': {
      if (s.phase !== 'playing' || s.table.status !== 'collecting') return s;
      const table = collectTrick(s.table);
      if (table.status !== 'done') return { ...s, table };
      const next = { ...s, table };
      const makerTeam = teamOf(s.maker);
      const tricks = teamTricks(next);
      const { delta, result } = scoreHand(makerTeam, tricks, s.alone);
      const scores = [s.scores[0] + delta[0], s.scores[1] + delta[1]];
      const winner = gameWinner(scores);
      return {
        ...next, scores, winner,
        phase: winner != null ? 'gameOver' : 'handOver',
        lastHand: { makerTeam, maker: s.maker, trump: s.trump, alone: s.alone, tricks, delta, result },
      };
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

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  if (s.phase === 'bidding') {
    const choice = chooseCall({
      hand: s.hands[seat], seat, dealer: s.dealer, upcard: s.upcard, round: s.round, turnedDown: s.turnedDown, level,
    });
    return choice.call ? { type: 'call', seat, suit: choice.suit, alone: choice.alone } : { type: 'pass', seat };
  }
  if (s.phase === 'discard') return { type: 'discard', seat, cardId: chooseDiscard(s.hands[seat], s.trump).id };
  const t = s.table;
  const memory = tableMemory({
    history: t.history, trick: t.trick, deck: DECK, suitOf: suitWith(s.trump), rankOf: rankWith(s.trump),
    // The dealer knows the card they threw away
    hand: seat === s.dealer && s.discarded ? [...t.hands[seat], s.discarded] : t.hands[seat],
  });
  const card = chooseCard({
    legal: legalFor(s, seat), trick: t.trick, seat, level, trump: s.trump,
    makerTeam: teamOf(s.maker), sittingOut: s.sittingOut, memory,
  });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
const hide = cards => cards.map(() => null);

export function viewFor(s, seat) {
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? h : hide(h))),
    kitty: hide(s.kitty),
    discarded: seat === s.dealer ? s.discarded : null,
    table: tableViewFor(s.table, seat),
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
    dealer: r(s.dealer), bidTurn: r(s.bidTurn), maker: r(s.maker), sittingOut: r(s.sittingOut),
    hands: arr(s.hands), calls: arr(s.calls),
    scores: teams(s.scores), winner: team(s.winner),
    lastHand: s.lastHand && {
      ...s.lastHand, makerTeam: team(s.lastHand.makerTeam), maker: r(s.lastHand.maker),
      tricks: teams(s.lastHand.tricks), delta: teams(s.lastHand.delta),
    },
    table: rotateTable(s.table, seat),
  };
}
