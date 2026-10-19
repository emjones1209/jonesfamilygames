import { describe, it, expect } from 'vitest';
import { newSpider, runStart, canMove, move, deal, whyNoDeal, destinations, hint, isWon, RANKS } from './spiderRules';

const card = (rank, suit = 'spades', n = 0, faceUp = true) => ({ id: `${rank}-${suit}-${n}`, rank, suit, faceUp });
const all = s => [...s.tableau.flat(), ...s.stock].length + s.done.length * 13;

describe('Spider deal', () => {
  it('deals 54 cards to the columns (6, 6, 6, 6, then 5s) with only the last face up, and 50 to the stock', () => {
    for (const suits of [1, 2, 4]) {
      const s = newSpider(suits);
      expect(s.tableau.map(c => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
      expect(s.stock).toHaveLength(50);
      for (const col of s.tableau) expect(col.map(c => c.faceUp)).toEqual(col.map((_, i) => i === col.length - 1));
      const ids = [...s.tableau.flat(), ...s.stock].map(c => c.id);
      expect(new Set(ids).size).toBe(104);
      const bySuit = {};
      for (const c of [...s.tableau.flat(), ...s.stock]) bySuit[c.suit] = (bySuit[c.suit] ?? 0) + 1;
      expect(Object.values(bySuit)).toEqual(Array(suits).fill(104 / suits));
    }
  });
});

describe('Spider moves', () => {
  const game = tableau => ({ suits: 2, tableau: [...tableau, ...Array(10 - tableau.length).fill([])], stock: [], done: [], moves: 0, score: 500 });

  it('moves only a run of one suit, onto a card one higher of any suit or an empty column', () => {
    const s = game([
      [card('9', 'hearts', 0, false), card('8'), card('7'), card('6', 'hearts')],
      [card('9', 'hearts')],
      [card('7', 'hearts')],
    ]);
    expect(runStart(s.tableau[0])).toBe(3);                         // the 6♥ breaks the spade run
    expect(canMove(s, 0, 3, 2)).toBe(true);                         // 6♥ on 7♥
    expect(canMove(s, 0, 2, 1)).toBe(false);                        // 7♠ 6♥ aren't one suit
    expect(canMove(s, 0, 3, 3)).toBe(true);                         // an empty column takes anything
    const t = move(s, 0, 3, 2);
    expect(runStart(t.tableau[0])).toBe(1);                         // now 8♠ 7♠ move together
    expect(canMove(t, 0, 1, 1)).toBe(true);                         // onto the 9♥: any suit
    const u = move(t, 0, 1, 1);
    expect(u.tableau[0].map(c => c.faceUp)).toEqual([true]);        // the 9♥ underneath turns up
    expect(u.moves).toBe(2);
    expect(u.score).toBe(498);
  });

  it('clears a run of one suit from King to Ace, and you win with all eight', () => {
    const run = RANKS.slice().reverse();                            // K … A
    const s = game([[card('5', 'hearts', 1, false), ...run.slice(0, 12).map(r => card(r))], [card('A', 'spades', 1)]]);
    s.done = Array(7).fill('spades');
    const t = move(s, 1, 0, 0);
    expect(t.done).toHaveLength(8);
    expect(t.tableau[0]).toEqual([card('5', 'hearts', 1, true)]);   // cleared, and the card under it turned up
    expect(t.score).toBe(500 - 1 + 100);
    expect(isWon(t)).toBe(true);
  });

  it('deals one card onto every column, but not while a column is empty', () => {
    const s = newSpider(1);
    const t = deal(s);
    expect(t.stock).toHaveLength(40);
    expect(t.tableau.map(c => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6, 6, 6]);
    expect(t.tableau.every(c => c[c.length - 1].faceUp)).toBe(true);
    const empty = { ...t, tableau: [[], ...t.tableau.slice(1)] };
    expect(whyNoDeal(empty)).toMatch(/empty column/);
    expect(() => deal(empty)).toThrow();
  });

  it('suggests the same suit first', () => {
    const s = game([[card('7')], [card('8', 'hearts')], [card('8')], []]);
    expect(destinations(s, 0, 0).slice(0, 3)).toEqual([2, 1, 3]);   // (then the other empty columns)
  });
});

describe('Spider hints', () => {
  it('lead through whole one-suit games, never going round in circles or losing a card', () => {
    let wins = 0;
    for (let g = 0; g < 40; g++) {
      let s = newSpider(1);
      let step = 0;
      for (; step < 3000 && !isWon(s); step++) {
        const h = hint(s);
        if (!h) break;
        s = h.deal ? deal(s) : move(s, h.from, h.idx, h.to);
        expect(all(s)).toBe(104);
      }
      expect(step).toBeLessThan(3000);                              // it always comes to an end
      if (isWon(s)) wins++;
    }
    // (Hints aren't a solver, but following them alone wins about 1 game in 4 with one suit)
    expect(wins).toBeGreaterThan(0);
  });
});
