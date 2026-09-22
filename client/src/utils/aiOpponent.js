/**
 * AI Opponent strategies shared across trick-taking card games.
 * Each game calls these helpers with game-specific parameters.
 */

import { RANK_VALUES, trickWinner } from './cardEngine';

/**
 * Choose a card to play from AI's hand.
 * @param {Object} params
 * @param {Array}  params.hand         - AI's cards
 * @param {Array}  params.trick        - Cards played so far this trick [{card, playerId}]
 * @param {string} params.leadSuit     - Suit that was led
 * @param {string} params.trumpSuit    - Trump suit (null if none)
 * @param {string} params.difficulty   - 'easy' | 'medium' | 'hard'
 * @param {string} params.gameType     - 'hearts' | 'spades' | 'rook' | 'bridge'
 * @param {Object} params.gameState    - Game-specific state for hard AI
 * @returns {Object} The card to play
 */
export function aiChooseCard({ hand, trick, leadSuit, trumpSuit, difficulty, gameType, gameState = {} }) {
  const legal = getLegalCards(hand, leadSuit, trumpSuit, gameType);
  if (legal.length === 1) return legal[0];

  switch (difficulty) {
    case 'easy':  return easyPlay(legal);
    case 'medium': return mediumPlay(legal, trick, leadSuit, trumpSuit, gameType);
    case 'hard':   return hardPlay(legal, trick, leadSuit, trumpSuit, gameType, gameState);
    default: return easyPlay(legal);
  }
}

/** Get legal cards to play given the lead suit */
function getLegalCards(hand, leadSuit, trumpSuit, gameType) {
  if (!leadSuit) return hand; // Leading
  const followSuit = hand.filter(c => c.suit === leadSuit);
  if (followSuit.length > 0) return followSuit;

  // Hearts: can't play hearts or Q♠ until broken (simplified: just return all)
  return hand;
}

/** Easy: random legal card */
function easyPlay(legal) {
  return legal[Math.floor(Math.random() * legal.length)];
}

/** Medium: simple heuristic */
function mediumPlay(legal, trick, leadSuit, trumpSuit, gameType) {
  if (gameType === 'hearts') {
    return mediumHeartsPlay(legal, trick, leadSuit);
  }
  if (gameType === 'spades') {
    return mediumSpadesPlay(legal, trick, leadSuit, trumpSuit);
  }
  // Default: play lowest card if not winning, else play lowest winner
  const trickCards = trick.map(t => t.card);
  if (trickCards.length === 0) {
    // Leading: play lowest
    return legal.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
  }
  const currentWinner = trickWinner(trickCards, leadSuit, trumpSuit);
  const winning = legal.filter(c => RANK_VALUES[c.rank] > RANK_VALUES[currentWinner.rank] && (c.suit === leadSuit || c.suit === trumpSuit));
  if (winning.length > 0) {
    // Play lowest winning card
    return winning.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
  }
  // Can't win: play lowest value card
  return legal.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
}

function mediumHeartsPlay(legal, trick, leadSuit) {
  const trickCards = trick.map(t => t.card);
  const highPenalty = legal.filter(c => c.suit === 'hearts' || (c.suit === 'spades' && c.rank === 'Q'));
  const safe = legal.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 'Q'));

  if (trickCards.length === 0) {
    // Lead: play lowest safe card, or just lowest
    const pool = safe.length > 0 ? safe : legal;
    return pool.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
  }
  // Dump high-penalty cards when can't follow suit
  const followSuit = legal.filter(c => c.suit === leadSuit);
  if (followSuit.length === 0 && highPenalty.length > 0) {
    return highPenalty.reduce((a, b) => RANK_VALUES[a.rank] > RANK_VALUES[b.rank] ? a : b);
  }
  // Follow suit: play lowest that won't win, or if must win, play lowest
  if (followSuit.length > 0) {
    return followSuit.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
  }
  return legal.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
}

function mediumSpadesPlay(legal, trick, leadSuit, trumpSuit) {
  const trickCards = trick.map(t => t.card);
  if (trickCards.length === 0) {
    // Leading: avoid leading trump (spades), play mid-value
    const nonTrump = legal.filter(c => c.suit !== trumpSuit);
    const pool = nonTrump.length > 0 ? nonTrump : legal;
    const sorted = [...pool].sort((a, b) => RANK_VALUES[a.rank] - RANK_VALUES[b.rank]);
    return sorted[Math.floor(sorted.length / 2)] || sorted[0];
  }
  return mediumPlay(legal, trick, leadSuit, trumpSuit, 'default');
}

/** Hard: uses more sophisticated logic */
function hardPlay(legal, trick, leadSuit, trumpSuit, gameType, gameState) {
  // For hard, use a slightly improved version of medium with memory
  // (Full MCTS would be ideal but impractical in browser — this is a strong heuristic)
  if (gameType === 'hearts') return hardHeartsPlay(legal, trick, leadSuit, gameState);
  return mediumPlay(legal, trick, leadSuit, trumpSuit, gameType);
}

function hardHeartsPlay(legal, trick, leadSuit, gameState) {
  const trickCards = trick.map(t => t.card);
  const isLeading = trickCards.length === 0;
  const highPenalty = legal.filter(c => c.suit === 'hearts' || (c.suit === 'spades' && c.rank === 'Q'));
  const safe = legal.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 'Q'));

  // Try to shoot the moon if we have many hearts
  const myHearts = legal.filter(c => c.suit === 'hearts');
  if (myHearts.length >= 8) {
    // Play highest to try to win every trick
    return legal.reduce((a, b) => RANK_VALUES[a.rank] > RANK_VALUES[b.rank] ? a : b);
  }

  if (isLeading) {
    // Lead lowest safe card
    const pool = safe.length > 0 ? safe : legal;
    return pool.reduce((a, b) => RANK_VALUES[a.rank] < RANK_VALUES[b.rank] ? a : b);
  }

  // Dump Q♠ ASAP when void in lead suit
  const followSuit = legal.filter(c => c.suit === leadSuit);
  if (followSuit.length === 0) {
    const qSpades = legal.find(c => c.suit === 'spades' && c.rank === 'Q');
    if (qSpades) return qSpades;
    // Dump highest heart
    if (myHearts.length > 0) return myHearts.reduce((a, b) => RANK_VALUES[a.rank] > RANK_VALUES[b.rank] ? a : b);
  }

  return mediumHeartsPlay(legal, trick, leadSuit);
}

/** AI bidding for Spades */
export function aiBidSpades({ hand, difficulty }) {
  const spades = hand.filter(c => c.suit === 'spades');
  const highCards = hand.filter(c => ['A', 'K', 'Q'].includes(c.rank));
  const base = spades.length + Math.floor(highCards.length / 2);

  switch (difficulty) {
    case 'easy':   return Math.max(1, Math.floor(Math.random() * 5) + 1);
    case 'medium': return Math.max(1, Math.min(base, 7));
    case 'hard':   return Math.max(1, Math.min(base + (spades.length > 5 ? 1 : 0), 9));
    default: return 2;
  }
}

/** AI bidding for Bridge (simplified point-count) */
export function aiBidBridge({ hand, difficulty, currentBid, position }) {
  const hcp = calcHCP(hand);
  const BIDS = ['1C','1D','1H','1S','1NT','2C','2D','2H','2S','2NT','3C','3D','3H','3S','3NT','Pass'];

  if (difficulty === 'easy') {
    return Math.random() < 0.6 ? 'Pass' : BIDS[Math.floor(Math.random() * 5)];
  }

  if (hcp < 12) return 'Pass';
  if (hcp >= 12 && hcp <= 14) {
    const longestSuit = getLongestSuit(hand);
    return `1${longestSuit[0].toUpperCase()}`;
  }
  if (hcp >= 15 && hcp <= 17) return '1NT';
  if (hcp >= 18 && hcp <= 19) return '2NT';
  if (hcp >= 20) return '2C';
  return 'Pass';
}

function calcHCP(hand) {
  const pts = { A: 4, K: 3, Q: 2, J: 1 };
  return hand.reduce((s, c) => s + (pts[c.rank] || 0), 0);
}

function getLongestSuit(hand) {
  const counts = {};
  for (const c of hand) counts[c.suit] = (counts[c.suit] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'spades';
}
