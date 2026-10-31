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

/** Is moving the cards from `idx` in column `from` to `to` worth anything at all? (Not shuffling a run between equal places.) */
function pointless(s, from, idx, to) {
  const col = s.tableau[from], target = s.tableau[to];
  const top = target[target.length - 1], below = col[idx - 1];
  const sameSuit = top && top.suit === col[idx].suit;
  const settled = below && below.faceUp && RANK[below.rank] === RANK[col[idx].rank] + 1;
  if (settled && !(sameSuit && below.suit !== col[idx].suit)) return true;   // it already sat on a card one higher
  if (!top && idx === 0) return true;                                        // a whole column to an empty one
  return idx > runStart(col) && !sameSuit;                                   // splitting a run, for nothing
}

/** The position as the player sees it: face-down cards are blanks (they stay unknown when they turn over). */
function visible(s) {
  return { ...s, stock: [], tableau: s.tableau.map(col => col.map(c => (c.faceUp ? c : { id: c.id, rank: '?', suit: '?', faceUp: false }))) };
}

/**
 * How good a position looks: cards turned up, empty columns, runs in one suit, finished runs.
 * (`empties`: what an empty column is worth.)
 */
function outlook(s, empties = 10) {
  let v = s.done.length * 200;
  for (const col of s.tableau) {
    if (!col.length) { v += empties; continue; }
    for (let i = 0; i < col.length; i++) {
      const c = col[i];
      if (!c.faceUp) { v -= 8; continue; }
      const below = col[i - 1];
      if (below?.faceUp && RANK[below.rank] === RANK[c.rank] + 1) v += below.suit === c.suit ? 3 : 1;
    }
  }
  return v;
}

const tableKey = s => s.tableau.map(c => c.map(x => `${x.id}${x.faceUp ? '' : '_'}`).join()).join('|') + `#${s.stock.length}`;

/** Every move worth considering: [from, idx, to]. */
function usefulMoves(s) {
  const out = [];
  for (let from = 0; from < COLUMNS; from++) {
    const col = s.tableau[from];
    if (!col.length) continue;
    for (let idx = runStart(col); idx < col.length; idx++) {
      for (const to of destinations(s, from, idx)) if (!pointless(s, from, idx, to)) out.push([from, idx, to]);
    }
  }
  return out;
}

/** "the 7♠" / "the run from the 9♥ down" */
const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const cardName = c => `${c.rank}${SYMBOL[c.suit]}`;

/**
 * A move worth making, for the Hint button — { from, idx, to, why } or { deal: true, why }, or
 * null when there's nothing left to do. Looks a few moves ahead with the cards in view (cards
 * that would turn over stay unknown: the hint doesn't peek) for the line that turns up the
 * most cards, empties columns and builds runs in one suit — and never goes back to a position
 * in `seen` (the game so far), so hints don't go round in circles.
 */
export function hint(s, seen = new Set(), { depth = 3 } = {}) {
  const view = visible(s);
  const hidden = t => t.tableau.reduce((n, col) => n + col.filter(c => !c.faceUp).length, 0);
  const base = { v: outlook(view), hidden: hidden(view), done: view.done.length };
  // Real progress can't be undone: a card turned up, or a run finished
  const progress = t => hidden(t) < base.hidden || t.done.length > base.done;
  const memo = new Map();
  let budget = 4000;
  // The best a line from here leads to: { v } for any line, { p } for one that makes real progress
  const search = (t, d) => {
    const key = tableKey(t);
    const known = memo.get(key);
    if (known && known.d >= d) return known;
    let v = outlook(t), p = progress(t) ? v : -Infinity;
    if (d > 0 && budget-- > 0) {
      for (const [from, idx, to] of usefulMoves(t)) {
        const sub = search(move(t, from, idx, to), d - 1);
        v = Math.max(v, sub.v - 0.5);
        p = Math.max(p, sub.p - 0.5);
      }
    }
    const out = { v, p, d };
    memo.set(key, out);
    return out;
  };
  // A move is worth making if it's better straight away, or sets up real progress. (When the
  // next deal is waiting for a column to be filled, only real progress counts: otherwise filling
  // a column and emptying it again would look like progress for ever.)
  const toDeal = s.stock.length > 0 && s.tableau.some(c => !c.length);
  let best = null;
  for (const [from, idx, to] of usefulMoves(view)) {
    if (seen.has(tableKey(move(s, from, idx, to)))) continue;
    const after = move(view, from, idx, to);
    const line = search(after, depth - 1);
    const v = (outlook(after) > base.v && !toDeal ? line.v : line.p) + (outlook(after) - base.v) * 0.1;   // (soonest gain first)
    if (v > base.v && (!best || v > best.v)) best = { from, idx, to, v };
  }
  if (best) return { from: best.from, idx: best.idx, to: best.to, why: describeMove(s, best.from, best.idx, best.to) };
  if (!whyNoDeal(s)) return { deal: true, why: 'Nothing useful left to move: deal a new row.' };
  // The stock can't be dealt while a column's empty: fill it, breaking up as little as possible
  if (s.stock.length) {
    const to = s.tableau.findIndex(c => !c.length);
    let fill = null;
    for (let from = 0; from < COLUMNS; from++) {
      const col = s.tableau[from];
      if (col.length < 2) continue;
      for (let idx = Math.max(1, runStart(col)); idx < col.length; idx++) {      // (leaving a card behind)
        const v = outlook(move(view, from, idx, to));
        if (!fill || v > fill.v) fill = { from, idx, v };
      }
    }
    if (fill) return { from: fill.from, idx: fill.idx, to, why: `${describeMove(s, fill.from, fill.idx, to)} Fill every empty column, then you can deal.` };
  }
  return null;
}

/** A position's key, for the game so far (pass them to `hint` as `seen`). */
export const positionKey = tableKey;

/** "Move the 7♠ onto the 8♠ — it turns over a card." */
export function describeMove(s, from, idx, to) {
  const col = s.tableau[from], target = s.tableau[to];
  const what = idx < col.length - 1 ? `the run from the ${cardName(col[idx])} down` : `the ${cardName(col[idx])}`;
  const top = target[target.length - 1];
  const where = top ? `onto the ${cardName(top)}` : 'into the empty column';
  const below = col[idx - 1];
  const why = below && !below.faceUp ? ' — it turns over a card'
    : idx === 0 ? ' — it empties a column'
      : top && top.suit === col[idx].suit ? ' — it builds a run in one suit' : '';
  return `Move ${what} ${where}${why}.`;
}
