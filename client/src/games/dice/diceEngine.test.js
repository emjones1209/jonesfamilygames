import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, rotate } from './diceEngine';
import { total, BOXES } from './diceRules';

function autoplay(s, levels = ['hard', 'medium', 'easy', 'hard'], until = () => false) {
  for (let step = 0; step < 5000 && !until(s) && s.phase !== 'gameOver'; step++) {
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Five Dice game engine', () => {
  it('plays whole games for 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      const s = autoplay(newGame({ players }));
      expect(s.phase).toBe('gameOver');
      for (const card of s.cards) expect(BOXES.every(b => card[b] != null)).toBe(true);
      const best = Math.max(...s.cards.map(total));
      expect(s.winners.every(w => total(s.cards[w]) === best)).toBe(true);
    }
  });

  it('takes turns: three rolls, holds between them, then a score', () => {
    let s = newGame({ players: 3 });
    expect(() => act(s, { type: 'roll', seat: 1 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'score', seat: 0, box: 'chance' })).toThrow(/Roll the dice first/);
    s = act(s, { type: 'roll', seat: 0 });
    expect(s.last).toMatchObject({ seat: 0, kind: 'roll', first: true });
    s = act(s, { type: 'hold', seat: 0, i: 2 });
    const kept = s.dice.dice[2];
    s = act(s, { type: 'roll', seat: 0 });
    expect(s.dice.dice[2]).toBe(kept);
    expect(s.last.keeping).toEqual([kept]);
    s = act(s, { type: 'roll', seat: 0 });
    expect(() => act(s, { type: 'roll', seat: 0 })).toThrow(/No rolls left/);
    s = act(s, { type: 'score', seat: 0, box: 'chance' });
    expect(s.cards[0].chance).toBe(s.last.points);
    expect(waitingFor(s)).toBe(1);
    expect(() => act(s, { type: 'score', seat: 1, box: 'chance' })).toThrow(/Roll the dice first/);
  });

  it('turns the table round so each player comes first', () => {
    const s = autoplay(newGame({ players: 4 }), undefined, x => x.cards[3].chance != null || x.cards[3].ones != null);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.cards[0]).toEqual(s.cards[seat]);
      expect(r.turn).toBe((s.turn - seat + 4) % 4);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
