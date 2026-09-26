import { describe, it, expect } from 'vitest';
import {
  rawScore, options, score, total, upperBonus, emptyCard, newTurn, roll, toggleHold, cardFull, BOXES,
} from './diceRules';
import { robotStep } from './diceAI';

describe('Five Dice scoring', () => {
  it('scores each box', () => {
    expect(rawScore('threes', [3, 3, 1, 3, 6])).toBe(9);
    expect(rawScore('threeKind', [4, 4, 4, 2, 6])).toBe(20);
    expect(rawScore('threeKind', [4, 4, 3, 2, 6])).toBe(0);
    expect(rawScore('fourKind', [5, 5, 5, 5, 1])).toBe(21);
    expect(rawScore('fullHouse', [2, 2, 3, 3, 3])).toBe(25);
    expect(rawScore('fullHouse', [3, 3, 3, 3, 2])).toBe(0);
    expect(rawScore('smallStraight', [1, 2, 3, 4, 6])).toBe(30);
    expect(rawScore('smallStraight', [3, 4, 5, 6, 6])).toBe(30);
    expect(rawScore('smallStraight', [1, 2, 3, 5, 6])).toBe(0);
    expect(rawScore('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
    expect(rawScore('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
    expect(rawScore('fiveKind', [6, 6, 6, 6, 6])).toBe(50);
    expect(rawScore('chance', [1, 2, 3, 4, 6])).toBe(16);
  });

  it('adds the 35 upper bonus at 63 or more', () => {
    const card = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
    expect(upperBonus(card)).toBe(35);
    expect(upperBonus({ ...card, sixes: 12 })).toBe(0);
  });

  it('applies the joker rules to an extra Five of a Kind', () => {
    const card = { ...emptyCard(), fiveKind: 50 };
    // The matching number box is open: it must go there, and earns a 100 bonus
    expect(Object.keys(options(card, [4, 4, 4, 4, 4]))).toEqual(['fours']);
    const scored = score(card, 'fours', [4, 4, 4, 4, 4]);
    expect(scored.fours).toBe(20);
    expect(scored.bonus).toBe(100);
    // Number box used: any open lower box at full value
    const lower = options({ ...card, fours: 12 }, [4, 4, 4, 4, 4]);
    expect(lower).toMatchObject({ fullHouse: 25, smallStraight: 30, largeStraight: 40, threeKind: 20, chance: 20 });
    // A zero in the Five of a Kind box: still a joker, but no bonus
    const zeroed = score({ ...emptyCard(), fiveKind: 0, fours: 8 }, 'largeStraight', [4, 4, 4, 4, 4]);
    expect(zeroed.largeStraight).toBe(40);
    expect(zeroed.bonus).toBe(0);
  });

  it('refuses a filled box', () => {
    expect(() => score({ ...emptyCard(), chance: 20 }, 'chance', [1, 2, 3, 4, 5])).toThrow(/already filled/);
  });

  it('rolls three times, keeping held dice', () => {
    let t = newTurn();
    expect(toggleHold(t, 0)).toBe(t);                        // nothing to hold before the first roll
    t = roll(t);
    expect(t.dice.every(d => d >= 1 && d <= 6)).toBe(true);
    t = toggleHold(t, 2);
    const kept = t.dice[2];
    t = roll(roll(t));
    expect(t.dice[2]).toBe(kept);
    expect(t.rollsLeft).toBe(0);
    expect(() => roll(t)).toThrow(/No rolls left/);
  });
});

// ── Computer players ─────────────────────────────────────────────────────────
function playGame(level) {
  let card = emptyCard();
  for (let turnNo = 0; turnNo < 13; turnNo++) {
    let t = newTurn();
    for (let step = 0; step < 10; step++) {
      const move = robotStep(card, t, level);
      if (move.type === 'score') { card = score(card, move.box, t.dice); break; }
      t = roll({ ...t, held: move.held });
    }
  }
  return card;
}

describe('Five Dice computer players', () => {
  it('fill the whole scorecard, and each level scores more than the one below', () => {
    const avg = {};
    const games = { easy: 400, medium: 400, hard: 150 };
    for (const level of ['easy', 'medium', 'hard']) {
      let sum = 0;
      for (let g = 0; g < games[level]; g++) {
        const card = playGame(level);
        expect(cardFull(card)).toBe(true);
        expect(BOXES.every(b => Number.isFinite(card[b]))).toBe(true);
        sum += total(card);
      }
      avg[level] = sum / games[level];
    }
    console.log(`dice averages: easy ${avg.easy.toFixed(0)} · medium ${avg.medium.toFixed(0)} · hard ${avg.hard.toFixed(0)}`);
    expect(avg.medium).toBeGreaterThan(avg.easy + 20);
    expect(avg.hard).toBeGreaterThan(avg.medium + 20);
  }, 120000);
});
