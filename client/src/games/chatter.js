/**
 * Computer players' reactions: now and then, when something notable happens,
 * a robot sends one of its favourite reactions (see players.js), just as a
 * person would. Shared by the single-player games (in the browser) and
 * play-together tables (on the server).
 *
 * What counts as notable: a hand (or round, or hole) is scored and one side did
 * clearly best or worst, or the game ends. Each robot speaks at most about once
 * a minute, and only one speaks per hand, so they never flood the screen.
 */
import { total as diceTotal } from './dice/diceRules.js';

export const QUIET_MS = 60 * 1000;          // the least time between one robot's reactions (except at game over)
const CHANCE = 0.5;                         // how often someone reacts to a notable hand
const FINAL_CHANCE = 0.85;                  // …and to the end of a game

const byTeam = (s, seat) => s.scores?.[seat % 2];
/**
 * How each game keeps score, seat by seat (partners share their side's score).
 * low: lower is better · min: the least change that's worth reacting to (e.g. not every peg in Cribbage)
 * Chess and Checkers have no score: only the end of the game counts.
 */
const SCORES = {
  rook: { score: byTeam },
  spades: { score: byTeam },
  canasta: { score: byTeam },
  euchre: { score: byTeam },
  pinochle: { score: byTeam },
  bridge: { score: (s, seat) => (seat % 2 ? s.scores?.ew : s.scores?.ns) },
  handfoot: { score: (s, seat) => s.scores?.[s.players === 4 ? seat % 2 : seat] },
  hearts: { score: (s, seat) => s.totals?.[seat], low: true },
  golf: { score: (s, seat) => s.totals?.[seat], low: true },
  train: { score: (s, seat) => s.totals?.[seat], low: true },
  gin: { score: (s, seat) => s.scores?.[seat] },
  cribbage: { score: (s, seat) => s.scores?.[seat], min: 8 },
  dice: { score: (s, seat) => (s.cards?.[seat] ? diceTotal(s.cards[seat]) : undefined), min: 25 },
  checkers: {},
  chess: {},
};
const TWO_PLAYER = new Set(['gin', 'cribbage', 'checkers', 'chess']);
const seatCount = (game, s) => s.players ?? (TWO_PLAYER.has(game) ? 2 : 4);

/**
 * What just happened, seat by seat: [{ seat, kind, best, delta }] where kind is
 * 'win' | 'lose' (the game just ended) or 'good' | 'bad' (that seat's side did
 * best / worst this hand), best lists the seats whose side did best, and delta
 * is how that seat's side did this hand (better is more).
 */
export function moments(game, before, after) {
  const rules = SCORES[game];
  // (A new game starting isn't a moment: the scores just go back to nothing)
  if (!rules || !before || !after || before === after || before.phase === 'gameOver') return [];
  const seats = Array.from({ length: seatCount(game, after) }, (_, i) => i);
  const scores = s => seats.map(seat => rules.score?.(s, seat));
  const known = list => list.every(Number.isFinite);

  if (after.phase === 'gameOver' && before.phase !== 'gameOver') {
    let winners;
    if (rules.score) {
      const final = scores(after);
      if (!known(final)) return [];
      const top = rules.low ? Math.min(...final) : Math.max(...final);
      winners = seats.filter(seat => final[seat] === top);
    } else {
      if (after.winner == null) return [];                  // a draw: nothing to say
      winners = [after.winner];
    }
    return seats.map(seat => ({ seat, kind: winners.includes(seat) ? 'win' : 'lose', best: winners }));
  }

  if (!rules.score) return [];
  const was = scores(before), now = scores(after);
  if (!known(was) || !known(now)) return [];
  const deltas = seats.map(seat => (now[seat] - was[seat]) * (rules.low ? -1 : 1));
  if (Math.max(...deltas.map(Math.abs)) < (rules.min ?? 1)) return [];
  const top = Math.max(...deltas), bottom = Math.min(...deltas);
  if (top === bottom) return [];
  const best = seats.filter(seat => deltas[seat] === top);
  return seats
    .map(seat => ({ seat, kind: deltas[seat] === top ? 'good' : deltas[seat] === bottom ? 'bad' : null, best, delta: deltas[seat] }))
    .filter(m => m.kind);
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * Which robots react to these moments, and with what: [{ seat, emoji }].
 * @param robots   seat → personality (from players.js) for each computer player
 * @param isPerson seat → true for a person (whose good hand a robot may admire)
 * @param lastSaid name → when that robot last reacted (updated here)
 */
export function reactionsFor(found, { robots, isPerson, lastSaid, now = Date.now(), rng = Math.random }) {
  const out = [];
  const final = found.some(m => m.kind === 'win' || m.kind === 'lose');
  const candidates = found.filter(m => robots(m.seat));
  // Shuffle, so it isn't always the same robot who speaks first
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const m of candidates) {
    const robot = robots(m.seat);
    if (!final && now - (lastSaid.get(robot.name) ?? -Infinity) < QUIET_MS) continue;
    if (rng() >= (final ? FINAL_CHANCE : CHANCE)) continue;
    let kind = m.kind;
    // A person on the other side did best: admire it (or sometimes grumble, if it cost us)
    if (kind === 'bad' && m.best.some(isPerson) && (m.delta === 0 || rng() < 0.5)) kind = 'them';
    else if (kind === 'bad' && m.delta === 0) continue;      // (another robot's good turn, e.g. at Five Dice)
    const choices = robot.reactions?.[kind];
    if (!choices?.length) continue;
    out.push({ seat: m.seat, emoji: pick(choices, rng) });
    lastSaid.set(robot.name, now);
    if (!final) break;                                       // one robot per hand is plenty
  }
  return out;
}
