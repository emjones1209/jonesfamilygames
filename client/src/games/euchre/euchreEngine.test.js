import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate, teamTricks, legalFor, mustCall } from './euchreEngine';
import { makeDeck } from './euchreRules';

function autoplay(s, levels = ['hard', 'medium', 'hard', 'easy'], until = () => false) {
  for (let step = 0; step < 20000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = seat == null ? act(s, { type: 'collect' }) : act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

// A deck laid out so each seat gets the named cards (5 each, seat 0 first), then the up-card and the rest
function stacked(hands, upcard) {
  const all = makeDeck();
  const take = id => all.splice(all.findIndex(c => c.id === id), 1)[0];
  const dealt = hands.flatMap(h => h.map(take));
  const up = take(upcard);
  return [...dealt, up, ...all];
}
const DECK = stacked([
  ['J-hearts', 'A-hearts', 'K-hearts', 'A-spades', '10-clubs'],     // seat 0
  ['9-clubs', '10-spades', 'Q-spades', '9-diamonds', '10-diamonds'], // seat 1
  ['J-diamonds', 'Q-hearts', 'A-clubs', 'K-clubs', 'A-diamonds'],   // seat 2
  ['9-spades', 'J-spades', 'K-spades', 'Q-clubs', 'J-clubs'],       // seat 3 (dealer)
], '9-hearts');

describe('Euchre game engine', () => {
  it('plays whole games to 10 with computer players', () => {
    for (let g = 0; g < 20; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.scores[s.winner]).toBeGreaterThanOrEqual(10);
    }
  });

  it('plays five tricks a hand, three players a trick when someone goes alone', () => {
    let alones = 0;
    for (let g = 0; g < 200 && alones < 5; g++) {
      const s = autoplay(newGame(), ['hard', 'hard', 'hard', 'hard'], x => x.phase === 'handOver' || x.phase === 'gameOver');
      expect(teamTricks(s)[0] + teamTricks(s)[1]).toBe(5);
      if (s.alone) {
        alones++;
        expect(s.table.history.every(t => t.length === 3 && !t.some(p => p.seat === s.sittingOut))).toBe(true);
      } else {
        expect(s.table.history.every(t => t.length === 4)).toBe(true);
      }
    }
    expect(alones).toBeGreaterThan(0);
  });

  it('goes round the table from the dealer\'s left', () => {
    let s = newGame({ deck: DECK });
    expect(s.upcard.id).toBe('9-hearts');
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'pass', seat: 1 })).toThrow(/not your turn/);
    s = act(s, { type: 'pass', seat: 0 });
    expect(waitingFor(s)).toBe(1);
  });

  it('ordering up puts the up-card in the dealer\'s hand, and the dealer throws one away', () => {
    let s = act(newGame({ deck: DECK }), { type: 'call', seat: 0 });
    expect(s).toMatchObject({ phase: 'discard', trump: 'hearts', maker: 0, alone: false });
    expect(s.hands[3]).toHaveLength(6);
    expect(waitingFor(s)).toBe(3);
    expect(() => act(s, { type: 'discard', seat: 3, cardId: '9-hearts-nope' })).toThrow(/isn't in your hand/);
    s = act(s, { type: 'discard', seat: 3, cardId: 'Q-clubs' });
    expect(s.phase).toBe('playing');
    expect(s.table.hands[3].map(c => c.id)).toContain('9-hearts');
    expect(s.table.hands[3]).toHaveLength(5);
    expect(waitingFor(s)).toBe(0);                          // left of the dealer leads
  });

  it('in round 1 only the up-card\'s suit can be ordered', () => {
    const s = newGame({ deck: DECK });
    expect(() => act(s, { type: 'call', seat: 0, suit: 'spades' })).toThrow(/turned card/);
  });

  it('turns the card down after four passes, then sticks the dealer', () => {
    let s = newGame({ deck: DECK });
    for (const seat of [0, 1, 2, 3]) s = act(s, { type: 'pass', seat });
    expect(s).toMatchObject({ round: 2, turnedDown: 'hearts', phase: 'bidding' });
    expect(waitingFor(s)).toBe(0);
    expect(() => act(s, { type: 'call', seat: 0, suit: 'hearts' })).toThrow(/other than/);
    for (const seat of [0, 1, 2]) s = act(s, { type: 'pass', seat });
    expect(mustCall(s)).toBe(true);
    expect(() => act(s, { type: 'pass', seat: 3 })).toThrow(/dealer has to name trump/);
    s = act(s, { type: 'call', seat: 3, suit: 'spades' });
    expect(s).toMatchObject({ phase: 'playing', trump: 'spades', maker: 3 });
    expect(s.hands[3]).toHaveLength(5);                      // no pick-up in round 2
  });

  it('going alone sits the partner out; the lone player\'s left leads', () => {
    let s = act(newGame({ deck: DECK }), { type: 'call', seat: 0, alone: true });
    s = act(s, { type: 'discard', seat: 3, cardId: 'Q-clubs' });
    expect(s).toMatchObject({ alone: true, sittingOut: 2 });
    expect(s.table.hands[2]).toEqual([]);
    expect(waitingFor(s)).toBe(0);
    s = act(s, { type: 'play', seat: 0, cardId: 'J-hearts' });
    expect(waitingFor(s)).toBe(1);
    s = act(s, robotAction(s, 1, 'medium'));
    expect(waitingFor(s)).toBe(3);                            // skips seat 2
    s = act(s, robotAction(s, 3, 'medium'));
    expect(s.table.status).toBe('collecting');
    expect(s.table.winner).toBe(0);
  });

  it('when the dealer\'s partner goes alone, the dealer sits out and doesn\'t pick up', () => {
    let s = act(newGame({ deck: DECK }), { type: 'pass', seat: 0 });
    s = act(s, { type: 'call', seat: 1, alone: true });
    expect(s).toMatchObject({ phase: 'playing', sittingOut: 3 });
    expect(s.hands[3]).toHaveLength(5);
    expect(waitingFor(s)).toBe(0);
  });

  it('makes the left bower follow a trump lead', () => {
    // Hearts trump: seat 2's J♦ is a trump, so when trump is led seat 2 may play it or the Q♥
    let s = act(newGame({ deck: DECK }), { type: 'call', seat: 0 });
    s = act(s, { type: 'discard', seat: 3, cardId: 'Q-clubs' });
    s = act(s, { type: 'play', seat: 0, cardId: 'J-hearts' });
    expect(legalFor(s, 1)).toHaveLength(5);                   // no hearts: anything goes
    s = act(s, { type: 'play', seat: 1, cardId: '9-clubs' });
    expect(legalFor(s, 2).map(c => c.id).sort()).toEqual(['J-diamonds', 'Q-hearts']);
    expect(() => act(s, { type: 'play', seat: 2, cardId: 'A-diamonds' })).toThrow(/follow suit/);
  });

  it('scores the makers\' tricks at the end of the hand', () => {
    const s = autoplay(newGame(), undefined, x => x.phase === 'handOver' || x.phase === 'gameOver');
    const { makerTeam, tricks, delta } = s.lastHand;
    expect(makerTeam).toBe(s.maker % 2);
    if (tricks[makerTeam] >= 3) expect(delta[makerTeam]).toBeGreaterThan(0);
    else expect(delta[1 - makerTeam]).toBe(2);
    expect(s.scores).toEqual(delta);
  });

  it('never shows anyone else\'s cards, the pack, or the dealer\'s thrown-away card', () => {
    let s = act(newGame({ deck: DECK }), { type: 'call', seat: 0 });
    s = act(s, { type: 'discard', seat: 3, cardId: 'Q-clubs' });
    for (const seat of [0, 1, 2]) {
      const json = JSON.stringify(viewFor(s, seat));
      expect(json).not.toContain('"Q-clubs"');
      for (const c of s.kitty) expect(json).not.toContain(`"${c.id}"`);
      for (const other of [0, 1, 2, 3].filter(x => x !== seat)) {
        for (const c of s.table.hands[other]) if (c.id !== '9-hearts') expect(json).not.toContain(`"${c.id}"`);
      }
    }
    expect(JSON.stringify(viewFor(s, 3))).toContain('"Q-clubs"');
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.handNo === 1 && x.phase === 'playing' && x.table.history.length === 2);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.table.hands[0]).toEqual(s.table.hands[seat]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(teamTricks(r)).toEqual(seat % 2 ? [teamTricks(s)[1], teamTricks(s)[0]] : teamTricks(s));
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });

  it('plays a sensible game: Hard beats Easy most of the time', () => {
    let wins = 0;
    const games = 40;
    for (let g = 0; g < games; g++) if (autoplay(newGame(), ['hard', 'easy', 'hard', 'easy']).winner === 0) wins++;
    expect(wins).toBeGreaterThan(games * 0.6);
  });
});
