import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate, bidTurn, declarerTricks, dummyShown } from './bridgeEngine';
import { PASS } from './bridgeRules';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 5000 && !until(s); step++) {
    if (s.phase === 'handOver') return s;
    const seat = waitingFor(s);
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

/** Deal hands until the bidding produces a contract. */
function contracted() {
  for (;;) {
    const s = autoplay(newGame(), undefined, x => x.phase === 'playing');
    if (s.phase === 'playing') return s;
  }
}

describe('Bridge game engine', () => {
  it('plays hand after hand, scoring each contract', () => {
    let s = newGame();
    for (let hand = 0; hand < 12; hand++) {
      s = autoplay(s);
      expect(s.phase).toBe('handOver');
      if (!s.result.passedOut) {
        expect(s.table.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
        expect(s.result.declarerTricks).toBe(declarerTricks(s));
      }
      const before = s.scores;
      s = act(s, { type: 'nextHand' });
      expect(s.scores).toEqual(before);
      expect(s.dealer).toBe((hand + 1) % 4);
    }
  });

  it('checks bids: in turn, and higher than the last', () => {
    let s = newGame({ dealer: 0 });
    expect(() => act(s, { type: 'bid', seat: 1, bid: '1C' })).toThrow(/not your turn/);
    s = act(s, { type: 'bid', seat: 0, bid: '1H' });
    expect(() => act(s, { type: 'bid', seat: 1, bid: '1D' })).toThrow(/higher/);
    expect(() => act(s, { type: 'bid', seat: 1, bid: '8S' })).toThrow(/higher/);
    s = act(s, { type: 'bid', seat: 1, bid: '1S' });
    for (const seat of [2, 3, 0]) s = act(s, { type: 'bid', seat, bid: PASS });
    expect(s.phase).toBe('playing');
    expect(s.contract).toMatchObject({ bid: '1S', declarer: 1, dummy: 3 });
    expect(s.table.turn).toBe(2);                              // declarer's left leads
  });

  it('lets the declarer play dummy\'s cards', () => {
    let s = contracted();
    const { declarer, dummy } = s.contract;
    s = autoplay(s, undefined, x => x.phase !== 'playing' || (x.table.status === 'playing' && x.table.turn === dummy));
    expect(waitingFor(s)).toBe(declarer);
    const card = s.table.hands[dummy][0];
    expect(() => act(s, { type: 'play', seat: dummy, cardId: card.id })).toThrow(/not your turn/);
    const move = robotAction(s, declarer, 'hard');
    expect(s.table.hands[dummy].some(c => c.id === move.cardId)).toBe(true);
    s = act(s, move);
    expect(s.table.hands[dummy].some(c => c.id === move.cardId)).toBe(false);
  });

  it('shows dummy to everyone after the opening lead, and nothing else', () => {
    let s = contracted();
    const { dummy } = s.contract;
    const viewer = [0, 1, 2, 3].find(x => x !== dummy && x !== s.contract.declarer);
    expect(viewFor(s, viewer).table.hands[dummy].every(c => c === null)).toBe(true);
    s = act(s, robotAction(s, waitingFor(s), 'medium'));      // the opening lead
    expect(dummyShown(s)).toBe(true);
    const v = viewFor(s, viewer);
    expect(v.table.hands[dummy]).toEqual(s.table.hands[dummy]);
    const json = JSON.stringify(v);
    for (const seat of [0, 1, 2, 3]) {
      if (seat === viewer || seat === dummy) continue;
      for (const c of s.table.hands[seat]) expect(json).not.toContain(`"${c.id}"`);
    }
  });

  it('turns the table round so each player is South', () => {
    const s = autoplay(contracted(), undefined, x => x.table.history.length === 4 && x.table.trick.length === 1);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.contract.declarer).toBe((s.contract.declarer - seat + 4) % 4);
      expect(bidTurn(r)).toBe((bidTurn(s) - seat + 4) % 4);
      expect(waitingFor(r)).toBe((waitingFor(s) - seat + 4) % 4);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
