/**
 * Standard deck utilities used across all card games.
 * Rook uses its own deck (see games/rook/rookRules.js); trick-taking rules
 * live in games/cards/tricks.js.
 */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_COLORS  = { spades: 'text-gray-900', hearts: 'text-red-600', diamonds: 'text-red-600', clubs: 'text-gray-900' };
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,A:14 };

/** Build a standard 52-card deck */
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}`, faceUp: false });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
