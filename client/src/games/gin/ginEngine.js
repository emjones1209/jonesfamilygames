/**
 * A whole game of Gin Rummy (hand after hand, to 100) as a pure state machine,
 * shared by the single-player game (run in the browser) and play-together
 * tables (run on the server). Two players: seats 0 and 1.
 *
 * Each hand: 10 cards each and one card turned up to start the discard pile.
 * First the non-dealer, then the dealer, may take that card; if both pass,
 * the non-dealer draws from the stock. Then each turn: draw (from the stock
 * or the pile), then discard — or knock. You may knock when your deadwood
 * (after discarding) is 10 or less; with none it's gin, and if all 11 cards
 * make melds before you discard it's big gin.
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed:
 *   { type: 'draw', seat, from }        from = 'stock' | 'discard'
 *   { type: 'pass', seat }              turn down the first face-up card
 *   { type: 'discard', seat, cardId }
 *   { type: 'knock', seat, cardId }     cardId = the card to discard (null for big gin)
 *   { type: 'nextHand' }  { type: 'newGame' }
 *
 * `waitingFor(state)` says whose move it is; `robotAction(state, seat, level)`
 * picks a computer player's move; `viewFor(state, seat)` hides the other hand
 * and the stock (until the hand is over).
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';
import {
  HAND_SIZE, KNOCK_LIMIT, DEAD_STOCK, GAME_TARGET, GAME_BONUS, HAND_BONUS,
  bestMelds, defend, scoreKnock, chooseDiscard, wantsDiscard,
} from './ginRules.js';

const other = seat => 1 - seat;
const top = s => s.discard[s.discard.length - 1] ?? null;

function deal(game, dealer, deck = shuffle(buildDeck())) {
  const first = other(dealer);
  return {
    ...game,
    phase: 'firstTake',                        // firstTake | draw | discard | handOver | gameOver
    dealer,
    turn: first,                               // the non-dealer may take the first card
    passes: 0,                                 // players who've turned down the first card
    stockOnly: false,                          // both passed: the first draw must come from the stock
    hands: [0, 1].map(seat => deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)),
    discard: [deck[2 * HAND_SIZE]],            // the last card is the top
    stock: deck.slice(2 * HAND_SIZE + 1),
    takenFromPile: null,                       // the card just taken from the pile (it can't go straight back)
    pickups: [[], []],                         // cards each player has taken from the pile (everyone saw them)
    lastMove: null,                            // { seat, kind: 'stock' | 'pile' | 'pass' | 'discard', card? }
    result: null,
  };
}

export function newGame({ dealer = 1, deck } = {}) {
  return deal({ scores: [0, 0], handsWon: [0, 0], handNo: 0, winner: null, final: null }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export const waitingFor = s => (['firstTake', 'draw', 'discard'].includes(s.phase) ? s.turn : null);

/** After both players turn the first card down, the non-dealer must draw from the stock. */
export const mustDrawStock = s => s.phase === 'draw' && s.stockOnly;

/** The seat's hand arranged into its best melds: { melds, deadwood, points }. */
export const arrangement = (s, seat) => bestMelds(s.hands[seat]);

/**
 * What knocking with `cardId` thrown away would score for `seat` (or null if
 * it isn't allowed): { kind, points }. cardId null = big gin (all 11 melded).
 */
export function knockCheck(s, seat, cardId) {
  if (s.phase !== 'discard' || s.turn !== seat) return null;
  const hand = s.hands[seat];
  if (cardId == null) return bestMelds(hand).points === 0 ? { kind: 'bigGin', points: 0 } : null;
  if (cardId === s.takenFromPile?.id) return null;
  const rest = hand.filter(c => c.id !== cardId);
  if (rest.length === hand.length) return null;
  const { points } = bestMelds(rest);
  if (points > KNOCK_LIMIT) return null;
  return { kind: points === 0 ? 'gin' : 'knock', points };
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, a) {
  const playing = ['firstTake', 'draw', 'discard'].includes(s.phase);
  if (['draw', 'pass', 'discard', 'knock'].includes(a.type)) {
    if (!playing) throw new Error('The hand is over.');
    if (a.seat !== s.turn) throw new Error('It\'s not your turn.');
  }
  switch (a.type) {
    case 'pass': {
      if (s.phase !== 'firstTake') throw new Error('You can only pass on the first card.');
      const passes = s.passes + 1;
      if (passes < 2) return { ...s, passes, turn: other(a.seat), lastMove: { seat: a.seat, kind: 'pass' } };
      // Both passed: the non-dealer starts by drawing from the stock
      return { ...s, passes, phase: 'draw', stockOnly: true, turn: other(s.dealer), lastMove: { seat: a.seat, kind: 'pass' } };
    }

    case 'draw': {
      if (s.phase !== 'firstTake' && s.phase !== 'draw') throw new Error('You\'ve already drawn — now discard a card.');
      if (s.phase === 'firstTake' && a.from !== 'discard') throw new Error('Take the face-up card, or pass.');
      if (a.from === 'discard') {
        if (mustDrawStock(s)) throw new Error('You both turned that card down — draw from the stock.');
        const card = top(s);
        if (!card) throw new Error('The pile is empty — draw from the stock.');
        return {
          ...s, phase: 'discard',
          hands: s.hands.map((h, i) => (i === a.seat ? [...h, card] : h)),
          discard: s.discard.slice(0, -1),
          takenFromPile: card,
          pickups: s.pickups.map((p, i) => (i === a.seat ? [...p, card] : p)),
          lastMove: { seat: a.seat, kind: 'pile', card },
        };
      }
      if (a.from !== 'stock') throw new Error('Draw from the stock or the pile.');
      const [card, ...stock] = s.stock;
      return {
        ...s, phase: 'discard', stock, stockOnly: false,
        hands: s.hands.map((h, i) => (i === a.seat ? [...h, card] : h)),
        takenFromPile: null,
        lastMove: { seat: a.seat, kind: 'stock', card },
      };
    }

    case 'discard': {
      if (s.phase !== 'discard') throw new Error('Draw a card first.');
      const card = s.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (card.id === s.takenFromPile?.id) throw new Error('You can\'t throw back the card you just took from the pile.');
      const next = {
        ...s,
        hands: s.hands.map((h, i) => (i === a.seat ? h.filter(c => c.id !== card.id) : h)),
        discard: [...s.discard, card],
        pickups: s.pickups.map(p => p.filter(c => c.id !== card.id)),
        takenFromPile: null,
        lastMove: { seat: a.seat, kind: 'discard', card },
      };
      // Only two cards left in the stock and nobody has knocked: nobody wins this hand
      if (next.stock.length <= DEAD_STOCK) return finishHand(next, null);
      return { ...next, phase: 'draw', turn: other(a.seat) };
    }

    case 'knock': {
      const check = knockCheck(s, a.seat, a.cardId ?? null);
      if (!check) {
        if (s.phase !== 'discard') throw new Error('Draw a card first.');
        if (a.cardId != null && a.cardId === s.takenFromPile?.id) throw new Error('You can\'t throw back the card you just took from the pile.');
        throw new Error(`To knock, your deadwood must be ${KNOCK_LIMIT} or less after you discard.`);
      }
      const card = a.cardId == null ? null : s.hands[a.seat].find(c => c.id === a.cardId);
      const next = {
        ...s,
        hands: s.hands.map((h, i) => (i === a.seat ? h.filter(c => c.id !== a.cardId) : h)),
        discard: card ? [...s.discard, card] : s.discard,
        takenFromPile: null,
        lastMove: { seat: a.seat, kind: 'knock', card },
      };
      return finishHand(next, { seat: a.seat, kind: check.kind });
    }

    case 'nextHand':
      if (s.phase !== 'handOver') return s;
      return { ...deal(s, other(s.dealer)), handNo: s.handNo + 1 };

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ dealer: other(s.dealer) });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

/** Show both hands and score them. `knock` is null when the stock ran out. */
function finishHand(s, knock) {
  if (!knock) {
    return { ...s, phase: 'handOver', result: { kind: 'draw', hands: [0, 1].map(seat => bestMelds(s.hands[seat])) } };
  }
  const knocker = knock.seat, defender = other(knocker);
  const mine = bestMelds(s.hands[knocker]);
  const theirs = defend(s.hands[defender], mine.melds, knock.kind !== 'knock');
  const { winner: rel, points, undercut } = scoreKnock(knock.kind, mine.points, theirs.points);
  const winner = rel === 0 ? knocker : defender;
  const hands = [];
  hands[knocker] = mine;
  hands[defender] = theirs;
  const scores = s.scores.map((n, i) => (i === winner ? n + points : n));
  const handsWon = s.handsWon.map((n, i) => (i === winner ? n + 1 : n));
  const result = { kind: knock.kind, knocker, winner, points, undercut, hands };
  if (scores[winner] < GAME_TARGET) return { ...s, phase: 'handOver', scores, handsWon, result };
  // Game over: 100 for winning, and 25 for every hand each player won
  const final = [0, 1].map(seat => scores[seat] + handsWon[seat] * HAND_BONUS + (seat === winner ? GAME_BONUS : 0));
  return { ...s, phase: 'gameOver', scores, handsWon, result, winner, final };
}

// ── Computer players ─────────────────────────────────────────────────────────
const DECK = buildDeck();

/** Cards `seat` hasn't seen: not in their hand or the pile, and not known to be in the other hand. */
function unseenBy(s, seat) {
  const seen = new Set([...s.hands[seat], ...s.discard, ...s.pickups[other(seat)]].map(c => c.id));
  return DECK.filter(c => !seen.has(c.id));
}

export function robotAction(s, seat, level) {
  const hand = s.hands[seat];
  const unseen = level === 'hard' ? unseenBy(s, seat) : null;
  if (s.phase === 'firstTake') return wantsDiscard(hand, top(s), level, unseen) ? { type: 'draw', seat, from: 'discard' } : { type: 'pass', seat };
  if (s.phase === 'draw') {
    const take = !mustDrawStock(s) && top(s) && wantsDiscard(hand, top(s), level, unseen);
    return { type: 'draw', seat, from: take ? 'discard' : 'stock' };
  }
  if (bestMelds(hand).points === 0) return { type: 'knock', seat, cardId: null };
  const card = chooseDiscard(hand, { level, keep: s.takenFromPile?.id, theirPickups: s.pickups[other(seat)], unseen });
  // Knock as soon as possible (in 1,600 test games, waiting for a lower count or gin did no better)
  if (knockCheck(s, seat, card.id)) return { type: 'knock', seat, cardId: card.id };
  return { type: 'discard', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
const hide = cards => cards.map(() => null);

export function viewFor(s, seat) {
  const over = s.phase === 'handOver' || s.phase === 'gameOver';
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat || over ? h : hide(h))),
    stock: hide(s.stock),
    // A card drawn from the stock is only seen by the player who drew it
    lastMove: s.lastMove && s.lastMove.kind === 'stock' && s.lastMove.seat !== seat ? { ...s.lastMove, card: null } : s.lastMove,
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : other(x));
  const arr = a => a && [a[1], a[0]];
  return {
    ...s,
    dealer: r(s.dealer), turn: r(s.turn), winner: r(s.winner),
    hands: arr(s.hands), pickups: arr(s.pickups), scores: arr(s.scores), handsWon: arr(s.handsWon), final: arr(s.final),
    lastMove: s.lastMove && { ...s.lastMove, seat: r(s.lastMove.seat) },
    result: s.result && {
      ...s.result, knocker: r(s.result.knocker), winner: r(s.result.winner), hands: arr(s.result.hands),
    },
  };
}
