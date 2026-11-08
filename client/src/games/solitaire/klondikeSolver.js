/**
 * Can a Klondike deal be won? A search over the whole deal, face-down cards and all, used
 * to deal only games that can be won (it isn't the Hint, which never peeks). It knows both
 * ways of turning the stock: one card at a time or three, going through it as often as you
 * like either way.
 *
 * The stock and waste are kept as one row of cards in the order they're turned, with the
 * first `w` of them turned over (the waste, its top card the w-th). Turning through the
 * stock costs nothing, so the cards that can be played from it are the ones turning can
 * bring to the top of the waste:
 *  - one at a time: every one of them, whenever it's wanted;
 *  - three at a time: the top of the waste now, every third card on from there to the end,
 *    and, after turning the waste back over, every third card from the start (and the last).
 * Playing one leaves the waste where it was, less that card.
 *
 * With one at a time, once every card in the columns is face up the game can always be
 * finished (see autoComplete.js), so the search stops there. With three, a card in the stock
 * can still be out of reach, so it plays on to the end: cards up to the foundations, from the
 * columns or the stock, while any can go.
 *
 * It only looks for a way to win using moves the game allows, so a way it finds is a real
 * one. A deal it can't settle within its budget counts as not proven (and isn't dealt).
 */
import { SUITS, buildDeck, shuffle } from '../../utils/cardEngine.js';

const RANK = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
const RED = [false, true, true, false];                  // spades, hearts, diamonds, clubs (as SUITS)

// A card is a number: suit * 13 + rank - 1
const suitOf = k => Math.floor(k / 13);
const rankOf = k => (k % 13) + 1;
const toNum = card => SUITS.indexOf(card.suit) * 13 + RANK[card.rank] - 1;
const toCard = k => { const suit = SUITS[suitOf(k)], rank = Object.keys(RANK).find(r => RANK[r] === rankOf(k)); return { suit, rank, id: `${rank}-${suit}` }; };
/** Does card `a` go on card `b` in a column (one lower, the other colour)? */
const follows = (a, b) => rankOf(a) === rankOf(b) - 1 && RED[suitOf(a)] !== RED[suitOf(b)];

/**
 * A way to win this deal, or null when it didn't find one (it can't be won, or it ran out of
 * `budget` positions first). `deal` is { tableau: [[card…]×7] (face-down cards first, the
 * last one face up), stock: [card…] (the next to turn first) }, as SolitaireGame.jsx deals
 * it; `draw` is how many cards the stock turns at a time (1 or 3). The way to win is a list
 * of moves, [{ card, to }] with `to` 'home' (its foundation) or a column's index, and `card`
 * the one moved (a run's first card); with one at a time it stops once every card in the
 * columns is face up.
 */
export function solve(deal, { budget = 5000, draw = 1 } = {}) {
  const start = {
    cols: deal.tableau.map(col => col.map(toNum)),
    down: deal.tableau.map(col => col.filter(c => !c.faceUp).length),
    home: [0, 0, 0, 0],
    talon: deal.stock.map(toNum),
    w: 0,
    draw,
    path: null,
  };
  settle(start);
  const seen = new Set();
  let left = budget;

  const search = s => {
    if (s.down.every(d => d === 0)) {
      if (draw === 1) return s;
      const done = finish(s);
      if (done) return done;
    }
    const key = `${s.home.join()}|${draw === 1 ? '' : s.w}|${s.cols.map((c, i) => s.down[i] + ':' + c.join('.')).join('|')}`;
    if (seen.has(key) || left-- <= 0) return null;
    seen.add(key);
    for (const make of moves(s)) { const won = search(settle(make())); if (won) return won; }
    return null;
  };
  const won = search(start);
  if (!won) return null;
  const steps = [];
  for (let p = won.path; p; p = p.prev) steps.unshift({ card: toCard(p.k), to: p.to });
  return steps;
}

/** Is there a way to win this deal (that `solve` can find)? */
export const canWin = (deal, opts) => !!solve(deal, opts);

const step = (s, k, to) => { s.path = { k, to, prev: s.path }; };
const fitsHome = (s, k) => s.home[suitOf(k)] === rankOf(k) - 1;
const copy = s => ({ ...s, cols: s.cols.map(c => [...c]), down: [...s.down], home: [...s.home], talon: [...s.talon] });

/** Where in the stock and waste a card can be played from: the positions p (the card is talon[p - 1]). */
function reachable(s) {
  const n = s.talon.length;
  if (s.draw === 1) return Array.from({ length: n }, (_, i) => i + 1);
  const at = new Set();
  if (s.w > 0) at.add(s.w);                                  // the top of the waste now
  for (let p = s.w + s.draw; p < n; p += s.draw) at.add(p);  // turning on to the end
  if (n) at.add(n);
  for (let p = s.draw; p < n; p += s.draw) at.add(p);        // and round again from the start
  return [...at];
}

/** Take the card at position p out of the stock and waste (the waste stays where it was). */
function takeAt(s, p) {
  const k = s.talon[p - 1];
  s.talon.splice(p - 1, 1);
  s.w = p - 1;
  return k;
}

/** A column has lost its top card(s): turn over the card under them. */
const turnOver = (s, i) => { if (s.down[i] === s.cols[i].length && s.down[i]) s.down[i]--; };

/**
 * Cards that are safe to send up go up (nothing could still want to sit on them: both
 * cards of the other colour one lower are up already), turning over what they uncover.
 * From the stock too when it turns one at a time (with three, taking a card out changes
 * which others can be reached, so that's left to the search).
 */
function settle(s) {
  const safe = k => {
    if (!fitsHome(s, k)) return false;
    const r = rankOf(k);
    return r <= 2 || [0, 1, 2, 3].every(t => RED[t] === RED[suitOf(k)] || s.home[t] >= r - 1);
  };
  for (let again = true; again;) {
    again = false;
    if (s.draw === 1) {
      for (let p = s.talon.length; p >= 1; p--) {
        const k = s.talon[p - 1];
        if (safe(k)) { takeAt(s, p); s.home[suitOf(k)]++; step(s, k, 'home'); again = true; }
      }
    }
    s.cols.forEach((col, i) => {
      while (col.length > s.down[i] && safe(col.at(-1))) {
        const k = col.pop();
        s.home[suitOf(k)]++;
        step(s, k, 'home');
        turnOver(s, i);
        again = true;
      }
    });
  }
  return s;
}

/**
 * With every card in the columns face up: play the rest out, sending up whatever can go
 * (from a column, or from the stock and waste). The finished position, or null if it
 * gets stuck.
 */
function finish(s0) {
  const s = copy(s0);
  while (s.home.some(h => h < 13)) {
    const i = s.cols.findIndex(col => col.length && fitsHome(s, col.at(-1)));
    if (i >= 0) { const k = s.cols[i].pop(); s.home[suitOf(k)]++; step(s, k, 'home'); continue; }
    const p = reachable(s).find(q => fitsHome(s, s.talon[q - 1]));
    if (p == null) return null;
    const k = takeAt(s, p);
    s.home[suitOf(k)]++;
    step(s, k, 'home');
  }
  return s;
}

/** The moves from `s`, the most promising first: each a function making the position after it (not yet settled). */
function moves(s) {
  const out = [];
  const add = (score, make) => out.push({ score, make });
  const fitsCol = (k, j) => {
    const col = s.cols[j];
    return col.length ? follows(k, col.at(-1)) : rankOf(k) === 13;
  };
  const playable = reachable(s);
  const fromTalon = playable.map(p => s.talon[p - 1]);
  // (A King that could use an empty column: in the stock, or face up on top of other cards)
  const anyKingWaiting = () => fromTalon.some(k => rankOf(k) === 13)
    || s.cols.some((col, i) => col.some((k, r) => r > 0 && r >= s.down[i] && rankOf(k) === 13));

  s.cols.forEach((col, i) => {
    const top = col.length - 1;
    if (top < s.down[i]) return;
    // A column's top card up to its foundation
    if (fitsHome(s, col[top])) add(50 + (top === s.down[i] && s.down[i] ? 40 : 0), () => {
      const n = copy(s);
      const k = n.cols[i].pop();
      n.home[suitOf(k)]++;
      step(n, k, 'home');
      turnOver(n, i);
      return n;
    });
    // A run (from any card in it) onto another column
    let from = top;
    while (from > s.down[i] && follows(col[from], col[from - 1])) from--;
    for (let r = from; r <= top; r++) {
      const k = col[r];
      let score;
      if (r === s.down[i] && s.down[i] > 0) score = 100 + s.down[i];       // turns over a card
      else if (r === 0) score = anyKingWaiting() ? 30 : -1;                 // empties a column
      else {
        // Off a face-up card: only worth it if that card can then go up, or a stock card can go on it
        const below = col[r - 1];
        score = fitsHome(s, below) || fromTalon.some(t => follows(t, below)) ? 10 : -1;
      }
      if (score < 0) continue;
      for (let j = 0; j < s.cols.length; j++) {
        if (j === i || !fitsCol(k, j)) continue;
        if (r === 0 && !s.cols[j].length) continue;                         // a whole column to an empty one
        add(score - (s.cols[j].length ? 0 : 5), () => {
          const n = copy(s);
          n.cols[j].push(...n.cols[i].splice(r));
          step(n, k, j);
          turnOver(n, i);
          return n;
        });
      }
    }
  });

  playable.forEach((p, q) => {
    const k = fromTalon[q];
    if (fitsHome(s, k)) add(60, () => { const n = copy(s); takeAt(n, p); n.home[suitOf(k)]++; step(n, k, 'home'); return n; });
    let empty = false;
    for (let j = 0; j < s.cols.length; j++) {
      if (!fitsCol(k, j)) continue;
      if (!s.cols[j].length) { if (empty) continue; empty = true; }      // (one empty column is as good as another)
      add(s.cols[j].length ? 40 : 20, () => { const n = copy(s); takeAt(n, p); n.cols[j].push(k); step(n, k, j); return n; });
    }
  });

  return out.sort((a, b) => b.score - a.score).map(m => m.make);
}

/** A shuffled deal: 7 columns (each with its last card face up) and the rest as the stock. */
export function deal() {
  const deck = shuffle(buildDeck());
  let i = 0;
  const tableau = Array.from({ length: 7 }, (_, c) => Array.from({ length: c + 1 }, (_, r) => ({ ...deck[i++], faceUp: r === c })));
  return { tableau, stock: deck.slice(i).map(c => ({ ...c, faceUp: false })) };
}

/**
 * A deal that can be won, turning the stock `draw` cards at a time: shuffles until `solve`
 * finds a way to win. It's given only a small `budget` each time, so a deal it can't settle
 * quickly is passed over for the next shuffle (at a few thousandths of a second each). After
 * `tries` shuffles without one the last is dealt anyway (all but impossible).
 */
export function winnableDeal({ tries = 40, budget = 1000, draw = 1 } = {}) {
  let d;
  for (let n = 0; n < tries; n++) {
    d = deal();
    if (canWin(d, { budget, draw })) return d;
  }
  return d;
}
