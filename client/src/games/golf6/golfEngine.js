/**
 * A game of 6-Card Golf for 2-4 players as a pure state machine, for
 * play-together tables (run on the server; see server/multiplayer/tables.js).
 * The rules and computer player are the same as the single-player game
 * (golfRules.js).
 *
 * Seats 0..players-1 clockwise. A game is a number of holes (deals); the lowest
 * total after the last hole wins. `act(state, action)` returns the next state
 * or throws an Error whose message explains why the move isn't allowed:
 *   { type: 'peek', seat, row, col }     at the start of a hole everyone turns 2 cards face up
 *   { type: 'draw', seat, from }         from = 'stock' | 'discard'
 *   { type: 'place', seat, row, col }    swap the drawn card into your grid (that card is discarded)
 *   { type: 'discard', seat }            throw the drawn card away
 *   { type: 'flip', seat, row, col }     instead of drawing, turn a face-down card over
 *   { type: 'nextHole' }                 deal the next hole after the scores are shown
 *   { type: 'newGame' }                  start again after the last hole
 *
 * `waitingOn(state)` lists the seats that must move (everyone at once while
 * peeking); `robotAction(state, seat, level)` picks a computer player's move;
 * `viewFor(state, seat)` hides the face-down cards and the stock.
 */
import { shuffle } from '../../utils/cardEngine.js';
import { gridScore, allFaceUp, dealGame, refillStock, chooseSource, choosePlacement } from './golfRules.js';

export const PEEKS = 2;
export const HOLE_CHOICES = [1, 3, 9];
const POSITIONS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]];

const next = (s, seat) => (seat + 1) % s.players;
const setCell = (grid, row, col, card) => grid.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? card : c)));
const withGrid = (s, seat, grid) => s.grids.map((g, i) => (i === seat ? grid : g));

// ── Dealing ──────────────────────────────────────────────────────────────────
function deal(state, dealer) {
  const { grids, stock, discard } = dealGame(state.players);
  return {
    ...state,
    phase: 'peek',                             // peek | playing | holeOver | gameOver
    dealer,
    grids, stock, discard,                     // discard[0] is the top card
    peeks: Array(state.players).fill(0),       // cards each player has turned over to start
    turn: null,
    drawn: null,                               // { card, fromDiscard } while a player holds a card
    finisher: null,                            // the first player to turn all 6 cards face up
    turnsLeft: null,                           // turns still to come once someone has finished
    lastMove: null,                            // for "Dad swaps it for his 9♠"
    lastHole: null,
  };
}

export function newGame({ players = 2, holes = 9, dealer = players - 1 } = {}) {
  return deal({ players, holes, holeNo: 0, totals: Array(players).fill(0), history: [], winners: null }, dealer);
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** Seats that must move now (several while everyone turns over their first cards). */
export function waitingOn(s) {
  if (s.phase === 'peek') return s.peeks.map((p, seat) => (p < PEEKS ? seat : -1)).filter(x => x >= 0);
  if (s.phase === 'playing') return [s.turn];
  return [];
}

/** The seat whose turn it is (null while peeking or between holes). */
export const waitingFor = s => (s.phase === 'playing' ? s.turn : null);

// ── Actions ──────────────────────────────────────────────────────────────────
function checkCell(row, col) {
  if (![0, 1].includes(row) || ![0, 1, 2].includes(col)) throw new Error('Pick one of your six cards.');
}

function checkTurn(s, seat) {
  if (s.phase !== 'playing') throw new Error('It\'s not time to play.');
  if (seat !== s.turn) throw new Error('It\'s not your turn.');
}

export function act(s, a) {
  switch (a.type) {
    case 'peek': {
      if (s.phase !== 'peek') throw new Error('The hole has already started.');
      checkCell(a.row, a.col);
      if (s.peeks[a.seat] >= PEEKS) throw new Error(`You've already turned over ${PEEKS} cards.`);
      const card = s.grids[a.seat][a.row][a.col];
      if (card.faceUp) throw new Error('That card is already face up.');
      const peeks = s.peeks.map((p, i) => (i === a.seat ? p + 1 : p));
      const next_ = { ...s, peeks, grids: withGrid(s, a.seat, setCell(s.grids[a.seat], a.row, a.col, { ...card, faceUp: true })) };
      // Once everyone has turned over their cards, the player after the dealer starts
      return peeks.every(p => p >= PEEKS) ? { ...next_, phase: 'playing', turn: next(s, s.dealer) } : next_;
    }

    case 'draw': {
      checkTurn(s, a.seat);
      if (s.drawn) throw new Error('You\'ve already drawn a card.');
      if (a.from === 'discard') {
        if (!s.discard.length) throw new Error('The discard pile is empty.');
        const [card, ...discard] = s.discard;
        return { ...s, discard, drawn: { card, fromDiscard: true }, lastMove: { seat: a.seat, kind: 'draw', card, fromDiscard: true } };
      }
      if (a.from !== 'stock') throw new Error('Draw from the deck or the discard pile.');
      const { stock, discard } = refillStock(s.stock, s.discard);
      if (!stock.length) throw new Error('The deck is empty — take the discard.');
      const card = { ...stock[0], faceUp: true };
      return {
        ...s, stock: stock.slice(1), discard, drawn: { card, fromDiscard: false },
        lastMove: { seat: a.seat, kind: 'draw', card, fromDiscard: false, reshuffled: stock !== s.stock },
      };
    }

    case 'place': {
      checkTurn(s, a.seat);
      if (!s.drawn) throw new Error('Draw a card first.');
      checkCell(a.row, a.col);
      const old = s.grids[a.seat][a.row][a.col];
      const grid = setCell(s.grids[a.seat], a.row, a.col, { ...s.drawn.card, faceUp: true });
      return endTurn({
        ...s, grids: withGrid(s, a.seat, grid), discard: [{ ...old, faceUp: true }, ...s.discard], drawn: null,
        lastMove: { seat: a.seat, kind: 'place', card: s.drawn.card, replaced: { ...old, faceUp: true }, wasFaceUp: old.faceUp, row: a.row, col: a.col },
      }, a.seat);
    }

    case 'discard': {
      checkTurn(s, a.seat);
      if (!s.drawn) throw new Error('Draw a card first.');
      return endTurn({
        ...s, discard: [s.drawn.card, ...s.discard], drawn: null,
        lastMove: { seat: a.seat, kind: 'discard', card: s.drawn.card },
      }, a.seat);
    }

    case 'flip': {
      checkTurn(s, a.seat);
      if (s.drawn) throw new Error('Put the card you drew in your grid, or discard it.');
      checkCell(a.row, a.col);
      const card = s.grids[a.seat][a.row][a.col];
      if (card.faceUp) throw new Error('That card is already face up.');
      const up = { ...card, faceUp: true };
      return endTurn({
        ...s, grids: withGrid(s, a.seat, setCell(s.grids[a.seat], a.row, a.col, up)),
        lastMove: { seat: a.seat, kind: 'flip', card: up, row: a.row, col: a.col },
      }, a.seat);
    }

    case 'nextHole':
      if (s.phase !== 'holeOver') return s;
      return { ...deal(s, next(s, s.dealer)), holeNo: s.holeNo + 1 };

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({ players: s.players, holes: s.holes, dealer: next(s, s.dealer) });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

/** Pass the turn on; once someone has all six cards up, everyone else gets one more turn. */
function endTurn(s, seat) {
  if (s.finisher == null) {
    if (allFaceUp(s.grids[seat])) return { ...s, finisher: seat, turnsLeft: s.players - 1, turn: next(s, seat) };
    return { ...s, turn: next(s, seat) };
  }
  const turnsLeft = s.turnsLeft - 1;
  if (turnsLeft <= 0) return finishHole({ ...s, turnsLeft: 0 });
  return { ...s, turnsLeft, turn: next(s, seat) };
}

function finishHole(s) {
  const grids = s.grids.map(g => g.map(row => row.map(c => ({ ...c, faceUp: true }))));
  const scores = grids.map(gridScore);
  const totals = s.totals.map((t, i) => t + scores[i]);
  const last = s.holeNo + 1 >= s.holes;
  const best = Math.min(...totals);
  return {
    ...s, grids, totals, turn: null,
    history: [...s.history, scores],
    lastHole: { scores, finisher: s.finisher },
    phase: last ? 'gameOver' : 'holeOver',
    winners: last ? totals.map((t, i) => (t === best ? i : -1)).filter(i => i >= 0) : null,
  };
}

// ── Computer players ─────────────────────────────────────────────────────────
/** The move a computer player at `seat` makes now (it must be one of `waitingOn`). */
export function robotAction(s, seat, level) {
  const grid = s.grids[seat];
  if (s.phase === 'peek') {
    const [row, col] = shuffle(POSITIONS.filter(([r, c]) => !grid[r][c].faceUp))[0];
    return { type: 'peek', seat, row, col };
  }
  if (!s.drawn) {
    const stockLeft = s.stock.length || s.discard.length > 1;
    const fromDiscard = !stockLeft || chooseSource({ grid, topDiscard: s.discard[0], difficulty: level });
    return { type: 'draw', seat, from: fromDiscard ? 'discard' : 'stock' };
  }
  const opponentGrids = s.grids.filter((_, i) => i !== seat);
  const pos = choosePlacement({ grid, opponentGrids, card: s.drawn.card, fromDiscard: s.drawn.fromDiscard, difficulty: level });
  return pos ? { type: 'place', seat, row: pos[0], col: pos[1] } : { type: 'discard', seat };
}

// ── What each player may see ─────────────────────────────────────────────────
const FACE_DOWN = { faceUp: false };

/** The state as `seat` may see it: nobody sees face-down cards or the stock (not even their own). */
export function viewFor(s) {
  return {
    ...s,
    grids: s.grids.map(g => g.map(row => row.map(c => (c.faceUp ? c : FACE_DOWN)))),
    stock: s.stock.map(() => null),
  };
}

/** Turn a state (or view) round so that `seat` becomes seat 0 — you always sit at the bottom. */
export function rotate(s, seat) {
  if (!seat) return s;
  const n = s.players;
  const r = x => (x == null ? x : (x - seat + n) % n);
  const arr = a => a && a.map((_, i) => a[(i + seat) % n]);
  return {
    ...s,
    dealer: r(s.dealer), turn: r(s.turn), finisher: r(s.finisher),
    grids: arr(s.grids), peeks: arr(s.peeks), totals: arr(s.totals),
    history: s.history.map(arr),
    winners: s.winners && s.winners.map(r),
    lastMove: s.lastMove && { ...s.lastMove, seat: r(s.lastMove.seat) },
    lastHole: s.lastHole && { scores: arr(s.lastHole.scores), finisher: r(s.lastHole.finisher) },
  };
}
