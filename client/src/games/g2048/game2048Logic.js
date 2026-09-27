/**
 * 2048 as pure functions. Slide the tiles on a 4×4 board; two tiles with the
 * same number that meet merge into one (each tile merges at most once per
 * move), and a new 2 (or sometimes a 4) appears after every move that changes
 * the board. Reach 2048 to win, then keep going if you like; the game is over
 * when no move is possible.
 *
 * Tiles keep their ids as they slide, so the screen can animate them:
 *   { id, value, row, col }                a tile
 *   { ..., merged: true }                  made by a merge on the last move
 *   { ..., isNew: true }                   appeared after the last move
 *   { ..., gone: true }                    merged away on the last move — shown
 *                                          sliding under the new tile, then dropped
 * `rng` returns a number in [0, 1) so tests can choose where tiles appear.
 */
export const SIZE = 4;
export const WIN_VALUE = 2048;
export const UNDOS = 1;

/** Slide one line of numbers (0 = empty) toward its start, merging equal neighbours once. */
export function slideLine(values) {
  const nums = values.filter(v => v);
  const line = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === nums[i + 1]) {
      line.push(nums[i] * 2);
      gained += nums[i] * 2;
      i++;
    } else line.push(nums[i]);
  }
  while (line.length < values.length) line.push(0);
  return { line, gained };
}

// Each line of cells in the order its tiles slide: line[0] is the edge they slide toward
function linesFor(dir) {
  const idx = [...Array(SIZE).keys()];
  const last = SIZE - 1;
  const cell = {
    left: (i, j) => [i, j],
    right: (i, j) => [i, last - j],
    up: (i, j) => [j, i],
    down: (i, j) => [last - j, i],
  }[dir];
  if (!cell) throw new Error(`Unknown direction: ${dir}`);
  return idx.map(i => idx.map(j => cell(i, j)));
}

const liveTiles = tiles => tiles.filter(t => !t.gone);

/** The board as rows of numbers (0 = empty), for tests and checks. */
export function toGrid(tiles) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of liveTiles(tiles)) grid[t.row][t.col] = t.value;
  return grid;
}

/** Can any move change the board? */
export function canMove(tiles) {
  const grid = toGrid(tiles);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (!v || v === grid[r][c + 1] || v === grid[r + 1]?.[c]) return true;
    }
  }
  return false;
}

// Put a 2 (90%) or a 4 (10%) in a random empty cell
function spawn(tiles, nextId, rng) {
  const grid = toGrid(tiles);
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return { tiles, nextId };
  const [row, col] = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  return { tiles: [...tiles, { id: nextId, value, row, col, isNew: true }], nextId: nextId + 1 };
}

export function newGame(rng = Math.random) {
  let s = { tiles: [], nextId: 1 };
  s = spawn(s.tiles, s.nextId, rng);
  s = spawn(s.tiles, s.nextId, rng);
  return {
    tiles: s.tiles, nextId: s.nextId, score: 0, moves: 0,
    won: false,          // a 2048 tile has been made
    keepGoing: false,    // chose to carry on after winning
    over: false,         // no moves left
    undosLeft: UNDOS,
  };
}

/** Slide every tile toward `dir` ('left' | 'right' | 'up' | 'down'). Returns the same state if nothing moves. */
export function move(state, dir, rng = Math.random) {
  if (state.over) return state;
  const at = new Map(liveTiles(state.tiles).map(t => [`${t.row},${t.col}`, t]));
  let tiles = [];
  let nextId = state.nextId;
  let gained = 0, moved = false, reached = false;

  for (const line of linesFor(dir)) {
    const inLine = line.map(([r, c]) => at.get(`${r},${c}`)).filter(Boolean);
    let target = 0;
    for (let i = 0; i < inLine.length; i++, target++) {
      const [row, col] = line[target];
      const a = inLine[i], b = inLine[i + 1];
      if (b && a.value === b.value) {
        const value = a.value * 2;
        tiles.push(
          { id: a.id, value: a.value, row, col, gone: true },
          { id: b.id, value: b.value, row, col, gone: true },
          { id: nextId++, value, row, col, merged: true },
        );
        gained += value;
        moved = true;
        if (value >= WIN_VALUE) reached = true;
        i++;
      } else {
        if (a.row !== row || a.col !== col) moved = true;
        tiles.push({ id: a.id, value: a.value, row, col });
      }
    }
  }
  if (!moved) return state;

  ({ tiles, nextId } = spawn(tiles, nextId, rng));
  return {
    ...state,
    tiles, nextId,
    score: state.score + gained,
    moves: state.moves + 1,
    won: state.won || reached,
    over: !canMove(tiles),
  };
}

/** Carry on playing after making 2048. */
export const keepGoing = state => ({ ...state, keepGoing: true });

/** The biggest tile on the board. */
export const biggestTile = state => Math.max(0, ...liveTiles(state.tiles).map(t => t.value));
