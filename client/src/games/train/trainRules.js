/**
 * Mexican Train dominoes, as pure functions.
 *
 * A double-12 set (91 tiles). Seat 0 is you; seats 1.. are computer players.
 * Each round starts from an engine double in the hub (12|12 in round 1, then
 * 11|11 … down to 0|0). Every player has a train of their own, and there's a
 * shared Mexican Train anyone may play on.
 *
 * On your turn, play one tile that matches the open end of your own train,
 * the Mexican Train, or any train with a marker on it. If you can't, draw one
 * tile; if that still doesn't play, pass and put a marker on your own train
 * (anyone may then play on it until you play on it yourself).
 * A double must be covered ("satisfied") before anyone plays anywhere else:
 * whoever plays it plays again, and if they can't cover it, the next players must.
 * The round ends when someone plays their last tile, or when nobody can play.
 * The pips left in your hand are added to your score; lowest total wins.
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the move isn't allowed. Actions:
 *   { type: 'play', tileId, train }   train = index into state.trains
 *   { type: 'draw' }
 *   { type: 'pass' }
 */
import { shuffle } from '../../utils/cardEngine';

export const MAX_PIP = 12;
export const MEXICAN = 'mexican';

export function makeSet(max = MAX_PIP) {
  const tiles = [];
  for (let a = 0; a <= max; a++) for (let b = a; b <= max; b++) tiles.push({ id: `${a}-${b}`, a, b });
  return tiles;
}

export const isDouble = t => t.a === t.b;
export const pips = t => t.a + t.b;
export const handPips = hand => hand.reduce((s, t) => s + pips(t), 0);
export const matches = (t, n) => t.a === n || t.b === n;

/** Tiles dealt to each player (the usual counts for a double-12 set). */
export const handSize = players => (players <= 4 ? 15 : players <= 6 ? 12 : 11);

/** Engines by round: 12, 11, … 0. `rounds` limits the game (e.g. 7 → 12 down to 6). */
export const engineFor = round => MAX_PIP - round;

// ── Dealing ──────────────────────────────────────────────────────────────────
/**
 * Start a round. `players` = number of players (2–4 here), `round` = 0-based.
 * `set` may be passed in (already shuffled) so tests can replay a deal.
 */
export function dealRound({ players = 4, round = 0, set = shuffle(makeSet()) } = {}) {
  const engine = engineFor(round);
  const boneyard = set.filter(t => !(t.a === engine && t.b === engine));
  const n = handSize(players);
  const hands = Array.from({ length: players }, (_, s) => boneyard.slice(s * n, s * n + n));
  return {
    players,
    round,
    engine,
    hands,
    boneyard: boneyard.slice(players * n),
    // One train per player, then the Mexican Train
    trains: [
      ...Array.from({ length: players }, (_, s) => ({ owner: s, tiles: [], open: false })),
      { owner: MEXICAN, tiles: [], open: true },
    ],
    turn: round % players,                 // the start moves round the table each round
    pendingDouble: null,                   // index of a train ending in an uncovered double
    drew: false,                           // has the current player drawn this turn?
    passesInARow: 0,
    phase: 'play',                         // play | over
    outBy: null,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** The number a tile must match to extend `train`. */
export const openEnd = (s, train) => {
  const tiles = s.trains[train].tiles;
  return tiles.length ? tiles[tiles.length - 1].b : s.engine;
};

/** Trains `seat` may play on right now. */
export function playableTrains(s, seat) {
  if (s.pendingDouble != null) return [s.pendingDouble];
  return s.trains.map((t, i) => (t.owner === seat || t.owner === MEXICAN || t.open ? i : -1)).filter(i => i >= 0);
}

/** Every legal move for `seat`: [{ tileId, train }]. */
export function legalMoves(s, seat) {
  const moves = [];
  for (const train of playableTrains(s, seat)) {
    const end = openEnd(s, train);
    for (const t of s.hands[seat]) if (matches(t, end)) moves.push({ tileId: t.id, train });
  }
  return moves;
}

export const trainName = (s, train, names) =>
  (s.trains[train].owner === MEXICAN ? 'the Mexican Train' : `${names[s.trains[train].owner]}${s.trains[train].owner === 0 ? 'r' : '\'s'} train`);

// ── Actions ──────────────────────────────────────────────────────────────────
export function act(s, action) {
  if (s.phase === 'over') throw new Error('The round is over.');
  const seat = s.turn;
  switch (action.type) {
    case 'play': {
      const tile = s.hands[seat].find(t => t.id === action.tileId);
      if (!tile) throw new Error('Pick one of your tiles first.');
      const train = action.train;
      if (!playableTrains(s, seat).includes(train)) {
        throw new Error(s.pendingDouble != null
          ? `The double on ${describeTrain(s, s.pendingDouble)} has to be covered first.`
          : 'You can only play on your own train, the Mexican Train, or a train with a marker.');
      }
      const end = openEnd(s, train);
      if (!matches(tile, end)) throw new Error(`That tile doesn't match — this train needs a ${end}.`);

      const next = clone(s);
      next.hands[seat] = next.hands[seat].filter(t => t.id !== tile.id);
      const placed = tile.a === end ? { ...tile } : { id: tile.id, a: tile.b, b: tile.a };   // turn it to fit
      next.trains[train].tiles.push(placed);
      if (next.trains[train].owner === seat) next.trains[train].open = false;   // playing on your own train takes the marker off
      next.passesInARow = 0;
      if (!next.hands[seat].length) return endRound(next, seat);
      if (isDouble(tile)) {
        next.pendingDouble = train;          // must be covered: the same player goes again
        next.drew = false;
        return next;
      }
      if (next.pendingDouble === train) next.pendingDouble = null;
      return endTurn(next);
    }

    case 'draw': {
      if (legalMoves(s, seat).length) throw new Error('You have a tile that plays — no need to draw.');
      if (s.drew) throw new Error('You\'ve already drawn this turn.');
      if (!s.boneyard.length) throw new Error('The boneyard is empty — pass instead.');
      const next = clone(s);
      next.hands[seat].push(next.boneyard.pop());
      next.drew = true;
      return next;
    }

    case 'pass': {
      if (legalMoves(s, seat).length) throw new Error('You have a tile that plays.');
      if (!s.drew && s.boneyard.length) throw new Error('Draw a tile first.');
      const next = clone(s);
      next.trains[seat].open = true;         // put your marker out
      next.passesInARow++;
      // Nobody can play and there's nothing left to draw: the round is blocked
      if (!next.boneyard.length && next.passesInARow >= next.players) return endRound(next, null);
      return endTurn(next);
    }

    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

const describeTrain = (s, train) => (s.trains[train].owner === MEXICAN ? 'the Mexican Train' : 'that train');

function endTurn(s) {
  s.turn = (s.turn + 1) % s.players;
  s.drew = false;
  return s;
}

function endRound(s, outBy) {
  s.phase = 'over';
  s.outBy = outBy;
  return s;
}

function clone(s) {
  return {
    ...s,
    hands: s.hands.map(h => [...h]),
    boneyard: [...s.boneyard],
    trains: s.trains.map(t => ({ ...t, tiles: [...t.tiles] })),
  };
}

/** Points each player takes from the round: the pips left in their hand. */
export const roundScores = s => s.hands.map(handPips);
