import { describe, it, expect } from 'vitest';
import { newTripeaks, coveredBy, placeOf, isFree, canPlay, play, draw, adjacent, hint, isWon, isStuck, left, PEAK_BONUS } from './tripeaksRules';

const card = (rank, suit = 'spades') => ({ id: `${rank}-${suit}`, rank, suit, faceUp: true });
const total = s => s.peaks.filter(Boolean).length + s.stock.length + s.waste.length;

describe('TriPeaks', () => {
  it('deals three peaks of 28 cards (bottom row face up), one card to the waste and 23 to the stock', () => {
    const s = newTripeaks();
    expect(s.peaks).toHaveLength(28);
    expect(s.waste).toHaveLength(1);
    expect(s.stock).toHaveLength(23);
    expect(s.peaks.map(c => c.faceUp)).toEqual(s.peaks.map((_, i) => i >= 18));
    expect(s.peaks.map((_, i) => isFree(s, i))).toEqual(s.peaks.map((_, i) => i >= 18));
  });

  it('lays out the peaks: each card sits between the two covering it', () => {
    expect(coveredBy(0)).toEqual([3, 4]);
    expect(coveredBy(4)).toEqual([10, 11]);
    expect(coveredBy(9)).toEqual([18, 19]);
    for (let i = 0; i < 18; i++) {
      const [a, b] = coveredBy(i).map(placeOf);
      expect(placeOf(i).x).toBe((a.x + b.x) / 2);
      expect(a.row).toBe(placeOf(i).row + 1);
    }
  });

  it('plays a card one higher or lower than the waste card (K and A next to each other)', () => {
    expect(adjacent(card('K'), card('A'))).toBe(true);
    expect(adjacent(card('5'), card('7'))).toBe(false);
    const s = newTripeaks();
    s.peaks[18] = card('6'); s.peaks[19] = card('8'); s.peaks[20] = card('K');
    s.waste = [card('7', 'hearts')];
    expect(canPlay(s, 18)).toBe(true);
    expect(canPlay(s, 20)).toBe(false);
    const t = play(s, 18);
    expect(t.score).toBe(1);
    expect(canPlay(t, 19)).toBe(false);                            // the waste is the 6 now: 8 isn't next to it
  });

  it('turns a card over once both cards covering it are gone, and the streak scores', () => {
    const s = newTripeaks();
    s.peaks[18] = card('6'); s.peaks[19] = card('5');
    s.waste = [card('7', 'hearts')];
    let t = play(s, 18);                                           // 6: streak 1
    t = play(t, 19);                                               // 5: streak 2
    expect(t.peaks[9].faceUp).toBe(true);
    expect(t.score).toBe(3);
    t = draw(t);
    expect(t.streak).toBe(0);
  });

  it('gives a bonus for clearing a peak, and plays whole games to a win or a stop', () => {
    let wins = 0;
    for (let g = 0; g < 300; g++) {
      let s = newTripeaks();
      let peaks = 0;
      for (let n = 0; n < 200 && !isWon(s) && !isStuck(s); n++) {
        const h = hint(s);
        const before = s;
        s = h.draw ? draw(s) : play(s, h.play);
        if (h.play != null && h.play < 3) { peaks++; expect(s.score - before.score).toBe(s.streak + PEAK_BONUS); }
        expect(total(s)).toBe(52);
      }
      expect(isWon(s) || isStuck(s)).toBe(true);
      if (isWon(s)) { wins++; expect(peaks).toBe(3); expect(left(s)).toBe(0); }
    }
    expect(wins).toBeGreaterThan(0);
  });
});
