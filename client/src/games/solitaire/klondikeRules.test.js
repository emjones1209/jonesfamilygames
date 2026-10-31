import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { legalMoves, applyMove, hint, turnStock, positionKey, fitsColumn, destinations, autoHomeStep } from './klondikeRules';

const deal = () => {
  const deck = shuffle(buildDeck());
  let i = 0;
  const tableau = Array.from({ length: 7 }, (_, c) => Array.from({ length: c + 1 }, (_, r) => ({ ...deck[i++], faceUp: r === c })));
  return { tableau, stock: deck.slice(i).map(c => ({ ...c, faceUp: false })), waste: [], foundations: { spades: [], hearts: [], diamonds: [], clubs: [] }, moves: 0 };
};
const up = g => Object.values(g.foundations).reduce((n, f) => n + f.length, 0);
const all = g => g.tableau.flat().length + g.stock.length + g.waste.length + up(g);
const card = (rank, suit, faceUp = true) => ({ id: `${rank}${suit}`, rank, suit, faceUp });
const empty = () => ({ tableau: [[], [], [], [], [], [], []], stock: [], waste: [], foundations: { spades: [], hearts: [], diamonds: [], clubs: [] }, moves: 0 });

describe('Klondike moves', () => {
  it('builds down in alternating colours, Kings into empty columns, and turns over what it uncovers', () => {
    const g = empty();
    g.tableau[0] = [card('9', 'clubs', false), card('7', 'hearts')];
    g.tableau[1] = [card('8', 'spades')];
    expect(fitsColumn(g, card('7', 'hearts'), 1)).toBe(true);
    expect(fitsColumn(g, card('7', 'spades'), 1)).toBe(false);
    expect(fitsColumn(g, card('K', 'spades'), 2)).toBe(true);
    expect(fitsColumn(g, card('Q', 'spades'), 2)).toBe(false);
    const after = applyMove(g, { from: { type: 'tableau', colIdx: 0, rowIdx: 1 }, to: { type: 'tableau', colIdx: 1 } });
    expect(after.tableau[1].map(c => c.rank)).toEqual(['8', '7']);
    expect(after.tableau[0][0].faceUp).toBe(true);
  });

  it('only moves ordered runs, and sends single cards up to the foundations', () => {
    const g = empty();
    g.tableau[0] = [card('A', 'hearts')];
    g.tableau[1] = [card('9', 'spades'), card('5', 'hearts')];      // not in order: only the 5 moves
    const moves = legalMoves(g);
    expect(moves).toContainEqual({ from: { type: 'tableau', colIdx: 0, rowIdx: 0 }, to: { type: 'foundation', suit: 'hearts' } });
    expect(moves.some(m => m.from.colIdx === 1 && m.from.rowIdx === 0)).toBe(false);
  });
});

describe('Klondike taps', () => {
  it('send a card up first, then onto a card, then a King into an empty column', () => {
    const g = empty();
    g.foundations.hearts = [card('A', 'hearts')];
    g.tableau[0] = [card('2', 'hearts')];
    g.tableau[1] = [card('3', 'spades')];
    g.tableau[3] = [card('3', 'clubs')];
    expect(destinations(g, { type: 'tableau', colIdx: 0, rowIdx: 0 })).toEqual([
      { type: 'foundation', suit: 'hearts' }, { type: 'tableau', colIdx: 1 }, { type: 'tableau', colIdx: 3 },
    ]);
    g.waste = [card('K', 'clubs')];
    expect(destinations(g, { type: 'waste' })).toEqual([2, 4, 5, 6].map(colIdx => ({ type: 'tableau', colIdx })));
  });

  it('never move a whole column into an empty one, or a card out of the middle of a muddle', () => {
    const g = empty();
    g.tableau[0] = [card('K', 'spades'), card('Q', 'hearts')];
    g.tableau[1] = [card('9', 'clubs'), card('4', 'hearts')];
    expect(destinations(g, { type: 'tableau', colIdx: 0, rowIdx: 0 })).toEqual([]);
    expect(destinations(g, { type: 'tableau', colIdx: 1, rowIdx: 0 })).toEqual([]);
  });

  it('take a card back down from a foundation', () => {
    const g = empty();
    g.foundations.hearts = [card('A', 'hearts'), card('2', 'hearts')];
    g.tableau[0] = [card('3', 'spades')];
    const to = destinations(g, { type: 'foundation', suit: 'hearts' });
    expect(to).toEqual([{ type: 'tableau', colIdx: 0 }]);
    const after = applyMove(g, { from: { type: 'foundation', suit: 'hearts' }, to: to[0] });
    expect(after.foundations.hearts).toHaveLength(1);
    expect(after.tableau[0].map(c => c.rank)).toEqual(['3', '2']);
  });

  it('send up by themselves only the cards nothing could want', () => {
    const g = empty();
    g.foundations.hearts = [card('A', 'hearts'), card('2', 'hearts')];
    g.foundations.spades = [card('A', 'spades')];
    g.tableau[0] = [card('3', 'hearts')];                        // the 2♠ isn't up: a 3♥ could still hold it
    expect(autoHomeStep(g)).toBe(null);
    g.waste = [card('2', 'spades')];                             // 2s always go
    const next = autoHomeStep(g);
    expect(next.foundations.spades).toHaveLength(2);
    next.foundations.clubs = [card('A', 'clubs'), card('2', 'clubs')];      // both black 2s up: the 3♥ can go
    expect(autoHomeStep(next).foundations.hearts).toHaveLength(3);
  });
});

describe('Klondike hints', () => {
  it('turn over face-down cards first, and say why', () => {
    const g = empty();
    g.tableau[0] = [card('2', 'clubs', false), card('7', 'hearts')];
    g.tableau[1] = [card('8', 'spades')];
    g.tableau[2] = [card('8', 'clubs'), card('7', 'diamonds')];
    const h = hint(g);
    expect(h.from).toEqual({ type: 'tableau', colIdx: 0, rowIdx: 1 });
    expect(h.why).toBe('Move the 7♥ onto the 8♠ — it turns over a card.');
  });

  it('send an Ace up before anything else', () => {
    const g = empty();
    g.tableau[0] = [card('3', 'diamonds')];
    g.tableau[1] = [card('5', 'clubs', false), card('A', 'clubs')];
    g.tableau[2] = [card('4', 'clubs')];
    expect(hint(g).why).toBe('Move the A♣ up to its foundation — it turns over a card.');
  });

  it('never peek: what a face-down card is doesn\'t change the hint', () => {
    for (let n = 0; n < 30; n++) {
      const g = deal();
      const shuffled = { ...g, tableau: g.tableau.map(col => col.map(c => (c.faceUp ? c : { ...c, rank: ['2', '9', 'K'][n % 3], suit: 'clubs' }))) };
      expect(JSON.stringify(hint(shuffled))).toBe(JSON.stringify(hint(g)));
    }
  });

  it('lead through whole games, always coming to an end, never losing a card — and often win', () => {
    let wins = 0;
    for (let n = 0; n < 40; n++) {
      let g = deal();
      const seen = new Set([positionKey(g)]);
      let step = 0;
      for (; step < 2000 && up(g) < 52; step++) {
        const h = hint(g, seen);
        if (!h) break;
        expect(h.why).toBeTruthy();
        g = h.draw ? turnStock(g) : applyMove(g, h);
        seen.add(positionKey(g));
        expect(all(g)).toBe(52);
      }
      expect(step).toBeLessThan(2000);
      if (up(g) === 52) wins++;
    }
    // (Without seeing face-down cards, following the hints alone wins about 1 game in 4)
    expect(wins).toBeGreaterThan(2);
  }, 60000);
});
