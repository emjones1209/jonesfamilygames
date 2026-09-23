import { describe, it, expect } from 'vitest';
import {
  bidHigher, bidLevel, bidDenom, auctionOver, contractOf, scoreContract, chooseBid, highCardPoints, PASS,
} from './bridgeRules';
import { cards } from '../cards/testCards';

const auction = (...entries) => entries.map(([seat, bid]) => ({ seat, bid }));

describe('Bridge bids', () => {
  it('parses levels and denominations, including NT', () => {
    expect([bidLevel('3NT'), bidDenom('3NT'), bidLevel('7C'), bidDenom('7C')]).toEqual([3, 'NT', 7, 'C']);
  });
  it('ranks bids by level, then C < D < H < S < NT', () => {
    expect(bidHigher('1D', '1C')).toBe(true);
    expect(bidHigher('1NT', '1S')).toBe(true);
    expect(bidHigher('1S', '1NT')).toBe(false);
    expect(bidHigher('2C', '1NT')).toBe(true);
    expect(bidHigher(PASS, '1C')).toBe(false);
  });
});

describe('Bridge auction', () => {
  it('ends after four opening passes, with no contract', () => {
    const a = auction([0, PASS], [1, PASS], [2, PASS], [3, PASS]);
    expect(auctionOver(a)).toBe(true);
    expect(contractOf(a)).toBe(null);
  });

  it('does not end after three passes if nobody has bid yet', () => {
    expect(auctionOver(auction([0, PASS], [1, PASS], [2, PASS]))).toBe(false);
  });

  it('ends after a bid followed by three passes', () => {
    expect(auctionOver(auction([1, PASS], [2, '1H'], [3, PASS], [0, PASS], [1, PASS]))).toBe(true);
  });

  it('makes declarer the first of the side to name the final denomination', () => {
    // South opens 1H, North raises to 4H: South (who named hearts first) declares
    const a = auction([0, '1H'], [1, PASS], [2, '4H'], [3, PASS], [0, PASS], [1, PASS]);
    expect(contractOf(a)).toMatchObject({ bid: '4H', declarer: 0, dummy: 2, trump: 'hearts' });
  });

  it('can make the AI partner declarer, with you as dummy', () => {
    const a = auction([0, '1C'], [1, PASS], [2, '1S'], [3, PASS], [0, '2S'], [1, PASS], [2, PASS], [3, PASS]);
    expect(contractOf(a)).toMatchObject({ declarer: 2, dummy: 0 });
  });

  it('No Trump has no trump suit', () => {
    const a = auction([3, '1NT'], [0, PASS], [1, PASS], [2, PASS]);
    expect(contractOf(a)).toMatchObject({ declarer: 3, dummy: 1, trump: null });
  });
});

describe('Bridge scoring', () => {
  const contract = (bid, declarer = 0) => contractOf(auction([declarer, bid], [(declarer + 1) % 4, PASS], [(declarer + 2) % 4, PASS], [(declarer + 3) % 4, PASS]));

  it('part-score: 2H making exactly = 60 + 50', () => {
    expect(scoreContract(contract('2H'), 8)).toMatchObject({ ns: 110, ew: 0, made: true });
  });
  it('game: 3NT making with an overtrick = 100 + 300 + 30', () => {
    expect(scoreContract(contract('3NT'), 10).ns).toBe(430);
  });
  it('minor-suit overtricks score 20', () => {
    expect(scoreContract(contract('1C'), 9).ns).toBe(20 + 50 + 40);
  });
  it('small slam bonus', () => {
    expect(scoreContract(contract('6S'), 12).ns).toBe(180 + 300 + 500);
  });
  it('going down gives the defenders 50 per trick', () => {
    expect(scoreContract(contract('4S', 1), 8)).toMatchObject({ ns: 100, ew: 0, made: false, down: 2 });
  });
});

describe('Bridge AI bidding', () => {
  const strong = cards('AS KS QS 5S 3S AH KH 4H 2D 3D 4D 2C 3C');   // 16 HCP, balanced 5-3-3-2
  const weak = cards('2S 3S 4H 5H 6H 7D 8D 9D 2C 3C 4C 5C 6C');

  it('counts high card points', () => {
    expect(highCardPoints(strong)).toBe(16);
  });
  it('opens its long suit with an unbalanced opening hand', () => {
    const unbalanced = cards('AS KS QS 5S 3S 2S AH KH 4H 2D 3D 4D 2C');  // 16 HCP, 6-3-3-1
    expect(chooseBid({ hand: unbalanced, auction: [], seat: 0, difficulty: 'medium' })).toBe('1S');
  });
  it('opens 1NT with a balanced 15-17', () => {
    expect(chooseBid({ hand: strong, auction: [], seat: 0, difficulty: 'medium' })).toBe('1NT');
  });
  it('passes a weak hand', () => {
    expect(chooseBid({ hand: weak, auction: [], seat: 0, difficulty: 'medium' })).toBe(PASS);
  });
  it('never makes an insufficient bid (old AI bid 1C over 2S)', () => {
    const a = auction([1, '2S']);
    const bid = chooseBid({ hand: strong, auction: a, seat: 2, difficulty: 'medium' });
    expect(bid === PASS || bidHigher(bid, '2S')).toBe(true);
    for (let i = 0; i < 30; i++) {
      const easy = chooseBid({ hand: strong, auction: a, seat: 2, difficulty: 'easy' });
      expect(easy === PASS || bidHigher(easy, '2S')).toBe(true);
    }
  });
  it("raises partner's suit with support and enough combined points", () => {
    const support = cards('KS 8S 4S 2S AH 5H 4H KD 3D 2D 7C 3C 2C');   // 10 HCP, 4 spades
    const a = auction([0, '1S'], [1, PASS]);
    const bid = chooseBid({ hand: support, auction: a, seat: 2, difficulty: 'medium' });
    expect(bidDenom(bid)).toBe('S');
    expect(bidLevel(bid)).toBeGreaterThanOrEqual(2);
  });
});
