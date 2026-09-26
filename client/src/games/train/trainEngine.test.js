import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate } from './trainEngine';
import { legalMoves, MEXICAN } from './trainRules';

/** Let computer players play until `until` (or the game ends). */
function autoplay(s, levels = ['hard', 'medium', 'easy', 'hard'], until = () => false) {
  for (let step = 0; step < 50000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'roundOver') { s = act(s, { type: 'nextRound' }); continue; }
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Mexican Train game engine', () => {
  it('plays whole games for 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      for (let g = 0; g < 3; g++) {
        const s = autoplay(newGame({ players, rounds: 3 }));
        expect(s.phase).toBe('gameOver');
        expect(s.history).toHaveLength(3);
        expect(s.totals).toEqual(s.history.reduce((t, h) => t.map((x, i) => x + h[i]), Array(players).fill(0)));
        expect(s.winners.every(w => s.totals[w] === Math.min(...s.totals))).toBe(true);
      }
    }
  });

  it('deals each round afresh from the next engine', () => {
    let s = autoplay(newGame({ players: 3, rounds: 3 }), undefined, x => x.phase === 'roundOver');
    const totals = s.totals;
    s = act(s, { type: 'nextRound' });
    expect(s.round).toBe(1);
    expect(s.engine).toBe(11);
    expect(s.hands.every(h => h.length === 15)).toBe(true);
    expect(s.trains.every(t => t.tiles.length === 0)).toBe(true);
    expect(s.totals).toEqual(totals);
    expect(s.lastMove).toBe(null);
  });

  it('only lets the right seat move, and says what happened', () => {
    let s = newGame({ players: 4 });
    const seat = waitingFor(s);
    expect(() => act(s, { type: 'draw', seat: (seat + 1) % 4 })).toThrow(/not your turn/);
    const move = legalMoves(s, seat)[0];
    if (move) {
      s = act(s, { type: 'play', seat, ...move });
      expect(s.lastMove).toMatchObject({ seat, kind: 'play', train: move.train });
      expect(s.lastMove.tile.a).toBe(12);                        // laid against the 12|12 engine
    } else {
      s = act(s, { type: 'draw', seat });
      expect(s.lastMove).toEqual({ seat, kind: 'draw' });
    }
  });

  it('shows each player only their own tiles', () => {
    const s = autoplay(newGame({ players: 3 }), undefined, x => x.trains.some(t => t.tiles.length > 2));
    const v = viewFor(s, 1);
    expect(v.hands[1]).toEqual(s.hands[1]);
    expect(v.hands[0].every(t => t === null)).toBe(true);
    expect(v.boneyard).toHaveLength(s.boneyard.length);
    const json = JSON.stringify(v);
    for (const t of [...s.hands[0], ...s.hands[2], ...s.boneyard]) expect(json).not.toContain(`"${t.id}"`);
  });

  it('turns the table round so each player comes first, trains and all', () => {
    const s = autoplay(newGame({ players: 4, rounds: 3 }), undefined,
      x => x.round === 1 && x.trains.filter(t => t.tiles.length).length >= 3 && x.lastMove?.kind === 'play');
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.trains[0]).toEqual({ ...s.trains[seat], owner: 0 });
      expect(r.trains[4]).toEqual(s.trains[4]);
      expect(r.trains[4].owner).toBe(MEXICAN);
      expect(r.turn).toBe((s.turn - seat + 4) % 4);
      expect(legalMoves(r, r.turn).length).toBe(legalMoves(s, s.turn).length);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);                // and back again
    }
  });
});
