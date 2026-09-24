/**
 * The difficulty levels must really differ: the stronger level has to come out
 * clearly ahead in duplicate computer-vs-computer matches (see matchups.js).
 */
import { describe, it, expect } from 'vitest';
import { edge } from './matchups';

const DEALS = { spades: 400, bridge: 400, rook: 400, hearts: 1500 };

describe.each(['spades', 'bridge', 'rook', 'hearts'])('%s difficulty levels', game => {
  it('hard beats medium, and medium beats easy', () => {
    const hm = edge(game, 'hard', 'medium', DEALS[game]);
    const me = edge(game, 'medium', 'easy', DEALS[game]);
    const fmt = r => `${r.mean.toFixed(1)} ± ${r.se.toFixed(1)}`;
    console.log(`${game}: hard vs medium ${fmt(hm)} pts/hand · medium vs easy ${fmt(me)} pts/hand`);
    // Clearly ahead: more than two standard errors above zero
    expect(hm.mean).toBeGreaterThan(2 * hm.se);
    expect(me.mean).toBeGreaterThan(2 * me.se);
  });
});
