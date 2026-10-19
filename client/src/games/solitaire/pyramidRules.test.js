import { describe, it, expect } from 'vitest';
import { newPyramid, isFree, canRemove, remove, draw, whyNoDraw, removals, hint, isWon, isStuck, left, rowOf, indexOf } from './pyramidRules';

const card = (rank, suit = 'spades') => ({ id: `${rank}-${suit}`, rank, suit, faceUp: true });
const pyr = i => ({ type: 'pyr', i });
const waste = { type: 'waste' };
const total = s => s.pyramid.filter(Boolean).length + s.stock.length + s.waste.length + s.removed.length;

describe('Pyramid', () => {
  it('deals 28 cards in seven rows, and 24 to the stock', () => {
    const s = newPyramid();
    expect(s.pyramid).toHaveLength(28);
    expect(s.stock).toHaveLength(24);
    expect([0, 1, 2, 3, 6, 21, 27].map(rowOf)).toEqual([0, 1, 1, 2, 3, 6, 6]);
    expect(indexOf(6, 0)).toBe(21);
    // Only the bottom row is uncovered at first
    expect(s.pyramid.map((_, i) => isFree(s, i))).toEqual(s.pyramid.map((_, i) => i >= 21));
  });

  it('takes away a King alone, or two uncovered cards that make 13', () => {
    const s = newPyramid();
    s.pyramid[21] = card('K'); s.pyramid[22] = card('6'); s.pyramid[23] = card('7', 'hearts'); s.pyramid[24] = card('Q');
    s.waste = [card('A', 'clubs')];
    s.stock = s.stock.slice(1);                                    // (the waste card came from the stock)
    expect(canRemove(s, [pyr(21)])).toBe(true);
    expect(canRemove(s, [pyr(22), pyr(23)])).toBe(true);           // 6 + 7
    expect(canRemove(s, [pyr(24), waste])).toBe(true);             // Q + A
    expect(canRemove(s, [pyr(22), pyr(24)])).toBe(false);
    expect(canRemove(s, [pyr(15)])).toBe(false);                   // covered
    let t = remove(s, [pyr(21)]);
    t = remove(t, [pyr(22), pyr(23)]);
    expect(isFree(t, 15)).toBe(true);                              // both cards below it (21, 22) are gone
    expect(isFree(t, 16)).toBe(true);                              // (22, 23)
    expect(isFree(t, 17)).toBe(false);                             // 24 is still there
    t = remove(t, [pyr(24), waste]);
    expect(isFree(t, 17)).toBe(true);
    expect(t.removed).toHaveLength(5);
    expect(total(t)).toBe(52);
  });

  it('goes through the stock three times', () => {
    let s = newPyramid();
    for (let pass = 1; pass <= 3; pass++) {
      for (let i = 0; i < 24; i++) s = draw(s);
      expect(s.waste).toHaveLength(24);
      if (pass < 3) s = draw(s);                                   // turn the waste back over
    }
    expect(whyNoDraw(s)).toMatch(/used up/);
    expect(() => draw(s)).toThrow();
  });

  it('wins once the pyramid is cleared, and knows when it\'s stuck', () => {
    for (let g = 0; g < 200; g++) {
      let s = newPyramid();
      for (let n = 0; n < 500 && !isWon(s) && !isStuck(s); n++) {
        const h = hint(s);
        s = h.remove ? remove(s, h.remove) : draw(s);
        expect(total(s)).toBe(52);
      }
      expect(isWon(s) || isStuck(s)).toBe(true);
      if (isWon(s)) expect(left(s)).toBe(0);
      if (isStuck(s)) expect(removals(s)).toEqual([]);
    }
  });
});
