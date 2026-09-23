import { describe, it, expect } from 'vitest';
import {
  cardValue, gridScore, allFaceUp, estimateGrid, dealGame, refillStock,
  chooseSource, choosePlacement,
} from './golfRules';

const card = (rank, faceUp = true, suit = 'hearts') => ({ rank, suit, id: `${rank}-${suit}-${Math.random()}`, faceUp });
const grid = (top, bottom) => [top, bottom];

describe('golf scoring', () => {
  it('values cards', () => {
    expect(cardValue(card('Jo', true, 'joker'))).toBe(-4);
    expect(cardValue(card('2'))).toBe(-2);
    expect(cardValue(card('K'))).toBe(0);
    expect(cardValue(card('A'))).toBe(1);
    expect(cardValue(card('7'))).toBe(7);
    expect(cardValue(card('10'))).toBe(10);
    expect(cardValue(card('J'))).toBe(11);
    expect(cardValue(card('Q'))).toBe(12);
  });

  it('cancels matching pairs in a column', () => {
    const g = grid([card('Q'), card('5'), card('3')], [card('Q'), card('4'), card('3')]);
    expect(gridScore(g)).toBe(9);
  });

  it('counts only face-up cards, and estimates hidden ones', () => {
    const g = grid([card('Q'), card('5', false), card('3')], [card('A'), card('4', false), card('K', false)]);
    expect(gridScore(g)).toBe(16);
    expect(estimateGrid(g)).toBe(16 + 15);
    expect(allFaceUp(g)).toBe(false);
  });

  it('deals 6 cards each and turns up one discard', () => {
    const { grids, stock, discard } = dealGame(2);
    expect(grids).toHaveLength(2);
    expect(grids.every(g => g.flat().length === 6 && g.flat().every(c => !c.faceUp))).toBe(true);
    expect(discard).toHaveLength(1);
    expect(stock).toHaveLength(54 - 12 - 1);
  });

  it('reshuffles the discard pile into an empty stock', () => {
    const { stock, discard } = refillStock([], [card('3'), card('4'), card('5')]);
    expect(discard).toHaveLength(1);
    expect(stock).toHaveLength(2);
    expect(stock.every(c => !c.faceUp)).toBe(true);
  });
});

describe('golf computer player', () => {
  it('hard takes a discard that makes a pair', () => {
    const g = grid([card('9'), card('4', false), card('K')], [card('8', false), card('5', false), card('3', false)]);
    // A 9 is a poor card on its own, but it pairs the face-up 9
    expect(chooseSource({ grid: g, topDiscard: card('9', true, 'spades'), difficulty: 'hard' })).toBe(true);
    const pos = choosePlacement({ grid: g, card: card('9', true, 'spades'), fromDiscard: true, difficulty: 'hard' });
    expect(pos).toEqual([1, 0]);
  });

  it('hard never breaks up a pair for a small gain', () => {
    const g = grid([card('4'), card('Q'), card('7', false)], [card('4'), card('J'), card('8', false)]);
    const pos = choosePlacement({ grid: g, card: card('3'), fromDiscard: false, difficulty: 'hard' });
    expect(pos).not.toEqual([0, 0]);
    expect(pos).not.toEqual([1, 0]);
  });

  it("hard won't finish the round while behind", () => {
    const g = grid([card('Q'), card('J'), card('10')], [card('9'), card('8'), card('7', false)]);
    const opp = grid([card('K'), card('A'), card('2')], [card('K'), card('3', false), card('4', false)]);
    const pos = choosePlacement({ grid: g, opponentGrids: [opp], card: card('A'), fromDiscard: false, difficulty: 'hard' });
    expect(pos).not.toEqual([1, 2]);   // replaces a high face-up card instead
  });

  it('medium swaps out its highest card', () => {
    const g = grid([card('Q'), card('5'), card('3', false)], [card('A'), card('4', false), card('K', false)]);
    expect(choosePlacement({ grid: g, card: card('3'), fromDiscard: false, difficulty: 'medium' })).toEqual([0, 0]);
  });
});

// ── Head-to-head simulation ──────────────────────────────────────────────────

/** Play one round between two computer players; returns the final scores and whether someone went out. */
function playRound(levels) {
  let { grids, stock, discard } = dealGame(2);
  // Each player starts with 2 random cards face up
  grids = grids.map(g => {
    const flat = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 2);
    return g.map((row, r) => row.map((c, col) => (flat.includes(r * 3 + col) ? { ...c, faceUp: true } : c)));
  });
  let player = Math.random() < 0.5 ? 0 : 1, finisher = null;
  for (let turn = 0; turn < 300; turn++) {
    ({ stock, discard } = refillStock(stock, discard));
    const me = grids[player], opp = grids[1 - player], difficulty = levels[player];
    const fromDiscard = !stock.length || chooseSource({ grid: me, topDiscard: discard[0], difficulty });
    let drawn;
    if (fromDiscard) { drawn = discard[0]; discard = discard.slice(1); }
    else { drawn = { ...stock[0], faceUp: true }; stock = stock.slice(1); }
    const pos = choosePlacement({ grid: me, opponentGrids: [opp], card: drawn, fromDiscard, difficulty });
    if (pos) {
      const [r, c] = pos;
      discard = [{ ...me[r][c], faceUp: true }, ...discard];
      grids[player] = me.map((row, ri) => row.map((x, ci) => (ri === r && ci === c ? { ...drawn, faceUp: true } : x)));
    } else {
      discard = [drawn, ...discard];
    }
    if (finisher !== null) break;                         // the other player's last turn
    if (allFaceUp(grids[player])) finisher = player;
    player = 1 - player;
  }
  const scores = grids.map(g => gridScore(g.map(row => row.map(c => ({ ...c, faceUp: true })))));
  return { scores, finished: finisher !== null };
}

/** Share of rounds `a` scores lower than `b` (ties count half). */
function winRate(a, b, rounds = 1500) {
  let wins = 0;
  for (let i = 0; i < rounds; i++) {
    const [sa, sb] = playRound([a, b]).scores;
    wins += sa < sb ? 1 : sa === sb ? 0.5 : 0;
  }
  return wins / rounds;
}

describe('golf difficulty levels really differ', () => {
  it('hard beats medium, and medium beats easy', () => {
    const hardVsMedium = winRate('hard', 'medium');
    const mediumVsEasy = winRate('medium', 'easy');
    console.log(`hard vs medium: ${(hardVsMedium * 100).toFixed(0)}%  medium vs easy: ${(mediumVsEasy * 100).toFixed(0)}%`);
    expect(hardVsMedium).toBeGreaterThan(0.6);
    expect(mediumVsEasy).toBeGreaterThan(0.6);
  });

  it('rounds finish (nobody stalls forever)', () => {
    for (const lv of [['easy', 'easy'], ['medium', 'medium'], ['hard', 'hard'], ['hard', 'easy']]) {
      let finished = 0;
      for (let i = 0; i < 200; i++) finished += playRound(lv).finished ? 1 : 0;
      expect(finished).toBeGreaterThan(190);
    }
  });
});
