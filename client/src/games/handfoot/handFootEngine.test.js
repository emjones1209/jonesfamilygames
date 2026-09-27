import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate } from './handFootEngine';
import { act as rulesAct, dealRound, makeDeck, isBook, isClean, scoreHand, MINIMUMS } from './handFootRules';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 100000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

const count = x => x.hands.flat().length + x.feet.flat().length + x.stock.length + x.discard.length
  + x.redThrees.flat().length + x.melds.flat().reduce((n, m) => n + m.cards.length, 0);

const card = (rank, suit = 'hearts', n = 1) => ({ id: `${rank}-${suit}-${n}`, rank, suit });

describe('Hand and Foot rules', () => {
  it('deals a hand and a foot of 11 to everyone from 270 cards', () => {
    const s = dealRound();
    expect(makeDeck()).toHaveLength(270);
    expect(count(s)).toBe(270);
    for (const seat of [0, 1, 2, 3]) {
      expect(s.hands[seat]).toHaveLength(11);
      expect(s.feet[seat]).toHaveLength(11);
    }
    expect(s.hands.flat().some(c => c.rank === '3' && ['hearts', 'diamonds'].includes(c.suit))).toBe(false);
  });

  it('draws two cards, and checks melds', () => {
    let s = dealRound({ dealer: 3 });
    s.hands[0] = [card('9'), card('9', 'spades'), card('9', 'clubs'), card('JK', 'joker'), card('2', 'clubs'), card('2', 'hearts'), card('5')];
    s = rulesAct(s, { type: 'draw' });
    expect(s.hands[0]).toHaveLength(9);
    const nines = s.hands[0].filter(c => c.rank === '9').slice(0, 2).map(c => c.id);
    expect(() => rulesAct(s, { type: 'meld', ids: nines })).toThrow(/at least 3/);
    const wilds = ['JK-joker-1', '2-clubs-1', '2-hearts-1'];
    expect(() => rulesAct(s, { type: 'meld', ids: [...nines, ...wilds] })).toThrow(/more wild cards than natural/);
    s = rulesAct(s, { type: 'meld', ids: [...nines, 'JK-joker-1'] });
    expect(s.melds[0]).toHaveLength(1);
    // 9s + joker = 70, enough for round 1's 50, so the turn can end
    s = rulesAct(s, { type: 'discard', id: '5-hearts-1' });
    expect(s.initialDone[0]).toBe(true);
    expect(s.turn).toBe(1);
  });

  it('insists on the first-meld minimum', () => {
    let s = dealRound({ dealer: 3, round: 2 });                 // 120 needed
    s.hands[0] = [card('4'), card('4', 'spades'), card('4', 'clubs'), card('K')];
    s = rulesAct(s, { type: 'draw' });
    s = rulesAct(s, { type: 'meld', ids: ['4-hearts-1', '4-spades-1', '4-clubs-1'] });
    expect(() => rulesAct(s, { type: 'discard', id: 'K-hearts-1' })).toThrow(new RegExp(`${MINIMUMS[2]}`));
    s = rulesAct(s, { type: 'undo' });
    expect(s.melds[0]).toHaveLength(0);
    expect(rulesAct(s, { type: 'discard', id: 'K-hearts-1' }).turn).toBe(1);
  });

  it('picks up your foot after taking a one-card pile with your last two cards', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.discard = [card('9', 'spades')];
    s.hands[0] = [card('9'), card('9', 'clubs')];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-clubs-1'] });
    expect(s.phase).toBe('play');
    expect(s.inFoot[0]).toBe(true);
    expect(s.hands[0].length).toBeGreaterThan(0);
    expect(s.melds[0][0].cards).toHaveLength(3);
  });

  it('picks up your foot when your hand is used up, and only goes out with a clean and a dirty book', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: 'K', cards: Array.from({ length: 7 }, (_, i) => card('K', 'spades', i + 1)) }];
    s = rulesAct(s, { type: 'draw' });
    // Discard your last hand card: your foot comes up, ready for your next turn
    s = { ...s, hands: s.hands.map((h, i) => (i === 0 ? [card('Q')] : h)) };
    const foot = s.feet[0];
    s = rulesAct(s, { type: 'discard', id: 'Q-hearts-1' });
    expect(s.turn).toBe(1);
    expect(s.inFoot[0]).toBe(true);
    expect(s.feet[0]).toHaveLength(0);
    expect(s.hands[0]).toHaveLength(11);
    expect(s.hands[0].filter(c => foot.includes(c)).length).toBe(foot.filter(c => !(c.rank === '3' && ['hearts', 'diamonds'].includes(c.suit))).length);
    // In the foot with only a clean book: can't go out
    s = { ...s, turn: 0, phase: 'play', hands: s.hands.map((h, i) => (i === 0 ? [card('7')] : h)) };
    expect(() => rulesAct(s, { type: 'discard', id: '7-hearts-1' })).toThrow(/clean book and a dirty book/);
    // With a dirty book too, discarding the last card goes out
    s.melds[0].push({ rank: 'A', cards: [...Array.from({ length: 5 }, (_, i) => card('A', 'clubs', i + 1)), card('2'), card('JK', 'joker')] });
    const out = rulesAct(s, { type: 'discard', id: '7-hearts-1' });
    expect(out.phase).toBe('over');
    expect(out.outBy).toBe(0);
    expect(out.melds[0].filter(isBook).map(isClean)).toEqual([true, false]);
    const [us] = scoreHand(out);
    expect(us).toMatchObject({ clean: 1, dirty: 1, goingOut: 100 });
  });
});

describe('Hand and Foot game engine', () => {
  it('plays whole games of four rounds, a step at a time', () => {
    for (let g = 0; g < 2; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.history).toHaveLength(4);
      expect(s.scores).toEqual(s.history.reduce((t, h) => [t[0] + h[0], t[1] + h[1]], [0, 0]));
      expect(s.winners.length).toBeGreaterThan(0);
    }
  });

  it('keeps all 270 cards in play through a hand', () => {
    let s = newGame();
    for (let step = 0; step < 3000 && s.phase !== 'handOver' && s.phase !== 'gameOver'; step++) {
      expect(count(s)).toBe(270);
      s = act(s, robotAction(s, waitingFor(s), 'hard'));
    }
  });

  it('books get made and players reach their feet', () => {
    let feet = 0, books = 0;
    for (let g = 0; g < 3; g++) {
      const s = autoplay(newGame(), undefined, x => x.phase === 'handOver');
      feet += s.inFoot.filter(Boolean).length;
      books += s.melds.flat().filter(isBook).length;
    }
    expect(feet).toBeGreaterThan(0);
    expect(books).toBeGreaterThan(0);
  });

  it('never sends anyone another hand, any foot, the stock or a computer player\'s plans', () => {
    const s = autoplay(newGame(), undefined, x => x.robotPlan != null);
    for (const seat of [0, 1, 2, 3]) {
      const v = JSON.parse(JSON.stringify(viewFor(s, seat)));
      expect(v.robotPlan).toBeUndefined();
      expect(v.turnStart).toBeUndefined();
      const json = JSON.stringify(v);
      const secret = [...s.stock, ...s.feet.flat(), ...[0, 1, 2, 3].filter(o => o !== seat).flatMap(o => s.hands[o])];
      for (const c of secret) expect(json).not.toContain(`"${c.id}"`);
    }
  });

  it('plays three-player games, everyone for themselves', () => {
    const start = newGame({ players: 3 });
    expect(start.hands).toHaveLength(3);
    expect(start.melds).toHaveLength(3);
    expect(count(start)).toBe(216);                              // four decks
    const s = autoplay(start, ['hard', 'medium', 'easy']);
    expect(s.phase).toBe('gameOver');
    expect(s.scores).toHaveLength(3);
    expect(s.history.every(h => h.length === 3)).toBe(true);
    expect(s.winners.every(w => s.scores[w] === Math.max(...s.scores))).toBe(true);
  });

  it('turns a three-player table round, each player bringing their side', () => {
    const s = autoplay(newGame({ players: 3 }), ['hard', 'medium', 'easy'], x => x.round === 1 && x.melds.every(m => m.length));
    for (const seat of [1, 2]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.melds[0]).toEqual(s.melds[seat]);
      expect(r.scores[0]).toBe(s.scores[seat]);
      expect(rotate(r, 3 - seat)).toEqual(s);
    }
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.round === 1 && x.melds[0].length && x.melds[1].length);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.melds[0]).toEqual(s.melds[seat % 2]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
