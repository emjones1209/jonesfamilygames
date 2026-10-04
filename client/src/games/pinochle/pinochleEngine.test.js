import { describe, it, expect } from 'vitest';
import { newGame, act, waitingOn, waitingFor, robotAction, viewFor, rotate, legalFor, teamMeld } from './pinochleEngine';
import { GAME_TARGET, MIN_BID, PASS, buildPinochleDeck } from './pinochleRules';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 20000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Pinochle game engine', () => {
  it('plays whole games to 1,500 with computer players', () => {
    for (let g = 0; g < 3; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.scores[s.winner]).toBeGreaterThanOrEqual(GAME_TARGET);
    }
  });

  it('plays all 12 tricks, and the trick points add up to 250', () => {
    for (let g = 0; g < 5; g++) {
      const s = autoplay(newGame(), undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
      const { counters, tricks } = s.lastHand;
      expect(tricks[0] + tricks[1]).toBe(12);
      expect(counters[0] + counters[1]).toBe(250);
    }
  });

  it('bids in turn: pass and you\'re out; the dealer is stuck if everyone passes', () => {
    let s = newGame({ dealer: 3 });
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'bid', seat: 1, bid: 250 })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'bid', seat: 0, bid: 240 })).toThrow(/at least 250/);
    expect(() => act(s, { type: 'bid', seat: 0, bid: 255 })).toThrow(/in tens/);
    for (const seat of [0, 1, 2]) s = act(s, { type: 'bid', seat, bid: PASS });
    expect(waitingFor(s)).toBe(3);
    expect(() => act(s, { type: 'bid', seat: 3, bid: PASS })).toThrow(/must bid/);
    s = act(s, { type: 'bid', seat: 3, bid: MIN_BID });
    expect(s.phase).toBe('trump');
    expect(s.bidder).toBe(3);
  });

  it('bidding goes round until only one bidder is left, skipping those who passed', () => {
    let s = newGame({ dealer: 3 });
    s = act(s, { type: 'bid', seat: 0, bid: 250 });
    s = act(s, { type: 'bid', seat: 1, bid: PASS });
    s = act(s, { type: 'bid', seat: 2, bid: 260 });
    s = act(s, { type: 'bid', seat: 3, bid: PASS });
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'bid', seat: 0, bid: 260 })).toThrow(/at least 270/);
    s = act(s, { type: 'bid', seat: 0, bid: 300 });
    expect(waitingFor(s)).toBe(2);
    s = act(s, { type: 'bid', seat: 2, bid: PASS });
    expect(s.phase).toBe('trump');
    expect(s.bidder).toBe(0);
    expect(s.high).toEqual({ seat: 0, amount: 300 });
  });

  it('trump, then the partner passes 3 and the bidder passes 3 back; then everyone sees the meld', () => {
    let s = newGame({ dealer: 3 });
    s = act(s, { type: 'bid', seat: 0, bid: 250 });
    for (const seat of [1, 2, 3]) s = act(s, { type: 'bid', seat, bid: PASS });
    s = act(s, { type: 'trump', seat: 0, suit: 'hearts' });
    expect(waitingFor(s)).toBe(2);
    expect(() => act(s, { type: 'pass', seat: 2, cardIds: s.hands[2].slice(0, 2).map(c => c.id) })).toThrow(/Choose 3/);
    const given = s.hands[2].slice(0, 3);
    s = act(s, { type: 'pass', seat: 2, cardIds: given.map(c => c.id) });
    expect(s.hands[0]).toHaveLength(15);
    expect(s.hands[2]).toHaveLength(9);
    const back = s.hands[0].slice(0, 3);
    s = act(s, { type: 'passBack', seat: 0, cardIds: back.map(c => c.id) });
    expect(s.hands.map(h => h.length)).toEqual([12, 12, 12, 12]);
    expect(s.phase).toBe('meld');
    expect(waitingOn(s)).toEqual([0, 1, 2, 3]);
    expect(teamMeld(s)[0]).toBe(s.meld[0].total + s.meld[2].total);
    // The two passes are seen only by the partners
    expect(JSON.stringify(viewFor(s, 1).passed)).not.toContain(given[0].id);
    expect(viewFor(s, 2).passed.toBidder).toEqual(given);
    for (const seat of [3, 1, 2]) s = act(s, { type: 'ready', seat });
    expect(s.phase).toBe('meld');
    s = act(s, { type: 'ready', seat: 0 });
    expect(s.phase).toBe('playing');
    expect(waitingFor(s)).toBe(0);                     // the bidder leads
  });

  it('enforces following suit and heading the trick', () => {
    const s = autoplay(newGame(), undefined, x => x.phase === 'playing' && x.table.trick.length === 1);
    const seat = waitingFor(s);
    const legal = legalFor(s, seat);
    const bad = s.table.hands[seat].find(c => !legal.includes(c));
    if (bad) expect(() => act(s, { type: 'play', seat, cardId: bad.id })).toThrow(/suit|trump/);
    expect(() => act(s, { type: 'play', seat: (seat + 1) % 4, cardId: s.table.hands[(seat + 1) % 4][0].id })).toThrow(/not your turn/);
  });

  it('a set bidder loses the bid; the others score their meld and trick points', () => {
    // Seat 0 is forced to 250 with a hopeless hand (all 9s and Jacks)
    const deck = buildPinochleDeck();
    const weak = deck.filter(c => c.rank === '9' || c.rank === 'J').slice(0, 12);
    const rest = deck.filter(c => !weak.includes(c));
    let s = newGame({ dealer: 0, deck: [...weak, ...rest] });      // seat 1 bids first
    for (const seat of [1, 2, 3]) s = act(s, { type: 'bid', seat, bid: PASS });
    s = act(s, { type: 'bid', seat: 0, bid: MIN_BID });
    s = autoplay(s, ['medium', 'medium', 'medium', 'medium'], x => x.phase === 'handOver');
    const { res } = s.lastHand;
    if (!res[0].made) expect(s.scores[0]).toBe(-MIN_BID);
    expect(s.scores[1]).toBe(res[1].delta);
  });

  it('never shows anyone else\'s cards', () => {
    const s = autoplay(newGame(), undefined, x => x.phase === 'playing' && x.table.history.length === 2);
    const json = JSON.stringify(viewFor(s, 1).table);
    for (const seat of [0, 2, 3]) for (const c of s.table.hands[seat]) expect(json).not.toContain(`"${c.id}"`);
    expect(JSON.stringify(viewFor(s, 1).hands)).not.toContain(s.hands[0][0].id);
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.phase === 'playing' && x.table.history.length === 4);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.meld[0]).toEqual(s.meld[seat]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
