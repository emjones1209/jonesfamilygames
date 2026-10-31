/**
 * Klondike (the classic Solitaire) moves and its Hint, on the game state SolitaireGame.jsx
 * keeps: { tableau: [[card…]×7], stock (stock[0] turns next), waste (waste[0] on top),
 * foundations: { suit: [card…] } }.
 *
 * Places: { type: 'waste' }, { type: 'tableau', colIdx, rowIdx } (moving from rowIdx down),
 * { type: 'foundation', suit } and, as a destination, { type: 'tableau', colIdx }.
 */
import { RANK_VALUES } from '../../utils/cardEngine.js';
import { fitsFoundation, foundationCount } from './autoComplete.js';

const RANK = { ...RANK_VALUES, A: 1 };                // aces are low in Solitaire
const red = c => c.suit === 'hearts' || c.suit === 'diamonds';
const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const cardName = c => `${c.rank}${SYMBOL[c.suit]}`;

/** Does `card` go on `onto` in a column (one lower, the other colour)? */
const follows = (card, onto) => onto.faceUp && RANK[card.rank] === RANK[onto.rank] - 1 && red(card) !== red(onto);

/** Can `card` (with whatever's on it) go on column `colIdx`? */
export function fitsColumn(game, card, colIdx) {
  const col = game.tableau[colIdx];
  if (!col.length) return card.rank === 'K';
  return follows(card, col[col.length - 1]);
}

/** Every move on the table (not turning the stock): [{ from, to }]. */
export function legalMoves(game) {
  const out = [];
  const waste = game.waste[0];
  if (waste) {
    if (fitsFoundation(waste, game)) out.push({ from: { type: 'waste' }, to: { type: 'foundation', suit: waste.suit } });
    game.tableau.forEach((_, c) => { if (fitsColumn(game, waste, c)) out.push({ from: { type: 'waste' }, to: { type: 'tableau', colIdx: c } }); });
  }
  game.tableau.forEach((col, colIdx) => {
    col.forEach((card, rowIdx) => {
      if (!card.faceUp || RANK[card.rank] == null) return;
      // (only an ordered run moves together)
      for (let k = rowIdx + 1; k < col.length; k++) if (!follows(col[k], col[k - 1])) return;
      const from = { type: 'tableau', colIdx, rowIdx };
      if (rowIdx === col.length - 1 && fitsFoundation(card, game)) out.push({ from, to: { type: 'foundation', suit: card.suit } });
      game.tableau.forEach((_, c) => { if (c !== colIdx && fitsColumn(game, card, c)) out.push({ from, to: { type: 'tableau', colIdx: c } }); });
    });
  });
  return out;
}

/** Make a move (turning over the card it uncovers). */
export function applyMove(game, { from, to }) {
  const g = { ...game, tableau: game.tableau.map(c => [...c]), waste: [...game.waste], foundations: { ...game.foundations } };
  let cards;
  if (from.type === 'waste') cards = [g.waste.shift()];
  else if (from.type === 'foundation') { cards = [g.foundations[from.suit].at(-1)]; g.foundations[from.suit] = g.foundations[from.suit].slice(0, -1); }
  else {
    const col = g.tableau[from.colIdx];
    cards = col.slice(from.rowIdx);
    const left = col.slice(0, from.rowIdx);
    if (left.length && !left[left.length - 1].faceUp) left[left.length - 1] = { ...left[left.length - 1], faceUp: true };
    g.tableau[from.colIdx] = left;
  }
  if (to.type === 'foundation') g.foundations[to.suit] = [...g.foundations[to.suit], cards[0]];
  else g.tableau[to.colIdx] = [...g.tableau[to.colIdx], ...cards];
  return g;
}

/** Where an ordered run starts at the bottom of a column (only it moves, all together from any card in it). */
export function runStart(col) {
  let i = col.length - 1;
  while (i > 0 && col[i - 1].faceUp && follows(col[i], col[i - 1])) i--;
  return i;
}

/**
 * Where the cards from `from` (waste, a column from rowIdx down, or a foundation's top card)
 * can go, best first: up to the foundation, onto a card, then into an empty column. (A whole
 * column doesn't move to an empty one: that changes nothing.)
 */
export function destinations(game, from) {
  const card = from.type === 'waste' ? game.waste[0]
    : from.type === 'foundation' ? game.foundations[from.suit].at(-1)
    : game.tableau[from.colIdx][from.rowIdx];
  if (!card?.faceUp) return [];
  if (from.type === 'tableau' && from.rowIdx < runStart(game.tableau[from.colIdx])) return [];
  const single = from.type !== 'tableau' || from.rowIdx === game.tableau[from.colIdx].length - 1;
  const out = [];
  if (single && from.type !== 'foundation' && fitsFoundation(card, game)) out.push({ type: 'foundation', suit: card.suit });
  const cols = game.tableau.map((_, c) => c).filter(c => !(from.type === 'tableau' && c === from.colIdx) && fitsColumn(game, card, c));
  for (const c of cols) if (game.tableau[c].length) out.push({ type: 'tableau', colIdx: c });
  if (!(from.type === 'tableau' && from.rowIdx === 0)) for (const c of cols) if (!game.tableau[c].length) out.push({ type: 'tableau', colIdx: c });
  return out;
}

/**
 * The next card that's safe to send up by itself (from the waste or a column), as the
 * game after it, or null: nothing could ever want to sit on it, as both cards of the other
 * colour one lower are up already (and Aces and 2s always are).
 */
export function autoHomeStep(game) {
  const safe = card => {
    if (!card?.faceUp || !fitsFoundation(card, game)) return false;
    const r = RANK[card.rank];
    return r <= 2 || Object.keys(game.foundations).filter(suit => red({ suit }) !== red(card)).every(suit => game.foundations[suit].length >= r - 1);
  };
  if (safe(game.waste[0])) return applyMove(game, { from: { type: 'waste' }, to: { type: 'foundation', suit: game.waste[0].suit } });
  for (let c = 0; c < game.tableau.length; c++) {
    const col = game.tableau[c];
    if (col.length && safe(col.at(-1))) return applyMove(game, { from: { type: 'tableau', colIdx: c, rowIdx: col.length - 1 }, to: { type: 'foundation', suit: col.at(-1).suit } });
  }
  return null;
}

export const isWon = game => foundationCount(game) === 52;

/** A position, as a string (for the game so far: pass them to `hint` as `seen`). */
export const positionKey = g => [
  ...g.tableau.map(c => c.map(x => `${x.id}${x.faceUp ? '' : '_'}`).join()),
  g.waste[0]?.id ?? '', g.stock.length, ...Object.values(g.foundations).map(f => f.length),
].join('|');

/** The table as the player sees it: face-down cards are blanks (they stay unknown when they turn over). */
const visible = g => ({ ...g, tableau: g.tableau.map(col => col.map(c => (c.faceUp ? c : { id: c.id, rank: '?', suit: '?', faceUp: false }))) });

/** How good a position looks: cards up on the foundations, cards turned over, cards out of the stock. */
function outlook(g) {
  let v = foundationCount(g) * 12 - (g.stock.length + g.waste.length) * 0.5;
  for (const col of g.tableau) {
    if (!col.length) v += 3;
    for (const c of col) if (!c.faceUp) v -= 7;
  }
  return v;
}

/** A move that only shuffles cards around: a run moving off a card it already sat on, or a King's column to an empty one. */
function pointless(game, { from, to }) {
  if (from.type !== 'tableau' || to.type !== 'tableau') return false;
  const col = game.tableau[from.colIdx];
  if (from.rowIdx === 0) return !game.tableau[to.colIdx].length;          // a whole column to an empty one
  const below = col[from.rowIdx - 1];
  // Off a card it already sat on: only worth it if that card can then go up
  return below.faceUp && follows(col[from.rowIdx], below) && !fitsFoundation(below, game);
}

const useful = game => legalMoves(game).filter(m => !pointless(game, m));

/** "Move the 7♠ onto the 8♥ — it turns over a card." */
export function describeMove(game, { from, to }) {
  const cards = from.type === 'waste' ? [game.waste[0]] : game.tableau[from.colIdx].slice(from.rowIdx);
  const what = from.type === 'waste' ? `the ${cardName(cards[0])} from the waste`
    : cards.length > 1 ? `the ${cardName(cards[0])} and the cards on it` : `the ${cardName(cards[0])}`;
  const target = to.type === 'tableau' ? game.tableau[to.colIdx] : null;
  const where = to.type === 'foundation' ? 'up to its foundation' : target.length ? `onto the ${cardName(target[target.length - 1])}` : 'into the empty column';
  let why = '';
  if (from.type === 'tableau') {
    const below = game.tableau[from.colIdx][from.rowIdx - 1];
    if (below && !below.faceUp) why = ' — it turns over a card';
    else if (!below) why = ' — it empties a column (only a King can go there)';
    else if (fitsFoundation(below, game)) why = ` — then the ${cardName(below)} can go up`;
  }
  return `Move ${what} ${where}${why}.`;
}

/**
 * The Hint button: { from, to, why } for a move, { draw: true, why } to turn the stock, or
 * null. Looks a few moves ahead with the cards in view (face-down cards stay unknown: the
 * hint doesn't peek) for the line that gets the most cards up and turned over, and never
 * goes back to a position in `seen` (the game so far), so hints don't go round in circles.
 */
export function hint(game, seen = new Set(), { depth = 3 } = {}) {
  const view = visible(game);
  const memo = new Map();
  let budget = 3000;
  const search = (g, d) => {
    const key = positionKey(g);
    const known = memo.get(key);
    if (known && known.d >= d) return known.v;
    let v = outlook(g);
    if (d > 0 && budget-- > 0) for (const m of useful(g)) v = Math.max(v, search(applyMove(g, m), d - 1) - 0.5);
    memo.set(key, { v, d });
    return v;
  };
  const now = outlook(view);
  let best = null;
  for (const m of useful(view)) {
    if (seen.has(positionKey(applyMove(game, m)))) continue;
    const after = applyMove(view, m);
    // (Lines that end up as good: the one that gains most straight away first — an Ace goes up before anything else)
    const v = search(after, depth - 1) + (outlook(after) - now) * 0.1;
    if (v > now && (!best || v > best.v)) best = { ...m, v };
  }
  if (best) return { from: best.from, to: best.to, why: describeMove(game, best) };
  // Turn the stock — unless that's been round the whole stock with nothing new to do
  const drawn = turnStock(game);
  if (!drawn || seen.has(positionKey(drawn))) return null;
  return { draw: true, why: game.stock.length ? 'Nothing useful to move: turn the next card from the stock.' : 'Turn the waste back over to go through the stock again.' };
}

/** Turn the next card from the stock (or, with the stock empty, turn the waste back over); null when there's nothing to turn. */
export function turnStock(game) {
  if (game.stock.length) return { ...game, stock: game.stock.slice(1), waste: [{ ...game.stock[0], faceUp: true }, ...game.waste] };
  if (game.waste.length) return { ...game, stock: [...game.waste].reverse().map(c => ({ ...c, faceUp: false })), waste: [] };
  return null;
}
