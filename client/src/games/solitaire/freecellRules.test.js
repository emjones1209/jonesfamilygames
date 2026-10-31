import { describe, it, expect } from 'vitest';
import { newFreecell, canMove, move, moveLimit, destinations, autoHomeStep, canAutoComplete, finishStep, isWon, homeCount, runStart, hint, positionKey } from './freecellRules';

const card = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit, faceUp: true });
const col = i => ({ type: 'col', i });
const cell = i => ({ type: 'cell', i });
const home = suit => ({ type: 'home', suit });
const empty = () => ({ cols: Array.from({ length: 8 }, () => []), cells: [null, null, null, null], home: { spades: [], hearts: [], diamonds: [], clubs: [] }, moves: 0 });
const count = s => s.cols.flat().length + s.cells.filter(Boolean).length + homeCount(s);

describe('FreeCell', () => {
  it('deals all 52 cards face up: four columns of 7, four of 6', () => {
    const s = newFreecell();
    expect(s.cols.map(c => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(new Set(s.cols.flat().map(c => c.id)).size).toBe(52);
  });

  it('builds down in alternating colours, and uses the free cells and foundations', () => {
    const s = empty();
    s.cols[0] = [card('8', 'spades'), card('7', 'hearts')];
    s.cols[1] = [card('8', 'clubs')];
    s.cols[2] = [card('A', 'hearts')];
    expect(canMove(s, col(0), 1, col(1))).toBe(true);              // red 7 on black 8
    expect(canMove(s, col(0), 0, col(1))).toBe(false);             // 8 on 8
    expect(canMove(s, col(2), 0, home('hearts'))).toBe(true);
    expect(canMove(s, col(2), 0, home('spades'))).toBe(false);
    let t = move(s, col(2), 0, home('hearts'));
    t = move(t, col(0), 1, cell(0));
    expect(canMove(t, cell(0), 0, cell(1))).toBe(true);
    expect(canMove(t, col(1), 0, cell(0))).toBe(false);            // that cell's taken
    expect(count(t)).toBe(4);
  });

  it('moves a run only when there\'s room for it: (free cells + 1) × 2 per empty column', () => {
    const s = empty();
    s.cols[0] = [card('9', 'spades'), card('8', 'hearts'), card('7', 'clubs'), card('6', 'diamonds'), card('5', 'spades')];
    s.cols[1] = [card('10', 'hearts')];
    for (let i = 2; i < 8; i++) s.cols[i] = [card('K', ['spades', 'hearts', 'diamonds', 'clubs'][i % 4])];
    s.cells = [card('2', 'clubs'), card('3', 'clubs'), null, null];
    expect(runStart(s.cols[0])).toBe(0);
    expect(moveLimit(s)).toBe(3);                                  // 2 free cells + 1, no empty column
    expect(canMove(s, col(0), 0, col(1))).toBe(false);             // 5 cards: too many
    expect(canMove(s, col(0), 2, col(1))).toBe(false);             // 7♣ doesn't go on 10♥
    s.cols[1] = [card('8', 'diamonds')];
    expect(canMove(s, col(0), 2, col(1))).toBe(true);              // 7♣ 6♦ 5♠ onto 8♦: 3 cards
    s.cells = [card('2', 'clubs'), card('3', 'clubs'), card('4', 'clubs'), null];
    expect(canMove(s, col(0), 2, col(1))).toBe(false);             // only 2 at once now
  });

  it('suggests going home first, then onto a column, then an empty column, then a cell', () => {
    const s = empty();
    s.cols[0] = [card('A', 'spades')];
    s.cols[1] = [card('2', 'hearts')];
    expect(destinations(s, col(0), 0)[0]).toEqual(home('spades'));
    s.cols[0] = [card('5', 'clubs')];
    s.cols[1] = [card('6', 'hearts')];
    expect(destinations(s, col(0), 0).map(d => d.type)).toEqual(['col', 'col', 'col', 'col', 'col', 'col', 'col', 'cell']);
    expect(destinations(s, col(0), 0)[0]).toEqual(col(1));
  });

  it('sends safe cards home on its own, and finishes the game once every column runs down', () => {
    const s = empty();
    // Every column in order: auto-complete can finish it
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
    suits.forEach((suit, i) => { s.cols[i] = ranks.map(r => card(r, suit)); });
    expect(canAutoComplete(s)).toBe(true);
    expect(autoHomeStep(s)).not.toBe(null);                        // an Ace is always safe
    let t = s;
    for (let n = 0; n < 60 && !isWon(t); n++) t = finishStep(t);
    expect(isWon(t)).toBe(true);
    // A column out of order: not yet
    s.cols[4] = [card('2', 'spades'), card('9', 'hearts')];
    expect(canAutoComplete(s)).toBe(false);
  });

  it('auto-complete finishes random positions where every column runs down', () => {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
    let tried = 0;
    for (let g = 0; g < 200; g++) {
      // Each rank's four cards go to four different columns (or a free cell), high ranks first,
      // so every column runs strictly down
      const s = empty();
      for (const r of ranks) {
        const cols = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
        suits.forEach((suit, k) => {
          const free = s.cells.indexOf(null);
          if (Math.random() < 0.05 && free >= 0) s.cells[free] = card(r, suit);
          else s.cols[cols[k]].push(card(r, suit));
        });
      }
      expect(count(s)).toBe(52);
      expect(canAutoComplete(s)).toBe(true);
      let t = s;
      for (let n = 0; n < 60 && !isWon(t); n++) t = finishStep(t);
      expect(isWon(t)).toBe(true);
      tried++;
    }
    expect(tried).toBe(200);
  });

  it('hints lead through games without going back to a position, and nearly always win', () => {
    let wins = 0;
    for (let g = 0; g < 8; g++) {
      let s = newFreecell();
      const seen = new Set([positionKey(s)]);
      for (let n = 0; n < 400 && !isWon(s); n++) {
        const h = hint(s, seen);
        if (!h?.from) break;
        expect(h.why).toMatch(/^Move /);
        s = move(s, h.from, h.idx, h.to);
        for (let x = autoHomeStep(s); x; x = autoHomeStep(s)) s = x;
        expect(seen.has(positionKey(s))).toBe(false);
        seen.add(positionKey(s));
        expect(count(s)).toBe(52);
      }
      if (isWon(s)) wins++;
    }
    // (The hint finds a way to win and follows it: almost every FreeCell deal can be won)
    expect(wins).toBeGreaterThanOrEqual(7);
  }, 120000);
});
