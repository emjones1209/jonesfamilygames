import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate, teamTricks } from './spadesEngine';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 20000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Spades game engine', () => {
  it('plays whole games to 500 with computer players', () => {
    for (let g = 0; g < 3; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect([0, 1]).toContain(s.winner);
      expect(s.scores[s.winner]).toBeGreaterThanOrEqual(500);
    }
  });

  it('plays to a shorter target when asked, and keeps it for the next game', () => {
    const s = autoplay(newGame({ target: 200 }));
    expect(s.phase).toBe('gameOver');
    expect(s.scores[s.winner]).toBeGreaterThanOrEqual(200);
    expect(s.scores[s.winner]).toBeLessThan(500);
    expect(act(s, { type: 'newGame' }).target).toBe(200);
    expect(rotate(s, 1).target).toBe(200);
  });

  it('plays all 13 tricks each hand', () => {
    const s = autoplay(newGame(), undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
    expect(teamTricks(s)[0] + teamTricks(s)[1]).toBe(13);
  });

  it('bids in turn, then the player after the dealer leads', () => {
    let s = newGame({ dealer: 3 });
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'bid', seat: 1, bid: 3 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'bid', seat: 0, bid: 14 })).toThrow(/Nil or 1 to 13/);
    for (const seat of [0, 1, 2, 3]) s = act(s, { type: 'bid', seat, bid: 3 });
    expect(s.phase).toBe('playing');
    expect(waitingFor(s)).toBe(0);
  });

  it('never shows anyone else\'s cards', () => {
    const s = autoplay(newGame(), undefined, x => x.phase === 'playing' && x.table.history.length === 2);
    const json = JSON.stringify(viewFor(s, 1));
    for (const seat of [0, 2, 3]) for (const c of s.table.hands[seat]) expect(json).not.toContain(`"${c.id}"`);
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.phase === 'playing' && x.table.history.length === 4);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.bids[0]).toBe(s.bids[seat]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(teamTricks(r)).toEqual(seat % 2 ? [teamTricks(s)[1], teamTricks(s)[0]] : teamTricks(s));
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
