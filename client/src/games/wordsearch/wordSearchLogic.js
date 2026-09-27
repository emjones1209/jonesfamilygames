/**
 * Word Search as pure functions: building a puzzle, the theme of the day, and
 * checking what the player has selected.
 *
 * Puzzles come from a seeded random number generator, so the daily puzzle
 * (seeded by the date and difficulty) is the same on every family member's
 * device. Cells are [row, col]; a direction is [dRow, dCol].
 */
import { THEMES } from './wordSearchWords.js';

const ACROSS = [0, 1], DOWN = [1, 0];
const DOWN_RIGHT = [1, 1], UP_RIGHT = [-1, 1];
const BACKWARDS = [[0, -1], [-1, 0], [-1, -1], [1, -1]];

export const DIFFICULTIES = {
  easy:   { label: 'Easy',   size: 8,  words: 6,  dirs: [ACROSS, DOWN],                                   note: 'Across and down' },
  medium: { label: 'Medium', size: 10, words: 9,  dirs: [ACROSS, DOWN, DOWN_RIGHT, UP_RIGHT],             note: 'Adds diagonals' },
  hard:   { label: 'Hard',   size: 12, words: 12, dirs: [ACROSS, DOWN, DOWN_RIGHT, UP_RIGHT, ...BACKWARDS], note: 'Adds backwards words' },
};

// ── Random numbers ───────────────────────────────────────────────────────────
/** A string → a 32-bit seed. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A small, fast seeded generator (mulberry32): returns numbers in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Theme of the day ─────────────────────────────────────────────────────────
/** 'YYYY-MM-DD' for a date in the device's own time zone. */
export function dateKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayNumber = key => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

/** The theme for a 'YYYY-MM-DD' day: the themes take turns, one a day. */
export function themeForDate(key) {
  return THEMES[((dayNumber(key) % THEMES.length) + THEMES.length) % THEMES.length];
}

/** The day after a 'YYYY-MM-DD' day. */
export function nextDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + 1));
}

// ── Building a puzzle ────────────────────────────────────────────────────────
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLACE_TRIES = 300;

/** The cells a word of `length` letters would cover from `start` going `dir`. */
const cellsFrom = ([r, c], [dr, dc], length) => Array.from({ length }, (_, i) => [r + dr * i, c + dc * i]);

function tryPlace(grid, word, dirs, rng) {
  const size = grid.length;
  for (let t = 0; t < PLACE_TRIES; t++) {
    const dir = pick(dirs, rng);
    const start = [Math.floor(rng() * size), Math.floor(rng() * size)];
    const cells = cellsFrom(start, dir, word.length);
    const fits = cells.every(([r, c], i) => r >= 0 && r < size && c >= 0 && c < size && (!grid[r][c] || grid[r][c] === word[i]));
    if (fits) {
      cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
      return cells;
    }
  }
  return null;
}

/**
 * A puzzle: { size, grid: rows of letters, words: [{ word, cells }] } with the
 * words in alphabetical order. Words that don't fit are skipped for others
 * from the theme.
 */
export function makePuzzle({ theme, difficulty, seed }) {
  const { size, words: count, dirs } = DIFFICULTIES[difficulty];
  const rng = seededRandom(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const pool = shuffled(theme.words.filter(w => w.length <= size), rng);
  // Longer words go in first: they're the hardest to fit
  const chosen = pool.slice(0, count).sort((a, b) => b.length - a.length);
  const spare = pool.slice(count);
  const words = [];
  for (const word of chosen) {
    let w = word, cells = tryPlace(grid, w, dirs, rng);
    while (!cells && spare.length) {
      w = spare.shift();
      cells = tryPlace(grid, w, dirs, rng);
    }
    if (cells) words.push({ word: w, cells });
  }
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = pick(LETTERS, rng);
  words.sort((a, b) => a.word.localeCompare(b.word));
  return { size, grid, words };
}

/** Today's puzzle: the same for everyone who plays it at this difficulty. */
export const dailyPuzzle = (key, difficulty) =>
  makePuzzle({ theme: themeForDate(key), difficulty, seed: `wordsearch:${key}:${difficulty}` });

// ── Selecting ────────────────────────────────────────────────────────────────
/**
 * The straight line of cells from `start` toward `toward`: snapped to the
 * nearest of the 8 directions, so a slightly wobbly finger still selects a
 * clean line, and stopped at the edge of the grid.
 */
export function snapLine(start, toward, size) {
  const dr = toward[0] - start[0], dc = toward[1] - start[1];
  if (!dr && !dc) return [start];
  const step = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const dir = [Math.round(Math.sin(step * Math.PI / 4)), Math.round(Math.cos(step * Math.PI / 4))];
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  const cells = [];
  for (let i = 0; i < length; i++) {
    const r = start[0] + dir[0] * i, c = start[1] + dir[1] * i;
    if (r < 0 || r >= size || c < 0 || c >= size) break;
    cells.push([r, c]);
  }
  return cells;
}

/** The letters under a line of cells. */
export const lettersOf = (grid, cells) => cells.map(([r, c]) => grid[r][c]).join('');

/**
 * The puzzle word the selected cells spell, read either way round, that
 * hasn't been found yet — or null.
 */
export function wordAt(puzzle, cells, found = []) {
  if (cells.length < 2) return null;
  const text = lettersOf(puzzle.grid, cells);
  const backwards = [...text].reverse().join('');
  const match = puzzle.words.find(w => !found.includes(w.word) && (w.word === text || w.word === backwards));
  return match ? match.word : null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────
const SCORE_SCALE = { easy: 1, medium: 1.5, hard: 2 };
/** Faster is better; harder puzzles are worth more. */
export const scoreFor = (seconds, difficulty) =>
  Math.round(Math.max(100, 3000 - seconds * 5) * (SCORE_SCALE[difficulty] ?? 1));
