/**
 * Pure state machine for playing out one hand of a trick-taking game.
 *
 * status:
 *   'playing'    – waiting for `turn` to play
 *   'collecting' – the trick is complete and stays visible (no plays accepted)
 *                  until collectTrick() is called
 *   'done'       – every card has been played
 *
 * All functions return a new state and never mutate their input. Illegal
 * actions (wrong seat, card not in hand, playing while collecting) return the
 * state unchanged, so a stray double-tap can't play a card twice.
 */
import { SEATS, nextSeat, removeCard } from './tricks.js';

export function dealTable(hands, leader) {
  return {
    hands,
    trick: [],               // [{ card, seat }] in play order
    turn: leader,
    leader,
    status: 'playing',
    winner: null,            // winner of the trick being collected
    tricksWon: hands.map(() => 0),
    taken: hands.map(() => []), // cards won by each seat (for point counting)
    lastTrick: null,         // most recently collected trick { plays, winner }
    history: [],             // every collected trick's plays, in order (for card memory)
    trickNumber: 0,
  };
}

/**
 * Play `card` from `seat`. `winnerOf(trick)` returns the winning seat once the
 * trick is complete. `seats` is the number of players per trick.
 */
export function playCard(state, seat, card, { winnerOf, seats = SEATS }) {
  if (state.status !== 'playing' || seat !== state.turn) return state;
  if (!state.hands[seat].some(c => c.id === card.id)) return state;

  const hands = state.hands.map((h, i) => (i === seat ? removeCard(h, card) : h));
  const trick = [...state.trick, { card, seat }];

  if (trick.length < seats) {
    return { ...state, hands, trick, turn: nextSeat(seat, seats) };
  }
  return { ...state, hands, trick, status: 'collecting', winner: winnerOf(trick) };
}

/** Move the completed trick to its winner; the winner leads next. */
export function collectTrick(state) {
  if (state.status !== 'collecting') return state;
  const { winner, trick } = state;
  const tricksWon = state.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
  const taken = state.taken.map((t, i) => (i === winner ? [...t, ...trick.map(p => p.card)] : t));
  const handOver = state.hands.every(h => h.length === 0);
  return {
    ...state,
    trick: [],
    tricksWon,
    taken,
    lastTrick: { plays: trick, winner },
    history: [...state.history, trick],
    trickNumber: state.trickNumber + 1,
    turn: winner,
    leader: winner,
    winner: null,
    status: handOver ? 'done' : 'playing',
  };
}

export const leadSuitOf = (state, suitOf = c => c.suit) =>
  state.trick.length ? suitOf(state.trick[0].card) : null;
