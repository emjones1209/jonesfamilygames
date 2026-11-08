import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LEVELS, ROWS, COLS, FLOWERS, loadReached, saveReached, reachedFromScores } from './match3Logic';

describe('Garden Match levels', () => {
  it('are numbered 1, 2, 3, … in order', () => {
    LEVELS.forEach((lv, i) => expect(lv.id).toBe(i + 1));
  });

  it('have sensible goals, and blockers on the board with no repeats', () => {
    for (const lv of LEVELS) {
      expect(lv.moves).toBeGreaterThan(0);
      expect(lv.target.value).toBeGreaterThan(0);
      const spots = (lv.obstacles ?? []).map(({ row, col }) => {
        expect(row).toBeGreaterThanOrEqual(0); expect(row).toBeLessThan(ROWS);
        expect(col).toBeGreaterThanOrEqual(0); expect(col).toBeLessThan(COLS);
        return `${row},${col}`;
      });
      expect(new Set(spots).size).toBe(spots.length);
      if (lv.target.type === 'clear') expect(lv.target.value).toBe(spots.length);
      if (lv.target.type === 'collect') expect(FLOWERS[lv.target.flowerType]).toBeDefined();
    }
  });

  it('ask for a little more each time among the score levels', () => {
    const score = LEVELS.filter(lv => lv.target.type === 'score');
    for (let i = 1; i < score.length; i++) {
      expect(score[i].target.value).toBeGreaterThanOrEqual(score[i - 1].target.value);
    }
  });
});

describe('Garden Match progress', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };
  });
  afterEach(() => { delete globalThis.localStorage; });

  it('starts at level 1 with nothing saved', () => {
    expect(loadReached({ id: 7 })).toBe(1);
  });

  it('remembers the furthest level, separately for each player', () => {
    saveReached({ id: 7 }, 6);
    expect(loadReached({ id: 7 })).toBe(6);
    expect(loadReached({ id: 8 })).toBe(1);
  });

  it('keeps saved values to real levels (or one past the last, meaning all done)', () => {
    saveReached({ id: 1 }, 999);
    expect(loadReached({ id: 1 })).toBe(LEVELS.length + 1);
    store.set('match3:progress:1', 'not json');
    expect(loadReached({ id: 1 })).toBe(1);
  });

  it('works without storage (private mode)', () => {
    delete globalThis.localStorage;
    expect(() => saveReached({ id: 1 }, 3)).not.toThrow();
    expect(loadReached({ id: 1 })).toBe(1);
  });

  it('works out the level after the highest win from saved scores', () => {
    expect(reachedFromScores([])).toBe(1);
    expect(reachedFromScores([
      { metadata: { level: 3 } },
      { metadata: '{"level":5}' },     // SQLite hands metadata back as text
      { metadata: {} },                // scores saved before levels were recorded
      { metadata: 'garbage' },
    ])).toBe(6);
    expect(reachedFromScores([{ metadata: { level: LEVELS.length } }])).toBe(LEVELS.length + 1);
  });
});
