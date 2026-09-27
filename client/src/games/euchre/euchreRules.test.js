import { describe, it, expect } from 'vitest';
import {
  makeDeck, suitWith, rankWith, legalPlays, winnerOf, sortHand, scoreHand, gameWinner,
  handValue, chooseDiscard, chooseCall, RIGHT, LEFT,
} from './euchreRules';

// Cards by name: 'J♥' → { rank: 'J', suit: 'hearts', id: 'J-hearts' }
const SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const card = name => {
  const rank = name.slice(0, -1), suit = SUIT[name.slice(-1)];
  return { rank, suit, id: `${rank}-${suit}` };
};
const cards = names => names.split(' ').map(card);
const ids = list => list.map(c => c.id);
const trick = (...plays) => plays.map(([name, seat]) => ({ card: card(name), seat }));

describe('the deck', () => {
  it('has 24 cards, 9 to ace in each suit', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(24);
    expect(new Set(ids(deck)).size).toBe(24);
    expect(deck.filter(c => c.suit === 'hearts').map(c => c.rank)).toEqual(['9', '10', 'J', 'Q', 'K', 'A']);
  });
});

describe('the bowers', () => {
  it('makes the jack of trump highest, then the other jack of the same colour', () => {
    const rank = rankWith('hearts');
    expect(rank(card('J♥'))).toBe(RIGHT);
    expect(rank(card('J♦'))).toBe(LEFT);
    expect(rank(card('A♥'))).toBe(14);
    expect(rank(card('J♠'))).toBe(11);          // an ordinary jack
  });

  it('counts the left bower as trump, not as its own suit', () => {
    const suit = suitWith('clubs');
    expect(suit(card('J♠'))).toBe('clubs');
    expect(suit(card('Q♠'))).toBe('spades');
    expect(suitWith(null)(card('J♠'))).toBe('spades');   // before trump is named
  });

  it('won\'t let the left bower follow its printed suit', () => {
    // Diamonds led, hearts trump: J♦ is a heart now, so the player is out of diamonds
    const hand = cards('J♦ 9♠ K♣');
    expect(ids(legalPlays(hand, trick(['A♦', 1]), 'hearts'))).toEqual(ids(hand));
  });

  it('makes the left bower follow a trump lead', () => {
    const hand = cards('J♦ 9♠ A♦');
    expect(ids(legalPlays(hand, trick(['9♥', 1]), 'hearts'))).toEqual(['J-diamonds']);
  });
});

describe('who wins a trick', () => {
  it('right bower beats left bower beats the ace of trump', () => {
    expect(winnerOf(trick(['A♥', 0], ['J♦', 1], ['J♥', 2], ['K♥', 3]), 'hearts')).toBe(2);
    expect(winnerOf(trick(['A♥', 0], ['J♦', 1], ['Q♥', 2], ['K♥', 3]), 'hearts')).toBe(1);
  });

  it('any trump beats the suit led; otherwise the highest of the suit led', () => {
    expect(winnerOf(trick(['A♠', 0], ['9♥', 1], ['K♠', 2], ['A♣', 3]), 'hearts')).toBe(1);
    expect(winnerOf(trick(['10♠', 0], ['Q♠', 1], ['A♣', 2], ['9♠', 3]), 'hearts')).toBe(1);
  });

  it('works with three players when someone goes alone', () => {
    expect(winnerOf(trick(['9♣', 1], ['J♠', 3], ['A♣', 0]), 'clubs')).toBe(3);
  });
});

describe('sorting a hand', () => {
  it('puts trump first with the bowers on top, and alternates colours', () => {
    const sorted = sortHand(cards('9♥ J♠ A♦ J♣ K♣ 10♠'), 'spades');
    expect(ids(sorted)).toEqual(['J-spades', 'J-clubs', '10-spades', '9-hearts', 'K-clubs', 'A-diamonds']);
  });
});

describe('scoring', () => {
  it.each([
    [[3, 2], false, [1, 0], 'made'],
    [[4, 1], false, [1, 0], 'made'],
    [[5, 0], false, [2, 0], 'march'],
    [[5, 0], true, [4, 0], 'march'],
    [[3, 2], true, [1, 0], 'made'],
    [[2, 3], false, [0, 2], 'euchred'],
    [[0, 5], true, [0, 2], 'euchred'],
  ])('makers with %j tricks (alone: %s) → %j', (tricks, alone, delta, result) => {
    expect(scoreHand(0, tricks, alone)).toEqual({ delta, result });
  });

  it('scores for the other team when they\'re the makers', () => {
    expect(scoreHand(1, [1, 4], false).delta).toEqual([0, 1]);
  });

  it('ends the game at 10', () => {
    expect(gameWinner([9, 9])).toBe(null);
    expect(gameWinner([10, 7])).toBe(0);
    expect(gameWinner([8, 11])).toBe(1);
  });
});

describe('the computer naming trump', () => {
  it('rates bowers and aces', () => {
    expect(handValue(cards('J♥ J♦ A♥ K♥ A♠'), 'hearts')).toBeGreaterThan(10);
    expect(handValue(cards('9♣ 10♣ Q♠ 9♦ 10♦'), 'hearts')).toBe(0);
  });

  it('orders up a strong hand and passes a weak one', () => {
    const base = { seat: 0, dealer: 3, upcard: card('9♥'), round: 1, level: 'medium' };
    expect(chooseCall({ ...base, hand: cards('J♥ A♥ K♥ A♠ 10♣') })).toMatchObject({ call: true, suit: 'hearts' });
    expect(chooseCall({ ...base, hand: cards('9♣ 10♣ Q♠ 9♦ 10♦') })).toEqual({ call: false });
  });

  it('goes alone with a near-certain hand (but not on Easy)', () => {
    const base = { seat: 0, dealer: 3, upcard: card('9♥'), round: 1, hand: cards('J♥ J♦ A♥ K♥ A♠') };
    expect(chooseCall({ ...base, level: 'hard' })).toEqual({ call: true, suit: 'hearts', alone: true });
    for (let i = 0; i < 20; i++) expect(chooseCall({ ...base, level: 'easy' }).alone).toBe(false);
  });

  it('as dealer in round 2, always names a suit — the best one, never the turned-down suit', () => {
    const hand = cards('9♣ 10♣ Q♠ 9♦ 10♦');
    const choice = chooseCall({ hand, seat: 3, dealer: 3, upcard: card('A♣'), round: 2, turnedDown: 'clubs', level: 'hard' });
    expect(choice.call).toBe(true);
    expect(choice.suit).not.toBe('clubs');
    const strong = chooseCall({ hand: cards('J♠ A♠ K♠ 9♦ A♥'), seat: 1, dealer: 3, upcard: card('A♣'), round: 2, turnedDown: 'clubs', level: 'medium' });
    expect(strong).toMatchObject({ call: true, suit: 'spades' });
  });
});

describe('the dealer throwing a card away', () => {
  it('throws away a lone low card to leave a suit empty', () => {
    expect(chooseDiscard(cards('J♥ A♥ 9♥ 10♣ K♠ Q♠'), 'hearts').id).toBe('10-clubs');
  });

  it('keeps aces and trump', () => {
    expect(['A-clubs', 'A-spades']).toContain(chooseDiscard(cards('J♥ A♥ 9♥ A♣ A♠ 10♥'), 'hearts').id);
    expect(chooseDiscard(cards('J♥ J♦ A♥ K♥ Q♥ 9♥'), 'hearts').id).toBe('9-hearts');
  });
});
