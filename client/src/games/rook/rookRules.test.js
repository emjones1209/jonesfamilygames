import { describe, it, expect } from 'vitest';
import {
  makeDeck, cardPoints, legalPlays, winnerOf, scoreHand, gameWinner, chooseBid, chooseNestDiscard,
  chooseCard, sortHand, ROOK_ID,
} from './rookRules';

// r('red-14') → red 14; r('ROOK') → the bird
const deck = Object.fromEntries(makeDeck().map(c => [c.id, c]));
const r = id => deck[id];
const rs = ids => ids.split(' ').map(r);
const trickOf = (...plays) => plays.map(([id, seat]) => ({ card: r(id), seat }));

describe('Rook deck', () => {
  it('has 57 cards worth 120 points', () => {
    const all = makeDeck();
    expect(all).toHaveLength(57);
    expect(all.reduce((s, c) => s + cardPoints(c), 0)).toBe(120);
  });
});

describe('Rook tricks', () => {
  it('the bird follows as trump', () => {
    // Trump (green) led: the bird is a legal follow; a red card is not
    expect(legalPlays(rs('ROOK red-3'), trickOf(['green-5', 1]), 'green').map(c => c.id)).toEqual([ROOK_ID]);
  });

  it('cannot play the bird when holding the colour led', () => {
    expect(legalPlays(rs('ROOK red-3'), trickOf(['red-9', 1]), 'green').map(c => c.id)).toEqual(['red-3']);
  });

  it('the bird is the lowest trump: any other trump beats it', () => {
    expect(winnerOf(trickOf(['green-14', 0], ['ROOK', 1], ['green-13', 2]), 'green')).toBe(0);
    expect(winnerOf(trickOf(['green-1', 0], ['ROOK', 1]), 'green')).toBe(0);
  });

  it('the bird still beats every card of another colour', () => {
    expect(winnerOf(trickOf(['red-14', 0], ['ROOK', 1], ['red-13', 2]), 'green')).toBe(1);
  });

  it('a low trump beats the colour led', () => {
    expect(winnerOf(trickOf(['red-14', 0], ['green-1', 1], ['red-13', 2]), 'green')).toBe(1);
  });

  it('sorts trump first, with the bird as its lowest card', () => {
    expect(sortHand(rs('red-3 green-2 ROOK green-14'), 'green').map(c => c.id))
      .toEqual(['green-14', 'green-2', 'ROOK', 'red-3']);
  });
});

describe('Rook scoring', () => {
  it('bidders score their points when they make the bid', () => {
    expect(scoreHand(0, 80, [85, 35])).toEqual({ delta: [85, 35], made: true });
  });
  it('bidders lose the bid when they fall short; defenders still score', () => {
    expect(scoreHand(1, 100, [40, 80])).toEqual({ delta: [40, -100], made: false });
  });
  it('the higher team wins once someone reaches 300', () => {
    expect(gameWinner([290, 250])).toBe(null);
    expect(gameWinner([310, 320])).toBe(1);
  });
});

describe('Rook AI', () => {
  const strong = rs('ROOK green-14 green-13 green-12 green-10 green-5 red-14 red-10 black-14 yellow-2 yellow-3 black-4 red-6');
  const weak = rs('red-2 red-3 red-4 green-2 green-3 green-6 black-2 black-3 black-6 yellow-4 yellow-6 yellow-7 yellow-8');

  it('opens at 70 and keeps bidding with a strong hand', () => {
    expect(chooseBid(strong, 0, 'medium')).toBe(70);
    expect(chooseBid(strong, 90, 'medium')).toBe(95);
  });
  it('passes a weak hand', () => {
    expect(chooseBid(weak, 0, 'medium')).toBe('pass');
  });
  it('never bids above 120', () => {
    expect(chooseBid(strong, 120, 'hard')).toBe('pass');
  });

  it('picks its long strong colour as trump and discards low side cards, not points', () => {
    const eighteen = [...strong, ...rs('green-7 black-1 yellow-1 red-1 black-5')];
    const { trump, discard } = chooseNestDiscard(eighteen);
    expect(trump).toBe('green');
    expect(discard).toHaveLength(5);
    expect(discard.some(c => c.isRook || c.colour === 'green' || cardPoints(c) > 0)).toBe(false);
  });

  it('smears a counter onto a trick its partner is winning with the bird', () => {
    const card = chooseCard({
      legal: rs('red-10 red-2'), trick: trickOf(['red-3', 1], ['ROOK', 2], ['red-4', 3]), seat: 0, difficulty: 'medium', trump: 'green',
    });
    expect(card.id).toBe('red-10');
  });
});
