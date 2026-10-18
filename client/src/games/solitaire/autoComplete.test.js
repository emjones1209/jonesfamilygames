import { describe, it, expect } from 'vitest';
import { autoStep, canAutoComplete, foundationCount } from './autoComplete';
import { shuffle } from '../../utils/cardEngine';

const DOWN = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
const card = (rank, suit, faceUp = true) => ({ id: `${rank}-${suit}`, rank, suit, faceUp });

/**
 * A random end game: every card in the columns face up (each column a run going down,
 * as play leaves them), and the rest somewhere in the stock or waste.
 */
function endGame() {
  const pieces = [];
  const stock = [];
  // The 52 cards as four K→A runs, each card used once
  const runs = [
    DOWN.map((rank, i) => card(rank, i % 2 ? 'hearts' : 'spades')),
    DOWN.map((rank, i) => card(rank, i % 2 ? 'spades' : 'hearts')),
    DOWN.map((rank, i) => card(rank, i % 2 ? 'diamonds' : 'clubs')),
    DOWN.map((rank, i) => card(rank, i % 2 ? 'clubs' : 'diamonds')),
  ];
  for (const r of runs) {
    // Cut each run into a few pieces: some stay in the columns, the rest go to the stock
    let start = 0;
    while (start < r.length) {
      const end = Math.min(r.length, start + 1 + Math.floor(Math.random() * 6));
      if (Math.random() < 0.6) pieces.push(r.slice(start, end)); else stock.push(...r.slice(start, end));
      start = end;
    }
  }
  const tableau = Array.from({ length: 7 }, () => []);
  shuffle(pieces).forEach((p, i) => { if (i < 7) tableau[i] = p; else stock.push(...p); });
  const cards = shuffle(stock).map(c => ({ ...c, faceUp: false }));
  const cut = Math.floor(Math.random() * (cards.length + 1));
  return {
    tableau,
    stock: cards.slice(cut),
    waste: cards.slice(0, cut).map(c => ({ ...c, faceUp: true })),
    foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
  };
}

describe('Solitaire auto-complete', () => {
  it('always finishes the game once every card in the columns is face up', () => {
    for (let trial = 0; trial < 300; trial++) {
      let g = endGame();
      expect(foundationCount(g) + g.stock.length + g.waste.length + g.tableau.flat().length).toBe(52);
      expect(canAutoComplete(g)).toBe(true);
      for (let steps = 0; steps < 5000; steps++) {
        const next = autoStep(g);
        if (!next) break;
        g = next;
      }
      expect(foundationCount(g)).toBe(52);
      expect(canAutoComplete(g)).toBe(false);
      for (const pile of Object.values(g.foundations)) expect(pile.map(c => c.rank)).toEqual([...DOWN].reverse());
    }
  });

  it('isn\'t offered while a card in the columns is still face down', () => {
    const g = endGame();
    g.tableau[0] = [card('5', 'spades', false), ...g.tableau[0]];
    expect(canAutoComplete(g)).toBe(false);
  });
});
