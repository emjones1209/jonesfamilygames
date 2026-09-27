import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, makePuzzle, dailyPuzzle, themeForDate, nextDateKey, dateKey,
  snapLine, lettersOf, wordAt, scoreFor, seededRandom,
} from './wordSearchLogic';
import { THEMES } from './wordSearchWords';

const direction = cells => [Math.sign(cells[1][0] - cells[0][0]), Math.sign(cells[1][1] - cells[0][1])];

describe('the word lists', () => {
  it.each(THEMES.map(t => [t.name, t]))('%s has enough words that fit every grid', (_, theme) => {
    expect(theme.words.every(w => /^[A-Z]+$/.test(w))).toBe(true);
    expect(new Set(theme.words).size).toBe(theme.words.length);
    for (const d of Object.values(DIFFICULTIES)) {
      expect(theme.words.filter(w => w.length <= d.size).length).toBeGreaterThanOrEqual(d.words + 2);
    }
  });
});

describe('making a puzzle', () => {
  it.each(Object.keys(DIFFICULTIES))('%s: every word can be read from its cells, in an allowed direction', difficulty => {
    const { size, words: count, dirs } = DIFFICULTIES[difficulty];
    for (const theme of THEMES) {
      for (let seed = 0; seed < 20; seed++) {
        const p = makePuzzle({ theme, difficulty, seed });
        expect(p.grid).toHaveLength(size);
        expect(p.grid.every(row => row.length === size && row.every(ch => /^[A-Z]$/.test(ch)))).toBe(true);
        expect(p.words).toHaveLength(count);
        for (const { word, cells } of p.words) {
          expect(theme.words).toContain(word);
          expect(lettersOf(p.grid, cells)).toBe(word);
          expect(dirs).toContainEqual(direction(cells));
        }
      }
    }
  });

  it('lists the words in alphabetical order, with no repeats', () => {
    const p = makePuzzle({ theme: THEMES[0], difficulty: 'hard', seed: 7 });
    const list = p.words.map(w => w.word);
    expect(list).toEqual([...list].sort());
    expect(new Set(list).size).toBe(list.length);
  });

  it('makes the same puzzle from the same seed, and a different one from another', () => {
    const a = makePuzzle({ theme: THEMES[1], difficulty: 'medium', seed: 'abc' });
    const b = makePuzzle({ theme: THEMES[1], difficulty: 'medium', seed: 'abc' });
    const c = makePuzzle({ theme: THEMES[1], difficulty: 'medium', seed: 'abd' });
    expect(b).toEqual(a);
    expect(c.grid).not.toEqual(a.grid);
  });

  it('gives everyone the same daily puzzle', () => {
    expect(dailyPuzzle('2026-09-27', 'easy')).toEqual(dailyPuzzle('2026-09-27', 'easy'));
    expect(dailyPuzzle('2026-09-27', 'easy').grid).not.toEqual(dailyPuzzle('2026-09-28', 'easy').grid);
  });

  it('has a generator that spreads its numbers over [0, 1)', () => {
    const rng = seededRandom(42);
    const n = Array.from({ length: 1000 }, rng);
    expect(n.every(x => x >= 0 && x < 1)).toBe(true);
    expect(n.filter(x => x < 0.5).length).toBeGreaterThan(400);
  });
});

describe('the theme of the day', () => {
  it('changes every day and comes round again after every theme has had a turn', () => {
    let key = '2026-09-27';
    const seen = [];
    for (let i = 0; i <= THEMES.length; i++) { seen.push(themeForDate(key).id); key = nextDateKey(key); }
    expect(new Set(seen.slice(0, THEMES.length)).size).toBe(THEMES.length);
    expect(seen[THEMES.length]).toBe(seen[0]);
  });

  it('steps over the ends of months and years', () => {
    expect(nextDateKey('2026-09-30')).toBe('2026-10-01');
    expect(nextDateKey('2026-12-31')).toBe('2027-01-01');
    expect(nextDateKey('2028-02-28')).toBe('2028-02-29');
  });

  it('uses the local date', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('selecting', () => {
  it('snaps a wobbly drag to the nearest straight line', () => {
    expect(snapLine([2, 2], [2, 5], 10)).toEqual([[2, 2], [2, 3], [2, 4], [2, 5]]);   // across
    expect(snapLine([2, 2], [3, 5], 10)).toEqual([[2, 2], [2, 3], [2, 4], [2, 5]]);   // nearly across
    expect(snapLine([2, 2], [5, 4], 10)).toEqual([[2, 2], [3, 3], [4, 4], [5, 5]]);   // nearly diagonal
    expect(snapLine([5, 5], [2, 5], 10)).toEqual([[5, 5], [4, 5], [3, 5], [2, 5]]);   // up
    expect(snapLine([5, 5], [3, 3], 10)).toEqual([[5, 5], [4, 4], [3, 3]]);           // up and left
    expect(snapLine([4, 4], [4, 4], 10)).toEqual([[4, 4]]);
  });

  it('stops at the edge of the grid', () => {
    expect(snapLine([1, 1], [4, 3], 3)).toEqual([[1, 1], [2, 2]]);
  });

  it('finds a word read either way round, once', () => {
    const p = makePuzzle({ theme: THEMES[2], difficulty: 'easy', seed: 3 });
    const { word, cells } = p.words[0];
    expect(wordAt(p, cells)).toBe(word);
    expect(wordAt(p, [...cells].reverse())).toBe(word);
    expect(wordAt(p, cells, [word])).toBe(null);
    expect(wordAt(p, cells.slice(0, 1))).toBe(null);
    expect(wordAt(p, cells.slice(0, -1))).toBe(null);
  });
});

describe('scoring', () => {
  it('rewards speed and harder puzzles, with a floor', () => {
    expect(scoreFor(60, 'easy')).toBe(2700);
    expect(scoreFor(60, 'hard')).toBe(5400);
    expect(scoreFor(60, 'easy')).toBeGreaterThan(scoreFor(120, 'easy'));
    expect(scoreFor(10000, 'easy')).toBe(100);
  });
});
