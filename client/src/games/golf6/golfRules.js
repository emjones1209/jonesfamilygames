/**
 * 6-Card Golf rules and computer player (pure functions, no React).
 *
 * A grid is 2 rows × 3 columns of cards { rank, suit, id, faceUp }. Lowest score
 * wins; two cards of the same rank in a column cancel to 0.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine';

export function cardValue(card) {
  if (!card) return 0;
  if (card.suit === 'joker') return -4;
  if (card.rank === '2') return -2;
  if (card.rank === 'K') return 0;
  if (card.rank === 'A') return 1;
  if (card.rank === 'J') return 11;
  if (card.rank === 'Q') return 12;
  return parseInt(card.rank, 10) || 10;
}

export function buildGolfDeck() {
  const base = buildDeck();
  base.push({ suit: 'joker', rank: 'Jo', id: 'joker-1', faceUp: false });
  base.push({ suit: 'joker', rank: 'Jo', id: 'joker-2', faceUp: false });
  return shuffle(base);
}

/** Score of the face-up cards (the true score once every card is revealed). */
export function gridScore(grid) {
  if (!grid) return 0;
  let total = 0;
  for (let col = 0; col < 3; col++) {
    const top = grid[0][col], bot = grid[1][col];
    if (top && bot && top.faceUp && bot.faceUp && top.rank === bot.rank) continue;
    if (top && top.faceUp) total += cardValue(top);
    if (bot && bot.faceUp) total += cardValue(bot);
  }
  return total;
}

export const allFaceUp = grid => !!grid && grid.every(row => row.every(c => c && c.faceUp));

export function dealGame(numPlayers) {
  const deck = buildGolfDeck();   // 54 cards: 52 standard + 2 jokers
  const grids = [];
  let idx = 0;
  for (let p = 0; p < numPlayers; p++) {
    grids.push([
      [0, 1, 2].map(() => ({ ...deck[idx++], faceUp: false })),
      [0, 1, 2].map(() => ({ ...deck[idx++], faceUp: false })),
    ]);
  }
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  const discard = [{ ...stock.shift(), faceUp: true }];
  return { grids, stock, discard };
}

/** If the stock is empty, shuffle the discard pile (keeping its top card) back into it. */
export function refillStock(stock, discard) {
  if (stock.length || discard.length < 2) return { stock, discard };
  return { stock: shuffle(discard.slice(1)).map(c => ({ ...c, faceUp: false })), discard: [discard[0]] };
}

// ── Computer player ──────────────────────────────────────────────────────────
//
// easy   – casual: random choices, ignores pairs, sometimes wastes a good card
// medium – sensible: swaps out its highest cards for lower ones
// hard   – plays like a good player: scores the whole grid (pairs count 0,
//          hidden cards count as an average card), goes for pairs, won't hand
//          you a card you can pair, and only finishes the round when it's ahead

const HIDDEN_VALUE = 5;   // roughly the average card value in the deck

/** Estimated final score: face-down cards count as an average card. */
export function estimateGrid(grid) {
  let total = 0;
  for (let col = 0; col < 3; col++) {
    const top = grid[0][col], bot = grid[1][col];
    if (top.faceUp && bot.faceUp && top.rank === bot.rank) continue;
    total += top.faceUp ? cardValue(top) : HIDDEN_VALUE;
    total += bot.faceUp ? cardValue(bot) : HIDDEN_VALUE;
  }
  return total;
}

const POSITIONS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]];

const placeCard = (grid, card, [row, col]) =>
  grid.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? { ...card, faceUp: true } : c)));

/** Is (row, col) one half of a face-up matching pair? */
const inPair = (grid, row, col) => {
  const other = grid[1 - row][col], me = grid[row][col];
  return me.faceUp && other.faceUp && me.rank === other.rank;
};

/** Ranks the opponents could pair right now (a face-up card with a face-down or different partner). */
function pairableRanks(opponentGrids) {
  const ranks = new Set();
  for (const g of opponentGrids) {
    for (let col = 0; col < 3; col++) {
      for (const row of [0, 1]) {
        const me = g[row][col], other = g[1 - row][col];
        if (me.faceUp && !(other.faceUp && other.rank === me.rank)) ranks.add(me.rank);
      }
    }
  }
  return ranks;
}

/** Hard: the best place for `card` and how much it lowers the estimated score. */
function bestPlacement(grid, card, { allowFinish = true } = {}) {
  const before = estimateGrid(grid);
  let best = null;
  for (const pos of POSITIONS) {
    const next = placeCard(grid, card, pos);
    if (!allowFinish && allFaceUp(next)) continue;
    const gain = before - estimateGrid(next);
    if (!best || gain > best.gain) best = { pos, gain, next };
  }
  return best;
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * Take the top discard (true) or draw from the stock (false)?
 */
export function chooseSource({ grid, topDiscard, difficulty, rng = Math.random }) {
  if (!topDiscard) return false;
  if (difficulty === 'easy') return rng() < 0.35;
  if (difficulty === 'medium') {
    return grid.flat().some(c => c.faceUp && cardValue(c) - cardValue(topDiscard) > 2);
  }
  // hard: take it if it's worth at least 2 points (or completes a pair)
  const best = bestPlacement(grid, topDiscard);
  return !!best && best.gain >= 2;
}

/**
 * Where to put `card` ([row, col]), or null to discard it. A card taken from
 * the discard pile is always kept.
 */
export function choosePlacement({ grid, opponentGrids = [], card, fromDiscard, difficulty, rng = Math.random }) {
  const dv = cardValue(card);
  const hidden = POSITIONS.filter(([r, c]) => !grid[r][c].faceUp);
  const worseFaceUp = POSITIONS.filter(([r, c]) => grid[r][c].faceUp && cardValue(grid[r][c]) > dv);

  if (difficulty === 'easy') {
    // Casual: keep low-ish cards, dropped somewhere that isn't obviously worse
    if (!fromDiscard && (dv > 5 || rng() < 0.3)) return null;
    const options = [...worseFaceUp, ...hidden];
    return options.length ? pick(options, rng) : fromDiscard ? pick(POSITIONS, rng) : null;
  }

  if (difficulty === 'medium') {
    let best = null, bestGain = 1;
    for (const [r, c] of POSITIONS) {
      const cell = grid[r][c];
      if (!cell.faceUp) { if (dv <= -2 && bestGain > 0) { bestGain = 0; best = [r, c]; } }
      else { const gain = cardValue(cell) - dv; if (gain > bestGain) { bestGain = gain; best = [r, c]; } }
    }
    // No good swap: put a low card over a face-down one to make progress
    if (!best && dv <= 4 && hidden.length) best = pick(hidden, rng);
    if (!best && fromDiscard) {
      best = worseFaceUp.length
        ? worseFaceUp.reduce((a, b) => (cardValue(grid[b[0]][b[1]]) > cardValue(grid[a[0]][a[1]]) ? b : a))
        : hidden.length ? pick(hidden, rng) : POSITIONS[0];
    }
    return best;
  }

  // ── hard ──
  const finishing = bestPlacement(grid, card);
  let choice = finishing;
  // Only finish the round (turn over the last card) when clearly ahead
  if (finishing && allFaceUp(finishing.next)) {
    const myFinal = gridScore(finishing.next);
    const theirs = Math.min(...opponentGrids.map(estimateGrid));
    if (opponentGrids.length && myFinal > theirs - 3) choice = bestPlacement(grid, card, { allowFinish: false });
  }
  // Never break up a pair for a small gain
  if (choice && inPair(grid, ...choice.pos) && choice.gain < 4) choice = null;

  if (fromDiscard) return (choice || finishing).pos;
  // Discarding a card an opponent can pair helps them, so it counts against discarding
  const discardCost = pairableRanks(opponentGrids).has(card.rank) ? 3 : 0;
  if (choice && choice.gain + discardCost > 0.5) return choice.pos;
  return null;
}
