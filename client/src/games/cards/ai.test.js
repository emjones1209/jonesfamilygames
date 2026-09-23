import { describe, it, expect } from 'vitest';
import { choosePartnershipCard } from './ai';
import { c, cards } from './testCards';

const play = (legalCodes, trickPlays, seat, extra = {}) =>
  choosePartnershipCard({
    legal: cards(legalCodes),
    trick: trickPlays.map(([code, s]) => ({ card: c(code), seat: s })),
    seat,
    difficulty: 'medium',
    trump: 'spades',
    ...extra,
  }).id;

describe('partnership AI', () => {
  it('does not overtake a partner who is already winning', () => {
    // Seat 2 (partner of 0) leads the ace; seat 0 should play low, not the king
    expect(play('KH 3H', [['AH', 2], ['5H', 3]], 0)).toBe('3-hearts');
  });

  it('wins cheaply when an opponent is winning', () => {
    expect(play('KH QH 3H', [['JH', 1]], 2)).toBe('Q-hearts');
  });

  it('trumps in with its lowest trump when void in the suit led', () => {
    expect(play('2S 9S 4D', [['AH', 1]], 2)).toBe('2-spades');
  });

  it('does not waste a high off-suit card against a trump (old AI bug)', () => {
    // Opponent trumped with 5S; a heart can't win, so throw the cheapest card
    expect(play('KH 4D', [['4H', 3], ['5S', 1]], 2)).toBe('4-diamonds');
  });

  it('when it cannot win, discards its lowest card', () => {
    expect(play('KD 3D', [['AD', 1]], 0)).toBe('3-diamonds');
  });

  it('gives point cards to a partner who is safely winning (Rook-style points)', () => {
    const points = card => ({ 5: 5, 10: 10 }[card.rank] || 0);
    // Partner (seat 2) wins with the ace as the last-but-one player; seat 0 plays last
    expect(play('10H 3H', [['AH', 2], ['4H', 3], ['2H', 1]], 0, { pointsOf: points })).toBe('10-hearts');
  });

  it('keeps point cards away from opponents when losing a trick', () => {
    const points = card => ({ 5: 5, 10: 10 }[card.rank] || 0);
    expect(play('10H 3H', [['AH', 1]], 2, { pointsOf: points })).toBe('3-hearts');
  });

  it('always plays a legal card on easy', () => {
    for (let i = 0; i < 20; i++) {
      expect(['2-hearts', '9-hearts']).toContain(play('2H 9H', [['5H', 1]], 2, { difficulty: 'easy' }));
    }
  });
});
