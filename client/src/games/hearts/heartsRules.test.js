import { describe, it, expect } from 'vitest';
import {
  legalPlays, scoreHand, passDirection, passTarget, applyPasses, choosePass, chooseCard, leaders,
} from './heartsRules';
import { c, cards } from '../cards/testCards';

const ids = list => list.map(x => x.id).sort();
const trickOf = (...plays) => plays.map(([code, seat]) => ({ card: c(code), seat }));

describe('Hearts legal plays', () => {
  it('forces the 2♣ lead on the first trick', () => {
    expect(ids(legalPlays(cards('2C AC 3H'), [], { firstTrick: true, heartsBroken: false }))).toEqual(['2-clubs']);
  });

  it('forbids leading hearts until broken', () => {
    expect(ids(legalPlays(cards('5H 9D'), [], { firstTrick: false, heartsBroken: false }))).toEqual(['9-diamonds']);
  });

  it('allows leading hearts when that is all you hold', () => {
    expect(legalPlays(cards('5H 9H'), [], { firstTrick: false, heartsBroken: false })).toHaveLength(2);
  });

  it('allows leading hearts once broken', () => {
    expect(legalPlays(cards('5H 9D'), [], { firstTrick: false, heartsBroken: true })).toHaveLength(2);
  });

  it('forbids dumping points on the first trick when void', () => {
    const trick = trickOf(['2C', 1]);
    expect(ids(legalPlays(cards('QS 5H 9D'), trick, { firstTrick: true, heartsBroken: false }))).toEqual(['9-diamonds']);
  });

  it('allows points on the first trick if the hand has nothing else', () => {
    const trick = trickOf(['2C', 1]);
    expect(legalPlays(cards('QS 5H'), trick, { firstTrick: true, heartsBroken: false })).toHaveLength(2);
  });
});

describe('Hearts scoring', () => {
  it('scores 1 per heart and 13 for the queen of spades', () => {
    const taken = [cards('QS 2H'), cards('3H 4H'), cards('2C'), []];
    expect(scoreHand(taken).points).toEqual([14, 2, 0, 0]);
  });

  it('shooting the moon gives everyone else 26', () => {
    const allPoints = cards('QS 2H 3H 4H 5H 6H 7H 8H 9H 10H JH QH KH AH');
    const res = scoreHand([[], allPoints, cards('2C'), []]);
    expect(res).toEqual({ points: [26, 0, 26, 26], shooter: 1 });
  });

  it('reports every seat tied for the lowest score', () => {
    expect(leaders([40, 12, 12, 90])).toEqual([1, 2]);
  });
});

describe('Hearts passing', () => {
  it('rotates left, right, across, then hold', () => {
    expect([0, 1, 2, 3, 4].map(passDirection)).toEqual(['left', 'right', 'across', 'hold', 'left']);
  });

  it('sends cards to the right seat', () => {
    expect([0, 1, 2, 3].map(s => passTarget(s, 'left'))).toEqual([1, 2, 3, 0]);
    expect([0, 1, 2, 3].map(s => passTarget(s, 'right'))).toEqual([3, 0, 1, 2]);
    expect([0, 1, 2, 3].map(s => passTarget(s, 'across'))).toEqual([2, 3, 0, 1]);
  });

  it('moves the passed cards and keeps 13 in every hand', () => {
    const hands = [0, 1, 2, 3].map(s => cards(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
      .map(r => r + 'SHDC'[s]).join(' ')));
    const passes = hands.map(h => h.slice(0, 3));
    const after = applyPasses(hands, passes, 'left');
    expect(after.every(h => h.length === 13)).toBe(true);
    expect(after[1].some(x => x.id === '2-spades')).toBe(true);   // from seat 0 to its left
    expect(after[0].some(x => x.id === '2-spades')).toBe(false);
  });

  it('AI passes an unguarded queen of spades and high hearts', () => {
    expect(ids(choosePass(cards('QS 3S AH KH 2C 3D')))).toEqual(['A-hearts', 'K-hearts', 'Q-spades']);
  });

  it('AI keeps a well-guarded queen of spades', () => {
    expect(choosePass(cards('QS 2S 3S 4S 5S AH KH 9H')).some(x => x.id === 'Q-spades')).toBe(false);
  });
});

describe('Hearts AI', () => {
  const pick = (legal, trick, extra = {}) =>
    chooseCard({ legal: cards(legal), trick: trickOf(...trick), seat: 0, difficulty: 'medium', ...extra }).id;

  it('ducks under the current winner with its highest safe card', () => {
    expect(pick('KD 9D 3D', [['10D', 1]])).toBe('9-diamonds');
  });

  it('drops the queen of spades under a higher spade', () => {
    expect(pick('QS 3S', [['AS', 1]])).toBe('Q-spades');
  });

  it('dumps the queen of spades when void', () => {
    expect(pick('QS 2H 5C', [['AD', 1]])).toBe('Q-spades');
  });

  it('dumps its highest heart when void and without the queen', () => {
    expect(pick('2H KH 5C', [['AD', 1]])).toBe('K-hearts');
  });

  it('leads low', () => {
    expect(pick('KD 4C 9D', [])).toBe('4-clubs');
  });
});
