import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate } from './canastaEngine';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 50000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Canasta game engine', () => {
  it('plays whole games to 5000, a step at a time', () => {
    for (let g = 0; g < 2; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect([0, 1]).toContain(s.winner);
      expect(s.scores[s.winner]).toBeGreaterThanOrEqual(5000);
    }
  });

  it('keeps all 108 cards in play', () => {
    let s = newGame();
    const count = x => x.hands.flat().length + x.stock.length + x.discard.length + x.redThrees.flat().length
      + x.melds.flat().reduce((n, m) => n + m.cards.length, 0);
    for (let step = 0; step < 400 && s.phase !== 'handOver' && s.phase !== 'gameOver'; step++) {
      expect(count(s)).toBe(108);
      s = act(s, robotAction(s, waitingFor(s), 'hard'));
    }
  });

  it('only lets the player whose turn it is move, and says what happened', () => {
    let s = newGame({ dealer: 3 });
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'draw', seat: 1 })).toThrow(/not your turn/);
    s = act(s, { type: 'draw', seat: 0 });
    expect(s.moves[0]).toMatchObject({ seat: 0, kind: 'draw' });
    s = act(s, { type: 'discard', seat: 0, id: s.hands[0][0].id });
    expect(s.moves.map(m => m.kind)).toEqual(['discard', 'draw']);
    expect(waitingFor(s)).toBe(1);
  });

  it('never sends anyone another hand, the stock or a computer player\'s plans', () => {
    let s = autoplay(newGame(), undefined, x => x.robotPlan != null);
    expect(s.robotPlan.steps.length).toBeGreaterThan(0);
    for (const seat of [0, 1, 2, 3]) {
      const v = JSON.parse(JSON.stringify(viewFor(s, seat)));
      expect(v.robotPlan).toBeUndefined();
      const json = JSON.stringify(v);
      for (const other of [0, 1, 2, 3]) {
        if (other !== seat) for (const c of s.hands[other]) expect(json).not.toContain(`"${c.id}"`);
      }
      for (const c of s.stock) expect(json).not.toContain(`"${c.id}"`);
    }
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.melds[0].length && x.melds[1].length);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.melds[0]).toEqual(s.melds[seat % 2]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(r.turn).toBe((s.turn - seat + 4) % 4);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
