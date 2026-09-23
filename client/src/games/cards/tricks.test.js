import { describe, it, expect } from 'vitest';
import {
  sortHand, followSuit, trickWinner, wouldWin, nextSeat, partnerOf, teamOf,
} from './tricks';
import { dealTable, playCard, collectTrick } from './trickTable';
import { c } from './testCards';

const t = (...plays) => plays.map(([code, seat]) => ({ card: c(code), seat }));

describe('seats', () => {
  it('rotates clockwise and wraps', () => {
    expect([0, 1, 2, 3].map(s => nextSeat(s))).toEqual([1, 2, 3, 0]);
  });
  it('pairs partners across the table', () => {
    expect([0, 1, 2, 3].map(partnerOf)).toEqual([2, 3, 0, 1]);
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 1, 0, 1]);
  });
});

describe('sortHand', () => {
  it('groups by suit and orders ranks high to low (aces high)', () => {
    const hand = ['2H', 'AS', '10C', 'KH', '3S', 'AD'].map(c);
    expect(sortHand(hand).map(x => x.id)).toEqual(
      ['A-spades', '3-spades', 'K-hearts', '2-hearts', '10-clubs', 'A-diamonds'],
    );
  });
});

describe('followSuit', () => {
  const hand = ['2H', 'KH', '5C'].map(c);
  it('must follow the lead suit when able', () => {
    expect(followSuit(hand, 'hearts').map(x => x.id)).toEqual(['2-hearts', 'K-hearts']);
  });
  it('may play anything when void', () => {
    expect(followSuit(hand, 'spades')).toHaveLength(3);
  });
  it('may play anything when leading', () => {
    expect(followSuit(hand, null)).toHaveLength(3);
  });
});

describe('trickWinner', () => {
  it('highest card of the suit led wins without trump', () => {
    expect(trickWinner(t(['5H', 0], ['KH', 1], ['AS', 2], ['9H', 3]))).toBe(1);
  });
  it('off-suit cards never win, however high', () => {
    expect(trickWinner(t(['2C', 0], ['AH', 1], ['AS', 2], ['AD', 3]))).toBe(0);
  });
  it('any trump beats the suit led', () => {
    expect(trickWinner(t(['AH', 0], ['2S', 1], ['KH', 2], ['3D', 3]), { trump: 'spades' })).toBe(1);
  });
  it('higher trump beats lower trump', () => {
    expect(trickWinner(t(['AH', 0], ['2S', 1], ['JS', 2], ['3D', 3]), { trump: 'spades' })).toBe(2);
  });
  it('works for a trick that starts at any seat', () => {
    expect(trickWinner(t(['4D', 2], ['QD', 3], ['JD', 0], ['2D', 1]))).toBe(3);
  });
});

describe('wouldWin', () => {
  it('knows a low trump beats a high card of the suit led', () => {
    // Regression: the old AI compared raw ranks across suits
    expect(wouldWin(t(['AH', 0]), c('2S'), 1, { trump: 'spades' })).toBe(true);
  });
  it('knows a high off-suit card cannot beat a trump', () => {
    expect(wouldWin(t(['4H', 0], ['5S', 1]), c('KH'), 2, { trump: 'spades' })).toBe(false);
  });
});

describe('trick table', () => {
  const winnerOf = trick => trickWinner(trick);
  const hands = [['2H', '3H'], ['4H', '5H'], ['6H', '7H'], ['8H', 'AH']].map(h => h.map(c));

  it('only accepts a play from the seat whose turn it is', () => {
    const s = dealTable(hands, 0);
    expect(playCard(s, 1, c('4H'), { winnerOf })).toBe(s);
  });

  it('rejects a card that is not in the hand', () => {
    const s = dealTable(hands, 0);
    expect(playCard(s, 0, c('KS'), { winnerOf })).toBe(s);
  });

  it('keeps the full trick visible and locked until collected', () => {
    let s = dealTable(hands, 0);
    for (const [seat, code] of [[0, '2H'], [1, '4H'], [2, '6H'], [3, 'AH']]) {
      s = playCard(s, seat, c(code), { winnerOf });
    }
    expect(s.status).toBe('collecting');
    expect(s.trick).toHaveLength(4);        // the 4th card is shown
    expect(s.winner).toBe(3);
    // A second tap while collecting does nothing (the old double-play bug)
    expect(playCard(s, 3, c('8H'), { winnerOf })).toBe(s);
  });

  it('gives the trick to the winner, who leads next, and ends when hands are empty', () => {
    let s = dealTable(hands, 0);
    for (const [seat, code] of [[0, '2H'], [1, '4H'], [2, '6H'], [3, 'AH']]) {
      s = playCard(s, seat, c(code), { winnerOf });
    }
    s = collectTrick(s);
    expect(s).toMatchObject({ status: 'playing', turn: 3, trick: [], tricksWon: [0, 0, 0, 1] });
    expect(s.taken[3]).toHaveLength(4);
    for (const [seat, code] of [[3, '8H'], [0, '3H'], [1, '5H'], [2, '7H']]) {
      s = playCard(s, seat, c(code), { winnerOf });
    }
    s = collectTrick(s);
    expect(s.status).toBe('done');
    expect(s.tricksWon).toEqual([0, 0, 0, 2]);
  });
});
