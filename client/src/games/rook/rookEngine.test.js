import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate, nextBid, handPoints } from './rookEngine';

/** Let computer players play until the game reaches `until` (or ends). */
function autoplay(s, levels = ['hard', 'medium', 'hard', 'medium'], until = () => false) {
  for (let step = 0; step < 5000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Rook game engine', () => {
  it('plays whole games to 300 with computer players', () => {
    for (let g = 0; g < 10; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(300);
      expect([0, 1]).toContain(s.winner);
    }
  });

  it('accounts for all 120 points each hand', () => {
    let s = newGame();
    for (let hand = 0; hand < 20; hand++) {
      s = autoplay(s, undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
      expect(s.lastHand.taken[0] + s.lastHand.taken[1]).toBe(120);
      if (s.phase === 'gameOver') break;
      s = act(s, { type: 'nextHand' });
    }
  });

  it('only lets the right seat move, and checks bids', () => {
    const s = newGame({ dealer: 3 });            // seat 0 bids first
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'bid', seat: 1, bid: 70 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'bid', seat: 0, bid: 72 })).toThrow(/steps of 5/);
    const after = act(s, { type: 'bid', seat: 0, bid: 80 });
    expect(nextBid(after)).toBe(85);
    expect(waitingFor(after)).toBe(1);
  });

  it('makes the last player take the bid if everyone else passes', () => {
    let s = newGame({ dealer: 3 });
    for (const seat of [0, 1, 2]) s = act(s, { type: 'bid', seat, bid: 'pass' });
    s = act(s, { type: 'bid', seat: 3, bid: 'pass' });
    expect(s.phase).toBe('nest');
    expect(s.bidWinner).toBe(3);
    expect(s.high.bid).toBe(70);
    expect(s.hands[3]).toHaveLength(18);
  });

  it('shows each player only their own cards', () => {
    let s = newGame({ dealer: 3 });
    for (const seat of [0, 1, 2]) s = act(s, { type: 'bid', seat, bid: 'pass' });
    s = act(s, { type: 'bid', seat: 3, bid: 'pass' });           // seat 3 takes the nest
    const v = viewFor(s, 0);
    expect(v.hands[0].every(c => c && c.id)).toBe(true);
    expect(v.hands[1].every(c => c === null)).toBe(true);
    expect(v.hands[3]).toHaveLength(18);
    expect(v.nest.every(c => c === null)).toBe(true);
    const json = JSON.stringify(v);
    for (const c of [...s.hands[1], ...s.hands[3]]) expect(json).not.toContain(`"${c.id}"`);
  });

  it('turns the table round so each player sits at the bottom', () => {
    let s = autoplay(newGame(), undefined, x => x.phase === 'playing' && x.table.history.length === 3 && x.table.trick.length === 2);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.table.turn).toBe((s.table.turn - seat + 4) % 4);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(handPoints(r)).toEqual(seat % 2 ? [handPoints(s)[1], handPoints(s)[0]] : handPoints(s));
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);                // and back again
    }
  });
});
