/**
 * TriPeaks: 28 cards in three peaks — rows of 3, 6, 9 and 10 — with only the bottom row
 * face up; a card turns over once both cards covering it are gone. Play any uncovered card
 * that's one higher or one lower than the top of the waste (King and Ace go round: K–A–2),
 * or turn the next card from the stock. Clear all three peaks to win.
 *
 * Scoring: each card played scores its place in the current streak (1, 2, 3, …), and the
 * streak starts again when you turn from the stock; clearing a peak scores 15 more.
 * Every move returns a new state.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';

export const VALUE = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
export const ROW_SIZES = [3, 6, 9, 10];
const ROW_START = [0, 3, 9, 18];
export const PEAK_BONUS = 15;

/** The places covering place i (the cards that must go before it turns over). */
export function coveredBy(i) {
  if (i >= 18) return [];
  if (i >= 9) { const j = i - 9; return [18 + j, 19 + j]; }
  if (i >= 3) { const k = i - 3, p = Math.floor(k / 2), a = k % 2; return [9 + 3 * p + a, 10 + 3 * p + a]; }
  return [3 + 2 * i, 4 + 2 * i];
}
/** Where place i sits: its row, and its left edge in card widths (with the gap counted in). */
export function placeOf(i) {
  const r = ROW_START.findLastIndex(start => i >= start);
  const j = i - ROW_START[r];
  const x = r === 3 ? j : r === 2 ? j + 0.5 : r === 1 ? 3 * Math.floor(j / 2) + (j % 2) + 1 : 3 * j + 1.5;
  return { row: r, x };
}

export function newTripeaks() {
  const deck = shuffle(buildDeck());
  const peaks = deck.slice(0, 28).map((c, i) => ({ ...c, faceUp: i >= 18 }));
  return { peaks, waste: [{ ...deck[28], faceUp: true }], stock: deck.slice(29).map(c => ({ ...c, faceUp: false })), moves: 0, score: 0, streak: 0 };
}

export const isFree = (s, i) => !!s.peaks[i] && coveredBy(i).every(j => !s.peaks[j]);

/** Is a card one higher or one lower than another (K and A next to each other)? */
export const adjacent = (a, b) => {
  const d = Math.abs(VALUE[a.rank] - VALUE[b.rank]);
  return d === 1 || d === 12;
};

export const canPlay = (s, i) => isFree(s, i) && adjacent(s.peaks[i], s.waste[s.waste.length - 1]);

export function play(s, i) {
  if (!canPlay(s, i)) throw new Error('That card isn\'t one higher or lower than the waste card.');
  const peaks = [...s.peaks];
  const card = peaks[i];
  peaks[i] = null;
  // Turn over any card this uncovers
  for (let j = 0; j < 18; j++) if (peaks[j] && !peaks[j].faceUp && coveredBy(j).every(k => !peaks[k])) peaks[j] = { ...peaks[j], faceUp: true };
  const streak = s.streak + 1;
  const peakCleared = i < 3;               // (a peak's top card is the last of it to go)
  return { ...s, peaks, waste: [...s.waste, { ...card, faceUp: true }], moves: s.moves + 1, streak, score: s.score + streak + (peakCleared ? PEAK_BONUS : 0) };
}

export function draw(s) {
  if (!s.stock.length) throw new Error('The stock is used up.');
  return { ...s, stock: s.stock.slice(1), waste: [...s.waste, { ...s.stock[0], faceUp: true }], moves: s.moves + 1, streak: 0 };
}

export const left = s => s.peaks.filter(Boolean).length;
export const isWon = s => left(s) === 0;
export const playable = s => s.peaks.map((_, i) => i).filter(i => canPlay(s, i));
export const isStuck = s => !isWon(s) && !playable(s).length && !s.stock.length;

const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const cardName = c => `${c.rank}${SYMBOL[c.suit]}`;

/**
 * The longest streak from here using only the cards in view: cards that would turn over
 * along the way stay unknown (the hint doesn't peek), but turning them counts for something.
 * Returns { line: [places…], v } (v: cards played × 10, turned × 4, peaks cleared × 6).
 */
function bestStreak(s) {
  const known = new Set(s.peaks.map((c, i) => (c && c.faceUp ? i : -1)).filter(i => i >= 0));
  let budget = 20000;
  const search = (gone, top) => {
    let best = { line: [], v: 0 };
    if (--budget < 0) return best;
    for (const i of known) {
      if (gone.has(i) || !coveredBy(i).every(j => !s.peaks[j] || gone.has(j)) || !adjacent(s.peaks[i], top)) continue;
      const now = new Set(gone).add(i);
      // Cards this uncovers: they turn over (still unknown to us)
      let turned = 0;
      for (let j = 0; j < 18; j++) if (s.peaks[j] && !known.has(j) && !now.has(j) && coveredBy(j).includes(i) && coveredBy(j).every(k => !s.peaks[k] || now.has(k))) turned++;
      const sub = search(now, s.peaks[i]);
      const v = 10 + turned * 4 + (i < 3 ? 6 : 0) + sub.v;
      if (v > best.v) best = { line: [i, ...sub.line], v };
    }
    return best;
  };
  return search(new Set(s.peaks.map((c, i) => (c ? -1 : i)).filter(i => i >= 0)), s.waste[s.waste.length - 1]);
}

/**
 * A move for the Hint button: { play: i, why }, { draw: true, why }, or null. Plans the longest
 * streak with the cards in view (turning cards over along the way counts too).
 */
export function hint(s) {
  const { line } = bestStreak(s);
  if (line.length) {
    const i = line[0], card = s.peaks[i];
    const why = line.length > 1 ? ` — it starts a run of ${line.length} cards in a row` : '';
    return { play: i, why: `Play the ${cardName(card)}${why}.` };
  }
  return s.stock.length ? { draw: true, why: 'Nothing fits: turn the next card from the stock.' } : null;
}
