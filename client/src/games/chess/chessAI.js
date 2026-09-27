/**
 * The chess computer: alpha-beta search over the position, rating what it
 * finds by material and where each piece stands (piece-square tables).
 *
 * easy   – looks one move ahead only, so it grabs pieces without seeing the
 *          recapture, and now and then plays a random move — beatable by a
 *          beginner
 * medium – looks two moves ahead and follows captures to the end
 * hard   – searches as deep as its budget allows (usually 4–5 moves), follows
 *          captures to the end, and knows kings belong in the middle in an
 *          endgame
 *
 * Every search has a node budget rather than a time limit, so it takes about
 * the same effort on any device, and tests give the same answers every run.
 */
import { P, N, B, R, Q, K, legalMoves, pseudoMoves, make, unmake, inCheck, typeOf, colourOf, row, col, copyPosition } from './chessRules.js';

export const VALUE = { [P]: 100, [N]: 320, [B]: 330, [R]: 500, [Q]: 900, [K]: 0 };
const MATE = 100000;

// Piece-square tables, from White's side of the board (index 0 = a8); Black reads them mirrored
const PST = {
  [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

const mirror = i => (7 - row(i)) * 8 + col(i);

/** The position's value for the side to move (positive = good for them), in hundredths of a pawn. */
export function evaluate(pos) {
  const { sq } = pos;
  let heavy = 0;                                           // non-pawn material, to tell when it's an endgame
  for (let i = 0; i < 64; i++) { const t = typeOf(sq[i]); if (t && t !== P && t !== K) heavy += VALUE[t]; }
  const endgame = heavy <= 2600;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = sq[i];
    if (!p) continue;
    const t = typeOf(p), white = p > 0;
    const idx = white ? i : mirror(i);
    const table = t === K && endgame ? KING_END : PST[t];
    const v = VALUE[t] + table[idx];
    score += white ? v : -v;
  }
  return score * pos.turn;
}

// Captures of valuable pieces by cheap ones first, then promotions: the best moves are
// usually among them, and trying good moves first lets alpha-beta skip far more
const victimFirst = m => (m.captured ? 10 * VALUE[typeOf(m.captured)] - VALUE[typeOf(m.piece)] + 10000 : 0) + (m.promo ? VALUE[m.promo] : 0);
const ordered = moves => moves.sort((a, b) => victimFirst(b) - victimFirst(a));

// Follow captures until the position is quiet, so a search never stops halfway through an exchange
function quiesce(pos, alpha, beta, budget, qdepth) {
  if (--budget.nodes < 0) return null;
  const stand = evaluate(pos);
  if (stand >= beta || qdepth <= 0) return stand;
  if (stand > alpha) alpha = stand;
  const mover = pos.turn;
  for (const m of ordered(pseudoMoves(pos, true))) {
    const undo = make(pos, m);
    if (inCheck(pos, mover)) { unmake(pos, m, undo); continue; }
    const v = quiesce(pos, -beta, -alpha, budget, qdepth - 1);
    unmake(pos, m, undo);
    if (v === null) return null;
    if (-v >= beta) return -v;
    if (-v > alpha) alpha = -v;
  }
  return alpha;
}

function search(pos, depth, alpha, beta, ply, budget, quiet) {
  if (--budget.nodes < 0) return null;
  if (pos.half >= 100) return 0;
  if (depth <= 0) {
    // Checkmate still has to be spotted at the end of a line (only possible when in check)
    if (inCheck(pos) && !legalMoves(pos).length) return -MATE + ply;
    return quiet ? quiesce(pos, alpha, beta, budget, 8) : evaluate(pos);
  }
  const mover = pos.turn;
  let best = -Infinity, legal = 0;
  // Each move is checked for leaving our king in check as it's tried (not all up front):
  // most branches are cut off before their later moves are ever looked at
  for (const m of ordered(pseudoMoves(pos))) {
    const undo = make(pos, m);
    if (inCheck(pos, mover)) { unmake(pos, m, undo); continue; }
    legal++;
    const v = search(pos, depth - 1, -beta, -alpha, ply + 1, budget, quiet);
    unmake(pos, m, undo);
    if (v === null) return null;
    if (-v > best) best = -v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (!legal) return inCheck(pos) ? -MATE + ply : 0;
  return best;
}

export const LEVELS = {
  easy: { depth: 1, nodes: 5000, quiet: false, random: 0.25, spread: 60 },
  medium: { depth: 2, nodes: 40000, quiet: true, random: 0, spread: 15 },
  hard: { depth: 6, nodes: 80000, quiet: true, random: 0, spread: 5 },
};

/**
 * Score every legal move for the side to move, searching deeper while the
 * budget lasts. Returns [{ move, score, exact }], best first: scores are exact
 * for moves within `spread` of the best; the rest are only known to be worse.
 */
export function rankMoves(position, level = 'medium', spread = (LEVELS[level] ?? LEVELS.medium).spread) {
  const cfg = LEVELS[level] ?? LEVELS.medium;
  const pos = copyPosition(position);
  const moves = ordered(legalMoves(pos));
  let ranked = moves.map(move => ({ move, score: 0, exact: true }));
  const budget = { nodes: cfg.nodes };
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const scored = [];
    let alpha = -Infinity;
    for (const { move } of ranked) {
      const undo = make(pos, move);
      // Searched with a window reaching `spread` below the best so far: every move that
      // close to the best gets an exact score; anything worse just shows it's worse
      const floor = alpha - spread;
      const v = search(pos, depth - 1, -Infinity, -floor + 1, 1, budget, cfg.quiet);
      unmake(pos, move, undo);
      if (v === null) break;
      scored.push({ move, score: -v });
      if (-v > alpha) alpha = -v;
    }
    if (scored.length < ranked.length) break;               // ran out of budget part-way: keep the last full ranking
    const top = Math.max(...scored.map(s => s.score));
    ranked = scored.map(s => ({ ...s, exact: s.score >= top - spread })).sort((a, b) => b.score - a.score);
    if (Math.abs(top) > MATE / 2) break;                     // found a forced mate (or can't avoid one)
  }
  return ranked;
}

/** The computer's move. Picks among moves within a few points of the best, so games vary. */
export function chooseMove(pos, level = 'medium', random = Math.random) {
  const cfg = LEVELS[level] ?? LEVELS.medium;
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  if (random() < cfg.random) return moves[Math.floor(random() * moves.length)];
  const ranked = rankMoves(pos, level);
  const good = ranked.filter(r => r.exact && r.score >= ranked[0].score - cfg.spread);
  return good[Math.floor(random() * good.length)].move;
}

export const isMateScore = score => Math.abs(score) > MATE / 2;
export { colourOf };
