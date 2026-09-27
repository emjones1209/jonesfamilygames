/**
 * Checkers (American rules) as pure functions: moves, and the computer player.
 *
 * An 8×8 board, played on the dark squares ((row + col) odd). board[row][col]
 * is null or a piece { id, seat, king }. Seat 0 starts on rows 5-7 and moves
 * up the board (towards row 0); seat 1 starts on rows 0-2 and moves down.
 *
 * - Men move one square diagonally forward; kings forward or back.
 * - Jumping is compulsory: if any of your pieces can capture, you must — and
 *   keep jumping with the same piece while it can. (Any capturing move will
 *   do; it needn't be the longest.)
 * - A man reaching the far row becomes a king, and that ends the move.
 * - You lose when it's your turn and you have no pieces or no legal move.
 *
 * A move is { path: [[row, col], ...], captures: [[row, col], ...] }.
 */
export const SIZE = 8;

const forward = seat => (seat === 0 ? -1 : 1);
const kingRow = seat => (seat === 0 ? 0 : SIZE - 1);
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
export const isDark = (r, c) => (r + c) % 2 === 1;
export const other = seat => 1 - seat;

export function startBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) continue;
      if (r <= 2) board[r][c] = { id: `b${n++}`, seat: 1, king: false };
      else if (r >= 5) board[r][c] = { id: `a${n++}`, seat: 0, king: false };
    }
  }
  return board;
}

const dirsFor = piece => (piece.king ? [-1, 1] : [forward(piece.seat)]).flatMap(dr => [[dr, -1], [dr, 1]]);

function jumpsFrom(board, piece, path, captured, out) {
  const [r, c] = path[path.length - 1];
  let extended = false;
  // A man that has just been crowned stops (the move ends when it reaches the far row)
  const crowned = !piece.king && r === kingRow(piece.seat) && path.length > 1;
  if (!crowned) {
    for (const [dr, dc] of dirsFor(piece)) {
      const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
      if (!inside(lr, lc)) continue;
      const mid = board[mr][mc];
      if (!mid || mid.seat === piece.seat || captured.some(([x, y]) => x === mr && y === mc)) continue;
      const [sr, sc] = path[0];
      if (board[lr][lc] && !(lr === sr && lc === sc)) continue;       // (the jumping piece's own square is free)
      extended = true;
      jumpsFrom(board, piece, [...path, [lr, lc]], [...captured, [mr, mc]], out);
    }
  }
  if (!extended && captured.length) out.push({ path, captures: captured });
}

/** Every legal move for `seat` (only captures, when there are any). */
export function legalMoves(board, seat) {
  const captures = [], steps = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.seat !== seat) continue;
      jumpsFrom(board, piece, [[r, c]], [], captures);
      for (const [dr, dc] of dirsFor(piece)) {
        const tr = r + dr, tc = c + dc;
        if (inside(tr, tc) && !board[tr][tc]) steps.push({ path: [[r, c], [tr, tc]], captures: [] });
      }
    }
  }
  return captures.length ? captures : steps;
}

/** The board after `move` (a new board; the old one is untouched). */
export function applyMove(board, move) {
  const next = board.map(row => [...row]);
  const [[fr, fc]] = move.path;
  const [tr, tc] = move.path[move.path.length - 1];
  const piece = next[fr][fc];
  next[fr][fc] = null;
  for (const [r, c] of move.captures) next[r][c] = null;
  const crowned = !piece.king && tr === kingRow(piece.seat);
  next[tr][tc] = crowned ? { ...piece, king: true } : piece;
  return next;
}

export const sameMove = (a, b) => a.path.length === b.path.length && a.path.every(([r, c], i) => r === b.path[i][0] && c === b.path[i][1]);
export const crowns = (board, move) => {
  const [[fr, fc]] = move.path;
  const [tr] = move.path[move.path.length - 1];
  return !board[fr][fc].king && tr === kingRow(board[fr][fc].seat);
};

export function countPieces(board) {
  const n = [{ men: 0, kings: 0 }, { men: 0, kings: 0 }];
  for (const row of board) for (const p of row) if (p) n[p.seat][p.king ? 'kings' : 'men']++;
  return n;
}

/** Squares of `seat`'s pieces the opponent could capture right now (if it were their turn). */
export function threatened(board, seat) {
  const moves = legalMoves(board, other(seat)).filter(m => m.captures.length);
  const hit = new Set(moves.flatMap(m => m.captures.map(([r, c]) => `${r},${c}`)));
  return [...hit].map(k => k.split(',').map(Number));
}

// ── Computer player ──────────────────────────────────────────────────────────
const MAN = 100, KING = 160, WIN = 100000;

/** How good the position is for `seat` (positive = better for them). */
export function evaluate(board, seat, level = 'hard') {
  let score = 0;
  const count = countPieces(board);
  const total = count[0].men + count[0].kings + count[1].men + count[1].kings;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p) continue;
      let v = p.king ? KING : MAN;
      if (level === 'hard') {
        const advance = p.seat === 0 ? SIZE - 1 - r : r;
        if (!p.king) {
          v += advance * 4;                                             // pushing towards a crown
          if (advance === 0 && total > 16) v += 12;                      // back row guards against enemy kings early on
        } else {
          v += 8 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 2;          // kings are strongest in the middle
        }
        if (c === 0 || c === SIZE - 1) v -= 4;                           // edge men have fewer moves
        if (r >= 2 && r <= 5 && c >= 2 && c <= 5) v += 5;                // the centre
      }
      score += p.seat === seat ? v : -v;
    }
  }
  // Ahead on pieces? Trade down (the same lead counts for more with fewer pieces left)
  if (level === 'hard') {
    const mine = count[seat].men + count[seat].kings, theirs = count[other(seat)].men + count[other(seat)].kings;
    if (mine !== theirs) score += Math.sign(mine - theirs) * (24 - total) * 3;
  }
  return score;
}

/**
 * Negamax search with alpha-beta pruning. Stops (returning null) once
 * `budget.nodes` runs out, so a search always takes about the same effort.
 */
function search(board, seat, depth, alpha, beta, level, budget, ply) {
  if (--budget.nodes < 0) return null;
  const moves = legalMoves(board, seat);
  if (!moves.length) return -WIN + ply;                                 // no move: lost (sooner is worse)
  // Captures are forced, so keep looking while they go on (no stopping mid-exchange)
  if (depth <= 0 && !moves[0].captures.length) return evaluate(board, seat, level);
  if (depth <= -6) return evaluate(board, seat, level);
  let best = -Infinity;
  for (const m of order(moves)) {
    const v = search(applyMove(board, m), other(seat), depth - 1, -beta, -alpha, level, budget, ply + 1);
    if (v === null) return null;
    if (-v > best) best = -v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Longer captures first: they're usually best, which makes pruning work well
const order = moves => [...moves].sort((a, b) => b.captures.length - a.captures.length);

const LEVELS = {
  easy: { depth: 2, nodes: 2000, blunder: 0.3 },
  medium: { depth: 4, nodes: 20000, blunder: 0 },
  hard: { depth: 20, nodes: 25000, blunder: 0 },      // deepens until the budget (shared by every depth) runs out
};

/**
 * The computer's move, with its score. Easy looks 2 moves ahead and sometimes
 * plays at random; Medium 4; Hard searches as deep as its budget allows
 * (usually 7–10 moves) with a better sense of position.
 */
export function chooseMove(board, seat, level = 'medium', random = Math.random) {
  const moves = legalMoves(board, seat);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const { depth: maxDepth, nodes, blunder } = LEVELS[level] ?? LEVELS.medium;
  if (random() < blunder) return moves[Math.floor(random() * moves.length)];
  const evalLevel = level === 'hard' ? 'hard' : 'simple';
  const budget = { nodes };                                             // shared by every depth
  let best = moves;                                                     // best moves from the last finished depth
  let ranked = order(moves);                                            // each depth tries the last one's best first
  for (let depth = 1; depth <= maxDepth; depth++) {
    const scored = [];
    let alpha = -Infinity;
    for (const m of ranked) {
      const v = search(applyMove(board, m), other(seat), depth - 1, -Infinity, -alpha + 1, evalLevel, budget, 1);
      if (v === null) break;
      scored.push({ m, v: -v });
      if (-v > alpha) alpha = -v;
    }
    if (scored.length < moves.length) break;                          // ran out part-way: keep the last full answer
    const top = Math.max(...scored.map(s => s.v));
    best = scored.filter(s => s.v === top).map(s => s.m);
    ranked = [...scored].sort((a, b) => b.v - a.v).map(s => s.m);
    if (Math.abs(top) > WIN / 2) break;                                // found a forced win (or loss)
  }
  return best[Math.floor(random() * best.length)];
}

/**
 * Why a move is good, in plain words (for the Suggest button): capturing,
 * crowning, getting a piece out of danger, not leaving one to be taken.
 */
export function explainMove(board, seat, move) {
  const reasons = [];
  const n = move.captures.length;
  if (n) reasons.push(n === 1 ? 'Jumps and captures a piece.' : `A ${n === 2 ? 'double' : n === 3 ? 'triple' : `${n}-piece`} jump — captures ${n} pieces!`);
  if (crowns(board, move)) reasons.push('Reaches the far side and becomes a king 👑 (kings can move backwards too).');
  const after = applyMove(board, move);
  const [[fr, fc]] = move.path;
  const wasInDanger = threatened(board, seat).some(([r, c]) => r === fr && c === fc);
  const nowInDanger = threatened(after, seat);
  if (wasInDanger && !nowInDanger.length) reasons.push('Moves a piece that could have been captured out of danger.');
  if (!nowInDanger.length && !n) reasons.push('Safe: none of your pieces can be captured after it.');
  if (nowInDanger.length) reasons.push('Your opponent can capture after this — but every other move is worse.');
  const theirMoves = legalMoves(after, other(seat));
  if (!theirMoves.length) reasons.push('Your opponent has no moves left — you win!');
  return reasons.length ? reasons : ['A steady move that keeps your pieces together.'];
}
