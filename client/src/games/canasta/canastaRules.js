/**
 * Classic partnership Canasta (Hoyle rules), as pure functions.
 *
 * Seats: 0 = You, 1 = Left, 2 = Partner, 3 = Right. Team 0 = seats 0 & 2.
 * 108 cards: two standard decks plus four jokers. 11 cards each.
 *
 * A hand's state is a plain object; `act(state, action)` returns the next
 * state or throws an Error whose message explains why the move isn't allowed
 * (shown to the player). Actions, in turn order:
 *   { type: 'draw' }                         take the top card of the stock
 *   { type: 'takePile', ids }                take the discard pile, melding its top
 *                                            card with the selected hand cards
 *   { type: 'meld', ids, rank? }             meld / add to a meld (`rank` picks the
 *                                            meld when only wild cards are selected)
 *   { type: 'undo' }                         take back this turn's melds
 *   { type: 'discard', id }                  discard and end the turn
 */
import { shuffle } from '../../utils/cardEngine';

export const WINNING_SCORE = 5000;
export const HAND_SIZE = 11;
export const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

export const teamOf = seat => seat % 2;
export const nextSeat = seat => (seat + 1) % 4;

// ── Cards ────────────────────────────────────────────────────────────────────
export function makeDeck() {
  const deck = [];
  for (const d of [1, 2]) {
    for (const suit of SUITS) {
      for (const rank of ['2', ...[...RANK_ORDER].reverse()]) deck.push({ id: `${rank}-${suit}-${d}`, suit, rank });
    }
  }
  for (let i = 1; i <= 4; i++) deck.push({ id: `JK-${i}`, suit: 'joker', rank: 'JK' });
  return deck;
}

export const isWild = c => c.rank === 'JK' || c.rank === '2';
export const isRedThree = c => c.rank === '3' && (c.suit === 'hearts' || c.suit === 'diamonds');
export const isBlackThree = c => c.rank === '3' && (c.suit === 'spades' || c.suit === 'clubs');

export function cardValue(c) {
  if (c.rank === 'JK') return 50;
  if (c.rank === '2' || c.rank === 'A') return 20;
  if (['K', 'Q', 'J', '10', '9', '8'].includes(c.rank)) return 10;
  if (isRedThree(c)) return 0;          // red 3s score as bonuses instead
  return 5;                             // 7 down to 4, and black 3s
}

export const valueOf = cards => cards.reduce((s, c) => s + cardValue(c), 0);

/** Hand order: A down to 3, wild cards last. */
export const sortHand = hand => [...hand].sort((a, b) => rankIndex(a) - rankIndex(b) || a.suit.localeCompare(b.suit));
const rankIndex = c => (isWild(c) ? 20 + (c.rank === 'JK' ? 1 : 0) : RANK_ORDER.indexOf(c.rank));

/** Points a team's first meld must reach, from its score so far. */
export function minimumMeld(score) {
  if (score < 0) return 15;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  return 120;
}

// ── Melds ────────────────────────────────────────────────────────────────────
export const isCanasta = meld => meld.cards.length >= 7;
export const isNaturalMeld = meld => !meld.cards.some(isWild);
export const hasCanasta = melds => melds.some(isCanasta);

const naturalsIn = cards => cards.filter(c => !isWild(c));

/** A meld's cards must be one rank (plus wild cards): 2+ natural cards, at most 3 wild cards. */
function checkMeld(rank, cards) {
  const wild = cards.filter(isWild).length;
  if (cards.length < 3) throw new Error('A meld needs at least 3 cards.');
  if (cards.length - wild < 2) throw new Error('A meld needs at least 2 natural (non-wild) cards.');
  if (wild > 3) throw new Error('A meld can have at most 3 wild cards.');
  if (rank === '3' && wild) throw new Error('Black 3s can\'t be melded with wild cards.');
}

// ── Dealing ──────────────────────────────────────────────────────────────────
/**
 * Deal a hand. `scores` are the teams' running totals (for the first-meld minimum).
 * `deck` may be passed in (already shuffled) so tests can replay the same deal.
 */
export function dealHand({ dealer = 3, scores = [0, 0], deck = shuffle(makeDeck()) } = {}) {
  const stock = [...deck];
  const hands = [[], [], [], []];
  for (let i = 0; i < HAND_SIZE; i++) for (const s of [0, 1, 2, 3]) hands[s].push(stock.pop());
  const redThrees = [[], []];
  // Red 3s go face up straight away and are replaced from the stock
  for (const s of [0, 1, 2, 3]) {
    let red;
    while ((red = hands[s].find(isRedThree))) {
      hands[s] = hands[s].filter(c => c !== red);
      redThrees[teamOf(s)].push(red);
      hands[s].push(stock.pop());
    }
  }
  // Turn up the first discard; a wild card or red 3 is covered (and freezes the pile)
  const discard = [stock.pop()];
  while (isWild(discard[discard.length - 1]) || isRedThree(discard[discard.length - 1])) discard.push(stock.pop());

  return {
    hands, stock, discard, redThrees,
    melds: [[], []],                    // per team: [{ rank, cards }]
    initialDone: [false, false],        // has the team made its first meld?
    scores,
    dealer,
    turn: nextSeat(dealer),
    phase: 'draw',                      // draw | play | over
    turnStart: null,                    // snapshot for Undo
    discardLog: [],                     // [{ seat, card }] (for the computer players' memory)
    outBy: null,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────
export const topOfPile = s => s.discard[s.discard.length - 1] ?? null;
/** A wild card or red 3 in the pile freezes it: taking it then needs a natural pair. */
export const pileFrozen = s => s.discard.some(c => isWild(c) || isRedThree(c));
export const teamMeld = (s, team, rank) => s.melds[team].find(m => m.rank === rank);
export const needed = (s, team) => minimumMeld(s.scores[team]);

/** Points the team's melds are worth so far this turn (for the first-meld minimum). */
export const meldedValue = (s, team) => s.melds[team].reduce((t, m) => t + valueOf(m.cards), 0);

// ── Taking the discard pile ─────────────────────────────────────────────────
/**
 * Check a pile pickup: the top card must be melded right away, with cards
 * from hand (`ids`). Returns the melds it would make: [{ rank, cards, existing }].
 * Other ranks in the selection are laid down as extra melds (useful to reach
 * the first-meld minimum). Throws with the reason if it isn't allowed.
 */
export function planPileTake(s, seat, ids) {
  const top = topOfPile(s);
  const team = teamOf(seat);
  if (!top) throw new Error('The discard pile is empty.');
  if (isWild(top)) throw new Error('You can\'t take the pile while a wild card is on top.');
  if (isBlackThree(top)) throw new Error('A black 3 on top blocks the pile for this turn.');

  const hand = s.hands[seat];
  const sel = ids.map(id => hand.find(c => c.id === id)).filter(Boolean);
  const wilds = sel.filter(isWild);
  const byRank = {};
  for (const c of naturalsIn(sel)) (byRank[c.rank] ||= []).push(c);
  const topNat = byRank[top.rank] ?? [];
  const melded = s.initialDone[team];
  const frozen = pileFrozen(s) || !melded;
  const existing = teamMeld(s, team, top.rank);

  if (frozen) {
    if (topNat.length < 2) {
      throw new Error(melded
        ? `The pile is frozen: you need two natural ${top.rank}s from your hand to take it.`
        : `Until your team has melded, taking the pile needs two natural ${top.rank}s from your hand.`);
    }
  } else if (!existing && !(topNat.length >= 2 || (topNat.length >= 1 && wilds.length >= 1))) {
    throw new Error(`To take the pile, select two ${top.rank}s (or a ${top.rank} and a wild card) from your hand.`);
  }

  const main = [...topNat, ...wilds, top];
  checkMeld(top.rank, existing ? [...existing.cards, ...main] : main);
  const groups = [{ rank: top.rank, cards: main, existing: !!existing }];
  for (const [rank, cards] of Object.entries(byRank)) {
    if (rank === top.rank) continue;
    if (rank === '3') throw new Error('Black 3s can only be melded when going out.');
    const ex = teamMeld(s, team, rank);
    if (ex) { groups.push({ rank, cards, existing: true }); continue; }
    if (cards.length < 3) throw new Error(`Your ${rank}s need to be a meld of at least 3 cards.`);
    groups.push({ rank, cards, existing: false });
  }
  // You must still be able to discard afterwards without going out early
  const left = hand.length - sel.length + s.discard.length - 1;
  const canastaAfter = hasCanasta(s.melds[team]) || groups.some(g =>
    (g.existing ? teamMeld(s, team, g.rank).cards.length : 0) + g.cards.length >= 7);
  if (left < 1 || (left < 2 && !canastaAfter)) {
    throw new Error('You can\'t take the pile when it would leave you nothing to discard.');
  }
  if (!melded) {
    const value = groups.reduce((t, g) => t + valueOf(g.cards), 0);
    if (value < needed(s, team)) {
      throw new Error(`Your first meld must total at least ${needed(s, team)} points (this makes ${value}).`);
    }
  }
  return groups;
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, action) {
  if (s.phase === 'over') throw new Error('The hand is over.');
  const seat = s.turn, team = teamOf(seat);
  switch (action.type) {
    case 'draw': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      const next = clone(s);
      for (;;) {
        if (!next.stock.length) return endHand(next, null);     // stock ran out
        const card = next.stock.pop();
        if (isRedThree(card)) { next.redThrees[team].push(card); continue; }   // bonus, draw again
        next.hands[seat].push(card);
        break;
      }
      return startPlay(next);
    }

    case 'takePile': {
      if (s.phase !== 'draw') throw new Error('You\'ve already drawn this turn.');
      const groups = planPileTake(s, seat, action.ids);
      const next = clone(s);
      const used = new Set(action.ids);
      next.discard.pop();                                        // the top card goes into the meld
      next.hands[seat] = [...next.hands[seat].filter(c => !used.has(c.id)), ...next.discard];
      next.discard = [];
      for (const g of groups) addToMeld(next, team, g.rank, g.cards);
      next.initialDone[team] = true;
      return startPlay(next);
    }

    case 'meld': {
      if (s.phase !== 'play') throw new Error('Draw a card or take the pile first.');
      const hand = s.hands[seat];
      const cards = action.ids.map(id => hand.find(c => c.id === id)).filter(Boolean);
      if (!cards.length) throw new Error('Select the cards to meld first.');
      const ranks = [...new Set(naturalsIn(cards).map(c => c.rank))];
      if (ranks.length > 1) throw new Error('Meld one rank at a time.');
      const rank = ranks[0] ?? action.rank;
      if (!rank) throw new Error('To add wild cards, tap the meld they should go on.');
      const existing = teamMeld(s, team, rank);
      if (!existing && ranks.length === 0) throw new Error('Wild cards can only be added to an existing meld.');
      if (rank === '3' && cards.some(c => !isBlackThree(c))) throw new Error('Black 3s can\'t be melded with wild cards.');
      checkMeld(rank, existing ? [...existing.cards, ...cards] : cards);

      const next = clone(s);
      next.hands[seat] = hand.filter(c => !cards.includes(c));
      addToMeld(next, team, rank, cards);
      const left = next.hands[seat].length;
      const canasta = hasCanasta(next.melds[team]);
      if (rank === '3' && !(canasta && left <= 1)) throw new Error('Black 3s can only be melded when going out.');
      if (!canasta && left < 2) {
        throw new Error('You can\'t go out until your team has a canasta (7 or more cards), so keep at least 2 cards.');
      }
      if (left === 0) {
        checkMinimum(next, team);
        next.initialDone[team] = true;
        return endHand(next, seat);                              // went out by melding every card
      }
      return next;
    }

    case 'undo': {
      if (s.phase !== 'play' || !s.turnStart) return s;
      const next = clone(s);
      next.hands[seat] = s.turnStart.hand;
      next.melds[team] = s.turnStart.melds;
      return next;
    }

    case 'discard': {
      if (s.phase !== 'play') throw new Error('Draw a card or take the pile first.');
      const card = s.hands[seat].find(c => c.id === action.id);
      if (!card) throw new Error('Select a card to discard.');
      const next = clone(s);
      checkMinimum(next, team);
      if (next.melds[team].length) next.initialDone[team] = true;
      next.hands[seat] = next.hands[seat].filter(c => c !== card);
      if (!next.hands[seat].length && !hasCanasta(next.melds[team])) {
        throw new Error('You can\'t go out until your team has a canasta.');
      }
      next.discard.push(card);
      next.discardLog.push({ seat, card });
      if (!next.hands[seat].length) return endHand(next, seat);
      next.turn = nextSeat(seat);
      next.phase = 'draw';
      next.turnStart = null;
      return next;
    }

    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

/** A team's first melds, all laid this turn, must reach the minimum before the turn ends. */
function checkMinimum(s, team) {
  if (s.initialDone[team] || !s.melds[team].length) return;
  const value = meldedValue(s, team);
  if (value < needed(s, team)) {
    throw new Error(`Your first meld must total at least ${needed(s, team)} points — you have ${value}. Add more, or tap Undo.`);
  }
}

function addToMeld(s, team, rank, cards) {
  const existing = s.melds[team].find(m => m.rank === rank);
  if (existing) existing.cards.push(...cards);
  else s.melds[team].push({ rank, cards: [...cards] });
}

function startPlay(s) {
  s.phase = 'play';
  s.turnStart = { hand: [...s.hands[s.turn]], melds: s.melds[teamOf(s.turn)].map(m => ({ ...m, cards: [...m.cards] })) };
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
 * Score a finished hand for each team:
 * canastas (natural 500, mixed 300), red 3s (100 each, 800 for all four —
 * minus if the team never melded), going out 100, plus the value of melded
 * cards, minus the value of cards left in the partners' hands.
 */
export function scoreHand(s) {
  return [0, 1].map(team => {
    const melds = s.melds[team];
    const canastas = melds.filter(isCanasta);
    const natural = canastas.filter(isNaturalMeld).length;
    const mixed = canastas.length - natural;
    const reds = s.redThrees[team].length;
    const redValue = (reds === 4 ? 800 : reds * 100) * (melds.length ? 1 : -1);
    const cards = melds.reduce((t, m) => t + valueOf(m.cards), 0);
    const goingOut = s.outBy != null && teamOf(s.outBy) === team ? 100 : 0;
    const inHand = valueOf([...s.hands[team], ...s.hands[team + 2]]);
    const total = natural * 500 + mixed * 300 + redValue + goingOut + cards - inHand;
    return { natural, mixed, redThrees: redValue, goingOut, cards, inHand, total };
  });
}

/** Winning team once someone reaches 5000 (higher score wins; null on a tie). */
export function gameWinner(scores) {
  const [a, b] = scores;
  if (Math.max(a, b) < WINNING_SCORE || a === b) return null;
  return a > b ? 0 : 1;
}
