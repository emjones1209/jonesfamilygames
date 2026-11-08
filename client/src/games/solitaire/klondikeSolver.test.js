import { describe, it, expect } from 'vitest';
import { solve, canWin, deal, winnableDeal } from './klondikeSolver';
import { applyMove, turnStock, isWon } from './klondikeRules';
import { autoStep, canAutoComplete } from './autoComplete';

const game = (d, drawCount = 1) => ({ ...d, waste: [], foundations: { spades: [], hearts: [], diamonds: [], clubs: [] }, moves: 0, drawCount });
const card = (rank, suit, faceUp = true) => ({ id: `${rank}-${suit}`, rank, suit, faceUp });

/** Play the solver's way to win in the real game (turning the stock to reach a card), then auto-complete. */
function playOut(d, steps, drawCount = 1) {
  let g = game(d, drawCount);
  for (const { card: c, to } of steps) {
    let from = null;
    for (let turns = 0; !from; turns++) {
      if (turns > 60) throw new Error(`${c.id} can't be reached`);
      if (g.waste[0]?.id === c.id) { from = { type: 'waste' }; break; }
      const colIdx = g.tableau.findIndex(col => col.some(x => x.id === c.id && x.faceUp));
      if (colIdx >= 0) { from = { type: 'tableau', colIdx, rowIdx: g.tableau[colIdx].findIndex(x => x.id === c.id) }; break; }
      g = turnStock(g);
    }
    const dest = to === 'home' ? { type: 'foundation', suit: c.suit } : { type: 'tableau', colIdx: to };
    // (Each step must be one the game allows)
    if (dest.type === 'foundation') {
      const pile = g.foundations[c.suit];
      expect(pile.length + 1, `${c.id} up`).toBe({ A: 1, J: 11, Q: 12, K: 13 }[c.rank] ?? +c.rank);
      if (from.type === 'tableau') expect(from.rowIdx).toBe(g.tableau[from.colIdx].length - 1);
    } else {
      const col = g.tableau[to];
      const onto = col.at(-1);
      if (!onto) expect(c.rank).toBe('K');
      else expect(onto.faceUp).toBe(true);
    }
    g = applyMove(g, { from, to: dest });
  }
  if (drawCount === 1) expect(canAutoComplete(g) || isWon(g)).toBe(true);
  for (let next; (next = autoStep(g));) { const { kind: _k, ...rest } = next; g = rest; }
  return g;
}

describe('Klondike solver', () => {
  it('finds ways to win that really win, played out in the game', () => {
    let found = 0;
    for (let n = 0; n < 40; n++) {
      const d = deal();
      const steps = solve(d);
      if (!steps) continue;
      found++;
      expect(isWon(playOut(d, steps))).toBe(true);
    }
    expect(found).toBeGreaterThan(10);
  });

  it('finds ways to win turning three cards at a time, played out in the game', () => {
    let found = 0;
    for (let n = 0; n < 40; n++) {
      const d = deal();
      const steps = solve(d, { draw: 3 });
      if (!steps) continue;
      found++;
      expect(isWon(playOut(d, steps, 3))).toBe(true);
    }
    expect(found).toBeGreaterThan(8);
  });

  it('only plays the cards three at a time can reach', () => {
    // A column wanting the A♠ and nothing else: the A♠ is 2nd in the stock, so turning three
    // at a time never brings it to the top — until another card is taken out (none can be)
    const tableau = [[card('2', 'hearts', false), card('K', 'clubs')], [], [], [], [], [], []];
    const stock = [card('Q', 'diamonds'), card('A', 'spades'), card('9', 'clubs')].map(c => ({ ...c, faceUp: false }));
    expect(canWin({ tableau, stock }, { draw: 1 })).toBe(true);
    expect(canWin({ tableau, stock }, { draw: 3 })).toBe(false);
  });

  it("says a deal can't be won when nothing can move", () => {
    // An Ace (or 2) face down under every column's top card, and no top card goes anywhere
    const under = [['A', 'spades'], ['A', 'clubs'], ['A', 'hearts'], ['A', 'diamonds'], ['2', 'spades'], ['2', 'clubs'], ['2', 'hearts']];
    const tops = [['5', 'spades'], ['5', 'clubs'], ['5', 'hearts'], ['5', 'diamonds'], ['9', 'spades'], ['9', 'clubs'], ['9', 'hearts']];
    const tableau = under.map((u, i) => [card(...u, false), card(...tops[i])]);
    expect(canWin({ tableau, stock: [] })).toBe(false);
    // (A 4♦ from the stock can go on a black 5, but that turns nothing over)
    expect(canWin({ tableau, stock: [card('4', 'diamonds', false)] })).toBe(false);
  });

  it('deals games it can win turning three at a time', () => {
    for (let n = 0; n < 3; n++) expect(canWin(winnableDeal({ draw: 3 }), { draw: 3 })).toBe(true);
  });

  it('deals games it can win', () => {
    for (let n = 0; n < 5; n++) {
      const d = winnableDeal();
      expect(d.tableau.map(c => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(d.tableau.flat().length + d.stock.length).toBe(52);
      expect(new Set([...d.tableau.flat(), ...d.stock].map(c => c.id)).size).toBe(52);
      expect(canWin(d)).toBe(true);
    }
  });
});
