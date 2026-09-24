import { describe, it, expect } from 'vitest';
import { shuffle } from '../../utils/cardEngine';
import {
  makeDeck, dealHand, act, cardValue, minimumMeld, scoreHand, gameWinner, pileFrozen, isRedThree, isWild,
} from './canastaRules';
import { chooseDraw, choosePlay } from './canastaAI';

const DECK = makeDeck();
const c = id => DECK.find(x => x.id === id);          // e.g. c('K-hearts-1'), c('JK-1')
const ids = (...list) => list.map(x => c(x).id);

/** A hand in progress with chosen cards: seat 0 to play, in the draw phase. */
function position({ hand = [], pile = [], stock = ['4-clubs-1', '4-clubs-2', '5-clubs-1'], melds = [[], []], initialDone = [false, false], scores = [0, 0] }) {
  return {
    hands: [hand.map(c), ['9-clubs-1', '9-clubs-2'].map(c), ['8-clubs-1', '8-clubs-2'].map(c), ['7-clubs-1', '7-clubs-2'].map(c)],
    stock: stock.map(c), discard: pile.map(c), redThrees: [[], []],
    melds: melds.map(team => team.map(m => ({ rank: m.rank, cards: m.cards.map(c) }))),
    initialDone, scores, dealer: 3, turn: 0, phase: 'draw', turnStart: null, discardLog: [], outBy: null,
  };
}

describe('Canasta cards and dealing', () => {
  it('has 108 cards with the classic values', () => {
    expect(DECK).toHaveLength(108);
    expect(cardValue(c('JK-1'))).toBe(50);
    expect(cardValue(c('2-hearts-1'))).toBe(20);
    expect(cardValue(c('A-spades-1'))).toBe(20);
    expect(cardValue(c('8-spades-1'))).toBe(10);
    expect(cardValue(c('7-spades-1'))).toBe(5);
    expect(cardValue(c('3-spades-1'))).toBe(5);
  });

  it('deals 11 each, sets red 3s aside and turns up a natural card', () => {
    for (let i = 0; i < 50; i++) {
      const s = dealHand();
      expect(s.hands.every(h => h.length === 11 && !h.some(isRedThree))).toBe(true);
      const top = s.discard[s.discard.length - 1];
      expect(isWild(top) || isRedThree(top)).toBe(false);
      const total = s.hands.flat().length + s.stock.length + s.discard.length + s.redThrees.flat().length;
      expect(total).toBe(108);
    }
  });

  it('first-meld minimum depends on the score', () => {
    expect([minimumMeld(-20), minimumMeld(0), minimumMeld(1500), minimumMeld(3000)]).toEqual([15, 50, 90, 120]);
  });
});

describe('Taking the discard pile', () => {
  const pile = ['6-spades-1', 'K-hearts-1'];

  it('needs a natural pair before your team has melded — and the minimum', () => {
    const s = position({ hand: ['K-clubs-1', 'JK-1', 'A-spades-1', 'A-clubs-1', 'A-hearts-1', '5-hearts-1'], pile });
    expect(() => act(s, { type: 'takePile', ids: ids('K-clubs-1', 'JK-1') })).toThrow(/two natural Ks/);
    const s2 = position({ hand: ['K-clubs-1', 'K-spades-1', '5-hearts-1', '6-hearts-1'], pile });
    expect(() => act(s2, { type: 'takePile', ids: ids('K-clubs-1', 'K-spades-1') })).toThrow(/at least 50/);
    // Three kings (30) plus a set of aces (60) is enough
    const s3 = position({ hand: ['K-clubs-1', 'K-spades-1', 'A-spades-1', 'A-clubs-1', 'A-hearts-1', '5-hearts-1'], pile });
    const after = act(s3, { type: 'takePile', ids: ids('K-clubs-1', 'K-spades-1', 'A-spades-1', 'A-clubs-1', 'A-hearts-1') });
    expect(after.melds[0].map(m => [m.rank, m.cards.length])).toEqual([['K', 3], ['A', 3]]);
    expect(after.hands[0].map(x => x.id)).toEqual(['5-hearts-1', '6-spades-1']);
    expect(after.initialDone[0]).toBe(true);
    expect(after.phase).toBe('play');
  });

  it('lets a melded team take an unfrozen pile onto a meld', () => {
    const s = position({
      hand: ['5-hearts-1', '6-hearts-1'], pile, initialDone: [true, false],
      melds: [[{ rank: 'K', cards: ['K-clubs-1', 'K-spades-1', 'K-diamonds-1'] }], []],
    });
    const after = act(s, { type: 'takePile', ids: [] });
    expect(after.melds[0][0].cards).toHaveLength(4);
  });

  it('is frozen by a wild card and blocked by a black 3', () => {
    const frozen = position({ hand: ['K-clubs-1', 'JK-1', '5-hearts-1'], pile: ['2-spades-1', 'K-hearts-1'], initialDone: [true, false] });
    expect(pileFrozen(frozen)).toBe(true);
    expect(() => act(frozen, { type: 'takePile', ids: ids('K-clubs-1', 'JK-1') })).toThrow(/frozen/);
    const blocked = position({ hand: ['3-clubs-2', '3-spades-2'], pile: ['3-spades-1'] });
    expect(() => act(blocked, { type: 'takePile', ids: ids('3-clubs-2', '3-spades-2') })).toThrow(/black 3/);
  });
});

describe('Melding and going out', () => {
  const melded = { initialDone: [true, false], melds: [[{ rank: 'Q', cards: ['Q-clubs-1', 'Q-spades-1', 'Q-diamonds-1'] }], []] };

  it('checks meld shapes', () => {
    const s = act(position({ ...melded, hand: ['9-hearts-1', '9-spades-1', 'JK-1', '2-clubs-1', '2-hearts-1', '2-spades-1', '5-hearts-1'] }), { type: 'draw' });
    expect(() => act(s, { type: 'meld', ids: ids('9-hearts-1', 'JK-1') })).toThrow(/at least 3/);
    expect(() => act(s, { type: 'meld', ids: ids('9-hearts-1', 'JK-1', '2-clubs-1') })).toThrow(/2 natural/);
    expect(() => act(s, { type: 'meld', ids: ids('9-hearts-1', '9-spades-1', 'JK-1', '2-clubs-1', '2-hearts-1', '2-spades-1') })).toThrow(/at most 3 wild/);
    const after = act(s, { type: 'meld', ids: ids('9-hearts-1', '9-spades-1', 'JK-1') });
    expect(after.melds[0].find(m => m.rank === '9').cards).toHaveLength(3);
    // Wild cards on their own go onto a chosen meld
    const wild = act(after, { type: 'meld', ids: ids('2-clubs-1'), rank: 'Q' });
    expect(wild.melds[0].find(m => m.rank === 'Q').cards).toHaveLength(4);
  });

  it("won't let you go out without a canasta", () => {
    // After drawing: Q, Q and one more card. Melding both queens would leave 1 card to discard — going out
    const s = act(position({ ...melded, hand: ['Q-hearts-1', 'Q-hearts-2'] }), { type: 'draw' });
    expect(() => act(s, { type: 'meld', ids: ids('Q-hearts-1', 'Q-hearts-2') })).toThrow(/canasta/);
    expect(act(s, { type: 'meld', ids: ids('Q-hearts-1') }).hands[0]).toHaveLength(2);
  });

  it('first melds made from the hand must reach the minimum before discarding', () => {
    const s = act(position({ hand: ['5-hearts-1', '5-spades-1', '5-clubs-2', '9-hearts-1', '9-spades-1'] }), { type: 'draw' });
    const small = act(s, { type: 'meld', ids: ids('5-hearts-1', '5-spades-1', '5-clubs-2') });
    expect(() => act(small, { type: 'discard', id: c('9-hearts-1').id })).toThrow(/at least 50/);
    const undone = act(small, { type: 'undo' });
    expect(undone.melds[0]).toHaveLength(0);
    expect(act(undone, { type: 'discard', id: c('9-hearts-1').id }).turn).toBe(1);
  });

  it('goes out with a canasta and scores it', () => {
    const canasta = { rank: 'Q', cards: ['Q-clubs-1', 'Q-spades-1', 'Q-diamonds-1', 'Q-hearts-1', 'Q-clubs-2', 'Q-spades-2', 'Q-diamonds-2'] };
    const s = act(position({ initialDone: [true, false], melds: [[canasta], []], hand: ['Q-hearts-2'], stock: ['6-hearts-2'] }), { type: 'draw' });
    const out = act(act(s, { type: 'meld', ids: ids('Q-hearts-2') }), { type: 'discard', id: c('6-hearts-2').id });
    expect(out.phase).toBe('over');
    const [us] = scoreHand(out);
    expect(us.natural).toBe(1);
    expect(us.goingOut).toBe(100);
    // 8 queens (80) + natural canasta (500) + going out (100) − partner's two 8s (20)
    expect(us.total).toBe(80 + 500 + 100 - 20);
  });

  it('declares the higher team the winner at 5000', () => {
    expect(gameWinner([4990, 3000])).toBe(null);
    expect(gameWinner([5100, 5200])).toBe(1);
  });
});

// ── Computer players ─────────────────────────────────────────────────────────
/** Play a whole hand with computer players; `levels[seat]`. */
export function playHand(levels, deck, dealer = 3, scores = [0, 0]) {
  let s = dealHand({ dealer, scores, deck: [...deck] });
  for (let turn = 0; turn < 400 && s.phase !== 'over'; turn++) {
    const level = levels[s.turn];
    s = act(s, chooseDraw(s, level));
    if (s.phase === 'over') break;
    const acts = choosePlay(s, level);
    for (const a of acts) s = act(s, a);
  }
  return s;
}

describe('Canasta computer players', () => {
  it.each(['easy', 'medium', 'hard'])('play complete, legal hands (%s)', level => {
    let wentOut = 0;
    for (let i = 0; i < 40; i++) {
      const s = playHand([level, level, level, level], shuffle(makeDeck()), i % 4);
      expect(s.phase).toBe('over');
      const cards = s.hands.flat().length + s.stock.length + s.discard.length + s.redThrees.flat().length
        + s.melds.flat().reduce((n, m) => n + m.cards.length, 0);
      expect(cards).toBe(108);
      for (const team of [0, 1]) {
        for (const m of s.melds[team]) {
          expect(m.cards.filter(x => !isWild(x)).length).toBeGreaterThanOrEqual(2);
          expect(m.cards.filter(isWild).length).toBeLessThanOrEqual(3);
        }
      }
      if (s.outBy != null) wentOut++;
    }
    expect(wentOut).toBeGreaterThan(20);        // hands usually end with someone going out
  });

  it('hard beats medium, and medium beats easy (same deals, teams swapped)', () => {
    const edge = (a, b, deals) => {
      const samples = [];
      for (let i = 0; i < deals; i++) {
        const deck = shuffle(makeDeck());
        const diff = levels => { const [us, them] = scoreHand(playHand(levels, deck, i % 4)); return us.total - them.total; };
        samples.push((diff([a, b, a, b]) - diff([b, a, b, a])) / 2);
      }
      const mean = samples.reduce((x, y) => x + y, 0) / deals;
      const sd = Math.sqrt(samples.reduce((x, y) => x + (y - mean) ** 2, 0) / (deals - 1));
      return { mean, se: sd / Math.sqrt(deals) };
    };
    const hm = edge('hard', 'medium', 5000), me = edge('medium', 'easy', 300);
    console.log(`canasta: hard vs medium ${hm.mean.toFixed(0)} ± ${hm.se.toFixed(0)} · medium vs easy ${me.mean.toFixed(0)} ± ${me.se.toFixed(0)} pts/hand`);
    expect(hm.mean).toBeGreaterThan(2 * hm.se);
    expect(me.mean).toBeGreaterThan(2 * me.se);
  }, 120000);
});

