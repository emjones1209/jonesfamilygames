import { describe, it, expect } from 'vitest';
import {
  buildPinochleDeck, meldOf, legalPlays, trickWinner, scoreHand, sumPoints, chooseBid, bestTrump,
  choosePassToBidder, choosePassBack, MIN_BID, PASS,
} from './pinochleRules';

// card('A', 'hearts', 2) → the second ace of hearts
const card = (rank, suit = 'hearts', copy = 1) => ({ id: `${rank}-${suit}-${copy}`, rank, suit });
const names = (hand, trump) => meldOf(hand, trump).items.map(i => `${i.name} ${i.points}`).sort();

describe('Pinochle: the deck', () => {
  it('is 48 cards — two of each — worth 240 in counters (plus 10 for the last trick)', () => {
    const deck = buildPinochleDeck();
    expect(deck).toHaveLength(48);
    expect(new Set(deck.map(c => c.id)).size).toBe(48);
    expect(sumPoints(deck)).toBe(240);
  });
});

describe('Pinochle: meld', () => {
  it('a run in trump (its royal marriage isn\'t counted again)', () => {
    const hand = ['A', '10', 'K', 'Q', 'J'].map(r => card(r, 'hearts'));
    expect(names(hand, 'hearts')).toEqual(['Run 150']);
    expect(names(hand, 'spades')).toEqual(['Marriage 20']);           // not trump: just a marriage
  });

  it('a run plus another K and Q of trump: a royal marriage as well', () => {
    const hand = [...['A', '10', 'K', 'Q', 'J'].map(r => card(r, 'hearts')), card('K', 'hearts', 2), card('Q', 'hearts', 2)];
    expect(meldOf(hand, 'hearts').total).toBe(190);
  });

  it('dix, marriages and the pinochle (the Q♠ counts in both)', () => {
    const hand = [card('9', 'clubs'), card('9', 'clubs', 2), card('K', 'spades'), card('Q', 'spades'), card('J', 'diamonds')];
    expect(names(hand, 'clubs')).toEqual(['Dix 10', 'Dix 10', 'Marriage 20', 'Pinochle 40']);
    expect(meldOf(hand, 'clubs').total).toBe(80);
  });

  it('arounds — and doubled ones', () => {
    const aces = ['spades', 'hearts', 'clubs', 'diamonds'].map(s => card('A', s));
    expect(names(aces, 'hearts')).toEqual(['Aces around 100']);
    const double = [...aces, ...['spades', 'hearts', 'clubs', 'diamonds'].map(s => card('A', s, 2))];
    expect(names(double, 'hearts')).toEqual(['Double Aces around 1000']);
    const kings = ['spades', 'hearts', 'clubs', 'diamonds'].map(s => card('K', s));
    expect(meldOf(kings, 'hearts').total).toBe(80);
  });

  it('double pinochle is 300, a double run 1500', () => {
    expect(meldOf([card('J', 'diamonds'), card('J', 'diamonds', 2), card('Q', 'spades'), card('Q', 'spades', 2)], 'hearts').total).toBe(300 + 0);
    const both = ['A', '10', 'K', 'Q', 'J'].flatMap(r => [card(r, 'clubs'), card(r, 'clubs', 2)]);
    expect(names(both, 'clubs')).toEqual(['Double run 1500']);
  });
});

describe('Pinochle: playing tricks', () => {
  const play = (...cards) => cards.map(([c, seat]) => ({ card: c, seat }));

  it('of two identical cards, the first played wins', () => {
    expect(trickWinner(play([card('A', 'spades'), 1], [card('A', 'spades', 2), 2]), 'hearts')).toBe(1);
  });

  it('must follow suit — and beat the winning card if you can', () => {
    const hand = [card('9', 'spades'), card('A', 'spades'), card('K', 'hearts')];
    expect(legalPlays(hand, play([card('10', 'spades'), 1]), 'hearts').map(c => c.rank)).toEqual(['A']);
    // Can't beat it: any spade
    expect(legalPlays([card('9', 'spades'), card('J', 'spades')], play([card('A', 'spades'), 1]), 'hearts')).toHaveLength(2);
  });

  it('with none of the suit, must trump (and overtrump if you can)', () => {
    const hand = [card('9', 'hearts'), card('A', 'hearts'), card('K', 'clubs')];
    expect(legalPlays(hand, play([card('10', 'spades'), 1]), 'hearts').map(c => c.rank).sort()).toEqual(['9', 'A']);
    expect(legalPlays(hand, play([card('10', 'spades'), 1], [card('K', 'hearts'), 2]), 'hearts').map(c => c.rank)).toEqual(['A']);
    expect(legalPlays([card('K', 'clubs'), card('9', 'diamonds')], play([card('10', 'spades'), 1]), 'hearts')).toHaveLength(2);
  });

  it('once someone has trumped, following suit no longer has to "beat" anything', () => {
    const hand = [card('9', 'spades'), card('A', 'spades')];
    expect(legalPlays(hand, play([card('10', 'spades'), 1], [card('9', 'hearts'), 2]), 'hearts')).toHaveLength(2);
  });
});

describe('Pinochle: scoring a hand', () => {
  it('the bidders make it: meld and trick points both count', () => {
    const r = scoreHand({ bid: { team: 0, amount: 300 }, meld: [160, 60], counters: [170, 80], tricks: [8, 4] });
    expect(r[0]).toMatchObject({ made: true, delta: 330 });
    expect(r[1].delta).toBe(140);
  });

  it('set: the bidders lose the bid', () => {
    const r = scoreHand({ bid: { team: 1, amount: 400 }, meld: [40, 200], counters: [130, 120], tricks: [6, 6] });
    expect(r[1]).toMatchObject({ made: false, delta: -400 });
    expect(r[0].delta).toBe(170);
  });

  it('a side that takes no tricks loses its meld', () => {
    const r = scoreHand({ bid: { team: 0, amount: 250 }, meld: [100, 60], counters: [250, 0], tricks: [12, 0] });
    expect(r[1]).toMatchObject({ meld: 0, delta: 0 });
  });
});

describe('Pinochle: the computer players', () => {
  const strong = [...['A', '10', 'K', 'Q', 'J'].map(r => card(r, 'hearts')), card('A', 'spades'), card('A', 'clubs'), card('A', 'diamonds'),
    card('9', 'hearts'), card('K', 'clubs'), card('Q', 'clubs'), card('J', 'diamonds')];

  it('picks the suit with the run as trump, and bids on a strong hand', () => {
    expect(bestTrump(strong).suit).toBe('hearts');
    expect(chooseBid(strong, { high: null, level: 'hard' })).toBe(MIN_BID);
    expect(chooseBid(strong, { high: 600, level: 'hard' })).toBe(PASS);
    expect(chooseBid(strong, { high: null, forced: true, level: 'medium' })).toBe(MIN_BID);
  });

  it('passes the bidder trumps, and passes back no trumps', () => {
    const partner = [card('A', 'hearts', 2), card('10', 'hearts', 2), card('9', 'spades'), card('J', 'clubs'), card('K', 'spades', 2),
      card('9', 'clubs'), card('J', 'spades'), card('Q', 'diamonds'), card('9', 'diamonds'), card('10', 'clubs'), card('J', 'hearts', 2), card('9', 'hearts', 2)];
    const passed = choosePassToBidder(partner, 'hearts');
    expect(passed.every(id => id.includes('hearts'))).toBe(true);
    const fifteen = [...strong, ...partner.filter(c => passed.includes(c.id))];
    const back = choosePassBack(fifteen, 'hearts');
    expect(back).toHaveLength(3);
    expect(back.some(id => id.includes('hearts'))).toBe(false);
  });
});
