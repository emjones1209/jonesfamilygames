import { describe, it, expect } from 'vitest';
import { buildDeck } from '../../utils/cardEngine';
import { newGame, act, waitingFor, robotAction, viewFor, rotate, knockCheck, mustDrawStock } from './ginEngine';
import { GAME_TARGET, HAND_BONUS, GAME_BONUS } from './ginRules';

function autoplay(s, levels = ['hard', 'medium'], until = () => false) {
  for (let step = 0; step < 50000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

// A deck with seat 0's cards, seat 1's cards, the face-up card, then the stock in order
function stacked(hand0, hand1, up, stockTop = []) {
  const all = buildDeck();
  const take = id => all.splice(all.findIndex(c => c.id === id), 1)[0];
  return [...hand0.map(take), ...hand1.map(take), take(up), ...stockTop.map(take), ...all];
}
const H0 = ['A-spades', '2-spades', '3-spades', '9-hearts', '9-diamonds', '9-clubs', 'J-diamonds', 'Q-diamonds', 'K-diamonds', '5-hearts'];
const H1 = ['2-hearts', '4-clubs', '6-spades', '8-diamonds', '10-clubs', 'Q-hearts', 'K-clubs', '3-diamonds', '7-spades', 'J-hearts'];

describe('Gin Rummy game engine', () => {
  it('plays whole games to 100 with computer players', () => {
    for (let g = 0; g < 10; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.scores[s.winner]).toBeGreaterThanOrEqual(GAME_TARGET);
      expect(s.final[s.winner]).toBe(s.scores[s.winner] + s.handsWon[s.winner] * HAND_BONUS + GAME_BONUS);
    }
  }, 60000);

  it('offers the first card to the non-dealer, then the dealer, then makes the non-dealer draw from the stock', () => {
    let s = newGame({ dealer: 1, deck: stacked(H0, H1, '4-spades') });
    expect(s.phase).toBe('firstTake');
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'draw', seat: 0, from: 'stock' })).toThrow(/face-up card, or pass/);
    s = act(s, { type: 'pass', seat: 0 });
    expect(waitingFor(s)).toBe(1);
    s = act(s, { type: 'pass', seat: 1 });
    expect(s.phase).toBe('draw');
    expect(waitingFor(s)).toBe(0);
    expect(mustDrawStock(s)).toBe(true);
    expect(() => act(s, { type: 'draw', seat: 0, from: 'discard' })).toThrow(/draw from the stock/);
    s = act(s, { type: 'draw', seat: 0, from: 'stock' });
    expect(s.hands[0]).toHaveLength(11);
  });

  it('won\'t let you throw back the card you just took from the pile', () => {
    let s = newGame({ dealer: 1, deck: stacked(H0, H1, '4-spades') });
    s = act(s, { type: 'draw', seat: 0, from: 'discard' });
    expect(() => act(s, { type: 'discard', seat: 0, cardId: '4-spades' })).toThrow(/just took/);
    s = act(s, { type: 'discard', seat: 0, cardId: '5-hearts' });
    expect(s).toMatchObject({ phase: 'draw', turn: 1 });
    expect(s.pickups[0].map(c => c.id)).toEqual(['4-spades']);
  });

  it('knocks for gin: 25 plus the other player\'s deadwood', () => {
    // Seat 0 takes the 4♠ (A-2-3-4♠), throws the 5♥: all ten cards are melded
    let s = newGame({ dealer: 1, deck: stacked(H0, H1, '4-spades') });
    s = act(s, { type: 'draw', seat: 0, from: 'discard' });
    expect(knockCheck(s, 0, '5-hearts')).toEqual({ kind: 'gin', points: 0 });
    expect(knockCheck(s, 0, '9-hearts')).toBe(null);
    s = act(s, { type: 'knock', seat: 0, cardId: '5-hearts' });
    expect(s.phase).toBe('handOver');
    const theirs = 2 + 4 + 6 + 8 + 10 + 10 + 10 + 3 + 7 + 10;
    expect(s.result).toMatchObject({ kind: 'gin', knocker: 0, winner: 0, points: 25 + theirs });
    expect(s.scores).toEqual([25 + theirs, 0]);
    expect(s.handsWon).toEqual([1, 0]);
  });

  it('refuses a knock with more than 10 deadwood', () => {
    let s = newGame({ dealer: 1, deck: stacked(H0, H1, '4-spades') });
    s = act(s, { type: 'pass', seat: 0 });
    s = act(s, { type: 'pass', seat: 1 });
    s = act(s, { type: 'draw', seat: 0, from: 'stock' });
    const junk = s.hands[0].find(c => c.id === '9-hearts');
    expect(() => act(s, { type: 'knock', seat: 0, cardId: junk.id })).toThrow(/10 or less/);
  });

  it('calls the hand a draw when only two cards are left in the stock', () => {
    let s = newGame();
    s = { ...s, phase: 'discard', turn: 0, stock: s.stock.slice(0, 2), hands: [[...s.hands[0], s.stock[5]], s.hands[1]] };
    const card = s.hands[0].find(c => !knockCheck(s, 0, c.id));
    s = act(s, { type: 'discard', seat: 0, cardId: card.id });
    expect(s.phase).toBe('handOver');
    expect(s.result.kind).toBe('draw');
    expect(s.scores).toEqual([0, 0]);
  });

  it('never shows the other hand or the stock until the hand is over', () => {
    let s = newGame({ dealer: 1, deck: stacked(H0, H1, '4-spades') });
    s = act(s, { type: 'pass', seat: 0 });
    s = act(s, { type: 'pass', seat: 1 });
    s = act(s, { type: 'draw', seat: 0, from: 'stock' });
    const drawn = s.lastMove.card.id;
    const json = JSON.stringify(viewFor(s, 1));
    for (const c of s.hands[0]) expect(json).not.toContain(`"${c.id}"`);
    for (const c of s.stock) expect(json).not.toContain(`"${c.id}"`);
    expect(json).not.toContain(`"${drawn}"`);
    expect(JSON.stringify(viewFor(s, 0))).toContain(`"${drawn}"`);
    // After a knock both hands are shown
    const over = autoplay(s, undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
    expect(viewFor(over, 1).hands[0].every(Boolean)).toBe(true);
  });

  it('turns the table round for the other player', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.phase === 'discard');
    const r = rotate(s, 1);
    expect(r.hands[0]).toEqual(s.hands[1]);
    expect(r.scores).toEqual([s.scores[1], s.scores[0]]);
    expect(r.turn).toBe(1 - s.turn);
    expect(rotate(r, 1)).toEqual(s);
  });

  it('plays well: Hard beats Easy most of the time', () => {
    // Over 600 games Hard won 76%; Gin has plenty of luck, so check a lower bar over enough games
    let wins = 0;
    const games = 60;
    for (let g = 0; g < games; g++) if (autoplay(newGame({ dealer: g % 2 }), ['hard', 'easy']).winner === 0) wins++;
    expect(wins).toBeGreaterThan(games * 0.55);
  }, 60000);
});
