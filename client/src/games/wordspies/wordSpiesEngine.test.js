import { describe, it, expect } from 'vitest';
import {
  newGame, act, viewFor, rotate, waitingOn, startProblem, clueProblem, leftFor, teamLeft, toFind, foundCount, guessable, SIZE,
} from './wordSpiesEngine.js';
import { WORDS } from './wordSpiesWords.js';

// A repeatable "random" sequence, so each test deals the same board every time
function seeded(seed = 1) {
  let x = seed;
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
}
const cardsOf = (key, k) => key.map((x, i) => (x === k ? i : -1)).filter(i => i >= 0);

describe('the words', () => {
  it('are single, different, lower-case words', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.length).toBeGreaterThan(300);
    for (const w of WORDS) expect(w).toMatch(/^[a-z][a-z-]*$/);
  });
});

describe('starting a game', () => {
  it('teams need two players each; together needs one on each side', () => {
    expect(startProblem([0, 1, 2], { mode: 'teams' })).toMatch(/at least 2/);
    expect(startProblem([0, 1, 2, 3], { mode: 'teams' })).toBeNull();
    expect(startProblem([0, 2, 4, 5], { mode: 'teams' })).toMatch(/at least 2/);   // three on one team, one on the other
    expect(startProblem([0, 2], { mode: 'together' })).toMatch(/each side/);
    expect(startProblem([0, 3], { mode: 'together' })).toBeNull();
  });

  it('teams: 9 words for the team going first, 8 for the other, 7 bystanders and a trap', () => {
    const s = newGame({ players: 4, mode: 'teams', rng: seeded(3) });
    expect(s.words).toHaveLength(SIZE);
    expect(new Set(s.words).size).toBe(SIZE);
    const first = s.turn === 0 ? 'a' : 'b', second = s.turn === 0 ? 'b' : 'a';
    expect(cardsOf(s.key, first)).toHaveLength(9);
    expect(cardsOf(s.key, second)).toHaveLength(8);
    expect(cardsOf(s.key, 'n')).toHaveLength(7);
    expect(cardsOf(s.key, 'x')).toHaveLength(1);
    expect(s.side).toEqual([0, 1, 0, 1]);
    expect(s.cluers).toEqual([0, 1]);
  });

  it('teams are made from the seats people sat in, and the clue givers change each game', () => {
    // Lobby seats 1, 3, 4, 6 and 7 were filled (numbered from 0: 0, 2, 3, 5, 6)
    let s = newGame({ players: 5, mode: 'teams', seatOrder: [0, 2, 3, 5, 6], rng: seeded(4) });
    expect(s.side).toEqual([0, 0, 1, 1, 0]);
    expect(s.cluers).toEqual([0, 2]);
    s = act({ ...s, phase: 'gameOver' }, { type: 'newGame' });
    expect(s.cluers).toEqual([1, 3]);
    s = act({ ...s, phase: 'gameOver' }, { type: 'newGame' });
    expect(s.cluers).toEqual([4, 2]);
  });

  it('together: each side has 9 words and 3 traps; 15 words between them', () => {
    const s = newGame({ players: 2, mode: 'together', rng: seeded(5) });
    for (const key of s.keys) {
      expect(cardsOf(key, 'g')).toHaveLength(9);
      expect(cardsOf(key, 'x')).toHaveLength(3);
    }
    const wanted = s.keys[0].map((k, i) => k === 'g' || s.keys[1][i] === 'g').filter(Boolean);
    expect(wanted).toHaveLength(15);
    expect(s.turnsLeft).toBe(9);
  });
});

describe('clues', () => {
  const s = { words: ['fire', 'box', 'cat', 'apple'], shown: [null, null, 'n', null] };
  it('must be one word that isn\'t on the board', () => {
    expect(clueProblem(s, '')).toMatch(/one-word/);
    expect(clueProblem(s, 'hot dog')).toMatch(/one word/);
    expect(clueProblem(s, 'r2d2')).toMatch(/one word/);
    expect(clueProblem(s, 'FIRE')).toMatch(/FIRE/);
    expect(clueProblem(s, 'boxes')).toMatch(/BOX/);
    expect(clueProblem(s, 'firework')).toMatch(/FIRE/);
    expect(clueProblem(s, 'apples')).toMatch(/APPLE/);
    expect(clueProblem(s, 'cats')).toBeNull();          // CAT has been guessed: fair game
    expect(clueProblem(s, 'ocean')).toBeNull();
    expect(clueProblem(s, "jack-o'-lantern")).toBeNull();
  });
});

describe('teams', () => {
  const start = () => newGame({ players: 4, mode: 'teams', rng: seeded(7) });

  it('only the clue giver gives the clue, and only their team guesses', () => {
    const s = start();
    const t = s.turn, cluer = s.cluers[t], guesser = s.side.findIndex((x, i) => x === t && i !== cluer);
    const other = s.cluers[1 - t];
    expect(waitingOn(s)).toEqual([cluer]);
    expect(() => act(s, { type: 'clue', seat: guesser, word: 'xylophone', count: 2 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'clue', seat: other, word: 'xylophone', count: 2 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'clue', seat: cluer, word: s.words[0], count: 2 })).toThrow(/on the board/);
    expect(() => act(s, { type: 'clue', seat: cluer, word: 'xylophone', count: 12 })).toThrow(/0 to 9/);
    const g = act(s, { type: 'clue', seat: cluer, word: 'Xylophone', count: 2 });
    expect(g.clue).toMatchObject({ word: 'xylophone', count: 2 });
    expect(waitingOn(g)).toEqual([guesser]);
    expect(() => act(g, { type: 'guess', seat: cluer, card: 0 })).toThrow(/don't guess/);
    expect(() => act(g, { type: 'guess', seat: other, card: 0 })).toThrow(/not your turn/);
    expect(() => act(g, { type: 'endTurn', seat: guesser })).toThrow(/at least one/);
  });

  it('a clue of N allows N+1 guesses; a bystander ends the turn; the trap loses', () => {
    const s = start();
    const t = s.turn, mine = cardsOf(s.key, t === 0 ? 'a' : 'b');
    const guesser = s.side.findIndex((x, i) => x === t && i !== s.cluers[t]);
    let g = act(s, { type: 'clue', seat: s.cluers[t], word: 'xylophone', count: 1 });
    g = act(g, { type: 'guess', seat: guesser, card: mine[0] });
    expect(g.phase).toBe('guess');
    expect(g.shown[mine[0]]).toBe(t === 0 ? 'a' : 'b');
    expect(() => act(g, { type: 'guess', seat: guesser, card: mine[0] })).toThrow(/already/);
    g = act(g, { type: 'guess', seat: guesser, card: mine[1] });        // the extra guess
    expect(g.phase).toBe('clue');
    expect(g.turn).toBe(1 - t);

    let h = act(s, { type: 'clue', seat: s.cluers[t], word: 'xylophone', count: null });
    h = act(h, { type: 'guess', seat: guesser, card: cardsOf(s.key, 'n')[0] });
    expect(h.phase).toBe('clue');
    expect(h.turn).toBe(1 - t);

    let x = act(s, { type: 'clue', seat: s.cluers[t], word: 'xylophone', count: 3 });
    x = act(x, { type: 'guess', seat: guesser, card: cardsOf(s.key, 'x')[0] });
    expect(x).toMatchObject({ phase: 'gameOver', winner: 1 - t, reason: 'trap' });
    expect(x.wins[1 - t]).toBe(1);
  });

  it('finding all your words wins — even on the other team\'s turn', () => {
    let s = start();
    const t = s.turn;
    const theirs = cardsOf(s.key, t === 0 ? 'b' : 'a');
    s = { ...s, shown: s.shown.map((x, i) => (theirs.slice(1).includes(i) ? s.key[i] : x)) };   // all but one of theirs found
    expect(leftFor(s, 1 - t)).toBe(1);
    const guesser = s.side.findIndex((x, i) => x === t && i !== s.cluers[t]);
    s = act(s, { type: 'clue', seat: s.cluers[t], word: 'xylophone', count: 2 });
    s = act(s, { type: 'guess', seat: guesser, card: theirs[0] });
    expect(s).toMatchObject({ phase: 'gameOver', winner: 1 - t, reason: 'allFound' });
  });

  it('guessers see the key only when the game is over; clue givers always', () => {
    const s = start();
    const guesser = s.side.findIndex((x, i) => !s.cluers.includes(i));
    expect(viewFor(s, guesser).mine).toBeNull();
    expect(viewFor(s, guesser).key).toBeUndefined();
    expect(viewFor(s, s.cluers[0]).mine).toEqual(s.key);
    expect(viewFor({ ...s, phase: 'gameOver' }, guesser).mine).toEqual(s.key);
  });

  it('a guesser can take over as clue giver', () => {
    const s = start();
    const guesser = s.side.findIndex((x, i) => x === 0 && i !== s.cluers[0]);
    const t = act(s, { type: 'takeClues', seat: guesser });
    expect(t.cluers[0]).toBe(guesser);
    expect(viewFor(t, guesser).mine).toEqual(s.key);
  });
});

describe('together', () => {
  const start = (turns = 9) => newGame({ players: 2, mode: 'together', turns, rng: seeded(11) });

  it('one side clues from its own key, the other guesses', () => {
    const s = start();
    const giver = s.side.indexOf(s.turn), guesser = s.side.indexOf(1 - s.turn);
    expect(waitingOn(s)).toEqual([giver]);
    expect(() => act(s, { type: 'clue', seat: guesser, word: 'xylophone', count: 2 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'clue', seat: giver, word: 'xylophone', count: 0 })).toThrow(/how many/);
    const g = act(s, { type: 'clue', seat: giver, word: 'xylophone', count: 2 });
    expect(waitingOn(g)).toEqual([guesser]);
    expect(() => act(g, { type: 'guess', seat: giver, card: 0 })).toThrow(/not your turn/);
  });

  it('keep guessing until a bystander; then it\'s the other side\'s clue, one turn fewer', () => {
    const s = start();
    const t = s.turn, giver = s.side.indexOf(t), guesser = s.side.indexOf(1 - t);
    const words = cardsOf(s.keys[t], 'g'), bystander = cardsOf(s.keys[t], 'n')[0];
    let g = act(s, { type: 'clue', seat: giver, word: 'xylophone', count: 1 });
    for (const card of words.slice(0, 4)) g = act(g, { type: 'guess', seat: guesser, card });   // more than the clue said: fine
    expect(foundCount(g)).toBe(4);
    expect(toFind(g, t)).toBe(5);
    g = act(g, { type: 'guess', seat: guesser, card: bystander });
    expect(g).toMatchObject({ phase: 'clue', turn: 1 - t, turnsLeft: 8 });
    expect(g.missed[t][bystander]).toBe(true);
    expect(g.shown[bystander]).toBeNull();
    // That bystander is only ruled out for clues from that side
    g = act(g, { type: 'clue', seat: guesser, word: 'quokka', count: 1 });
    expect(guessable(g, bystander)).toBe(true);
  });

  it('a trap on the clue giver\'s key loses the game for everyone', () => {
    const s = start();
    const t = s.turn;
    let g = act(s, { type: 'clue', seat: s.side.indexOf(t), word: 'xylophone', count: 1 });
    g = act(g, { type: 'guess', seat: s.side.indexOf(1 - t), card: cardsOf(s.keys[t], 'x')[0] });
    expect(g).toMatchObject({ phase: 'gameOver', winner: false, reason: 'trap', record: { won: 0, lost: 1 } });
  });

  it('running out of turns loses', () => {
    let s = start(1);
    const t = s.turn;
    s = act(s, { type: 'clue', seat: s.side.indexOf(t), word: 'xylophone', count: 1 });
    s = act(s, { type: 'guess', seat: s.side.indexOf(1 - t), card: cardsOf(s.keys[t], 'g')[0] });
    s = act(s, { type: 'endTurn', seat: s.side.indexOf(1 - t) });
    expect(s).toMatchObject({ phase: 'gameOver', winner: false, reason: 'outOfTurns' });
  });

  it('finding all 15 wins; a side with nothing left to find only guesses', () => {
    let s = start(20);
    const play = side => {
      const giver = s.side.indexOf(side), guesser = s.side.indexOf(1 - side);
      s = act(s, { type: 'clue', seat: giver, word: 'xylophone', count: 9 });
      for (const card of cardsOf(s.keys[side], 'g')) if (s.phase === 'guess' && s.shown[card] !== 'g') s = act(s, { type: 'guess', seat: guesser, card });
    };
    const first = s.turn;
    play(first);
    expect(toFind(s, first)).toBe(0);
    expect(s).toMatchObject({ phase: 'clue', turn: 1 - first });
    play(1 - first);
    expect(s).toMatchObject({ phase: 'gameOver', winner: true, reason: 'allFound', record: { won: 1, lost: 0 } });
  });

  it('each side sees only its own key until the end', () => {
    const s = start();
    const v0 = viewFor(s, s.side.indexOf(0)), v1 = viewFor(s, s.side.indexOf(1));
    expect(v0.mine).toEqual(s.keys[0]);
    expect(v1.mine).toEqual(s.keys[1]);
    expect(v0.keys).toBeUndefined();
    expect(v0.theirs).toBeNull();
    expect(viewFor({ ...s, phase: 'gameOver' }, 0).theirs).toEqual(s.keys[1]);
  });

  it('a new game keeps the sides, the turns and the record', () => {
    const s = act({ ...start(11), phase: 'gameOver', record: { won: 2, lost: 1 } }, { type: 'newGame' });
    expect(s).toMatchObject({ phase: 'clue', turns: 11, turnsLeft: 11, record: { won: 2, lost: 1 }, round: 1 });
  });
});

describe('rotate', () => {
  it('turns seats round so the viewer is seat 0', () => {
    const s = newGame({ players: 4, mode: 'teams', rng: seeded(2) });
    const v = rotate(viewFor(s, 1), 1);
    expect(v.side).toEqual([1, 0, 1, 0]);
    expect(v.cluers).toEqual([3, 0]);
  });
});

describe('words left (teams)', () => {
  it('can be counted from what everyone sees', () => {
    const s = newGame({ players: 4, mode: 'teams', rng: seeded(9) });
    const v = viewFor(s, s.side.findIndex((x, i) => !s.cluers.includes(i)));
    expect(teamLeft(v, s.first)).toBe(9);
    expect(teamLeft(v, 1 - s.first)).toBe(8);
    expect(teamLeft(v, 0)).toBe(leftFor(s, 0));
  });
});
