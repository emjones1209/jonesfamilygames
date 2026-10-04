/**
 * Hand and Foot — one hand of it, as pure functions. Four players play in two
 * partnerships (seats 0 & 2 against 1 & 3); three play each for themselves.
 * "Side" below means a partnership, or a single player when there are three.
 * A close cousin of Canasta, with the common house rules:
 *
 * - One more deck than players, with their jokers (270 cards for four players,
 *   216 for three). Everyone is dealt a hand and a
 *   foot of 11 cards each; you play your hand, then pick up your foot.
 * - Jokers and 2s are wild. 3s can't be melded, only discarded (a 3 on top
 *   blocks the pile). Red 3s stay in your hand (Jones family rules): each one
 *   still in a hand or foot when the hand ends costs 300.
 * - On your turn draw 2 cards, or take the top 5 cards of the discard pile by
 *   melding its top card with two matching natural cards from your hand — or
 *   one and a wild card (Jones family rules; even before your side's first
 *   meld — that meld then counts towards the minimum, and Undo puts the pile
 *   back). The pile can't be taken until it has at least 5 cards (Jones
 *   family rules), and you may look at those 5 before choosing (Jones family rules). Then meld, and end by discarding one card.
 * - A meld is 3 or more cards of one rank, with more natural cards than wild
 *   ones (Jones family rules) and at most 3 wild. Seven cards make a book:
 *   clean (no wild cards) 500, dirty 300. Books can keep growing (Jones family
 *   rules), though never with a wild card on a clean book. Cards go on the
 *   side's meld or book of their rank, never a second one (Jones family rules)
 *   — unless they can't go on it (a wild card for a clean book).
 * - A side's first meld each hand must total at least 50, 90, 120 then 150
 *   points (by round), all laid in one turn.
 * - Used up your hand? Pick up your foot (straight away if you melded your
 *   last card, or at the end of your turn if you discarded it).
 * - You go out from your foot, once your side has 2 clean books and 3 dirty
 *   ones (Jones family rules; a third clean book counts as a dirty one):
 *   +100 and the hand ends. It also ends if the stock runs out.
 * - With partners you need your partner's permission to go out (Jones family
 *   rules): ask "may I go out?" during your turn; a "no" holds for that turn.
 *
 * `act(state, action)` returns the next state (for the player whose turn it
 * is) or throws an Error whose message explains why the move isn't allowed:
 *   { type: 'draw' }  { type: 'takePile', ids }  { type: 'meld', ids, rank?, target? }
 *   (`target`: which of the side's melds to add to, by position — e.g. a book)
 *   { type: 'undo' }  { type: 'discard', id }
 *   { type: 'askOut' }  "may I go out?" (partners only)
 *   { type: 'answerOut', yes }  the partner's answer (made by the partner, not the player whose turn it is)
 */
import { shuffle } from '../../utils/cardEngine.js';

export const PILE_SIZE = 11;             // cards in each hand and each foot
export const ROUNDS = 4;
export const MINIMUMS = [50, 90, 120, 150];
export const BOOK = 7;
export const MAX_WILD = 3;
export const TAKE = 5;                   // taking the pile gets you its top 5 cards
export const MIN_PILE = 5;               // …and it can't be taken with fewer than 5 in it
export const CLEAN_BOOK = 500, DIRTY_BOOK = 300, RED_THREE = 300, GOING_OUT = 100;
export const CLEAN_TO_GO_OUT = 2, BOOKS_TO_GO_OUT = 5;   // 2 clean books + 3 dirty (or more clean)
export const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

/** The side `seat` plays for: partners share one when there are four players. */
export const teamOf = (s, seat) => (s.players === 4 ? seat % 2 : seat);
export const sideCount = s => (s.players === 4 ? 2 : s.players);
export const seatsOf = (s, side) => Array.from({ length: s.players }, (_, i) => i).filter(seat => teamOf(s, seat) === side);
export const nextSeat = (s, seat) => (seat + 1) % s.players;
/** "your team has" with partners, "you have" when playing alone (for messages). */
const yours = s => (s.players === 4 ? 'your team has' : 'you have');
const BOOKS_NEEDED = '2 pure books and 3 impure books';     // (the Joneses' names for clean and dirty)
export const partnerOf = (s, seat) => (seat + 2) % s.players;   // (four players only)

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
  if (isRedThree(c)) return RED_THREE;   // caught in your hand or foot: −300
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
/** A side may go out once it has 2 clean books and 3 dirty ones (extra clean books count as dirty). */
export const canGoOut = (s, team) => {
  const b = bookCount(s, team);
  return b.clean >= CLEAN_TO_GO_OUT && b.clean + b.dirty >= BOOKS_TO_GO_OUT;
};
/** Why the player whose turn it is can't go out right now (null if they can). */
function whyNotOut(s, team) {
  if (!canGoOut(s, team)) return `You can't go out until ${yours(s)} ${BOOKS_NEEDED}`;
  if (s.players === 4 && s.outAsk !== 'yes') {
    return s.outAsk === 'no' ? 'Your partner said not yet, so you can\'t go out this turn' : 'Ask your partner if you may go out first';
  }
  return null;
}
/** Books still needed before the side can go out: { clean, dirty }. */
export function booksToGo(s, team) {
  const b = bookCount(s, team);
  const clean = Math.max(0, CLEAN_TO_GO_OUT - b.clean);
  const dirty = Math.max(0, BOOKS_TO_GO_OUT - CLEAN_TO_GO_OUT - b.dirty - Math.max(0, b.clean - CLEAN_TO_GO_OUT));
  return { clean, dirty };
}
export const minimumFor = s => MINIMUMS[Math.min(s.round, MINIMUMS.length - 1)];
export const meldedValue = (s, team) => s.melds[team].reduce((t, m) => t + valueOf(m.cards), 0);
export const topOfPile = s => s.discard[s.discard.length - 1] ?? null;

function checkMeld(cards) {
  const wild = cards.filter(isWild).length;
  if (cards.length < 3) throw new Error('A meld needs at least 3 cards.');
  if (wild >= cards.length - wild) throw new Error('A meld must have more natural cards than wild ones.');
  if (wild > MAX_WILD) throw new Error(`A meld can have at most ${MAX_WILD} wild cards.`);
}

/** Add cards to a meld (or a book — but no wild cards on a clean book). */
function addTo(meld, cards) {
  if (isBook(meld) && isClean(meld) && cards.some(isWild)) {
    throw new Error('Wild cards can\'t go on a pure book — it would make it impure (300 instead of 500).');
  }
  const all = [...meld.cards, ...cards];
  checkMeld(all);
  meld.cards = all;
}

/**
 * Put cards on one of the side's melds: `target` if given, else the side's meld
 * of `rank` (the unfinished one, else the finished book), else a new meld.
 * Jones family rules: a side never starts a second meld of a rank it already has
 * — unless the cards can't go on it (see below).
 */
function placeCards(s, team, rank, cards, target = null) {
  if (target != null) {
    const meld = s.melds[team][target];
    if (!meld) throw new Error('Tap one of your own melds.');
    if (meld.rank !== rank) throw new Error(`Those cards don't go on the ${meld.rank}s.`);
    addTo(meld, cards);
    return;
  }
  const existing = openMeld(s, team, rank) ?? s.melds[team].find(m => m.rank === rank && isBook(m));
  const ownMeld = cards.filter(isNatural).length >= 2 && cards.length >= 3;
  // Cards join the side's meld of their rank, finished book or not (books keep growing)…
  if (existing) {
    try {
      return addTo(existing, cards);
    } catch (e) {
      // …unless they can't (a wild card on a clean book, or one wild card too many): then,
      // if they make a meld of their own, they start one
      if (!ownMeld) throw e;
    }
  }
  if (!cards.some(isNatural)) throw new Error('Wild cards can only be added to a meld you already have.');
  checkMeld(cards);
  s.melds[team].push({ rank, cards: [...cards] });
}

// ── Dealing ──────────────────────────────────────────────────────────────────
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
    melds: each(sides, () => []),        // per side: [{ rank, cards }]
    initialDone: each(sides, () => false),
    turn: (dealer + 1) % players,
    phase: 'draw',                       // draw | play | over
    turnStart: null,                     // snapshot for Undo
    discardLog: [],                      // [{ seat, card }] (for the computer players)
    outBy: null,
    outAsk: null,                        // partners: has the player whose turn it is asked to go out? null | asking | yes | no
  };
  for (let seat = 0; seat < players; seat++) {
    s.hands[seat] = s.stock.splice(-PILE_SIZE);
    s.feet[seat] = s.stock.splice(-PILE_SIZE);
  }
  // Turn up the first discard (not a wild card or a 3)
  let first;
  while ((first = s.stock.pop()) && !isNatural(first)) s.stock.unshift(first);
  s.discard.push(first);
  return s;
}

// ── Taking the pile ──────────────────────────────────────────────────────────
/**
 * Can `seat` take the pile with these cards — two naturals matching its top
 * card, or one and a wild card? Returns the cards, or throws why not.
 */
export function checkPileTake(s, seat, ids = []) {
  const top = topOfPile(s);
  if (!top) throw new Error('The discard pile is empty.');
  if (s.discard.length < MIN_PILE) {
    throw new Error(`The pile needs at least ${MIN_PILE} cards before it can be picked up (it has ${s.discard.length}).`);
  }
  if (!isNatural(top)) throw new Error('You can\'t take the pile when a wild card or a 3 is on top.');
  const cards = ids.map(id => s.hands[seat].find(c => c.id === id));
  const matching = cards.filter(c => c && c.rank === top.rank).length;
  const wild = cards.filter(c => c && isWild(c)).length;
  if (cards.length !== 2 || cards.some(c => !c) || !(matching === 2 || (matching === 1 && wild === 1))) {
    throw new Error(`To take the pile, select two ${top.rank}s from your hand — or one ${top.rank} and a wild card — to meld with it.`);
  }
  return cards;
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, action) {
  if (s.phase === 'over') throw new Error('The hand is over.');
  const seat = s.turn, team = teamOf(s, seat);
  if (s.outAsk === 'asking' && action.type !== 'answerOut') throw new Error('Waiting for your partner to answer.');
  switch (action.type) {
    case 'askOut': {
      if (s.players !== 4) throw new Error('Only partners need to ask to go out.');
      if (!s.inFoot[seat]) throw new Error('You can only go out from your foot.');
      if (s.outAsk) throw new Error('You\'ve already asked this turn.');
      if (!canGoOut(s, team)) throw new Error(`You can't ask to go out until ${yours(s)} ${BOOKS_NEEDED}.`);
      return { ...s, outAsk: 'asking' };
    }

    case 'answerOut':
      if (s.outAsk !== 'asking') throw new Error('Nobody has asked to go out.');
      return { ...s, outAsk: action.yes ? 'yes' : 'no' };

    case 'draw': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      if (!s.stock.length) return endHand(clone(s), null);
      const next = clone(s);
      const drawn = next.stock.splice(-2).reverse();
      next.hands[seat].push(...drawn);
      if (!drawn.length) return endHand(next, null);         // the stock ran out
      return startPlay(next);
    }

    case 'takePile': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      const pair = checkPileTake(s, seat, action.ids);
      const next = clone(s);
      // Before the side's first meld, Undo can put the pile back (in case the minimum can't be reached)
      const beforeTaking = !s.initialDone[team] && snapshot(s, { discard: [...s.discard] });
      const taken = next.discard.splice(-TAKE);
      const top = taken.pop();
      const used = new Set(pair.map(c => c.id));
      next.hands[seat] = [...next.hands[seat].filter(c => !used.has(c.id)), ...taken];
      placeCards(next, team, top.rank, [top, ...pair]);
      // (The pile has at least 5 cards, so this always leaves 4 more in your hand: taking it
      // can never empty your hand or foot)
      startPlay(next);
      if (beforeTaking) next.turnStart = beforeTaking;
      return next;
    }

    case 'meld': {
      if (s.phase !== 'play') throw new Error('Draw first (or take the pile).');
      const hand = s.hands[seat];
      const cards = (action.ids ?? []).map(id => hand.find(c => c.id === id)).filter(Boolean);
      if (!cards.length) throw new Error('Select the cards to meld first.');
      if (cards.some(c => c.rank === '3')) throw new Error('3s can\'t be melded — black 3s can only be discarded.');
      const ranks = [...new Set(cards.filter(isNatural).map(c => c.rank))];
      if (ranks.length > 1) throw new Error('Meld one rank at a time.');
      const target = Number.isInteger(action.target) ? action.target : null;
      const rank = ranks[0] ?? (target != null ? s.melds[team][target]?.rank : action.rank);
      if (!rank) throw new Error('To add wild cards, tap the meld they should go on.');
      const next = clone(s);
      next.hands[seat] = hand.filter(c => !cards.includes(c));
      placeCards(next, team, rank, cards, target);
      const left = next.hands[seat].length;
      if (left === 0 && !next.inFoot[seat]) return pickUpFoot(next, seat);   // straight on with your foot
      const why = next.inFoot[seat] && left < 2 && whyNotOut(next, team);
      if (why) throw new Error(`${why}, so keep at least 2 cards.`);
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
      next.stock = [...t.stock];
      if (t.discard) {                                           // the pile goes back: draw again
        next.discard = [...t.discard];
        next.phase = 'draw';
        next.turnStart = null;
      }
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
      const why = !next.hands[seat].length && next.inFoot[seat] && whyNotOut(next, team);
      if (why) throw new Error(`${why}.`);
      next.discard.push(card);
      next.discardLog.push({ seat, card });
      if (!next.hands[seat].length) {
        if (next.inFoot[seat]) return endHand(next, seat);       // went out
        pickUpFoot(next, seat);                                  // your foot, ready for your next turn
      }
      next.turn = nextSeat(s, seat);
      next.phase = 'draw';
      next.turnStart = null;
      next.outAsk = null;
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
  s.hands[seat] = s.feet[seat];
  s.feet[seat] = [];
  return s;
}

/** What Undo goes back to: the player's cards and their side's melds (and more, see takePile). */
function snapshot(s, extra = {}) {
  const seat = s.turn, team = teamOf(s, seat);
  return {
    hand: [...s.hands[seat]], foot: [...s.feet[seat]], inFoot: s.inFoot[seat],
    melds: s.melds[team].map(m => ({ ...m, cards: [...m.cards] })), stock: [...s.stock],
    ...extra,
  };
}

function startPlay(s) {
  s.phase = 'play';
  s.turnStart = snapshot(s);
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
    melds: s.melds.map(team => team.map(m => ({ ...m, cards: [...m.cards] }))),
    initialDone: [...s.initialDone],
    discardLog: [...s.discardLog],
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────
/**
 * Score a finished hand for each side: books (clean 500, dirty 300), going
 * out (100) and the melded cards, minus every card left in its players' hands
 * and feet — and 300 for each red 3 among them.
 */
export function scoreHand(s) {
  return Array.from({ length: sideCount(s) }, (_, team) => {
    const { clean, dirty } = bookCount(s, team);
    const goingOut = s.outBy != null && teamOf(s, s.outBy) === team ? GOING_OUT : 0;
    const cards = meldedValue(s, team);
    const stuck = seatsOf(s, team).flatMap(seat => [...s.hands[seat], ...s.feet[seat]]);
    const redThrees = -stuck.filter(isRedThree).length * RED_THREE;
    const left = valueOf(stuck.filter(c => !isRedThree(c)));
    const total = clean * CLEAN_BOOK + dirty * DIRTY_BOOK + redThrees + goingOut + cards - left;
    return { clean, dirty, redThrees, goingOut, cards, left, total };
  });
}
