/**
 * Chess rules as pure functions: the position, legal moves, check, checkmate,
 * the drawing rules, and move names (SAN, like "Nf3" or "exd5").
 *
 * A position is plain data, so it can be sent to other players:
 *   { sq: [64 numbers], turn: 1 | -1, castle: bits, ep: square | -1, half, full }
 * Squares are numbered 0-63 from a8 (0) along each rank to h1 (63): row 0 is
 * rank 8 and row 7 is rank 1, so White starts at the bottom. A piece is
 * +type for White and −type for Black, with types P=1 N=2 B=3 R=4 Q=5 K=6.
 *
 * The search code (chessAI.js) moves pieces with make/unmake, which change
 * the position in place (and put it back) — far faster than copying it.
 */
export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export const WHITE = 1, BLACK = -1;
export const WK = 1, WQ = 2, BK = 4, BQ = 8;          // castling rights
export const NAMES = { [P]: 'pawn', [N]: 'knight', [B]: 'bishop', [R]: 'rook', [Q]: 'queen', [K]: 'king' };
const LETTERS = { [N]: 'N', [B]: 'B', [R]: 'R', [Q]: 'Q', [K]: 'K' };

export const row = i => i >> 3;
export const col = i => i & 7;
export const at = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const squareName = i => `${'abcdefgh'[col(i)]}${8 - row(i)}`;
export const squareIndex = name => at(8 - Number(name[1]), 'abcdefgh'.indexOf(name[0]));
export const colourOf = p => Math.sign(p);
export const typeOf = p => Math.abs(p);

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const AROUND = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ── FEN ──────────────────────────────────────────────────────────────────────
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_TYPES = { p: P, n: N, b: B, r: R, q: Q, k: K };

export function fromFen(fen) {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const sq = Array(64).fill(0);
  placement.split('/').forEach((rank, r) => {
    let c = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) c += Number(ch);
      else { sq[at(r, c)] = FEN_TYPES[ch.toLowerCase()] * (ch === ch.toUpperCase() ? 1 : -1); c++; }
    }
  });
  let castle = 0;
  if (castling.includes('K')) castle |= WK;
  if (castling.includes('Q')) castle |= WQ;
  if (castling.includes('k')) castle |= BK;
  if (castling.includes('q')) castle |= BQ;
  return { sq, turn: turn === 'w' ? WHITE : BLACK, castle, ep: ep === '-' ? -1 : squareIndex(ep), half: Number(half), full: Number(full) };
}

export function toFen(pos) {
  const ranks = [];
  for (let r = 0; r < 8; r++) {
    let s = '', empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = pos.sq[at(r, c)];
      if (!p) { empty++; continue; }
      if (empty) { s += empty; empty = 0; }
      const letter = 'pnbrqk'[typeOf(p) - 1];
      s += p > 0 ? letter.toUpperCase() : letter;
    }
    ranks.push(empty ? s + empty : s);
  }
  const c = pos.castle;
  const castling = `${c & WK ? 'K' : ''}${c & WQ ? 'Q' : ''}${c & BK ? 'k' : ''}${c & BQ ? 'q' : ''}` || '-';
  return `${ranks.join('/')} ${pos.turn === WHITE ? 'w' : 'b'} ${castling} ${pos.ep < 0 ? '-' : squareName(pos.ep)} ${pos.half} ${pos.full}`;
}

export const copyPosition = pos => ({ ...pos, sq: [...pos.sq] });
/** Everything that makes positions "the same" for the repetition rule. */
export const positionKey = pos => `${pos.sq.join(',')}|${pos.turn}|${pos.castle}|${pos.ep}`;

// ── Attacks ──────────────────────────────────────────────────────────────────
/** Squares of `by`'s pieces that attack square i. */
export function attackersOf(sq, i, by) {
  const out = [];
  const r = row(i), c = col(i);
  // Pawns: a White pawn attacks up the board, so it sits one row below the square it attacks
  const pr = r + (by === WHITE ? 1 : -1);
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && sq[at(pr, c + dc)] === P * by) out.push(at(pr, c + dc));
  for (const [dr, dc] of KNIGHT) if (inside(r + dr, c + dc) && sq[at(r + dr, c + dc)] === N * by) out.push(at(r + dr, c + dc));
  for (const [dr, dc] of AROUND) if (inside(r + dr, c + dc) && sq[at(r + dr, c + dc)] === K * by) out.push(at(r + dr, c + dc));
  const slide = (dirs, types) => {
    for (const [dr, dc] of dirs) {
      for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) {
        const p = sq[at(rr, cc)];
        if (!p) continue;
        if (colourOf(p) === by && types.includes(typeOf(p))) out.push(at(rr, cc));
        break;
      }
    }
  };
  slide(DIAG, [B, Q]);
  slide(ORTHO, [R, Q]);
  return out;
}

export function isAttacked(sq, i, by) {
  const r = row(i), c = col(i);
  const pr = r + (by === WHITE ? 1 : -1);
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && sq[at(pr, c + dc)] === P * by) return true;
  for (const [dr, dc] of KNIGHT) if (inside(r + dr, c + dc) && sq[at(r + dr, c + dc)] === N * by) return true;
  for (const [dr, dc] of AROUND) if (inside(r + dr, c + dc) && sq[at(r + dr, c + dc)] === K * by) return true;
  for (const [dirs, t1] of [[DIAG, B], [ORTHO, R]]) {
    for (const [dr, dc] of dirs) {
      for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) {
        const p = sq[at(rr, cc)];
        if (!p) continue;
        if (p === t1 * by || p === Q * by) return true;
        break;
      }
    }
  }
  return false;
}

export const kingSquare = (sq, colour) => sq.indexOf(K * colour);
/** Is `colour`'s king attacked? (Lesson positions may have no king: then never.) */
export function inCheck(pos, colour = pos.turn) {
  const k = kingSquare(pos.sq, colour);
  return k >= 0 && isAttacked(pos.sq, k, -colour);
}

// ── Moves ────────────────────────────────────────────────────────────────────
// A move: { from, to, piece, captured, promo (a type, or 0), flag: null | 'double' | 'ep' | 'castle' }
const move = (from, to, piece, captured, promo = 0, flag = null) => ({ from, to, piece, captured, promo, flag });

/** Moves that follow the pieces' rules, before checking whether they leave your own king in check. */
export function pseudoMoves(pos, capturesOnly = false) {
  const { sq, turn: t } = pos;
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = sq[i];
    if (!p || colourOf(p) !== t) continue;
    const r = row(i), c = col(i), type = typeOf(p);
    if (type === P) {
      const dir = t === WHITE ? -1 : 1, start = t === WHITE ? 6 : 1, last = t === WHITE ? 0 : 7;
      const addPawn = (to, captured, flag = null) => {
        if (row(to) === last) for (const promo of [Q, R, B, N]) out.push(move(i, to, p, captured, promo, flag));
        else out.push(move(i, to, p, captured, 0, flag));
      };
      const r1 = r + dir;
      if (inside(r1, c) && !sq[at(r1, c)] && (!capturesOnly || r1 === last)) {
        addPawn(at(r1, c), 0);
        if (!capturesOnly && r === start && !sq[at(r + 2 * dir, c)]) out.push(move(i, at(r + 2 * dir, c), p, 0, 0, 'double'));
      }
      for (const dc of [-1, 1]) {
        if (!inside(r1, c + dc)) continue;
        const to = at(r1, c + dc), target = sq[to];
        if (target && colourOf(target) === -t) addPawn(to, target);
        else if (to === pos.ep) out.push(move(i, to, p, -t * P, 0, 'ep'));
      }
    } else if (type === N || type === K) {
      for (const [dr, dc] of type === N ? KNIGHT : AROUND) {
        if (!inside(r + dr, c + dc)) continue;
        const to = at(r + dr, c + dc), target = sq[to];
        if (target ? colourOf(target) === -t : !capturesOnly) out.push(move(i, to, p, target));
      }
      if (type === K && !capturesOnly) castles(pos, i, out);
    } else {
      const dirs = type === B ? DIAG : type === R ? ORTHO : [...DIAG, ...ORTHO];
      for (const [dr, dc] of dirs) {
        for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) {
          const to = at(rr, cc), target = sq[to];
          if (target) { if (colourOf(target) === -t) out.push(move(i, to, p, target)); break; }
          if (!capturesOnly) out.push(move(i, to, p, 0));
        }
      }
    }
  }
  return out;
}

// Castling: king and rook unmoved, the squares between empty, and the king not in,
// passing through, or landing on an attacked square
function castles(pos, from, out) {
  const { sq, turn: t, castle } = pos;
  const home = t === WHITE ? 60 : 4;
  if (from !== home) return;
  const [kSide, qSide] = t === WHITE ? [WK, WQ] : [BK, BQ];
  const clear = squares => squares.every(s => !sq[s]);
  const safe = squares => squares.every(s => !isAttacked(sq, s, -t));
  if (castle & kSide && sq[home + 3] === R * t && clear([home + 1, home + 2]) && safe([home, home + 1, home + 2])) {
    out.push(move(home, home + 2, K * t, 0, 0, 'castle'));
  }
  if (castle & qSide && sq[home - 4] === R * t && clear([home - 1, home - 2, home - 3]) && safe([home, home - 1, home - 2])) {
    out.push(move(home, home - 2, K * t, 0, 0, 'castle'));
  }
}

// Which castling rights a move through each corner (or the king's square) loses
const RIGHTS_LOST = { 0: BQ, 7: BK, 56: WQ, 63: WK, 4: BK | BQ, 60: WK | WQ };

/** Play a move on the position in place. Returns what unmake needs to put it back. */
export function make(pos, m) {
  const { sq } = pos, t = pos.turn;
  const undo = { castle: pos.castle, ep: pos.ep, half: pos.half, full: pos.full };
  sq[m.from] = 0;
  if (m.flag === 'ep') sq[m.to + (t === WHITE ? 8 : -8)] = 0;
  sq[m.to] = m.promo ? m.promo * t : m.piece;
  if (m.flag === 'castle') {
    const kingSide = m.to > m.from;
    const rookFrom = kingSide ? m.from + 3 : m.from - 4, rookTo = kingSide ? m.from + 1 : m.from - 1;
    sq[rookTo] = sq[rookFrom];
    sq[rookFrom] = 0;
  }
  pos.castle &= ~((RIGHTS_LOST[m.from] ?? 0) | (RIGHTS_LOST[m.to] ?? 0));
  pos.ep = m.flag === 'double' ? (m.from + m.to) / 2 : -1;
  pos.half = typeOf(m.piece) === P || m.captured ? 0 : pos.half + 1;
  if (t === BLACK) pos.full++;
  pos.turn = -t;
  return undo;
}

export function unmake(pos, m, undo) {
  const { sq } = pos;
  pos.turn = -pos.turn;
  const t = pos.turn;
  sq[m.from] = m.piece;
  if (m.flag === 'ep') { sq[m.to] = 0; sq[m.to + (t === WHITE ? 8 : -8)] = m.captured; }
  else sq[m.to] = m.captured;
  if (m.flag === 'castle') {
    const kingSide = m.to > m.from;
    const rookFrom = kingSide ? m.from + 3 : m.from - 4, rookTo = kingSide ? m.from + 1 : m.from - 1;
    sq[rookFrom] = sq[rookTo];
    sq[rookTo] = 0;
  }
  Object.assign(pos, undo);
}

/** Does this move leave the mover's own king safe? */
function legal(pos, m) {
  const mover = pos.turn;
  const undo = make(pos, m);
  const ok = !inCheck(pos, mover);
  unmake(pos, m, undo);
  return ok;
}

export const legalMoves = (pos, capturesOnly = false) => pseudoMoves(pos, capturesOnly).filter(m => legal(pos, m));

/** A new position with the move played (the old one is untouched). */
export function afterMove(pos, m) {
  const next = copyPosition(pos);
  make(next, m);
  return next;
}

export const sameSquares = (m, from, to, promo = 0) => m.from === from && m.to === to && (!m.promo || m.promo === (promo || Q));

// ── The end of the game ──────────────────────────────────────────────────────
/** Neither side can possibly checkmate: kings alone, or with one knight or bishop (or bishops all on one colour). */
export function insufficientMaterial(pos) {
  const others = [];
  for (let i = 0; i < 64; i++) {
    const p = pos.sq[i];
    if (p && typeOf(p) !== K) others.push({ type: typeOf(p), light: (row(i) + col(i)) % 2 === 0 });
  }
  if (others.some(o => o.type === P || o.type === R || o.type === Q)) return false;
  if (others.length <= 1) return true;
  return others.every(o => o.type === B) && others.every(o => o.light === others[0].light);
}

/** 'checkmate' | 'stalemate' | 'fifty' | 'material' | null (repetition is the game's job — it needs the history). */
export function outcome(pos, moves = legalMoves(pos)) {
  if (!moves.length) return inCheck(pos) ? 'checkmate' : 'stalemate';
  if (pos.half >= 100) return 'fifty';
  if (insufficientMaterial(pos)) return 'material';
  return null;
}

// ── Move names ───────────────────────────────────────────────────────────────
/** Standard algebraic notation for a legal move in this position: "Nf3", "exd5", "O-O", "e8=Q+", "Qxf7#". */
export function san(pos, m, moves = legalMoves(pos)) {
  let s;
  if (m.flag === 'castle') s = m.to > m.from ? 'O-O' : 'O-O-O';
  else {
    const type = typeOf(m.piece);
    const to = squareName(m.to);
    if (type === P) {
      s = m.captured ? `${'abcdefgh'[col(m.from)]}x${to}` : to;
      if (m.promo) s += `=${LETTERS[m.promo]}`;
    } else {
      const rivals = moves.filter(o => o.to === m.to && o.from !== m.from && o.piece === m.piece);
      let which = '';
      if (rivals.length) {
        if (!rivals.some(o => col(o.from) === col(m.from))) which = 'abcdefgh'[col(m.from)];
        else if (!rivals.some(o => row(o.from) === row(m.from))) which = String(8 - row(m.from));
        else which = squareName(m.from);
      }
      s = `${LETTERS[type]}${which}${m.captured ? 'x' : ''}${to}`;
    }
  }
  const next = afterMove(pos, m);
  if (inCheck(next)) s += legalMoves(next).length ? '+' : '#';
  return s;
}

/** Count the positions `depth` moves ahead (for testing move generation against known totals). */
export function perft(pos, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(pos)) {
    const undo = make(pos, m);
    n += depth === 1 ? 1 : perft(pos, depth - 1);
    unmake(pos, m, undo);
  }
  return n;
}
