import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LEVELS, ROWS, COLS, FLOWERS, loadReached, saveReached, reachedFromScores,
  blastArea, getMatchGroups, processMatches, CHAPTERS, findHint, trySwapBoard,
} from './match3Logic';

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

  it('ask for a little more each time among the score levels of a chapter', () => {
    // Levels 1-20 are the first chapter, then each ten is a new one, which starts
    // a little easier than the last ended
    const chapter = id => (id <= 20 ? 0 : Math.ceil((id - 20) / 10));
    const score = LEVELS.filter(lv => lv.target.type === 'score');
    for (let i = 1; i < score.length; i++) {
      if (chapter(score[i].id) !== chapter(score[i - 1].id)) continue;
      expect(score[i].target.value).toBeGreaterThanOrEqual(score[i - 1].target.value);
    }
  });

  it('go up to level 100, every one in exactly one chapter', () => {
    expect(LEVELS).toHaveLength(100);
    let next = 1;
    for (const ch of CHAPTERS) { expect(ch.from).toBe(next); next = ch.to + 1; }
    expect(next).toBe(LEVELS.length + 1);
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

describe('Garden Match special tiles', () => {
  // A board with no matches: flower types cycle so no three line up
  let id = 0;
  const board = () => Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({ id: ++id, type: (r * 2 + c) % 3 + (r % 2) * 3, special: null, isBlocker: false })));

  it('blast bigger the harder the match: star 7, sun 9, rainbow 13 squares', () => {
    const b = board();
    expect(blastArea(b, 3, 3, 'row')).toHaveLength(7);
    expect(blastArea(b, 3, 3, 'area')).toHaveLength(9);
    const cross = blastArea(b, 3, 3, 'cross');
    expect(cross).toHaveLength(13);
    expect(new Set(cross).size).toBe(13);
  });

  it('never blast blockers', () => {
    const b = board();
    b[3][0] = { ...b[3][0], type: -1, isBlocker: true };
    expect(blastArea(b, 3, 3, 'cross')).not.toContain('3,0');
  });

  it('a match of 4 makes a star, a match of 5 makes a rainbow', () => {
    for (const [len, kind] of [[4, 'row'], [5, 'cross']]) {
      const b = board();
      expect(getMatchGroups(b)).toHaveLength(0);
      for (let c = 0; c < len; c++) b[6][c] = { ...b[6][c], type: 5 };
      const groups = getMatchGroups(b);
      expect(groups).toHaveLength(1);
      const made = processMatches(b, groups).board[6].filter(cl => cl.special);
      expect(made.map(cl => cl.special)).toEqual([kind]);
    }
  });
});

describe('Garden Match hints', () => {
  let id = 0;
  // A board where flowers never line up and no swap makes a match
  const stuckBoard = () => Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({ id: ++id, type: (r * 2 + c) % 3 + (r % 2) * 3, special: null, isBlocker: false })));
  const set = (b, cells, type) => cells.forEach(([r, c]) => { b[r][c] = { ...b[r][c], type }; });
  // Plant moves: 🌷 (4) along the top makes 3 when (0,2)↔(1,2) swap;
  // 💐 (5) along the bottom makes 3 (or 5) when (5,2)↔(6,2) swap
  const plantTop = b => set(b, [[0, 0], [0, 1]], 4);
  const plantBottom = (b, five) => { set(b, [[6, 0], [6, 1], [5, 2], ...(five ? [[6, 3], [6, 4]] : [])], 5); };
  const swapOf = h => [h.r1, h.c1, h.r2, h.c2];

  it('finds nothing on a board with no moves', () => {
    expect(findHint(stuckBoard())).toBeNull();
  });

  it('suggests the swap that makes a match', () => {
    const b = stuckBoard(); plantBottom(b);
    expect(getMatchGroups(b)).toHaveLength(0);
    const h = findHint(b);
    expect(Math.abs(h.r1 - h.r2) + Math.abs(h.c1 - h.c2)).toBe(1);   // neighbours
    expect(getMatchGroups(trySwapBoard(b, ...swapOf(h)))).not.toHaveLength(0);
  });

  it('prefers the bigger match when going for points', () => {
    const b = stuckBoard(); plantTop(b); plantBottom(b, true);
    expect(getMatchGroups(b)).toHaveLength(0);
    expect(swapOf(findHint(b))).toEqual([5, 2, 6, 2]);
  });

  it('goes for the flower being collected', () => {
    const b = stuckBoard(); plantTop(b); plantBottom(b, true);
    expect(swapOf(findHint(b, { type: 'collect', flowerType: 4 }))).toEqual([0, 2, 1, 2]);
  });

  it('never moves a blocker', () => {
    const b = stuckBoard(); plantBottom(b);
    b[5][2] = { ...b[5][2], type: -1, isBlocker: true };
    expect(findHint(b)).toBeNull();
  });
});
