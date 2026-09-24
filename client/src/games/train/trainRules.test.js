import { describe, it, expect } from 'vitest';
import { shuffle } from '../../utils/cardEngine';
import { makeSet, dealRound, act, legalMoves, openEnd, roundScores, handSize, MEXICAN } from './trainRules';
import { chooseAction, longestChain } from './trainAI';

const t = id => { const [a, b] = id.split('|').map(Number); return { id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) }; };

/** A round in progress: engine 12, you (seat 0) to play. */
function position({ hands, boneyard = ['0|0', '0|1'], trains = {}, pendingDouble = null, players = 3 }) {
  const s = dealRound({ players, round: 0, set: makeSet() });
  s.hands = hands.map(h => h.map(t));
  s.boneyard = boneyard.map(t);
  for (const [i, tiles] of Object.entries(trains)) s.trains[i].tiles = tiles.map(x => { const [a, b] = x.split('|').map(Number); return { id: t(x).id, a, b }; });
  s.pendingDouble = pendingDouble;
  s.turn = 0;
  return s;
}

describe('Mexican Train setup', () => {
  it('uses a double-12 set of 91 tiles', () => {
    expect(makeSet()).toHaveLength(91);
  });

  it('deals 15 each (2–4 players) and keeps the engine out', () => {
    for (const players of [2, 3, 4]) {
      const s = dealRound({ players, round: 3 });
      expect(s.engine).toBe(9);
      expect(s.hands.every(h => h.length === handSize(players))).toBe(true);
      const all = [...s.hands.flat(), ...s.boneyard];
      expect(all).toHaveLength(90);
      expect(all.some(x => x.id === '9-9')).toBe(false);
      expect(s.trains).toHaveLength(players + 1);
      expect(s.trains[players].owner).toBe(MEXICAN);
    }
  });
});

describe('Playing tiles', () => {
  it('plays on your own train and the Mexican Train, turning tiles to fit', () => {
    const s = position({ hands: [['12|5', '3|12', '7|8'], ['1|2'], ['1|3']] });
    expect(legalMoves(s, 0).map(m => `${m.tileId}@${m.train}`).sort()).toEqual(['3-12@0', '3-12@3', '5-12@0', '5-12@3']);
    const next = act(s, { type: 'play', tileId: '5-12', train: 0 });
    expect(openEnd(next, 0)).toBe(5);
    expect(next.turn).toBe(1);
  });

  it("doesn't allow other players' trains unless they have a marker", () => {
    const s = position({ hands: [['12|5', '7|8'], ['1|2'], ['1|3']] });
    expect(() => act(s, { type: 'play', tileId: '5-12', train: 1 })).toThrow(/marker/);
    s.trains[1].open = true;
    expect(act(s, { type: 'play', tileId: '5-12', train: 1 }).turn).toBe(1);
  });

  it('makes you draw, then pass with a marker, when nothing plays', () => {
    const s = position({ hands: [['1|1', '2|3'], ['1|2'], ['1|3']], boneyard: ['4|5'] });
    expect(() => act(s, { type: 'pass' })).toThrow(/Draw/);
    const drawn = act(s, { type: 'draw' });
    expect(drawn.hands[0]).toHaveLength(3);
    const passed = act(drawn, { type: 'pass' });
    expect(passed.trains[0].open).toBe(true);
    expect(passed.turn).toBe(1);
  });

  it('a double must be covered before anything else — first by whoever played it', () => {
    const s = position({ hands: [['12|6', '6|6', '6|1', '9|9'], ['1|2'], ['1|3']], trains: { 0: [] } });
    let n = act(s, { type: 'play', tileId: '6-12', train: 0 });
    n.turn = 0;                                  // back to you for the test
    n = act(n, { type: 'play', tileId: '6-6', train: 0 });
    expect(n.turn).toBe(0);                      // you go again
    expect(n.pendingDouble).toBe(0);
    expect(legalMoves(n, 0).every(m => m.train === 0)).toBe(true);
    n = act(n, { type: 'play', tileId: '1-6', train: 0 });
    expect(n.pendingDouble).toBe(null);
    expect(n.turn).toBe(1);
  });

  it('ends the round when someone plays their last tile, and scores the pips left', () => {
    const s = position({ hands: [['12|4'], ['10|11', '0|0'], ['6|6']] });
    const over = act(s, { type: 'play', tileId: '4-12', train: 3 });
    expect(over.phase).toBe('over');
    expect(over.outBy).toBe(0);
    expect(roundScores(over)).toEqual([0, 21, 12]);
  });

  it('ends a blocked round when nobody can play and the boneyard is empty', () => {
    let s = position({ hands: [['1|1'], ['2|2'], ['3|3']], boneyard: [] });
    for (let i = 0; i < 3; i++) s = act(s, { type: 'pass' });
    expect(s.phase).toBe('over');
    expect(s.outBy).toBe(null);
  });
});

describe('Hard planning', () => {
  it('finds the longest run from the open end', () => {
    const chain = longestChain(['12|3', '3|7', '7|1', '12|9', '5|5'].map(t), 12);
    expect(chain.map(x => x.id)).toEqual(['3-12', '3-7', '1-7']);
  });
});

// ── Computer players ─────────────────────────────────────────────────────────
export function playRound(levels, set, round) {
  let s = dealRound({ players: levels.length, round, set: [...set] });
  for (let step = 0; step < 2000 && s.phase !== 'over'; step++) s = act(s, chooseAction(s, levels[s.turn]));
  return s;
}

describe('Mexican Train computer players', () => {
  it.each(['easy', 'medium', 'hard'])('play complete, legal rounds (%s)', level => {
    for (let i = 0; i < 60; i++) {
      const s = playRound([level, level, level, level], shuffle(makeSet()), i % 13);
      expect(s.phase).toBe('over');
      const tiles = s.hands.flat().length + s.boneyard.length + s.trains.reduce((n, tr) => n + tr.tiles.length, 0);
      expect(tiles).toBe(90);
    }
  });

  it('hard beats medium, and medium beats easy', () => {
    // One player at level `a` against three at level `b`, seat and engine rotating;
    // edge = the others' average points minus the hero's (points are bad)
    const edge = (a, b, rounds) => {
      const samples = [];
      for (let i = 0; i < rounds; i++) {
        const hero = i % 4;
        const pts = roundScores(playRound([0, 1, 2, 3].map(p => (p === hero ? a : b)), shuffle(makeSet()), i % 13));
        samples.push(pts.filter((_, p) => p !== hero).reduce((x, y) => x + y, 0) / 3 - pts[hero]);
      }
      const mean = samples.reduce((x, y) => x + y, 0) / rounds;
      const sd = Math.sqrt(samples.reduce((x, y) => x + (y - mean) ** 2, 0) / (rounds - 1));
      return { mean, se: sd / Math.sqrt(rounds) };
    };
    const hm = edge('hard', 'medium', 3000), me = edge('medium', 'easy', 1500);
    console.log(`train: hard vs medium ${hm.mean.toFixed(1)} ± ${hm.se.toFixed(1)} · medium vs easy ${me.mean.toFixed(1)} ± ${me.se.toFixed(1)} pts/round`);
    expect(hm.mean).toBeGreaterThan(2 * hm.se);
    expect(me.mean).toBeGreaterThan(2 * me.se);
  }, 120000);
});
