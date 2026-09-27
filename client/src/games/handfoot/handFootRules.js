/**
 * Hand and Foot — one hand of it, as pure functions. Four players play in two
 * partnerships (seats 0 & 2 against 1 & 3); three play each for themselves.
 * "Side" below means a partnership, or a single player when there are three.
 * A close cousin of Canasta, with the common house rules:
 *
 * - One more deck than players, with their jokers (270 cards for four players,
 *   216 for three). Everyone is dealt a hand and a
 *   foot of 11 cards each; you play your hand, then pick up your foot.
 * - Jokers and 2s are wild. Red 3s are set aside for 100 each (and replaced);
 *   black 3s can only be discarded.
 * - On your turn draw 2 cards, or — once your side has melded — take the top 7
 *   cards of the discard pile by melding its top card with two matching natural
 *   cards from your hand. Then meld, and end by discarding one card.
 * - A meld is 3 to 7 cards of one rank, with at least as many natural cards as
 *   wild ones (and at most 3 wild). Seven cards make a book: clean (no wild
 *   cards) 500, dirty 300. A finished book is closed; a new meld of the same
 *   rank can be started.
 * - A side's first meld each hand must total at least 50, 90, 120 then 150
 *   points (by round), all laid in one turn.
 * - Used up your hand? Pick up your foot (straight away if you melded your
 *   last card, or at the end of your turn if you discarded it).
 * - You go out from your foot, once your side has a clean book and a dirty
 *   book: +100 and the hand ends. It also ends if the stock runs out.
 *
 * `act(state, action)` returns the next state (for the player whose turn it
 * is) or throws an Error whose message explains why the move isn't allowed:
 *   { type: 'draw' }  { type: 'takePile', ids }  { type: 'meld', ids, rank? }
 *   { type: 'undo' }  { type: 'discard', id }
 */
import { shuffle } from '../../utils/cardEngine.js';

export const PILE_SIZE = 11;             // cards in each hand and each foot
export const ROUNDS = 4;
export const MINIMUMS = [50, 90, 120, 150];
export const BOOK = 7;
export const MAX_WILD = 3;
export const TAKE = 7;                   // taking the pile gets you its top 7 cards
export const CLEAN_BOOK = 500, DIRTY_BOOK = 300, RED_THREE = 100, GOING_OUT = 100;
export const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

/** The side `seat` plays for: partners share one when there are four players. */
export const teamOf = (s, seat) => (s.players === 4 ? seat % 2 : seat);
export const sideCount = s => (s.players === 4 ? 2 : s.players);
export const seatsOf = (s, side) => Array.from({ length: s.players }, (_, i) => i).filter(seat => teamOf(s, seat) === side);
export const nextSeat = (s, seat) => (seat + 1) % s.players;
/** "your team has" with partners, "you have" when playing alone (for messages). */
const yours = s => (s.players === 4 ? 'your team has' : 'you have');

// ── Cards ────────────────────────────────────────────────────────────────────
export function makeDeck(decks = 5) {
  const deck = [];
  for (let d = 1; d <= decks; d++) {
    for (const suit of SUITS) for (const rank of ['2', ...RANK_ORDER]) deck.push({ id: `${rank}-${suit}-${d}`, suit, rank });
    for (const j of [1, 2]) deck.push({ id: `JK-${d}-${j}`, suit: 'joker', rank: 'JK' });
  }
  return deck;
}

export const isWild = c => c.rank === 'JK' || c.rank === '2';
export const isRedThree = c => c.rank === '3' && (c.suit === 'hearts' || c.suit === 'diamonds');
export const isBlackThree = c => c.rank === '3' && (c.suit === 'spades' || c.suit === 'clubs');
export const isNatural = c => !isWild(c) && c.rank !== '3';

export function cardValue(c) {
  if (c.rank === 'JK') return 50;
  if (c.rank === '2' || c.rank === 'A') return 20;
  if (['K', 'Q', 'J', '10', '9', '8'].includes(c.rank)) return 10;
  if (isRedThree(c)) return 0;           // red 3s score as bonuses instead
  return 5;                              // 7 down to 4, and black 3s
}
export const valueOf = cards => cards.reduce((s, c) => s + cardValue(c), 0);

const rankIndex = c => (isWild(c) ? 20 + (c.rank === 'JK' ? 1 : 0) : RANK_ORDER.indexOf(c.rank));
/** Hand order: A down to 3, wild cards last. */
export const sortHand = hand => [...hand].sort((a, b) => rankIndex(a) - rankIndex(b) || a.suit.localeCompare(b.suit));

// ── Melds and books ──────────────────────────────────────────────────────────
export const isBook = m => m.cards.length >= BOOK;
export const isClean = m => !m.cards.some(isWild);
export const openMeld = (s, team, rank) => s.melds[team].find(m => m.rank === rank && !isBook(m));
export const bookCount = (s, team) => {
  const done = s.melds[team].filter(isBook);
  const clean = done.filter(isClean).length;
  return { clean, dirty: done.length - clean };
};
/** A side may go out once it has a clean book and a dirty book. */
export const canGoOut = (s, team) => { const b = bookCount(s, team); return b.clean >= 1 && b.dirty >= 1; };
export const minimumFor = s => MINIMUMS[Math.min(s.round, MINIMUMS.length - 1)];
export const meldedValue = (s, team) => s.melds[team].reduce((t, m) => t + valueOf(m.cards), 0);
export const topOfPile = s => s.discard[s.discard.length - 1] ?? null;

function checkMeld(cards) {
  const wild = cards.filter(isWild).length;
  if (cards.length < 3) throw new Error('A meld needs at least 3 cards.');
  if (cards.length > BOOK) throw new Error(`A meld can't have more than ${BOOK} cards — that's a finished book.`);
  if (wild > cards.length - wild) throw new Error('A meld can\'t have more wild cards than natural ones.');
  if (wild > MAX_WILD) throw new Error(`A meld can have at most ${MAX_WILD} wild cards.`);
}

/** Put cards on the team's open meld of `rank`, or start a new one. */
function placeCards(s, team, rank, cards) {
  const open = openMeld(s, team, rank);
  // Too many to fit on the open meld, but enough for a meld of their own? Start a new one
  const ownMeld = cards.filter(isNatural).length >= 2 && cards.length >= 3;
  if (open && !(open.cards.length + cards.length > BOOK && ownMeld)) {
    const all = [...open.cards, ...cards];
    checkMeld(all);
    open.cards = all;
  } else {
    if (!cards.some(isNatural)) throw new Error('Wild cards can only be added to a meld you already have.');
    checkMeld(cards);
    s.melds[team].push({ rank, cards: [...cards] });
  }
}

// ── Dealing ──────────────────────────────────────────────────────────────────
/** Red 3s go straight to the team's bonus pile and are replaced from the stock. */
function setAsideRedThrees(s, seat, cards) {
  let hand = cards;
  for (let red; (red = hand.find(isRedThree)) && s.stock.length;) {
    hand = hand.filter(c => c !== red);
    s.redThrees[teamOf(s, seat)].push(red);
    hand = [...hand, s.stock.pop()];
  }
  return hand;
}

export function dealRound({ players = 4, round = 0, dealer = players - 1, scores, deck = shuffle(makeDeck(players + 1)) } = {}) {
  const sides = players === 4 ? 2 : players;
  const each = (n, make) => Array.from({ length: n }, make);
  const s = {
    players, round, dealer,
    scores: scores ?? each(sides, () => 0),
    stock: [...deck],
    hands: each(players, () => []),
    feet: each(players, () => []),
    inFoot: each(players, () => false),
    discard: [],
    redThrees: each(sides, () => []),
    melds: each(sides, () => []),        // per side: [{ rank, cards }]
    initialDone: each(sides, () => false),
    turn: (dealer + 1) % players,
    phase: 'draw',                       // draw | play | over
    turnStart: null,                     // snapshot for Undo
    discardLog: [],                      // [{ seat, card }] (for the computer players)
    outBy: null,
  };
  for (let seat = 0; seat < players; seat++) {
    s.hands[seat] = s.stock.splice(-PILE_SIZE);
    s.feet[seat] = s.stock.splice(-PILE_SIZE);
    s.hands[seat] = setAsideRedThrees(s, seat, s.hands[seat]);
  }
  // Turn up the first discard (not a wild card or a 3)
  let first;
  while ((first = s.stock.pop()) && !isNatural(first)) s.stock.unshift(first);
  s.discard.push(first);
  return s;
}

// ── Taking the pile ──────────────────────────────────────────────────────────
/** Can `seat` take the pile with these cards? Returns the cards, or throws why not. */
export function checkPileTake(s, seat, ids = []) {
  const top = topOfPile(s);
  if (!top) throw new Error('The discard pile is empty.');
  if (!isNatural(top)) throw new Error('You can\'t take the pile when a wild card or a 3 is on top.');
  if (!s.initialDone[teamOf(s, seat)]) throw new Error(`You can't take the pile until ${yours(s)} made a first meld.`);
  const cards = ids.map(id => s.hands[seat].find(c => c.id === id));
  if (cards.length < 2 || cards.some(c => !c || c.rank !== top.rank)) {
    throw new Error(`To take the pile, select two ${top.rank}s from your hand to meld with it.`);
  }
  return cards;
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, action) {
  if (s.phase === 'over') throw new Error('The hand is over.');
  const seat = s.turn, team = teamOf(s, seat);
  switch (action.type) {
    case 'draw': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      if (!s.stock.length) return endHand(clone(s), null);
      const next = clone(s);
      let drawn = [];
      while (drawn.filter(c => !isRedThree(c)).length < 2 && next.stock.length) drawn.push(next.stock.pop());
      next.redThrees[team].push(...drawn.filter(isRedThree));
      drawn = drawn.filter(c => !isRedThree(c));
      next.hands[seat].push(...drawn);
      if (!drawn.length) return endHand(next, null);         // the stock ran out
      return startPlay(next);
    }

    case 'takePile': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      const pair = checkPileTake(s, seat, action.ids);
      const next = clone(s);
      const taken = next.discard.splice(-TAKE);
      const top = taken.pop();
      const used = new Set(pair.map(c => c.id));
      next.hands[seat] = [...next.hands[seat].filter(c => !used.has(c.id)), ...taken];
      placeCards(next, team, top.rank, [top, ...pair]);
      // A pile of one card, taken with your last two: on to your foot (or out, from your foot)
      if (!next.hands[seat].length) {
        if (!next.inFoot[seat]) pickUpFoot(next, seat);
        else if (canGoOut(next, team)) return endHand(next, seat);
        else throw new Error(`You can't go out until ${yours(s)} a clean book and a dirty book, so you can't take the pile with your last cards.`);
      }
      // …and until you can go out, keep 2 cards in your foot so you can still discard one
      if (next.inFoot[seat] && !canGoOut(next, team) && next.hands[seat].length < 2) {
        throw new Error(`You can't go out until ${yours(s)} a clean book and a dirty book, so keep at least 2 cards.`);
      }
      return startPlay(next);
    }

    case 'meld': {
      if (s.phase !== 'play') throw new Error('Draw first (or take the pile).');
      const hand = s.hands[seat];
      const cards = (action.ids ?? []).map(id => hand.find(c => c.id === id)).filter(Boolean);
      if (!cards.length) throw new Error('Select the cards to meld first.');
      if (cards.some(c => c.rank === '3')) throw new Error('3s can\'t be melded — black 3s can only be discarded.');
      const ranks = [...new Set(cards.filter(isNatural).map(c => c.rank))];
      if (ranks.length > 1) throw new Error('Meld one rank at a time.');
      const rank = ranks[0] ?? action.rank;
      if (!rank) throw new Error('To add wild cards, tap the meld they should go on.');
      const next = clone(s);
      next.hands[seat] = hand.filter(c => !cards.includes(c));
      placeCards(next, team, rank, cards);
      const left = next.hands[seat].length;
      if (left === 0 && !next.inFoot[seat]) return pickUpFoot(next, seat);   // straight on with your foot
      if (next.inFoot[seat] && !canGoOut(next, team) && left < 2) {
        throw new Error(`You can't go out until ${yours(s)} a clean book and a dirty book, so keep at least 2 cards.`);
      }
      if (left === 0) {                                          // went out by melding every card
        checkMinimum(next, team);
        next.initialDone[team] = true;
        return endHand(next, seat);
      }
      return next;
    }

    case 'undo': {
      if (s.phase !== 'play' || !s.turnStart) return s;
      const next = clone(s);
      const t = s.turnStart;
      next.hands[seat] = [...t.hand];
      next.feet[seat] = [...t.foot];
      next.inFoot[seat] = t.inFoot;
      next.melds[team] = t.melds.map(m => ({ ...m, cards: [...m.cards] }));
      next.redThrees[team] = [...t.redThrees];
      next.stock = [...t.stock];
      return next;
    }

    case 'discard': {
      if (s.phase !== 'play') throw new Error('Draw first (or take the pile).');
      const card = s.hands[seat].find(c => c.id === action.id);
      if (!card) throw new Error('Select a card to discard.');
      const next = clone(s);
      checkMinimum(next, team);
      if (next.melds[team].length) next.initialDone[team] = true;
      next.hands[seat] = next.hands[seat].filter(c => c !== card);
      if (!next.hands[seat].length && next.inFoot[seat] && !canGoOut(next, team)) {
        throw new Error(`You can't go out until ${yours(s)} a clean book and a dirty book.`);
      }
      next.discard.push(card);
      next.discardLog.push({ seat, card });
      if (!next.hands[seat].length) {
        if (next.inFoot[seat]) return endHand(next, seat);       // went out
        pickUpFoot(next, seat);                                  // your foot, ready for your next turn
      }
      next.turn = nextSeat(s, seat);
      next.phase = 'draw';
      next.turnStart = null;
      return next;
    }

    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

/** A side's first melds, all laid in one turn, must reach the round's minimum. */
function checkMinimum(s, team) {
  if (s.initialDone[team] || !s.melds[team].length) return;
  const value = meldedValue(s, team);
  if (value < minimumFor(s)) {
    throw new Error(`Your first meld must total at least ${minimumFor(s)} points — you have ${value}. Add more, or tap Undo.`);
  }
}

function pickUpFoot(s, seat) {
  s.inFoot[seat] = true;
  s.hands[seat] = setAsideRedThrees(s, seat, s.feet[seat]);
  s.feet[seat] = [];
  return s;
}

function startPlay(s) {
  const seat = s.turn, team = teamOf(s, seat);
  s.phase = 'play';
  s.turnStart = {
    hand: [...s.hands[seat]], foot: [...s.feet[seat]], inFoot: s.inFoot[seat],
    melds: s.melds[team].map(m => ({ ...m, cards: [...m.cards] })), redThrees: [...s.redThrees[team]], stock: [...s.stock],
  };
  return s;
}

function endHand(s, outBy) {
  s.phase = 'over';
  s.outBy = outBy;
  s.turnStart = null;
  return s;
}

function clone(s) {
  return {
    ...s,
    hands: s.hands.map(h => [...h]),
    feet: s.feet.map(f => [...f]),
    inFoot: [...s.inFoot],
    stock: [...s.stock],
    discard: [...s.discard],
    redThrees: s.redThrees.map(r => [...r]),
    melds: s.melds.map(team => team.map(m => ({ ...m, cards: [...m.cards] }))),
    initialDone: [...s.initialDone],
    discardLog: [...s.discardLog],
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────
/**
 * Score a finished hand for each side: books (clean 500, dirty 300), red 3s
 * (100 each), going out (100) and the melded cards, minus every card left in
 * its players' hands and feet.
 */
export function scoreHand(s) {
  return Array.from({ length: sideCount(s) }, (_, team) => {
    const { clean, dirty } = bookCount(s, team);
    const redThrees = s.redThrees[team].length * RED_THREE;
    const goingOut = s.outBy != null && teamOf(s, s.outBy) === team ? GOING_OUT : 0;
    const cards = meldedValue(s, team);
    const left = seatsOf(s, team).reduce((t, seat) => t + valueOf(s.hands[seat]) + valueOf(s.feet[seat]), 0);
    const total = clean * CLEAN_BOOK + dirty * DIRTY_BOOK + redThrees + goingOut + cards - left;
    return { clean, dirty, redThrees, goingOut, cards, left, total };
  });
}
