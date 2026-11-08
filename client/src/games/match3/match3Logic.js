/** Garden Match: levels and board rules (no React, so they can be tested and simulated). */

// ── Theme ─────────────────────────────────────────────────────────────────────
export const ROWS = 7, COLS = 7;
export const FLOWERS = ['🌸', '🌻', '🌺', '🌼', '💐', '🌷'];
// Bigger matches make bigger blasts: star 7 squares, sun 9, rainbow 13
export const SPECIAL_ICON = { row: '🌟', area: '☀️', cross: '🌈' };

// ── Levels ────────────────────────────────────────────────────────────────────
// Tuned by simulating a player who makes the biggest match they can see (no
// peeking at which flowers will drop in next). That player wins about 99% of the
// first levels, easing down to about half of level 20. Clear-the-blocker levels
// are a little easier than their neighbours, as a breather.
export const LEVELS = [
  // Levels 1-5: Sprouts — short and gentle, almost everyone wins
  { id:  1, target: { type: 'score',   value:  3900 }, moves: 12 },
  { id:  2, target: { type: 'score',   value:  5300 }, moves: 14 },
  { id:  3, target: { type: 'score',   value:  5900 }, moves: 15 },
  { id:  4, target: { type: 'score',   value:  6500 }, moves: 16 },
  { id:  5, target: { type: 'score',   value:  7600 }, moves: 18,
    obstacles: [{ row: 3, col: 3 }] },
  // Levels 6-10: Growing — blockers and new goals arrive
  { id:  6, target: { type: 'collect', value:    12, flowerType: 0 }, moves: 20,
    obstacles: [{ row: 2, col: 2 }, { row: 4, col: 4 }] },
  { id:  7, target: { type: 'score',   value:  8000 }, moves: 18,
    obstacles: [{ row: 3, col: 3 }] },
  { id:  8, target: { type: 'score',   value:  8300 }, moves: 18,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 3 }] },
  { id:  9, target: { type: 'clear',   value:     4 }, moves: 16,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  { id: 10, target: { type: 'score',   value:  8600 }, moves: 18,
    obstacles: [{ row: 3, col: 2 }, { row: 3, col: 4 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  // Levels 11-15: Blooming — a real challenge
  { id: 11, target: { type: 'collect', value:    14, flowerType: 1 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id: 12, target: { type: 'score',   value:  8700 }, moves: 18,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }, { row: 3, col: 3 }] },
  { id: 13, target: { type: 'clear',   value:     9 }, moves: 15,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 3, col: 3 }] },
  { id: 14, target: { type: 'score',   value:  9200 }, moves: 18 },
  { id: 15, target: { type: 'collect', value:    17, flowerType: 2 }, moves: 20,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 4 }] },
  // Levels 16-20: Master gardener
  { id: 16, target: { type: 'score',   value: 10300 }, moves: 20,
    obstacles: [{ row: 0, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 6, col: 3 }, { row: 3, col: 3 }] },
  { id: 17, target: { type: 'clear',   value:    12 }, moves: 18,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 0, col: 3 }, { row: 6, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }] },
  { id: 18, target: { type: 'score',   value: 11300 }, moves: 20 },
  { id: 19, target: { type: 'collect', value:    18, flowerType: 3 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 3, col: 3 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id: 20, target: { type: 'score',   value: 12900 }, moves: 22,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
];

// ── Board logic ───────────────────────────────────────────────────────────────
const rnd  = () => Math.floor(Math.random() * FLOWERS.length);
// Every tile gets a unique id so it can animate as it moves around the board
let tileSeq = 0;
const mkCell = (type, special = null, isBlocker = false) => ({ id: ++tileSeq, type, special, isBlocker });

export function initBoard(level) {
  const b = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => mkCell(rnd())));
  level.obstacles?.forEach(({ row, col }) => { b[row][col] = mkCell(-1, null, true); });
  // Dissolve any matches present at start
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c].isBlocker) continue;
      let tries = 0;
      while (tries++ < 30 && hasInitialMatch(b, r, c)) b[r][c] = mkCell(rnd());
    }
  }
  return b;
}

function hasInitialMatch(b, r, c) {
  const t = b[r][c].type;
  if (t < 0) return false;
  const eq = (nr, nc) =>
    nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !b[nr][nc].isBlocker && b[nr][nc].type === t;
  return (eq(r, c-1) && eq(r, c-2)) || (eq(r, c+1) && eq(r, c+2)) || (eq(r, c-1) && eq(r, c+1))
      || (eq(r-1, c) && eq(r-2, c)) || (eq(r+1, c) && eq(r+2, c)) || (eq(r-1, c) && eq(r+1, c));
}

export function getMatchGroups(b) {
  const groups = [];
  // Horizontal runs
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { c++; continue; }
      let len = 1;
      while (c + len < COLS && !b[r][c+len].isBlocker && b[r][c+len].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r, c: c+i })), len, dir: 'h' });
      c += len;
    }
  }
  // Vertical runs
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && !b[r+len][c].isBlocker && b[r+len][c].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r: r+i, c })), len, dir: 'v' });
      r += len;
    }
  }
  return groups;
}

const BLAST_POINTS = 60;   // per flower cleared by a special's blast

const specialAt = (b, key) => { const [r, c] = key.split(',').map(Number); return b[r][c].special; };

/** Squares a special clears: its row (star), 3×3 area (sun) or its row and
 *  column together (rainbow). Never blockers. */
export function blastArea(b, r, c, kind) {
  const cells = [];
  const add = (rr, cc) => {
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && !b[rr][cc].isBlocker) cells.push(`${rr},${cc}`);
  };
  if (kind === 'row' || kind === 'cross') for (let cc = 0; cc < COLS; cc++) add(r, cc);
  if (kind === 'cross') for (let rr = 0; rr < ROWS; rr++) if (rr !== r) add(rr, c);
  if (kind === 'area') for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
  return cells;
}

export function processMatches(b, groups, targetType = -1) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  const toRemove = new Set();
  let score = 0, collected = 0, blockersRemoved = 0;

  // Matched tiles are removed
  const matched = new Set();
  groups.forEach(g => {
    g.cells.forEach(({ r, c }) => { matched.add(`${r},${c}`); toRemove.add(`${r},${c}`); });
    score += g.len * 100 * (g.len >= 5 ? 3 : g.len >= 4 ? 2 : 1);
  });

  // Set off specials: any in a match, then any caught in another's blast
  // (chain reactions), until nothing new goes off
  const queue = [...toRemove].filter(key => specialAt(b, key));
  const fired = new Set();
  while (queue.length) {
    const key = queue.shift();
    if (fired.has(key)) continue;
    fired.add(key);
    const [r, c] = key.split(',').map(Number);
    for (const hit of blastArea(b, r, c, b[r][c].special)) {
      if (toRemove.has(hit)) continue;
      toRemove.add(hit);
      if (specialAt(b, hit)) queue.push(hit);
    }
  }
  // Flowers cleared by a blast (rather than matched) score points too
  score += [...toRemove].filter(key => !matched.has(key)).length * BLAST_POINTS;

  // Damage adjacent blockers
  [...toRemove].forEach(key => {
    const [r, c] = key.split(',').map(Number);
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && nb[nr][nc].isBlocker) {
        nb[nr][nc] = mkCell(-1);
        blockersRemoved++;
      }
    });
  });

  // Promote long matches to special tiles (before removal)
  const hSet = new Set(), vSet = new Set();
  groups.forEach(g => g.cells.forEach(({ r, c }) => (g.dir === 'h' ? hSet : vSet).add(`${r},${c}`)));

  groups.forEach(g => {
    const mid = g.cells[Math.floor(g.len / 2)];
    const key = `${mid.r},${mid.c}`;
    const origType = b[mid.r][mid.c].type;
    if (g.len >= 5 && toRemove.has(key)) {
      nb[mid.r][mid.c] = mkCell(origType, 'cross'); toRemove.delete(key);
    } else if (g.len === 4 && toRemove.has(key)) {
      nb[mid.r][mid.c] = mkCell(origType, 'row'); toRemove.delete(key);
    }
  });

  // L/T intersections → area special
  [...hSet].filter(k => vSet.has(k) && toRemove.has(k)).forEach(key => {
    const [r, c] = key.split(',').map(Number);
    nb[r][c] = mkCell(b[r][c].type, 'area');
    toRemove.delete(key);
  });

  // Count collected then remove
  toRemove.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (targetType >= 0 && b[r][c].type === targetType) collected++;
    nb[r][c] = mkCell(-1);
  });

  return { board: nb, score, collected, blockersRemoved };
}

export function applyGravity(b) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!nb[r][c].isBlocker && nb[r][c].type >= 0) col.push(nb[r][c]);
    }
    let ci = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (nb[r][c].isBlocker) continue;
      nb[r][c] = ci < col.length ? col[ci++] : mkCell(-1);
    }
  }
  return nb;
}

const fillBoard = b =>
  b.map(row => row.map(cl => (!cl.isBlocker && cl.type < 0 ? mkCell(rnd()) : cl)));

/** Resolve every match. `steps` holds the board after each stage (matches
 *  cleared, then tiles dropped and refilled, repeated) so it can be animated. */
export function fullCascade(b, targetType = -1) {
  let cur = b, totalScore = 0, totalCollected = 0, totalBlockers = 0;
  const steps = [];
  let groups = getMatchGroups(cur);
  while (groups.length > 0) {
    const res = processMatches(cur, groups, targetType);
    totalScore    += res.score;
    totalCollected += res.collected;
    totalBlockers  += res.blockersRemoved;
    steps.push(res.board);
    cur = fillBoard(applyGravity(res.board));
    steps.push(cur);
    groups = getMatchGroups(cur);
  }
  return { board: cur, steps, totalScore, totalCollected, totalBlockers };
}

export function trySwapBoard(b, r1, c1, r2, c2) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  [nb[r1][c1], nb[r2][c2]] = [nb[r2][c2], nb[r1][c1]];
  return nb;
}

/** True if at least one adjacent swap would create a match. */
export function hasValidMove(b) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c].isBlocker) continue;
    for (const [r2, c2] of [[r, c + 1], [r + 1, c]]) {
      if (r2 >= ROWS || c2 >= COLS || b[r2][c2].isBlocker) continue;
      if (getMatchGroups(trySwapBoard(b, r, c, r2, c2)).length > 0) return true;
    }
  }
  return false;
}

/** Rearrange the existing tiles (blockers stay put) into a layout with no
 *  ready-made matches and at least one valid move. */
export function reshuffleBoard(b) {
  const spots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!b[r][c].isBlocker) spots.push([r, c]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const tiles = spots.map(([r, c]) => b[r][c]);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const nb = b.map(row => row.map(cl => ({ ...cl })));
    spots.forEach(([r, c], i) => { nb[r][c] = tiles[i]; });
    if (getMatchGroups(nb).length === 0 && hasValidMove(nb)) return nb;
  }
  // Extremely unlikely: fall back to fresh random flowers
  const nb = b.map(row => row.map(cl => (cl.isBlocker ? cl : mkCell(rnd()))));
  return getMatchGroups(nb).length === 0 && hasValidMove(nb) ? nb : reshuffleBoard(nb);
}

// ── Progress ──────────────────────────────────────────────────────────────────
// Like the levels on a map: you can play any level up to the furthest one
// you've reached. Kept on this device, and also worked out from the scores saved
// on the server after each win, so it follows you to another device.
const progressKey = user => `match3:progress:${user?.id ?? 'guest'}`;

/** Clamp to a real level number (1 … LEVELS.length + 1, where the +1 means all done). */
const clampLevel = n => Math.min(LEVELS.length + 1, Math.max(1, Math.floor(Number(n)) || 1));

/** The furthest level this player has reached on this device (1 if none). */
export function loadReached(user) {
  try { return clampLevel(JSON.parse(localStorage.getItem(progressKey(user)))?.reached); } catch { return 1; }
}

export function saveReached(user, reached) {
  try { localStorage.setItem(progressKey(user), JSON.stringify({ reached: clampLevel(reached) })); } catch { /* private mode */ }
}

/** The level after the highest one won, from the player's saved match3 scores
 *  (each win is saved with metadata.level). Metadata can arrive as text. */
export function reachedFromScores(rows) {
  let best = 0;
  for (const row of rows ?? []) {
    let meta = row?.metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
    const lv = Number(meta?.level);
    if (Number.isInteger(lv) && lv > best) best = lv;
  }
  return clampLevel(best + 1);
}
