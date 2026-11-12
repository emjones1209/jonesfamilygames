/**
 * Makes the Garden Match level table for levels 101-500 (MORE_LEVELS in
 * src/games/match3/match3Logic.js), or re-tunes levels 1-100.
 *
 * Each level's goal type, blocker layout and moves follow a fixed plan; its
 * target is then set by simulating a player who makes the best match they can
 * see (the same choice as the in-game hint) many times over, and picking the
 * target that player reaches in the wanted share of games. For clear levels
 * the target is every blocker, so the moves are tuned instead.
 *
 *   node scripts/tuneMatch3Levels.mjs [--from 101] [--to 500] [--trials 300] [--wins file]
 *
 * Prints the table to paste into MORE_LEVELS. Re-run it after changing the
 * board rules (scoring, specials), as they change how hard every level is.
 *
 * Levels 1-100 are written out by hand, so they keep their goal type, blockers
 * and moves (clear levels: their target), and need a --wins file with lines
 * `id share` saying how often the player should win each one: measure that
 * under the old rules first to keep their difficulty. The lines printed for
 * them give the new target (or moves) to copy into LEVELS.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { readFileSync } from 'node:fs';
import * as L from '../src/games/match3/match3Logic.js';

const PER_CHAPTER = 20;
const FIRST = 101;
// Goal types through each ten levels, as in levels 51-100
const PATTERN = ['score', 'collect', 'score', 'clear', 'collect', 'score', 'collect', 'clear', 'score', 'collect'];
const MAX_CLEAR_MOVES = 45;

/** Share of games the simulated player should win: each chapter starts easier
 *  than the last one ended and builds up; later chapters are a little harder. */
function wantedWins(id, type) {
  const c = Math.floor((id - FIRST) / PER_CHAPTER), p = (id - FIRST) % PER_CHAPTER;
  const start = 0.66 - 0.005 * c, end = 0.40 - 0.006 * c;
  const w = start + (end - start) * p / (PER_CHAPTER - 1);
  return type === 'clear' ? Math.min(0.85, w + 0.22) : w;
}

/** Goal type, layout, flower and moves for every level, before tuning.
 *  Levels before 101 come as they are, with the wanted wins from `wins`. */
function plan(from, to, wins) {
  const names = Object.keys(L.LAYOUTS);
  const levels = [];
  for (let id = from; id < Math.min(FIRST, to + 1); id++) {
    const lv = L.LEVELS[id - 1];
    if (!wins.has(id)) throw new Error(`--wins has no share for level ${id}`);
    levels.push({ id, type: lv.target.type, obstacles: lv.obstacles ?? [], flower: lv.target.flowerType,
      moves: lv.moves, wanted: wins.get(id) });
  }
  let prev = null;
  for (let id = FIRST; id <= to; id++) {
    const c = Math.floor((id - FIRST) / PER_CHAPTER), p = (id - FIRST) % PER_CHAPTER;
    const type = PATTERN[(id - 1) % 10];
    let k = (id * 17) % names.length;
    // Never the same layout twice in a row; clear levels want plenty of blockers
    while (names[k] === prev || (type === 'clear' && L.layoutObstacles(names[k]).length < 9)) k = (k + 1) % names.length;
    prev = names[k];
    const moves = 22 + Math.round(p * 6 / (PER_CHAPTER - 1)) + Math.floor(c / 4);
    if (id >= from) {
      levels.push({ id, type, layout: names[k], obstacles: L.layoutObstacles(names[k]),
        flower: id % L.FLOWERS.length, moves, wanted: wantedWins(id, type) });
    }
  }
  return levels;
}

/** Play a level many times; return each game's progress toward its goal
 *  after `moves` moves (or, for clear levels, the moves it took). */
function simulate(lv, trials) {
  const { obstacles } = lv;
  const target = lv.type === 'collect' ? { type: 'collect', flowerType: lv.flower } : { type: lv.type };
  const level = { obstacles, target };
  const ft = lv.type === 'collect' ? lv.flower : -1;
  const results = [];
  for (let i = 0; i < trials; i++) {
    let b = L.initBoard(level);
    if (!L.hasValidMove(b)) b = L.reshuffleBoard(b);
    let progress = 0, left = obstacles.length, took = Infinity;
    const limit = lv.type === 'clear' ? MAX_CLEAR_MOVES : lv.moves;
    for (let m = 1; m <= limit; m++) {
      const h = L.findHint(b, target);
      const res = L.playMove(b, h.r1, h.c1, h.r2, h.c2, ft);
      progress += lv.type === 'score' ? res.totalScore : res.totalCollected;
      left = Math.max(0, left - res.totalBlockers);
      b = L.hasValidMove(res.board) ? res.board : L.reshuffleBoard(res.board);
      if (lv.type === 'clear' && left === 0) { took = m; break; }
    }
    results.push(lv.type === 'clear' ? took : progress);
  }
  return results.sort((a, b) => a - b);
}

function tune(lv, trials) {
  const res = simulate(lv, trials);
  const w = lv.wanted;
  if (lv.type === 'clear') {
    const moves = res[Math.max(0, Math.ceil(w * trials) - 1)];
    return { ...lv, moves: Math.min(MAX_CLEAR_MOVES, Math.max(6, moves)) };
  }
  const value = res[Math.min(trials - 1, Math.floor((1 - w) * trials))];
  return { ...lv, value: lv.type === 'score' ? Math.max(100, Math.floor(value / 100) * 100) : Math.max(5, value) };
}

if (!isMainThread) {
  for (const lv of workerData.levels) parentPort.postMessage(tune(lv, workerData.trials));
} else {
  const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
  const from = arg('from', FIRST), to = arg('to', 500), trials = arg('trials', 300);
  const winsAt = process.argv.indexOf('--wins');
  const wins = new Map(winsAt > 0
    ? readFileSync(process.argv[winsAt + 1], 'utf8').trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
    : []);
  const todo = plan(from, to, wins);
  const n = Math.max(1, availableParallelism());
  const done = new Map();
  await Promise.all(Array.from({ length: n }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { levels: todo.filter((_, i) => i % n === w), trials } });
    worker.on('message', lv => { done.set(lv.id, lv); process.stderr.write(`\r${done.size}/${todo.length}`); });
    worker.on('error', reject);
    worker.on('exit', resolve);
  })));
  process.stderr.write('\n');
  // Score targets never go down within a chapter
  let best = 0, chapter = -1;
  for (const lv of todo.map(l => done.get(l.id))) {
    const c = L.CHAPTERS.findIndex(ch => lv.id >= ch.from && lv.id <= ch.to);
    if (c !== chapter) { chapter = c; best = 0; }
    if (lv.type === 'score') { lv.value = Math.max(lv.value, best); best = lv.value; }
    const goal = lv.type === 'score' ? `score:${lv.value}` : lv.type === 'collect' ? `collect:${lv.value}:${lv.flower}` : 'clear';
    console.log(`${String(lv.id).padStart(3)} ${goal.padEnd(14)} ${String(lv.moves).padStart(2)} ${lv.layout ?? '(as is)'}`);
  }
}
