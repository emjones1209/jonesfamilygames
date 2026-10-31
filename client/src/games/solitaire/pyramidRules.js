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

const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const cardName = c => `${c.rank}${SYMBOL[c.suit]}`;

/**
 * How good a position is for what's left to do, using only what the player can see: pyramid
 * cards gone count most, cards uncovered help, and a pyramid card is "dead" — it can never be
 * taken away — once every card that could pair with it (adding to 13) is gone.
 */
function outlook(s) {
  const gone = new Map();
  for (const c of s.removed) gone.set(VALUE[c.rank], (gone.get(VALUE[c.rank]) ?? 0) + 1);
  let v = (28 - left(s)) * 10;
  s.pyramid.forEach((c, i) => {
    if (!c) return;
    if (isFree(s, i)) v += 1;
    const need = 13 - VALUE[c.rank];
    if (need > 0 && (gone.get(need) ?? 0) >= 4) v -= 40;              // nothing left to pair it with
  });
  return v;
}

/**
 * The best run of moves from here: searched move by move, keeping the line that leaves the
 * best outlook. Returns { line: [move…], v } where a move is places to take away or 'draw'.
 * Turning the stock is only planned once the player has been through it (`seenStock`): from
 * the second pass on, they've seen every card in it, in the order they'll come again.
 */
function bestLine(s, seenStock, budget = { n: 8000 }, memo = new Map()) {
  const key = `${s.pyramid.map(c => (c ? 1 : 0)).join('')}|${s.stock.length}|${s.waste.length}|${s.pass}`;
  if (memo.has(key)) return memo.get(key);
  let best = { line: [], v: outlook(s) };
  memo.set(key, best);                                      // (no going round in circles)
  if (budget.n-- > 0) {
    const moves = removals(s);
    if (seenStock && !whyNoDraw(s)) moves.push('draw');
    for (const m of moves) {
      const sub = bestLine(m === 'draw' ? draw(s) : remove(s, m), seenStock, budget, memo);
      if (sub.v > best.v) best = { line: [m, ...sub.line], v: sub.v };
    }
  }
  memo.set(key, best);
  return best;
}

/**
 * A move for the Hint button: { remove: places, why }, { draw: true, why }, or null. Plans
 * ahead with the cards in view (never the stock's hidden order): the take-away that starts
 * the best run, steering clear of using up the cards that something else still needs.
 */
export function hint(s) {
  const { line } = bestLine(s, s.pass > 1);
  const takes = line.filter(m => m !== 'draw').length;
  if (line[0] === 'draw') {
    return { draw: true, why: `Turn the next card: you've seen what's coming, and it leads to taking away ${takes} card${takes === 1 ? '' : 's'}.` };
  }
  if (line.length) {
    const first = line[0];
    const cards = first.map(p => (p.type === 'waste' ? s.waste[s.waste.length - 1] : s.pyramid[p.i]));
    const what = cards.length === 1 ? `the ${cardName(cards[0])} (a King goes on its own)` : `the ${cardName(cards[0])} and ${cardName(cards[1])} (${VALUE[cards[0].rank]} + ${VALUE[cards[1].rank]} = 13)`;
    const after = remove(s, first);
    const opened = after.pyramid.filter((c, i) => c && isFree(after, i) && !isFree(s, i)).length;
    const more = takes - 1;
    const why = more ? ` — it leads to ${more} more after it` : opened ? ` — it uncovers ${opened === 1 ? 'a card' : `${opened} cards`}` : '';
    return { remove: first, why: `Take away ${what}${why}.` };
  }
  if (!whyNoDraw(s)) return { draw: true, why: s.stock.length ? 'Nothing worth taking: turn the next card from the stock.' : 'Turn the waste back over to go through it again.' };
  // The stock's used up: the least bad take-away there is
  const options = removals(s);
  if (!options.length) return null;
  const best = options.reduce((a, b) => (outlook(remove(s, b)) > outlook(remove(s, a)) ? b : a));
  return { remove: best, why: 'Take these away — it\'s the last thing left to try.' };
}
