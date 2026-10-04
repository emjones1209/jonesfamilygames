/**
 * A whole game of Cribbage (hand after hand, first to 121) as a pure state
 * machine, shared by the single-player game (run in the browser) and
 * play-together tables (run on the server). Two players: seats 0 and 1.
 *
 * Each hand: six cards each; both throw two into the dealer's crib (at the same
 * time). The starter card is cut (a Jack is 2 for the dealer, "his heels").
 * Then pegging: the non-dealer leads and players take turns, counting up to 31.
 * A player who can't play says "go" — that's done for them here — and the
 * other plays on; when neither can, the last to play scores 1 and the count
 * starts again. Then the show: the non-dealer counts their hand, then the
 * dealer their hand and the crib. The first to 121 wins straight away, even
 * part-way through a hand (so the non-dealer, counting first, can win before
 * the dealer counts).
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed:
 *   { type: 'discard', seat, cardIds }  the two cards for the crib
 *   { type: 'play', seat, cardId }      pegging
 *   { type: 'nextHand' }  { type: 'newGame' }
 *
 * `waitingOn(state)` says who must move (both, while discarding);
 * `robotAction(state, seat, level)` picks a computer player's move;
 * `viewFor(state, seat)` hides the other hand, the crib and the deck.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine.js';
import {
  GAME_TARGET, SKUNK, HAND_SIZE, KEEP, MAX_COUNT, HEELS,
  scoreHand, pegPoints, playable, sumValue, chooseDiscard, choosePegCard,
} from './cribbageRules.js';

const other = seat => 1 - seat;

function deal(game, dealer, deck = shuffle(buildDeck())) {
  return {
    ...game,
    phase: 'discard',                 // discard | play | show | gameOver
    dealer,
    hands: [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, 2 * HAND_SIZE)],
    kept: [null, null],               // the four each keeps, for the show
    thrown: [false, false],           // has each player thrown into the crib yet?
    crib: [],
    starter: null,
    deck: deck.slice(2 * HAND_SIZE),  // the starter is cut from here
    peg: null,                        // { count, seq, played, turn, last }
    events: [],                       // what scored just now: [{ seat, points, why }]
    show: null,                       // [{ seat, what: 'hand' | 'crib', cards, total, items }] once counted
  };
}

export function newGame({ dealer = 1, deck } = {}) {
  return deal({ scores: [0, 0], back: [0, 0], handNo: 0, winner: null, skunk: false }, dealer, deck);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** Seats that must move now: both (who haven't thrown) while discarding; one while pegging. */
export function waitingOn(s) {
  if (s.phase === 'discard') return [0, 1].filter(seat => !s.thrown[seat]);
  if (s.phase === 'play') return [s.peg.turn];
  return [];
}
export const waitingFor = s => waitingOn(s)[0] ?? null;

/** Cards `seat` may play now. */
export const legalFor = (s, seat) => (s.phase === 'play' && s.peg.turn === seat ? playable(s.hands[seat], s.peg.count) : []);

// ── Scoring ──────────────────────────────────────────────────────────────────
/** Add points (moving the back peg up to where the front one was); ends the game at 121. */
function award(s, seat, points, why) {
  if (!points || s.phase === 'gameOver') return;
  s.back = s.back.map((b, i) => (i === seat ? s.scores[i] : b));
  s.scores = s.scores.map((n, i) => (i === seat ? Math.min(GAME_TARGET, n + points) : n));
  s.events = [...s.events, { seat, points, why }];
  if (s.scores[seat] >= GAME_TARGET) {
    s.phase = 'gameOver';
    s.winner = seat;
    s.skunk = s.scores[other(seat)] < SKUNK;
  }
}

/** After a card (or the cut): pass "go"s, reset the count, and move on to the show when the cards are gone. */
function advance(s) {
  for (let guard = 0; guard < 20 && s.phase === 'play'; guard++) {
    const p = s.peg;
    const canPlay = seat => playable(s.hands[seat], p.count).length > 0;
    if (!s.hands[0].length && !s.hands[1].length) {
      // Last card: 1 (unless it made 31, which has already scored)
      if (p.count > 0) award(s, p.last, 1, 'last card');
      if (s.phase === 'play') countHands(s);
      return s;
    }
    if (canPlay(p.turn)) return s;
    if (canPlay(other(p.turn))) {
      s.peg = { ...p, turn: other(p.turn), goBy: p.turn };       // "go": the other player plays on
      return s;
    }
    // Neither can play: the last to play gets 1 for the go, and the count starts again
    if (p.count > 0) award(s, p.last, 1, 'go');
    let next = other(p.last);
    if (!s.hands[next].length) next = p.last;
    s.peg = { ...p, count: 0, seq: [], turn: next, goBy: null };
  }
  return s;
}

/** The show: non-dealer's hand, then the dealer's hand, then the crib (stopping if someone reaches 121). */
function countHands(s) {
  const nd = other(s.dealer);
  const counts = [
    { seat: nd, what: 'hand', cards: s.kept[nd] },
    { seat: s.dealer, what: 'hand', cards: s.kept[s.dealer] },
    { seat: s.dealer, what: 'crib', cards: s.crib },
  ];
  s.show = [];
  for (const c of counts) {
    const { total, items } = scoreHand(c.cards, s.starter, { crib: c.what === 'crib' });
    s.show.push({ ...c, total, items });
    award(s, c.seat, total, c.what === 'crib' ? 'crib' : 'hand');
    if (s.phase === 'gameOver') return;
  }
  s.phase = 'show';
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(state, a) {
  const s = { ...state, events: [] };
  switch (a.type) {
    case 'discard': {
      if (s.phase !== 'discard') throw new Error('The crib has been made.');
      if (s.thrown[a.seat]) throw new Error('You\'ve already thrown your two cards.');
      const ids = a.cardIds ?? [];
      const cards = ids.map(id => s.hands[a.seat].find(c => c.id === id));
      if (ids.length !== HAND_SIZE - KEEP || new Set(ids).size !== ids.length || cards.some(c => !c)) {
        throw new Error('Choose two cards for the crib.');
      }
      const kept = s.hands[a.seat].filter(c => !ids.includes(c.id));
      s.hands = s.hands.map((h, i) => (i === a.seat ? kept : h));
      s.kept = s.kept.map((k, i) => (i === a.seat ? kept : k));
      s.thrown = s.thrown.map((t, i) => (i === a.seat ? true : t));
      s.crib = [...s.crib, ...cards];
      if (!s.thrown.every(Boolean)) return s;
      // Both have thrown: cut the starter. A Jack is 2 for the dealer ("his heels")
      const [starter, ...deck] = s.deck;
      s.starter = starter;
      s.deck = deck;
      s.phase = 'play';
      s.peg = { count: 0, seq: [], played: [], turn: other(s.dealer), last: null, goBy: null };
      if (starter.rank === 'J') award(s, s.dealer, HEELS, 'his heels');
      return advance(s);
    }

    case 'play': {
      if (s.phase !== 'play') throw new Error('It\'s not time to play a card.');
      if (a.seat !== s.peg.turn) throw new Error('It\'s not your turn.');
      const card = s.hands[a.seat].find(c => c.id === a.cardId);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (s.peg.count + sumValue([card]) > MAX_COUNT) throw new Error(`That would take the count past ${MAX_COUNT}.`);
      const { reasons, count } = pegPoints(s.peg.seq, card);
      s.hands = s.hands.map((h, i) => (i === a.seat ? h.filter(c => c.id !== card.id) : h));
      s.peg = {
        ...s.peg, count, seq: [...s.peg.seq, { ...card, seat: a.seat }], played: [...s.peg.played, { ...card, seat: a.seat }],
        last: a.seat, turn: other(a.seat), goBy: null,
      };
      for (const r of reasons) award(s, a.seat, r.points, r.why);
      if (s.phase !== 'play') return s;
      if (count === MAX_COUNT) {
        // 31: the count starts again, led by the other player (if they have cards)
        const next = s.hands[other(a.seat)].length ? other(a.seat) : a.seat;
        s.peg = { ...s.peg, count: 0, seq: [], turn: next };
      }
      return advance(s);
    }

    case 'nextHand':
      if (s.phase !== 'show') return state;
      return { ...deal(s, other(s.dealer)), handNo: s.handNo + 1, back: s.back };

    case 'newGame':
      if (s.phase !== 'gameOver') return state;
      return newGame({ dealer: other(s.dealer) });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── Computer players ─────────────────────────────────────────────────────────
export function robotAction(s, seat, level) {
  if (s.phase === 'discard') return { type: 'discard', seat, cardIds: chooseDiscard(s.hands[seat], { dealer: s.dealer === seat, level }) };
  const card = choosePegCard(s.hands[seat], s.peg.seq, { level });
  return { type: 'play', seat, cardId: card.id };
}

// ── What each player may see ─────────────────────────────────────────────────
const hide = cards => cards && cards.map(() => null);

export function viewFor(s, seat) {
  const open = s.phase === 'show' || s.phase === 'gameOver';
  return {
    ...s,
    hands: s.hands.map((h, i) => (i === seat || open ? h : hide(h))),
    kept: s.kept.map((k, i) => (i === seat || open ? k : hide(k))),
    crib: open ? s.crib : hide(s.crib),
    deck: hide(s.deck),
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0. */
export function rotate(s, seat) {
  if (!seat) return s;
  const r = x => (x == null ? x : other(x));
  const arr = a => a && [a[1], a[0]];
  const seated = cards => cards && cards.map(c => ({ ...c, seat: r(c.seat) }));
  return {
    ...s,
    dealer: r(s.dealer), winner: r(s.winner),
    hands: arr(s.hands), kept: arr(s.kept), thrown: arr(s.thrown), scores: arr(s.scores), back: arr(s.back),
    peg: s.peg && { ...s.peg, turn: r(s.peg.turn), last: r(s.peg.last), goBy: r(s.peg.goBy), seq: seated(s.peg.seq), played: seated(s.peg.played) },
    events: s.events.map(e => ({ ...e, seat: r(e.seat) })),
    show: s.show && s.show.map(c => ({ ...c, seat: r(c.seat) })),
  };
}
