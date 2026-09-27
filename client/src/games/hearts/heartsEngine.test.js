import { describe, it, expect } from 'vitest';
import { newGame, act, waitingOn, waitingFor, robotAction, viewFor, rotate, pointsTaken } from './heartsEngine';

/** Let computer players play until `until` (or the game ends). */
function autoplay(s, levels = ['hard', 'medium', 'easy', 'hard'], until = () => false) {
  for (let step = 0; step < 20000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingOn(s)[0];
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Hearts game engine', () => {
  it('plays whole games to 100 with computer players', () => {
    for (let g = 0; g < 5; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(Math.max(...s.totals)).toBeGreaterThanOrEqual(100);
      expect(s.winners.every(w => s.totals[w] === Math.min(...s.totals))).toBe(true);
    }
  });

  it('accounts for all 26 points each hand', () => {
    let s = newGame();
    for (let hand = 0; hand < 6 && s.phase !== 'gameOver'; hand++) {
      s = autoplay(s, undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
      const sum = s.lastHand.points.reduce((a, b) => a + b, 0);
      expect(sum).toBe(s.lastHand.shooter == null ? 26 : 78);        // shooting the moon: 26 to each of the others
      if (s.phase === 'handOver') s = act(s, { type: 'nextHand' });
    }
  });

  it('passes once everyone has chosen, and the 2♣ leads', () => {
    let s = newGame();
    expect(s.direction).toBe('left');
    expect(waitingOn(s)).toEqual([0, 1, 2, 3]);
    expect(() => act(s, { type: 'pass', seat: 0, ids: s.hands[0].slice(0, 2).map(c => c.id) })).toThrow(/Choose 3/);
    const mine = s.hands[0].slice(0, 3).map(c => c.id);
    s = act(s, { type: 'pass', seat: 0, ids: mine });
    expect(waitingOn(s)).toEqual([1, 2, 3]);
    for (const seat of [1, 2, 3]) s = act(s, robotAction(s, seat, 'medium'));
    expect(s.phase).toBe('playing');
    expect(s.table.hands[1].map(c => c.id)).toEqual(expect.arrayContaining(mine));   // passed to the left
    expect(s.received[1]).toEqual(expect.arrayContaining(mine));
    const leader = waitingFor(s);
    expect(s.table.hands[leader].some(c => c.id === '2-clubs')).toBe(true);
    const other = s.table.hands[leader].find(c => c.id !== '2-clubs');
    expect(() => act(s, { type: 'play', seat: leader, cardId: other.id })).toThrow(/2♣/);
    expect(() => act(s, { type: 'play', seat: (leader + 1) % 4, cardId: '2-clubs' })).toThrow(/not your turn/);
  });

  it('never shows anyone else\'s cards, or what they are passing', () => {
    let s = newGame();
    s = act(s, robotAction(s, 2, 'hard'));
    const v = viewFor(s, 0);
    expect(v.passes).toEqual([null, null, true, null]);
    const json = JSON.stringify(v);
    for (const seat of [1, 2, 3]) for (const c of s.hands[seat]) expect(json).not.toContain(`"${c.id}"`);
    s = autoplay(s, undefined, x => x.phase === 'playing' && x.table.history.length === 2);
    const later = JSON.stringify(viewFor(s, 3));
    const passedByMe = new Set(s.passes[3]);                       // you do know the cards you passed on
    for (const seat of [0, 1, 2]) {
      for (const c of s.table.hands[seat]) if (!passedByMe.has(c.id)) expect(later).not.toContain(`"${c.id}"`);
    }
  });

  it('turns the table round so each player sits at the bottom', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.phase === 'playing' && x.table.history.length === 3 && x.table.trick.length === 2);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.totals[0]).toBe(s.totals[seat]);
      expect(pointsTaken(r)[0]).toBe(pointsTaken(s)[seat]);
      expect(r.table.turn).toBe((s.table.turn - seat + 4) % 4);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
