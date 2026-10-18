/**
 * Solitaire's auto-complete: once every card in the columns is face up, the game
 * plays itself out to the end.
 *
 * It can always be finished then: the lowest card any foundation still needs can't
 * be buried under another card, because a face-up column runs downwards and every
 * lower card is already up. So it's on top of a column, or somewhere in the stock
 * (which is drawn through, a card at a time, as often as it takes).
 */
import { RANK_VALUES } from '../../utils/cardEngine.js';

const SOL_RANK = { ...RANK_VALUES, A: 1 };   // aces are low in Solitaire

export const foundationCount = game => Object.values(game.foundations).reduce((s, f) => s + f.length, 0);

/** Can this card go up on its foundation? */
export function fitsFoundation(card, game) {
  const pile = game.foundations[card.suit];
  if (pile.length === 0) return card.rank === 'A';
  return SOL_RANK[card.rank] === SOL_RANK[pile[pile.length - 1].rank] + 1;
}

/** Every card in the columns face up (and the game not already won)? */
export const canAutoComplete = game =>
  foundationCount(game) < 52 && game.tableau.every(col => col.every(c => c.faceUp));

/**
 * The game after auto-complete's next step — a card up onto its foundation, or else a
 * card drawn from the stock (turning the waste over when the stock runs out) — with
 * `kind` saying which ('up' or 'draw'). Null once there's nothing left to do.
 */
export function autoStep(game) {
  if (foundationCount(game) === 52) return null;
  const up = (card, rest) => ({
    ...rest, kind: 'up',
    foundations: { ...rest.foundations, [card.suit]: [...rest.foundations[card.suit], card] },
  });
  if (game.waste.length && fitsFoundation(game.waste[0], game)) return up(game.waste[0], { ...game, waste: game.waste.slice(1) });
  for (let i = 0; i < game.tableau.length; i++) {
    const col = game.tableau[i];
    const top = col[col.length - 1];
    if (top?.faceUp && fitsFoundation(top, game)) {
      return up(top, { ...game, tableau: game.tableau.map((c, j) => (j === i ? c.slice(0, -1) : c)) });
    }
  }
  if (game.stock.length) {
    return { ...game, kind: 'draw', stock: game.stock.slice(1), waste: [{ ...game.stock[0], faceUp: true }, ...game.waste] };
  }
  if (game.waste.length) {
    return { ...game, kind: 'draw', stock: [...game.waste].reverse().map(c => ({ ...c, faceUp: false })), waste: [] };
  }
  return null;
}
