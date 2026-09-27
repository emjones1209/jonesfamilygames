import { describe, it, expect } from 'vitest';
import {
  value, isRun, isSet, allMelds, bestMelds, deadwoodOf, layOff, defend, scoreKnock,
  chooseDiscard, wantsDiscard,
} from './ginRules';

// Cards by name: '10♥' → { rank: '10', suit: 'hearts', id: '10-hearts' }
const SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const card = name => {
  const rank = name.slice(0, -1), suit = SUIT[name.slice(-1)];
  return { rank, suit, id: `${rank}-${suit}` };
};
const cards = names => names.split(' ').map(card);
const ids = list => list.map(c => c.id).sort();
const meldNames = melds => melds.map(m => m.map(c => c.id).sort().join(' ')).sort();

describe('card values and melds', () => {
  it('counts aces as 1 and pictures as 10', () => {
    expect(cards('A♠ 7♥ 10♦ J♣ K♠').map(value)).toEqual([1, 7, 10, 10, 10]);
  });

  it('knows runs and sets, with aces low', () => {
    expect(isRun(cards('A♥ 2♥ 3♥'))).toBe(true);
    expect(isRun(cards('Q♥ K♥ A♥'))).toBe(false);
    expect(isRun(cards('5♥ 6♥ 8♥'))).toBe(false);
    expect(isRun(cards('5♥ 6♠ 7♥'))).toBe(false);
    expect(isSet(cards('7♥ 7♠ 7♦'))).toBe(true);
    expect(isSet(cards('7♥ 7♠'))).toBe(false);
  });

  it('finds every possible meld, including the 3-card sets inside a 4-card set', () => {
    const melds = allMelds(cards('7♥ 7♠ 7♦ 7♣ 2♠'));
    expect(melds).toHaveLength(5);
    const runs = allMelds(cards('3♥ 4♥ 5♥ 6♥'));
    expect(meldNames(runs)).toEqual(meldNames([cards('3♥ 4♥ 5♥'), cards('4♥ 5♥ 6♥'), cards('3♥ 4♥ 5♥ 6♥')]));
  });
});

describe('the best arrangement', () => {
  it('uses a shared card where it saves the most deadwood', () => {
    // The 7♥ fits the run 5-6-7♥ or the set of 7s, not both. The run leaves 7+7+10 = 24;
    // the set leaves 5+6+10 = 21, so the set is better
    const hand = cards('5♥ 6♥ 7♥ 7♠ 7♦ K♣');
    const best = bestMelds(hand);
    expect(best.points).toBe(21);
    expect(meldNames(best.melds)).toEqual(meldNames([cards('7♥ 7♠ 7♦')]));
    expect(deadwoodOf(hand)).toBe(21);
  });

  it('splits a 4-card set to make a run', () => {
    // 8♥ 8♠ 8♦ 8♣ + 9♥ 10♥: set of three 8s and a run 8♥-9♥-10♥
    const best = bestMelds(cards('8♥ 8♠ 8♦ 8♣ 9♥ 10♥'));
    expect(best.points).toBe(0);
    expect(meldNames(best.melds)).toEqual(meldNames([cards('8♠ 8♦ 8♣'), cards('8♥ 9♥ 10♥')]));
  });

  it('scores a hand with no melds as all deadwood', () => {
    expect(deadwoodOf(cards('A♠ 3♥ 5♦ 7♣ 9♠ J♥ K♦ 2♣ 4♦ 6♥'))).toBe(1 + 3 + 5 + 7 + 9 + 10 + 10 + 2 + 4 + 6);
  });

  it('finds gin', () => {
    expect(deadwoodOf(cards('A♠ 2♠ 3♠ 4♠ 9♥ 9♦ 9♣ J♦ Q♦ K♦'))).toBe(0);
  });
});

describe('laying off after a knock', () => {
  const knockerMelds = [cards('5♥ 6♥ 7♥'), cards('Q♠ Q♦ Q♣')];

  it('adds cards to the knocker\'s runs and sets, one after another', () => {
    const { laidOff, remaining } = layOff(cards('8♥ 9♥ Q♥ 2♣'), knockerMelds);
    expect(ids(laidOff.map(l => l.card))).toEqual(ids(cards('8♥ 9♥ Q♥')));
    expect(ids(remaining)).toEqual(['2-clubs']);
  });

  it('lets the defender keep their own melds and lay off the rest', () => {
    const hand = cards('4♥ 9♣ 9♠ 9♦ K♣ 2♦ 3♦ A♦ 10♠ J♠');
    const d = defend(hand, knockerMelds, false);
    expect(ids(d.laidOff.map(l => l.card))).toEqual(['4-hearts']);
    // Best: runs A-2-3♦ and 9-10-J♠, leaving 9♣ 9♦ K♣ (keeping the set of 9s would leave K♣ 10♠ J♠ = 30)
    expect(d.points).toBe(9 + 9 + 10);
  });

  it('can\'t lay off against gin', () => {
    const d = defend(cards('8♥ 2♣'), knockerMelds, true);
    expect(d.laidOff).toEqual([]);
    expect(d.points).toBe(10);
  });
});

describe('scoring a knock', () => {
  it('gives the knocker the difference', () => {
    expect(scoreKnock('knock', 5, 20)).toEqual({ winner: 0, points: 15, undercut: false });
  });
  it('gives the defender the difference plus 25 for an undercut (a tie counts too)', () => {
    expect(scoreKnock('knock', 8, 3)).toEqual({ winner: 1, points: 30, undercut: true });
    expect(scoreKnock('knock', 6, 6)).toEqual({ winner: 1, points: 25, undercut: true });
  });
  it('gives 25 for gin and 31 for big gin, plus the defender\'s deadwood', () => {
    expect(scoreKnock('gin', 0, 12)).toEqual({ winner: 0, points: 37, undercut: false });
    expect(scoreKnock('bigGin', 0, 12)).toEqual({ winner: 0, points: 43, undercut: false });
  });
});

describe('the computer player', () => {
  it('throws away the card that leaves the least deadwood, high cards first', () => {
    const hand = cards('5♥ 6♥ 7♥ 9♠ 9♦ 9♣ 2♣ 3♦ K♠ Q♥ A♣');
    expect(chooseDiscard(hand).id).toBe('K-spades');
  });

  it('won\'t throw back the card it just took', () => {
    const hand = cards('5♥ 6♥ 7♥ 9♠ 9♦ 9♣ 2♣ 3♦ K♠ Q♥ A♣');
    expect(chooseDiscard(hand, { keep: 'K-spades' }).id).toBe('Q-hearts');
  });

  it('on Hard, avoids feeding the opponent the cards they collect', () => {
    // Any of the four 10-point cards leaves the same deadwood. The opponent picked up the K♦,
    // so kings look wanted (and so does the J♦, near it); the Q♣ is safe
    const hand = cards('5♥ 6♥ 7♥ 9♠ 9♦ 9♣ 2♣ K♠ K♥ Q♣ J♦');
    expect(chooseDiscard(hand, { level: 'medium' }).id).toBe('K-spades');
    expect(chooseDiscard(hand, { level: 'hard', theirPickups: cards('K♦') }).id).toBe('Q-clubs');
  });

  it('takes the face-up card when it makes a meld', () => {
    const hand = cards('5♥ 6♥ 9♠ 9♦ 2♣ 3♦ K♠ Q♥ A♣ J♦');
    expect(wantsDiscard(hand, card('7♥'), 'easy')).toBe(true);
    expect(wantsDiscard(hand, card('9♣'), 'medium')).toBe(true);
    expect(wantsDiscard(hand, card('K♦'), 'medium')).toBe(false);
  });
});
