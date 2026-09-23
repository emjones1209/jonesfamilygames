import { describe, it, expect } from 'vitest';
import { legalPlays, scoreHand, winnerOf, estimateTricks, chooseBid, chooseCard, NIL } from './spadesRules';
import { c, cards } from '../cards/testCards';

const trickOf = (...plays) => plays.map(([code, seat]) => ({ card: c(code), seat }));

describe('Spades legal plays', () => {
  it('forbids leading spades until broken', () => {
    expect(legalPlays(cards('AS 4D'), [], { spadesBroken: false }).map(x => x.id)).toEqual(['4-diamonds']);
  });
  it('allows leading spades once broken or when holding only spades', () => {
    expect(legalPlays(cards('AS 4D'), [], { spadesBroken: true })).toHaveLength(2);
    expect(legalPlays(cards('AS 4S'), [], { spadesBroken: false })).toHaveLength(2);
  });
  it('must follow suit', () => {
    expect(legalPlays(cards('AS 4D 9D'), trickOf(['2D', 1]), { spadesBroken: false })).toHaveLength(2);
  });
});

describe('Spades scoring', () => {
  it('scores 10 per bid trick plus 1 per overtrick (bag)', () => {
    // Team 0 bid 3+2=5, took 4+2=6 → 50 + 1 bag. Team 1 bid 3+3=6, took 3+4=7 → 60 + 1 bag
    const res = scoreHand([3, 3, 2, 3], [4, 3, 2, 4]);
    expect(res.delta).toEqual([51, 61]);
    expect(res.bags).toEqual([1, 1]);
  });

  it('loses 10 per bid trick when the contract fails', () => {
    expect(scoreHand([5, 4, 4, 1], [3, 4, 2, 4]).delta[0]).toBe(-90);
  });

  it('charges 100 points when bags reach 10, carrying the remainder', () => {
    const res = scoreHand([3, 3, 3, 1], [5, 3, 3, 2], [8, 0]);  // team 0 takes 2 bags → 10
    expect(res.delta[0]).toBe(60 + 2 - 100);
    expect(res.bags[0]).toBe(0);
    const res2 = scoreHand([2, 3, 2, 3], [5, 3, 2, 3], [9, 0]);  // 3 bags → 12 → penalty, 2 left
    expect(res2.bags[0]).toBe(2);
  });

  it('awards +100 for a successful Nil and -100 for a failed one', () => {
    expect(scoreHand([NIL, 4, 5, 4], [0, 4, 5, 4]).delta[0]).toBe(100 + 50);
    // Nil bidder took 1 trick: -100, and that trick counts as a bag, not towards partner's bid
    expect(scoreHand([NIL, 4, 5, 3], [1, 4, 5, 3]).delta[0]).toBe(-100 + 50 + 1);
  });

  it('declares a winner only at 500+ and not on a tie', () => {
    expect(winnerOf([499, 300])).toBe(null);
    expect(winnerOf([510, 520])).toBe(1);
    expect(winnerOf([520, 520])).toBe(null);
  });
});

describe('Spades AI', () => {
  it('counts sure tricks from top cards and long spades', () => {
    expect(estimateTricks(cards('AS KS QS 5S 4S AH 2H 3H 4H 2D 3D 4D 5D'))).toBeGreaterThanOrEqual(6);
    expect(estimateTricks(cards('2S 3H 4H 5H 6H 7D 8D 9D 2C 3C 4C 5C 6C'))).toBeLessThan(1);
  });

  it('bids Nil on hard with a hopeless hand, but never on medium', () => {
    const weak = cards('2S 3H 4H 5H 6H 7D 8D 9D 2C 3C 4C 5C 6C');
    expect(chooseBid(weak, 'hard')).toBe(NIL);
    expect(chooseBid(weak, 'medium')).toBeGreaterThanOrEqual(1);
  });

  it('a Nil bidder ducks under the winning card', () => {
    const card = chooseCard({ legal: cards('KD 9D 2D'), trick: trickOf(['10D', 1]), seat: 0, difficulty: 'medium', bids: [NIL, 3, 4, 3] });
    expect(card.id).toBe('9-diamonds');
  });

  it("covers a Nil-bidding partner's winning card", () => {
    const card = chooseCard({ legal: cards('KD 3D'), trick: trickOf(['9D', 0], ['4D', 1]), seat: 2, difficulty: 'medium', bids: [NIL, 3, 4, 3] });
    expect(card.id).toBe('K-diamonds');
  });
});
