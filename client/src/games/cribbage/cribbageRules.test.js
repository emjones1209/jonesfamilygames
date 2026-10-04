import { describe, it, expect } from 'vitest';
import { scoreHand, pegPoints, playable, chooseDiscard, choosePegCard, value } from './cribbageRules';

// card('5', 'hearts') → the 5 of hearts
const card = (rank, suit = 'hearts') => ({ id: `${rank}-${suit}`, rank, suit });
const total = (hand, starter, opts) => scoreHand(hand, starter, opts).total;
const kinds = (hand, starter, opts) => {
  const by = {};
  for (const i of scoreHand(hand, starter, opts).items) by[i.kind] = (by[i.kind] ?? 0) + i.points;
  return by;
};

describe('Cribbage: counting a hand', () => {
  it('scores the best hand there is: 29', () => {
    // Three 5s and the Jack of clubs, with the 5 of clubs turned up
    expect(total([card('5', 'hearts'), card('5', 'diamonds'), card('5', 'spades'), card('J', 'clubs')], card('5', 'clubs'))).toBe(29);
  });

  it('four 5s and a ten-card: 28 (16 in fifteens, 12 in pairs)', () => {
    const hand = ['hearts', 'diamonds', 'spades', 'clubs'].map(s => card('5', s));
    expect(kinds(hand, card('K', 'hearts'))).toEqual({ fifteen: 16, pair: 12 });
  });

  it('counts every way of making a run (a double run)', () => {
    // 7-8-8-9: two runs of 3, a pair, and two fifteens (7+8)
    const hand = [card('7'), card('8'), card('8', 'spades'), card('9', 'clubs')];
    expect(kinds(hand, card('2', 'clubs'))).toEqual({ fifteen: 4, pair: 2, run: 6 });
    expect(total(hand, card('2', 'clubs'))).toBe(12);
  });

  it('a double double run: 3-3-4-4-5 is 20 (four runs, two pairs and two fifteens)', () => {
    const hand = [card('3'), card('3', 'spades'), card('4'), card('4', 'spades')];
    expect(kinds(hand, card('5', 'clubs'))).toEqual({ run: 12, pair: 4, fifteen: 4 });
    expect(total(hand, card('5', 'clubs'))).toBe(20);
  });

  it('a run of 5 counts once, for 5', () => {
    expect(kinds([card('A'), card('2', 'spades'), card('3'), card('4', 'clubs')], card('5', 'diamonds'))).toMatchObject({ run: 5 });
  });

  it('flushes: 4 in the hand, 5 with the starter — but a crib needs all 5', () => {
    const hearts = [card('2'), card('4'), card('6'), card('8')];
    expect(kinds(hearts, card('K', 'spades'))).toEqual({ flush: 4 });
    expect(kinds(hearts, card('K', 'hearts'))).toEqual({ flush: 5 });
    expect(kinds(hearts, card('K', 'spades'), { crib: true })).toEqual({});
    expect(kinds(hearts, card('K', 'hearts'), { crib: true })).toEqual({ flush: 5 });
  });

  it('nobs: the Jack of the starter\'s suit', () => {
    expect(kinds([card('J', 'clubs'), card('2'), card('4', 'spades'), card('9', 'diamonds')], card('K', 'clubs'))).toMatchObject({ nobs: 1 });
    expect(kinds([card('J', 'clubs'), card('2'), card('4', 'spades'), card('9', 'diamonds')], card('K', 'hearts')).nobs).toBeUndefined();
  });

  it('a hand with nothing (a "nineteen") scores 0', () => {
    expect(total([card('2'), card('4', 'spades'), card('6', 'clubs'), card('8', 'diamonds')], card('Q', 'hearts'))).toBe(0);
  });

  it('lists what makes up the score, for the breakdown', () => {
    const { items } = scoreHand([card('5'), card('10', 'spades'), card('J', 'clubs'), card('K', 'diamonds')], card('Q', 'hearts'));
    expect(items.filter(i => i.kind === 'fifteen')).toHaveLength(4);         // the 5 with each ten-card
    expect(items.find(i => i.kind === 'run').cards.map(c => c.rank).sort()).toEqual(['10', 'J', 'K', 'Q']);    // a run of 4
  });
});

describe('Cribbage: pegging', () => {
  const seq = ranks => ranks.map((r, i) => card(r, ['hearts', 'spades', 'clubs', 'diamonds'][i % 4]));

  it('15 and 31 are worth 2', () => {
    expect(pegPoints(seq(['10']), card('5', 'clubs'))).toMatchObject({ points: 2, count: 15 });
    expect(pegPoints(seq(['10', 'K', '6']), card('5', 'clubs'))).toMatchObject({ points: 2, count: 31 });
  });

  it('pairs: 2, then 6 for three, 12 for four', () => {
    expect(pegPoints(seq(['7']), card('7', 'clubs')).points).toBe(2);
    expect(pegPoints(seq(['3', '3']), card('3', 'clubs')).points).toBe(6);
    expect(pegPoints(seq(['2', '2', '2']), card('2', 'clubs')).points).toBe(12);
    expect(pegPoints(seq(['7', '9']), card('7', 'clubs')).points).toBe(0);    // not in a row
  });

  it('runs among the last cards, in any order', () => {
    expect(pegPoints(seq(['4', '6']), card('5', 'clubs')).reasons).toEqual([{ why: 'fifteen', points: 2 }, { why: 'run of 3', points: 3 }]);
    expect(pegPoints(seq(['4', '6', '5']), card('3', 'diamonds')).points).toBe(4);
    // 4-6-5-4-3: the last four (6-5-4-3) are a run; all five aren't (two 4s)
    expect(pegPoints(seq(['4', '6', '5', '4']), card('3', 'diamonds')).points).toBe(4);
    expect(pegPoints(seq(['9', 'K']), card('J', 'diamonds')).points).toBe(0);         // 9-K-J: no run
  });

  it('only cards that keep the count at 31 or under can be played', () => {
    expect(playable([card('K'), card('A'), card('5')], 27).map(c => c.rank)).toEqual(['A']);
  });
});

describe('Cribbage: the computer players', () => {
  const six = [card('5'), card('5', 'spades'), card('J', 'clubs'), card('K', 'diamonds'), card('2', 'clubs'), card('9', 'spades')];

  it('keeps a good hand and throws two cards (every level)', () => {
    for (const level of ['easy', 'medium', 'hard']) {
      const thrown = chooseDiscard(six, { dealer: true, level, rng: () => 0.9 });
      expect(thrown).toHaveLength(2);
      expect(new Set(thrown).size).toBe(2);
    }
    // Medium and Hard keep the 5s with the ten-cards
    for (const level of ['medium', 'hard']) {
      const thrown = chooseDiscard(six, { dealer: false, level });
      expect(thrown.some(id => id.startsWith('5-'))).toBe(false);
    }
  });

  it('pegs the 15 when it can, and never leads a 5 (Hard)', () => {
    const hand = [card('5'), card('9', 'spades'), card('3', 'clubs')];
    expect(choosePegCard(hand, [card('10', 'clubs')], { level: 'medium' }).rank).toBe('5');
    expect(choosePegCard(hand, [], { level: 'hard' }).rank).not.toBe('5');
    expect(choosePegCard([card('K')], [card('K', 'spades'), card('Q'), card('9', 'clubs')], { level: 'hard' })).toBe(null);
    expect(value(card('Q'))).toBe(10);
  });
});
