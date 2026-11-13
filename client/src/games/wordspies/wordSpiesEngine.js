/**
 * Word Spies: a word-association game for people only (no robots — a robot can't
 * give a clue that makes the family groan and laugh). Shared by the screen (in the
 * browser) and play-together tables (on the server, which holds the secret keys).
 *
 * 25 words are dealt in a 5×5 grid. Behind them is a secret key that only the
 * clue givers can see. A clue is ONE word and a number: "OCEAN 2" means "two of
 * our words go with ocean". The others try to tap the right words.
 *
 * Two ways to play (the table's `mode`):
 *
 *  'teams'    ☀️ Sun against 🌙 Moon (seats alternate between teams, like partners
 *             in cards). Each team has a clue giver who sees the key; their
 *             teammates guess. The starting team has 9 words, the other 8; 7 are
 *             bystanders and 1 is the trap 💣. A clue of N allows N+1 guesses (0 or
 *             ∞: as many as you like). Your own word: guess again. A bystander or
 *             the other team's word ends your turn. The trap loses the game. First
 *             team to find all its words wins.
 *
 *  'together' Everyone against the game. Seats alternate between side A and side B,
 *             and each side sees its OWN key (9 words to find, 3 traps). Sides take
 *             turns: one side gives a clue from its key, the other side guesses.
 *             A word from the clue giver's key: keep going (or stop when you like).
 *             A bystander ends the turn. A trap on the clue giver's key loses the
 *             game. Find all 15 words between you before the turns run out.
 *             (Once a side's words are all found, it only guesses from then on.)
 *
 * State, as kept by the server:
 *   words[25]
 *   key[25]        teams: 'a' (Sun) | 'b' (Moon) | 'n' (bystander) | 'x' (trap)
 *   keys[2][25]    together: each side's key: 'g' (a word to find) | 'n' | 'x'
 *   shown[25]      what everyone can see about a card: null (not guessed) or
 *                    teams: 'a' | 'b' | 'n' | 'x'
 *                    together: 'g' (found) | 'x' (the trap that ended the game)
 *   missed[2][25]  together: a bystander on that side's key, already guessed
 *   side[seat]     each seat's team (teams) or side (together): 0 or 1
 *   cluers[2]      teams: the clue giver's seat for each team
 *   turn           the team (or side) giving this clue
 *   phase          'clue' | 'guess' | 'gameOver'
 *
 * Actions (`act` throws an Error that explains a move that isn't allowed):
 *   { type: 'clue', seat, word, count }   count: 0–9, or null for "∞" (teams)
 *   { type: 'guess', seat, card }         card = index 0–24
 *   { type: 'endTurn', seat }             stop guessing (after at least one guess)
 *   { type: 'takeClues', seat }           teams: become your team's clue giver
 *                                         (the table only allows it when theirs has gone)
 *   { type: 'giveUp', seat }
 *   { type: 'newGame' }                   after a game: new words, and the clue givers move on
 */
import { WORDS } from './wordSpiesWords.js';

export const SIZE = 25;
export const MODES = ['together', 'teams'];
export const TURN_CHOICES = [11, 9, 7];
export const TEAMS = ['Sun', 'Moon'];
export const TEAM_EMOJI = ['☀️', '🌙'];
export const TOTAL_TOGETHER = 15;              // different words to find between the two sides

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The together-mode key cards, as [side A, side B] pairs: each side has 9 words and
// 3 traps, 3 words are wanted by both, and some of one side's words are the other's traps
const TOGETHER_PAIRS = [
  ...Array(3).fill(['g', 'g']),
  ...Array(5).fill(['g', 'n']),
  ...Array(5).fill(['n', 'g']),
  ['g', 'x'], ['x', 'g'], ['x', 'x'], ['x', 'n'], ['n', 'x'],
  ...Array(7).fill(['n', 'n']),
];

/** Seats (as they were in the lobby) → who's on which side: seats alternate. */
const sidesFor = (players, seatOrder) => (seatOrder ?? Array.from({ length: players }, (_, i) => i)).map(i => i % 2);

/**
 * Why a game can't start with these seats (their numbers in the lobby), or null.
 * Teams need a clue giver and at least one guesser each; together, a player on each side.
 */
export function startProblem(seats, { mode = 'together' } = {}) {
  const size = [0, 1].map(t => seats.filter(i => i % 2 === t).length);
  if (mode === 'teams') {
    return size[0] < 2 || size[1] < 2
      ? 'Teams need at least 2 players each (4 in all): one gives the clues and the others guess.'
      : null;
  }
  return !size[0] || !size[1] ? 'You need at least one player on each side (2 in all).' : null;
}

export function newGame({
  players = 2, mode = 'together', turns = 9, seatOrder, side, round = 0, wins = [0, 0], record = { won: 0, lost: 0 },
  rng = Math.random,
} = {}) {
  side ??= sidesFor(players, seatOrder);
  const words = shuffle(WORDS, rng).slice(0, SIZE);
  const s = {
    mode, players, side, round, words,
    shown: Array(SIZE).fill(null),
    phase: 'clue', clue: null, guesses: 0, log: [], winner: null, reason: null,
  };
  if (mode === 'teams') {
    const first = rng() < 0.5 ? 0 : 1;
    const key = shuffle([
      ...Array(9).fill(first ? 'b' : 'a'), ...Array(8).fill(first ? 'a' : 'b'), ...Array(7).fill('n'), 'x',
    ], rng);
    // The clue givers take turns: a different person on each team every game
    const cluers = [0, 1].map(t => {
      const team = side.map((x, seat) => (x === t ? seat : -1)).filter(seat => seat >= 0);
      return team[round % team.length];
    });
    return { ...s, key, cluers, first, turn: first, wins };
  }
  const pairs = shuffle(TOGETHER_PAIRS, rng);
  return {
    ...s, keys: [pairs.map(p => p[0]), pairs.map(p => p[1])], missed: [Array(SIZE).fill(false), Array(SIZE).fill(false)],
    turn: rng() < 0.5 ? 0 : 1, turns, turnsLeft: turns, record,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────
const teamLetter = t => (t === 0 ? 'a' : 'b');

/** Teams: words of team `t` not found yet. */
export const leftFor = (s, t) => s.key.filter((k, i) => k === teamLetter(t) && !s.shown[i]).length;
/** Teams, from what everyone can see (the team that went first has 9 words, the other 8). */
export const teamLeft = (s, t) => (t === s.first ? 9 : 8) - s.shown.filter(x => x === teamLetter(t)).length;
/** Together: words still to find on side `t`'s key. */
export const toFind = (s, t) => (s.keys[t] ?? []).filter((k, i) => k === 'g' && s.shown[i] !== 'g').length;
/** Together: words found so far (of 15). */
export const foundCount = s => s.shown.filter(x => x === 'g').length;

/** Is `seat` a clue giver? (Together, everyone on the side giving the clue may type it.) */
export const isCluer = (s, seat) => (s.mode === 'teams' ? s.cluers.includes(seat) : false);

/** The seats that may act now: the clue givers, or the guessers. */
export function waitingOn(s) {
  if (s.phase === 'gameOver') return [];
  const seats = s.side.map((_, seat) => seat);
  if (s.mode === 'teams') {
    return s.phase === 'clue' ? [s.cluers[s.turn]]
      : seats.filter(seat => s.side[seat] === s.turn && seat !== s.cluers[s.turn]);
  }
  return seats.filter(seat => (s.phase === 'clue' ? s.side[seat] === s.turn : s.side[seat] !== s.turn));
}
export const waitingFor = s => waitingOn(s)[0] ?? null;

/** Can this card be guessed now? */
export function guessable(s, card) {
  if (s.phase !== 'guess' || s.shown[card]) return false;
  return s.mode === 'teams' || !s.missed[s.turn][card];
}

// "Cat" and "cats", "box" and "boxes", "fire" and "firework" are all too close
const norm = w => String(w ?? '').trim().toLowerCase();
function tooClose(a, b) {
  if (a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 4 && (long.startsWith(short) || long.endsWith(short));
}

/** Why this clue isn't allowed, or null. Only the words still in play count. */
export function clueProblem(s, word) {
  const w = norm(word);
  if (!w) return 'Type a one-word clue.';
  if (w.length > 24 || !/^\p{L}[\p{L}'-]*$/u.test(w)) return 'A clue is just one word — no spaces or numbers.';
  const clash = s.words.find((b, i) => !s.shown[i] && tooClose(w, b.toLowerCase()));
  return clash ? `"${clash.toUpperCase()}" is on the board — you can't use it (or a word too like it).` : null;
}

// ── Actions ──────────────────────────────────────────────────────────────────
const MAX_LOG = 60;
const logged = (s, entry) => [...s.log, entry].slice(-MAX_LOG);

function finish(s, { winner = null, won = false, reason }) {
  if (s.mode === 'teams') {
    return { ...s, phase: 'gameOver', winner, reason, wins: s.wins.map((n, t) => (t === winner ? n + 1 : n)) };
  }
  return {
    ...s, phase: 'gameOver', winner: won, reason,
    record: { won: s.record.won + (won ? 1 : 0), lost: s.record.lost + (won ? 0 : 1) },
  };
}

/** The guessing is over for this clue: the other side's turn (together: one turn fewer). */
function endTurn(s) {
  const base = { ...s, phase: 'clue', clue: null, guesses: 0 };
  if (s.mode === 'teams') return { ...base, turn: 1 - s.turn };
  const turnsLeft = s.turnsLeft - 1;
  if (turnsLeft <= 0) return finish({ ...base, turnsLeft: 0 }, { won: false, reason: 'outOfTurns' });
  // A side whose words are all found has nothing left to give clues for: the other side does
  const next = toFind(s, 1 - s.turn) > 0 ? 1 - s.turn : s.turn;
  return { ...base, turnsLeft, turn: next };
}

function onSide(s, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= s.side.length) throw new Error('You\'re not playing in this game.');
  return s.side[seat];
}

export function act(s, a) {
  switch (a.type) {
    case 'clue': {
      if (s.phase !== 'clue') throw new Error(s.phase === 'gameOver' ? 'The game is over.' : 'There\'s already a clue — it\'s time to guess.');
      const side = onSide(s, a.seat);
      if (s.mode === 'teams' ? a.seat !== s.cluers[s.turn] : side !== s.turn) throw new Error('It\'s not your turn to give a clue.');
      const problem = clueProblem(s, a.word);
      if (problem) throw new Error(problem);
      const count = a.count == null ? null : Number(a.count);
      if (count != null && !(Number.isInteger(count) && count >= 0 && count <= 9)) throw new Error('The number goes from 0 to 9.');
      if (s.mode === 'together' && !count) throw new Error('Choose how many words your clue is for (1 to 9).');
      const clue = { word: norm(a.word), count, seat: a.seat, side: s.turn };
      return { ...s, phase: 'guess', clue, guesses: 0, log: logged(s, { kind: 'clue', ...clue }) };
    }

    case 'guess': {
      if (s.phase !== 'guess') throw new Error(s.phase === 'gameOver' ? 'The game is over.' : 'Wait for the clue first.');
      const side = onSide(s, a.seat);
      const mine = s.mode === 'teams' ? side === s.turn && a.seat !== s.cluers[s.turn] : side !== s.turn;
      if (!mine) throw new Error(s.mode === 'teams' && a.seat === s.cluers[s.turn] ? 'Clue givers don\'t guess — your team does.' : 'It\'s not your turn to guess.');
      const card = a.card;
      if (!Number.isInteger(card) || card < 0 || card >= SIZE) throw new Error('Tap one of the words.');
      if (!guessable(s, card)) throw new Error('That word has already been guessed.');
      const guesses = s.guesses + 1;

      if (s.mode === 'teams') {
        const k = s.key[card];
        const shown = s.shown.map((x, i) => (i === card ? k : x));
        const next = { ...s, shown, guesses, log: logged(s, { kind: 'guess', seat: a.seat, side, card, word: s.words[card], result: k }) };
        if (k === 'x') return finish(next, { winner: 1 - s.turn, reason: 'trap' });
        if (leftFor(next, 0) === 0) return finish(next, { winner: 0, reason: 'allFound' });
        if (leftFor(next, 1) === 0) return finish(next, { winner: 1, reason: 'allFound' });
        if (k !== teamLetter(s.turn)) return endTurn(next);
        const allowed = s.clue.count ? s.clue.count + 1 : Infinity;
        return guesses >= allowed ? endTurn(next) : next;
      }

      const k = s.keys[s.turn][card];
      const entry = { kind: 'guess', seat: a.seat, side, card, word: s.words[card], result: k };
      const next = { ...s, guesses, log: logged(s, entry) };
      if (k === 'x') return finish({ ...next, shown: s.shown.map((x, i) => (i === card ? 'x' : x)) }, { won: false, reason: 'trap' });
      if (k === 'n') {
        return endTurn({ ...next, missed: s.missed.map((m, t) => (t === s.turn ? m.map((x, i) => x || i === card) : m)) });
      }
      const found = { ...next, shown: s.shown.map((x, i) => (i === card ? 'g' : x)) };
      if (foundCount(found) >= TOTAL_TOGETHER) return finish(found, { won: true, reason: 'allFound' });
      // (Nothing left on the clue giver's key? Then the turn's done)
      return toFind(found, s.turn) === 0 ? endTurn(found) : found;
    }

    case 'endTurn': {
      if (s.phase !== 'guess') throw new Error('You can only stop while guessing.');
      const side = onSide(s, a.seat);
      const guessing = s.mode === 'teams' ? side === s.turn && a.seat !== s.cluers[s.turn] : side !== s.turn;
      if (!guessing) throw new Error('It\'s not your turn to guess.');
      if (!s.guesses) throw new Error('Make at least one guess first.');
      return endTurn({ ...s, log: logged(s, { kind: 'stop', seat: a.seat, side }) });
    }

    case 'takeClues': {
      if (s.mode !== 'teams' || s.phase === 'gameOver') throw new Error('There\'s no clue giver to take over from.');
      const side = onSide(s, a.seat);
      if (s.cluers[side] === a.seat) return s;
      return {
        ...s, cluers: s.cluers.map((c, t) => (t === side ? a.seat : c)),
        log: logged(s, { kind: 'takeClues', seat: a.seat, side }),
      };
    }

    case 'giveUp': {
      if (s.phase === 'gameOver') throw new Error('The game is over.');
      const side = onSide(s, a.seat);
      return finish(s, { winner: 1 - side, won: false, reason: 'gaveUp' });
    }

    case 'newGame':
      if (s.phase !== 'gameOver') return s;
      return newGame({
        players: s.players, mode: s.mode, turns: s.turns, side: s.side, round: s.round + 1, wins: s.wins, record: s.record,
      });

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// ── What each player may see ─────────────────────────────────────────────────
/**
 * Only clue givers see the key (teams); each side sees only its own key (together).
 * When the game is over, everything is turned over for everyone to see.
 * `mine` is the key this player may look at (teams: null for guessers).
 */
export function viewFor(s, seat) {
  const over = s.phase === 'gameOver';
  if (s.mode === 'teams') {
    const { key, ...rest } = s;
    return { ...rest, mine: over || s.cluers.includes(seat) ? key : null };
  }
  const { keys, ...rest } = s;
  const side = s.side[seat] ?? 0;
  return { ...rest, mine: keys[side], theirs: over ? keys[1 - side] : null };
}

/** Turn the seats round so that `seat` is seat 0 (the names at a table are turned the same way). */
export function rotate(v, seat) {
  if (!seat) return v;
  const n = v.side.length;
  const r = x => (x == null ? x : (x - seat + n) % n);
  return {
    ...v,
    side: v.side.map((_, i) => v.side[(i + seat) % n]),
    cluers: v.cluers?.map(r),
    clue: v.clue && { ...v.clue, seat: r(v.clue.seat) },
    log: v.log.map(e => ({ ...e, seat: r(e.seat) })),
  };
}
