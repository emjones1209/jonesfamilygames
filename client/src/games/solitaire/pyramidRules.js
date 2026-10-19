/**
 * Pyramid: 28 cards in a pyramid of seven rows, each card half covering the two below it.
 * Take away pairs that add up to 13 (Jack 11, Queen 12, Ace 1), or a King on its own,
 * using cards that aren't covered and the top card of the waste. The other 24 cards are
 * turned from the stock onto the waste one at a time; the waste can be turned back over
 * twice (three times through the stock). Clear the pyramid to win.
 *
 * `pyramid` holds the 28 places row by row (null once taken). Places are named
 * { type: 'pyr', i } and { type: 'waste' }. Every move returns a new state.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';

export const VALUE = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
export const ROWS = 7;
export const PASSES = 3;
export const rowOf = i => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
export const indexOf = (r, c) => (r * (r + 1)) / 2 + c;

export function newPyramid() {
  const deck = shuffle(buildDeck()).map(c => ({ ...c, faceUp: true }));
  return { pyramid: deck.slice(0, 28), stock: deck.slice(28).map(c => ({ ...c, faceUp: false })), waste: [], removed: [], pass: 1, moves: 0, score: 0 };
}

/** Is the card at place i uncovered (neither card below it is left)? */
export function isFree(s, i) {
  if (!s.pyramid[i]) return false;
  const r = rowOf(i);
  if (r === ROWS - 1) return true;
  const c = i - indexOf(r, 0);
  return !s.pyramid[indexOf(r + 1, c)] && !s.pyramid[indexOf(r + 1, c + 1)];
}

const cardAt = (s, p) => (p.type === 'waste' ? s.waste[s.waste.length - 1] : isFree(s, p.i) ? s.pyramid[p.i] : null);
const samePlace = (a, b) => a.type === b.type && (a.type === 'waste' || a.i === b.i);

/** Can these places (one King, or two adding up to 13) be taken away? */
export function canRemove(s, places) {
  const cards = places.map(p => cardAt(s, p));
  if (cards.some(c => !c)) return false;
  if (places.length === 1) return VALUE[cards[0].rank] === 13;
  if (places.length !== 2 || samePlace(places[0], places[1])) return false;
  return VALUE[cards[0].rank] + VALUE[cards[1].rank] === 13;
}

export function remove(s, places) {
  if (!canRemove(s, places)) throw new Error('Those don\'t add up to 13.');
  const next = { ...s, pyramid: [...s.pyramid], waste: [...s.waste], moves: s.moves + 1 };
  const taken = [];
  for (const p of places) {
    if (p.type === 'waste') taken.push(next.waste.pop());
    else { taken.push(next.pyramid[p.i]); next.pyramid[p.i] = null; }
  }
  next.removed = [...s.removed, ...taken];
  next.score = s.score + 5 * taken.length;
  return next;
}

/** Why the stock can't be turned (null if it can). */
export function whyNoDraw(s) {
  if (s.stock.length) return null;
  if (s.pass < PASSES && s.waste.length) return null;
  return 'The stock is used up.';
}

/** Turn a card from the stock onto the waste (or, with the stock empty, turn the waste back over). */
export function draw(s) {
  const why = whyNoDraw(s);
  if (why) throw new Error(why);
  if (!s.stock.length) {
    return { ...s, stock: [...s.waste].reverse().map(c => ({ ...c, faceUp: false })), waste: [], pass: s.pass + 1, moves: s.moves + 1 };
  }
  return { ...s, stock: s.stock.slice(1), waste: [...s.waste, { ...s.stock[0], faceUp: true }], moves: s.moves + 1 };
}

export const left = s => s.pyramid.filter(Boolean).length;
export const isWon = s => left(s) === 0;

/** Everything that can be taken away now: [[place], [place, place], …]. */
export function removals(s) {
  const free = s.pyramid.map((_, i) => ({ type: 'pyr', i })).filter(p => isFree(s, p.i));
  if (s.waste.length) free.push({ type: 'waste' });
  const out = [];
  for (const p of free) if (canRemove(s, [p])) out.push([p]);
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) if (canRemove(s, [free[a], free[b]])) out.push([free[a], free[b]]);
  }
  return out;
}

/** Is the game over (nothing to take away, and nothing left to turn)? */
export const isStuck = s => !isWon(s) && !removals(s).length && !!whyNoDraw(s);

/** A move for the Hint button: { remove: places } (pyramid cards first), { draw: true }, or null. */
export function hint(s) {
  const all = removals(s);
  // Taking pyramid cards matters more than using up the waste; lower rows open up the rest
  const score = places => places.reduce((v, p) => v + (p.type === 'pyr' ? 10 + rowOf(p.i) : 0), 0);
  const best = all.sort((a, b) => score(b) - score(a))[0];
  if (best) return { remove: best };
  if (!whyNoDraw(s)) return { draw: true };
  return null;
}
