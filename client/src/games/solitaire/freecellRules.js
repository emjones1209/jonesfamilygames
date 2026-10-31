/**
 * FreeCell: one deck, all 52 cards face up in eight columns (four of 7, four of 6),
 * four free cells that hold a card each, and four foundations built up by suit, A to K.
 *
 * Build columns down in alternating colours (a red 6 on a black 7). Only one card moves
 * at a time, but a run in order moves together when there's room to shuffle it across
 * through the free cells and empty columns: (free cells + 1) × 2^(empty columns) cards,
 * not counting the column it's going to. Any card can go into an empty column.
 *
 * Places are named { type: 'col', i }, { type: 'cell', i } and { type: 'home', suit }.
 * A state is a plain object, and every move returns a new one.
 */
import { buildDeck, shuffle, SUITS } from '../../utils/cardEngine.js';

export const RANK = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
const red = c => c.suit === 'hearts' || c.suit === 'diamonds';
export const CELLS = 4;
export const COLS = 8;

export function newFreecell() {
  const deck = shuffle(buildDeck()).map(c => ({ ...c, faceUp: true }));
  const cols = Array.from({ length: COLS }, () => []);
  deck.forEach((c, i) => cols[i % COLS].push(c));
  return { cols, cells: Array(CELLS).fill(null), home: Object.fromEntries(SUITS.map(s => [s, []])), moves: 0 };
}

export const homeCount = s => SUITS.reduce((n, suit) => n + s.home[suit].length, 0);
export const isWon = s => homeCount(s) === 52;

/** Does `card` go on `onto` in a column (one lower, the other colour)? */
const follows = (card, onto) => RANK[card.rank] === RANK[onto.rank] - 1 && red(card) !== red(onto);

/** Where the run that could move together starts at the bottom of a column. */
export function runStart(col) {
  let i = col.length - 1;
  while (i > 0 && follows(col[i], col[i - 1])) i--;
  return Math.max(i, 0);
}

/** How many cards in order can move at once, onto a column (`toEmpty`: into an empty one). */
export function moveLimit(s, toEmpty = false) {
  const freeCells = s.cells.filter(c => !c).length;
  const emptyCols = s.cols.filter(c => !c.length).length - (toEmpty ? 1 : 0);
  return (freeCells + 1) * 2 ** Math.max(0, emptyCols);
}

/** The cards that would move from a place, picking up from `idx` in a column. */
function lift(s, from, idx) {
  if (from.type === 'cell') return s.cells[from.i] ? [s.cells[from.i]] : [];
  if (from.type === 'home') { const pile = s.home[from.suit]; return pile.length ? [pile[pile.length - 1]] : []; }
  const col = s.cols[from.i];
  return idx >= runStart(col) ? col.slice(idx) : [];
}

const fitsHome = (s, card) => {
  const pile = s.home[card.suit];
  return RANK[card.rank] === pile.length + 1;
};

/** Can the cards from `from` (from `idx` down, for a column) go to `to`? */
export function canMove(s, from, idx, to) {
  const cards = lift(s, from, idx);
  if (!cards.length) return false;
  const same = from.type === to.type && (from.type === 'home' ? from.suit === to.suit : from.i === to.i);
  if (same) return false;
  if (to.type === 'home') return cards.length === 1 && cards[0].suit === to.suit && fitsHome(s, cards[0]);
  if (to.type === 'cell') return cards.length === 1 && !s.cells[to.i];
  const col = s.cols[to.i];
  if (!col.length) return cards.length <= moveLimit(s, true);
  return follows(cards[0], col[col.length - 1]) && cards.length <= moveLimit(s);
}

/** Make the move. */
export function move(s, from, idx, to) {
  if (!canMove(s, from, idx, to)) throw new Error('That move isn\'t allowed.');
  const cards = lift(s, from, idx);
  const next = { ...s, cols: s.cols.map(c => [...c]), cells: [...s.cells], home: { ...s.home }, moves: s.moves + 1 };
  if (from.type === 'cell') next.cells[from.i] = null;
  else if (from.type === 'home') next.home[from.suit] = next.home[from.suit].slice(0, -1);
  else next.cols[from.i] = next.cols[from.i].slice(0, idx);
  if (to.type === 'cell') next.cells[to.i] = cards[0];
  else if (to.type === 'home') next.home[to.suit] = [...next.home[to.suit], cards[0]];
  else next.cols[to.i] = [...next.cols[to.i], ...cards];
  return next;
}

/**
 * Where the cards from a place could go, best first: up to the foundation, onto a column,
 * into an empty column, then a free cell.
 */
export function destinations(s, from, idx) {
  const out = [];
  for (const suit of SUITS) if (canMove(s, from, idx, { type: 'home', suit })) out.push({ type: 'home', suit });
  const cols = [...Array(COLS).keys()];
  for (const i of cols) if (s.cols[i].length && canMove(s, from, idx, { type: 'col', i })) out.push({ type: 'col', i });
  for (const i of cols) if (!s.cols[i].length && canMove(s, from, idx, { type: 'col', i })) out.push({ type: 'col', i });
  if (from.type !== 'cell') {
    const free = s.cells.findIndex(c => !c);
    if (free >= 0 && canMove(s, from, idx, { type: 'cell', i: free })) out.push({ type: 'cell', i: free });
  }
  return out;
}

/**
 * A card that's safe to send home by itself: nothing could ever want to sit on it, as
 * both cards of the other colour one lower are home already (and Aces and 2s always are).
 */
function safeHome(s, card) {
  if (!fitsHome(s, card)) return false;
  const r = RANK[card.rank];
  if (r <= 2) return true;
  const others = SUITS.filter(suit => red({ suit }) !== red(card));
  return others.every(suit => s.home[suit].length >= r - 1);
}

/** One step of sending safe cards home (the next one, or null when there's none). */
export function autoHomeStep(s) {
  for (let i = 0; i < CELLS; i++) {
    const c = s.cells[i];
    if (c && safeHome(s, c)) return move(s, { type: 'cell', i }, 0, { type: 'home', suit: c.suit });
  }
  for (let i = 0; i < COLS; i++) {
    const col = s.cols[i];
    const c = col[col.length - 1];
    if (c && safeHome(s, c)) return move(s, { type: 'col', i }, col.length - 1, { type: 'home', suit: c.suit });
  }
  return null;
}

/**
 * Auto-complete is offered once every column runs downwards (each card lower than the one
 * it sits on): then the lowest card still wanted is always at the bottom of a column or
 * in a cell, so the game plays itself out.
 */
export const canAutoComplete = s => !isWon(s) && s.cols.every(col => col.every((c, i) => i === 0 || RANK[c.rank] < RANK[col[i - 1].rank]));

/** Auto-complete's next step: any card that can go home. */
export function finishStep(s) {
  for (let i = 0; i < CELLS; i++) {
    const c = s.cells[i];
    if (c && fitsHome(s, c)) return move(s, { type: 'cell', i }, 0, { type: 'home', suit: c.suit });
  }
  for (let i = 0; i < COLS; i++) {
    const col = s.cols[i];
    const c = col[col.length - 1];
    if (c && fitsHome(s, c)) return move(s, { type: 'col', i }, col.length - 1, { type: 'home', suit: c.suit });
  }
  return null;
}

/** A position, as a string: for spotting one that's been seen before. */
export const positionKey = s => [
  ...s.cols.map(c => c.map(x => x.id).join()).sort(),
  s.cells.filter(Boolean).map(x => x.id).sort().join(),
  SUITS.map(suit => s.home[suit].length).join(),
].join('|');

/** How promising a position looks (higher is better). */
function promise(s) {
  let v = homeCount(s) * 20;
  v += s.cols.filter(c => !c.length).length * 6 + s.cells.filter(c => !c).length * 4;
  for (const col of s.cols) {
    for (let i = 1; i < col.length; i++) if (follows(col[i], col[i - 1])) v += 1;
  }
  // The next card each foundation wants: the deeper it's buried, the worse
  for (const suit of SUITS) {
    const want = s.home[suit].length + 1;
    if (want > 13) continue;
    for (const col of s.cols) {
      const at = col.findIndex(c => c.suit === suit && RANK[c.rank] === want);
      if (at >= 0) v -= (col.length - 1 - at) * 2;
    }
  }
  return v;
}

/** Let the cards nothing could still want go home, as the game does after each move. */
function settle(s) {
  let t = s;
  for (let next = autoHomeStep(t); next; next = autoHomeStep(t)) t = next;
  return t;
}

/** Every move from a position: [from, idx, to]. */
function allMoves(s) {
  const out = [];
  s.cells.forEach((c, i) => { if (c) for (const to of destinations(s, { type: 'cell', i }, 0)) out.push([{ type: 'cell', i }, 0, to]); });
  s.cols.forEach((col, i) => {
    for (let idx = runStart(col); idx < col.length; idx++) for (const to of destinations(s, { type: 'col', i }, idx)) out.push([{ type: 'col', i }, idx, to]);
  });
  return out;
}

/** "7♠" */
const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const cardName = c => `${c.rank}${SYMBOL[c.suit]}`;

/** A small binary heap: the item with the highest `v` first. */
function heap() {
  const a = [];
  const up = i => { while (i > 0) { const p = (i - 1) >> 1; if (a[p].v >= a[i].v) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  const down = i => {
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < a.length && a[l].v > a[m].v) m = l;
      if (r < a.length && a[r].v > a[m].v) m = r;
      if (m === i) return;
      [a[m], a[i]] = [a[i], a[m]]; i = m;
    }
  };
  return {
    get size() { return a.length; },
    push: x => { a.push(x); up(a.length - 1); },
    pop: () => { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
  };
}

/**
 * Look for a way to win from here: a best-first search over positions (each move followed
 * by the cards that go home by themselves), most promising first, never revisiting one.
 * Returns { moves: [[from, idx, to], …] } for a win, { lost: true } when every position
 * reachable has been tried without one, or null when it ran out of `budget` positions first.
 * Positions in `avoid` (the game so far) are never gone back to.
 */
export function solve(s, { budget = 30000, avoid = new Set() } = {}) {
  const start = s;                       // (as it is: the first move must work on the table you see)
  if (isWon(start)) return { moves: [] };
  const visited = new Set([...avoid, positionKey(start)]);
  const open = heap();
  open.push({ s: start, path: null, depth: 0, v: promise(start) });
  for (let n = 0; open.size && n < budget; n++) {
    const node = open.pop();
    for (const [from, idx, to] of allMoves(node.s)) {
      const next = settle(move(node.s, from, idx, to));
      const key = positionKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      const path = { step: [from, idx, to], prev: node.path };
      if (isWon(next)) {
        const moves = [];
        for (let p = path; p; p = p.prev) moves.unshift(p.step);
        return { moves };
      }
      open.push({ s: next, path, depth: node.depth + 1, v: promise(next) - (node.depth + 1) * 0.5 });
    }
  }
  return open.size ? null : { lost: true };
}

/** A sentence saying what a move does: "Move the 7♠ onto the 8♥ — it frees a column." */
export function describeMove(s, from, idx, to) {
  const cards = lift(s, from, idx);
  const what = cards.length > 1 ? `the ${cards.length} cards from the ${cardName(cards[0])} down` : `the ${cardName(cards[0])}`;
  const col = to.type === 'col' ? s.cols[to.i] : null;
  const where = to.type === 'home' ? 'up to its foundation' : to.type === 'cell' ? 'into a free cell'
    : col.length ? `onto the ${cardName(col[col.length - 1])}` : 'into the empty column';
  const after = move(s, from, idx, to);
  const left = from.type === 'col' ? after.cols[from.i] : null;
  let why = '';
  if (to.type === 'home') why = '';
  else if (from.type === 'col' && !left.length) why = ' — it empties a column';
  else if (from.type === 'cell') why = ' — it frees a cell';
  else if (left?.length) {
    const freed = left[left.length - 1];
    if (fitsHome(after, freed)) why = ` — then the ${cardName(freed)} can go up`;
  }
  return `Move ${what} ${where}${why}.`;
}

/**
 * The Hint button: { from, idx, to, why } for the first move of a way to win from here (when
 * one can be found), else the most promising move by looking two moves ahead; { lost: true,
 * why } when no way to win is left; or null when there are no moves at all. Never suggests
 * going back to a position in `seen` (the game so far), so hints don't go round in circles.
 */
export function hint(s, seen = new Set(), { budget = 10000 } = {}) {
  const found = solve(s, { budget, avoid: seen });
  if (found?.moves.length) {
    const [from, idx, to] = found.moves[0];
    return { from, idx, to, why: `${describeMove(s, from, idx, to)} There's a way to win from here, and this is its first step.` };
  }
  const best = lookAhead(s, seen);
  if (found?.lost) {
    return best
      ? { ...best, lost: true, why: `There's no way to win from here any more — try Undo. (Best try: ${describeMove(s, best.from, best.idx, best.to).toLowerCase()})` }
      : { lost: true, why: 'There\'s no way to win from here any more — try Undo, or start a new game.' };
  }
  return best && { ...best, why: describeMove(s, best.from, best.idx, best.to) };
}

/** The most promising move, looking two moves ahead (when the solver runs out of time). */
function lookAhead(s, seen) {
  let best = null;
  for (const [from, idx, to] of allMoves(s)) {
    const next = settle(move(s, from, idx, to));
    const key = positionKey(next);
    if (seen.has(key)) continue;
    let v = promise(next);
    if (!isWon(next)) {
      for (const [f2, i2, t2] of allMoves(next)) {
        const after = settle(move(next, f2, i2, t2));
        const k2 = positionKey(after);
        if (k2 === key || seen.has(k2)) continue;
        v = Math.max(v, promise(after) - 1);
      }
    } else v = Infinity;
    if (!best || v > best.v) best = { from, idx, to, v };
  }
  return best && { from: best.from, idx: best.idx, to: best.to };
}
