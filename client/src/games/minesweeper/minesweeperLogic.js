/**
 * Minesweeper board logic (pure functions, no React).
 * A board is rows × cols cells: { mine, revealed, flagged, count, exploded, wrongFlag }.
 */

export function emptyBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false, revealed: false, flagged: false,
      count: 0, exploded: false, wrongFlag: false,
    }))
  );
}

export function placeMines(rows, cols, mineCount, safeR, safeC) {
  const board = emptyBoard(rows, cols);

  // Guarantee a 3×3 safe zone around the first tap
  const safe = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr, nc = safeC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safe.add(`${nr},${nc}`);
    }
  }

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!board[r][c].mine && !safe.has(`${r},${c}`)) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Compute neighbour counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].count = count;
    }
  }
  return board;
}

// BFS flood-reveal: reveals the tapped cell and cascades through zero-count cells
export function floodReveal(board, rows, cols, startR, startC) {
  const next = board.map(row => row.map(cell => ({ ...cell })));
  const queue = [[startR, startC]];
  const visited = new Set([`${startR},${startC}`]);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    next[r][c].revealed = true;

    if (next[r][c].count === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          const key = `${nr},${nc}`;
          if (
            nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
            !visited.has(key) && !next[nr][nc].flagged && !next[nr][nc].revealed
          ) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
  return next;
}

/**
 * Chord: tapping a revealed number.
 * - Flags around it match the number → reveal every other covered neighbour
 *   ({ board }), or { explode: [r, c] } if one of those is a mine (a wrong flag).
 * - Otherwise → { hint: [[r, c], …] }, the covered unflagged neighbours, so the
 *   game can highlight the squares the number is counting.
 * Returns null when there's nothing to do (a blank cell, or no covered neighbours).
 */
export function chordReveal(board, rows, cols, r, c) {
  const cell = board[r][c];
  if (!cell.revealed || cell.count === 0) return null;

  let flagCount = 0;
  const unflagged = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (board[nr][nc].flagged) flagCount++;
      else if (!board[nr][nc].revealed) unflagged.push([nr, nc]);
    }
  }

  if (unflagged.length === 0) return null;
  if (flagCount !== cell.count) return { hint: unflagged };

  // Check whether any unflagged neighbour is a mine
  const explodeCell = unflagged.find(([nr, nc]) => board[nr][nc].mine);
  if (explodeCell) return { explode: explodeCell };

  // Safe to reveal all unflagged neighbours
  let next = board;
  for (const [nr, nc] of unflagged) {
    next = floodReveal(next, rows, cols, nr, nc);
  }
  return { board: next };
}

export function revealAllMines(board, explodeR, explodeC) {
  return board.map((row, r) =>
    row.map((cell, c) => {
      if (cell.mine) return { ...cell, revealed: true, exploded: r === explodeR && c === explodeC };
      if (cell.flagged) return { ...cell, revealed: true, wrongFlag: true };
      return cell;
    })
  );
}

export function countRevealed(board) {
  return board.reduce((sum, row) => sum + row.filter(c => c.revealed).length, 0);
}
