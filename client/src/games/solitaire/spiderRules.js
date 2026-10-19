/**
 * Spider Solitaire: two decks, ten columns.
 *
 * Deal: 54 cards in the columns (the first four get 6, the rest 5), only the bottom card
 * of each face up; the other 50 wait in the stock, to be dealt 10 at a time — one onto
 * every column — when you ask (but not while a column is empty).
 *
 * Build down in any suit (a 7 on any 8), but only a run of one suit moves together. A
 * full run of one suit, King down to Ace, leaves the table by itself; clear all eight
 * and you've won. One suit (all spades) is the gentle game; two and four suits are harder.
 *
 * Scoring, as in the classic game: start at 500, −1 a move, +100 for each run cleared.
 * A state is a plain object, and every move returns a new one (so Undo can keep old ones).
 */
import { shuffle } from '../../utils/cardEngine.js';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));
export const COLUMNS = 10;
export const RUNS = 8;
const SUIT_SETS = { 1: ['spades'], 2: ['spades', 'hearts'], 4: ['spades', 'hearts', 'diamonds', 'clubs'] };

/** A new game with 1, 2 or 4 suits. */
export function newSpider(suits = 1) {
  const set = SUIT_SETS[suits] ?? SUIT_SETS[1];
  const cards = [];
  for (let copy = 0; copy < RUNS; copy++) {
    const suit = set[copy % set.length];
    for (const rank of RANKS) cards.push({ id: `${rank}-${suit}-${copy}`, rank, suit, faceUp: false });
  }
  const deck = shuffle(cards);
  const tableau = Array.from({ length: COLUMNS }, (_, c) => {
    const col = deck.splice(0, c < 4 ? 6 : 5);
    col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
    return col;
  });
  return { suits: set.length, tableau, stock: deck, done: [], moves: 0, score: 500 };
}

/** Where the run that can move together starts in a column (face up, one suit, going down). */
export function runStart(col) {
  let i = col.length - 1;
  if (i < 0) return 0;
  while (i > 0 && col[i - 1].faceUp && col[i - 1].suit === col[i].suit && RANK[col[i - 1].rank] === RANK[col[i].rank] + 1) i--;
  return i;
}

/** Can the cards from `idx` down in column `from` move onto column `to`? */
export function canMove(s, from, idx, to) {
  const col = s.tableau[from];
  if (from === to || idx < runStart(col) || idx >= col.length) return false;
  const target = s.tableau[to];
  if (!target.length) return true;
  return RANK[target[target.length - 1].rank] === RANK[col[idx].rank] + 1;
}

/** Turn up a column's last card, and take away a finished run (K down to A, one suit). */
function settle(s, c) {
  const col = s.tableau[c];
  if (col.length >= 13) {
    const tail = col.slice(-13);
    const suit = tail[0].suit;
    if (tail.every((card, i) => card.faceUp && card.suit === suit && RANK[card.rank] === 13 - i)) {
      s.tableau[c] = col.slice(0, -13);
      s.done = [...s.done, suit];
      s.score += 100;
    }
  }
  const left = s.tableau[c];
  if (left.length && !left[left.length - 1].faceUp) s.tableau[c] = [...left.slice(0, -1), { ...left[left.length - 1], faceUp: true }];
}

const copy = s => ({ ...s, tableau: s.tableau.map(c => [...c]) });

/** Move the cards from `idx` down in column `from` onto column `to`. */
export function move(s, from, idx, to) {
  if (!canMove(s, from, idx, to)) throw new Error('That move isn\'t allowed.');
  const next = copy(s);
  const cards = next.tableau[from].slice(idx);
  next.tableau[from] = next.tableau[from].slice(0, idx);
  next.tableau[to] = [...next.tableau[to], ...cards];
  next.moves += 1;
  next.score -= 1;
  settle(next, to);
  settle(next, from);
  return next;
}

/** Why the stock can't be dealt now (null if it can). */
export function whyNoDeal(s) {
  if (!s.stock.length) return 'The stock is used up.';
  if (s.tableau.some(c => !c.length)) return 'Fill every empty column before dealing.';
  return null;
}

/** Deal a card from the stock onto every column. */
export function deal(s) {
  const why = whyNoDeal(s);
  if (why) throw new Error(why);
  const next = copy(s);
  const cards = next.stock.slice(0, COLUMNS);
  next.stock = next.stock.slice(COLUMNS);
  cards.forEach((card, c) => { next.tableau[c].push({ ...card, faceUp: true }); });
  next.moves += 1;
  next.score -= 1;
  for (let c = 0; c < COLUMNS; c++) settle(next, c);
  return next;
}

export const isWon = s => s.done.length === RUNS;

/**
 * Where the cards from `idx` in column `from` could go, best first: onto the same suit
 * (keeping a run together), then onto another suit, then an empty column.
 */
export function destinations(s, from, idx) {
  const card = s.tableau[from][idx];
  const fits = [];
  for (let to = 0; to < COLUMNS; to++) {
    if (!canMove(s, from, idx, to)) continue;
    const target = s.tableau[to];
    const top = target[target.length - 1];
    fits.push({ to, rank: !top ? 2 : top.suit === card.suit ? 0 : 1 });
  }
  return fits.sort((a, b) => a.rank - b.rank || a.to - b.to).map(f => f.to);
}

/**
 * A move worth making, for the Hint button — { from, idx, to } or { deal: true }, or null
 * when there's nothing useful left. Prefers moves that turn up a face-down card or join
 * a run of one suit; leaves out moves that just shuffle a run between equal places.
 */
export function hint(s) {
  let best = null;
  for (let from = 0; from < COLUMNS; from++) {
    const col = s.tableau[from];
    if (!col.length) continue;
    const start = runStart(col);
    for (let idx = start; idx < col.length; idx++) {
      for (const to of destinations(s, from, idx)) {
        const target = s.tableau[to];
        const top = target[target.length - 1];
        const below = col[idx - 1];
        const sameSuit = top && top.suit === col[idx].suit;
        let value = 0;
        if (sameSuit) value += 3;                                     // keeps the run growing
        if (idx === 0 && top) value += 2;                             // empties a column
        if (below && !below.faceUp) value += 4;                       // turns a card up
        // Moving off a card that already held it in the same place gains nothing
        const settled = below && below.faceUp && RANK[below.rank] === RANK[col[idx].rank] + 1;
        if (settled && !(sameSuit && below.suit !== col[idx].suit)) continue;
        if (!top && idx === 0) continue;                              // a whole column to an empty one
        if (!top && !(below && !below.faceUp)) value -= 1;            // an empty column is worth keeping
        if (idx > start && !sameSuit) continue;                       // splitting a run, for nothing
        if (!best || value > best.value) best = { from, idx, to, value };
      }
    }
  }
  if (best && best.value > 0) return { from: best.from, idx: best.idx, to: best.to };
  if (!whyNoDeal(s)) return { deal: true };
  return best ? { from: best.from, idx: best.idx, to: best.to } : null;
}
