/**
 * Standard deck utilities used across all card games.
 * Rook uses a separate deck (see rookDeck.js).
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

/** Compare two cards by rank value. Returns positive if a > b. */
export function compareRank(a, b) {
  return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
}

/** Determine which card wins a trick given lead suit and optional trump suit */
export function trickWinner(trick, leadSuit, trumpSuit = null) {
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i];
    const bestTrump = best.suit === trumpSuit;
    const cardTrump = card.suit === trumpSuit;
    if (cardTrump && !bestTrump) {
      best = card;
    } else if (cardTrump && bestTrump) {
      if (RANK_VALUES[card.rank] > RANK_VALUES[best.rank]) best = card;
    } else if (!cardTrump && !bestTrump) {
      if (card.suit === leadSuit && best.suit !== leadSuit) best = card;
      else if (card.suit === leadSuit && best.suit === leadSuit &&
               RANK_VALUES[card.rank] > RANK_VALUES[best.rank]) best = card;
    }
  }
  return best;
}

/** Deal n cards from the top of a deck */
export function dealCards(deck, n) {
  return { hand: deck.slice(0, n), remaining: deck.slice(n) };
}
