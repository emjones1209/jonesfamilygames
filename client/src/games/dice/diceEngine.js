/**
 * A game of Five Dice for 2-4 players as a pure state machine, shared by the
 * single-player game (run in the browser) and play-together tables (run on the
 * server, which rolls the dice). The rules are in diceRules.js and the
 * computer players in diceAI.js.
 *
 * Players take turns clockwise, 13 turns each. `act(state, action)` returns the
 * next state or throws an Error whose message explains why the move isn't allowed:
 *   { type: 'roll', seat, held? }     roll the dice that aren't held (`held`: set them all at once)
 *   { type: 'hold', seat, i }         hold or let go of die i between rolls
 *   { type: 'score', seat, box }      score the dice in a box, ending the turn
 *   { type: 'newGame' }               start again after the game ends
 */
import { newTurn, roll, toggleHold, score, emptyCard, cardFull, total, ROLLS_PER_TURN } from './diceRules.js';
import { robotStep } from './diceAI.js';

export function newGame({ players = 2, first = 0 } = {}) {
  return {
    players,
    cards: Array.from({ length: players }, emptyCard),
    turn: first,
    first,
    dice: newTurn(),                      // { dice, held, rollsLeft }
    rollNo: 0,                            // counts rolls (so screens can tumble the dice)
    last: null,                           // the latest roll or score, for the message line
    phase: 'play',                        // play | gameOver
    winners: null,
  };
}

export const waitingFor = s => (s.phase === 'play' ? s.turn : null);

export function act(s, a) {
  if (a.type === 'newGame') {
    if (s.phase !== 'gameOver') return s;
    return newGame({ players: s.players, first: (s.first + 1) % s.players });
  }
  if (s.phase !== 'play') throw new Error('The game is over.');
  if (a.seat !== s.turn) throw new Error('It\'s not your turn.');
  switch (a.type) {
    case 'roll': {
      const before = Array.isArray(a.held) && a.held.length === 5 ? { ...s.dice, held: a.held.map(Boolean) } : s.dice;
      const keeping = before.rollsLeft < ROLLS_PER_TURN ? before.dice.filter((_, i) => before.held[i]) : [];
      return {
        ...s, dice: roll(before), rollNo: s.rollNo + 1,
        last: { seat: a.seat, kind: 'roll', first: before.rollsLeft === ROLLS_PER_TURN, keeping, rollsLeft: before.rollsLeft - 1 },
      };
    }
    case 'hold':
      if (!Number.isInteger(a.i) || a.i < 0 || a.i > 4) throw new Error('Pick one of the five dice.');
      return { ...s, dice: toggleHold(s.dice, a.i) };
    case 'score': {
      const card = score(s.cards[a.seat], a.box, s.dice.dice);
      const cards = s.cards.map((c, i) => (i === a.seat ? card : c));
      const next = {
        ...s, cards, dice: newTurn(), turn: (s.turn + 1) % s.players,
        last: { seat: a.seat, kind: 'score', box: a.box, points: card[a.box], bonus: card.bonus > s.cards[a.seat].bonus },
      };
      if (!cards.every(cardFull)) return next;
      const best = Math.max(...cards.map(total));
      return { ...next, phase: 'gameOver', winners: cards.map((c, i) => (total(c) === best ? i : -1)).filter(i => i >= 0) };
    }
    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

/** A computer player's next step: a roll (holding what it wants to keep) or a score. */
export const robotAction = (s, seat, level) => ({ ...robotStep(s.cards[seat], s.dice, level), seat });

/** Dice have no secrets: everyone sees everything. */
export const viewFor = s => s;

/** Turn a state round so that `seat` comes first. */
export function rotate(s, seat) {
  if (!seat) return s;
  const n = s.players;
  const r = x => (x == null ? x : (x - seat + n) % n);
  return {
    ...s,
    cards: s.cards.map((_, i) => s.cards[(i + seat) % n]),
    turn: r(s.turn), first: r(s.first),
    last: s.last && { ...s.last, seat: r(s.last.seat) },
    winners: s.winners && s.winners.map(r),
  };
}
