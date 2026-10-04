import { describe, it, expect } from 'vitest';
import { newGame, act, waitingOn, waitingFor, robotAction, viewFor, rotate, legalFor } from './cribbageEngine';
import { GAME_TARGET } from './cribbageRules';

const card = (rank, suit = 'hearts') => ({ id: `${rank}-${suit}`, rank, suit });

/** A deck that deals these hands (6 each: seat 0 first) and then turns up `starter`. */
const stacked = (h0, h1, starter, rest = []) => [...h0, ...h1, starter, ...rest];

function autoplay(s, levels = ['hard', 'medium'], until = () => false) {
  for (let step = 0; step < 5000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'show') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingOn(s)[0];
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

describe('Cribbage game engine', () => {
  it('plays whole games to 121 with computer players', () => {
    for (let g = 0; g < 5; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.scores[s.winner]).toBe(GAME_TARGET);
      expect(s.scores[1 - s.winner]).toBeLessThan(GAME_TARGET);
    }
  });

  it('both throw two cards into the dealer\'s crib, at the same time', () => {
    let s = newGame({ dealer: 1 });
    expect(waitingOn(s)).toEqual([0, 1]);
    expect(() => act(s, { type: 'discard', seat: 0, cardIds: [s.hands[0][0].id] })).toThrow(/two cards/);
    s = act(s, { type: 'discard', seat: 1, cardIds: s.hands[1].slice(0, 2).map(c => c.id) });
    expect(waitingOn(s)).toEqual([0]);
    s = act(s, { type: 'discard', seat: 0, cardIds: s.hands[0].slice(4).map(c => c.id) });
    expect(s.crib).toHaveLength(4);
    expect(s.starter).toBeTruthy();
    expect(s.phase).toBe('play');
    expect(waitingFor(s)).toBe(0);                       // the non-dealer leads
  });

  it('a Jack turned up is 2 for the dealer (his heels)', () => {
    let s = newGame({ dealer: 1, deck: stacked(
      [card('2'), card('3'), card('4'), card('5'), card('6'), card('7')],
      [card('2', 'spades'), card('3', 'spades'), card('4', 'spades'), card('5', 'spades'), card('6', 'spades'), card('7', 'spades')],
      card('J', 'clubs')) });
    s = act(s, { type: 'discard', seat: 0, cardIds: ['6-hearts', '7-hearts'] });
    s = act(s, { type: 'discard', seat: 1, cardIds: ['6-spades', '7-spades'] });
    expect(s.scores).toEqual([0, 2]);
    expect(s.events).toEqual([{ seat: 1, points: 2, why: 'his heels' }]);
  });

  it('pegging: 15s, pairs, "go", 31, the last card — and then the show', () => {
    let s = newGame({ dealer: 1, deck: stacked(
      [card('10'), card('K'), card('5'), card('A'), card('2'), card('3')],
      [card('5', 'spades'), card('6', 'spades'), card('Q', 'spades'), card('9', 'spades'), card('2', 'spades'), card('3', 'spades')],
      card('4', 'clubs')) });
    s = act(s, { type: 'discard', seat: 0, cardIds: ['2-hearts', '3-hearts'] });          // keeps 10 K 5 A
    s = act(s, { type: 'discard', seat: 1, cardIds: ['2-spades', '3-spades'] });          // keeps 5 6 Q 9
    const play = (seat, id) => { s = act(s, { type: 'play', seat, cardId: id }); return s.events; };
    expect(() => act(s, { type: 'play', seat: 1, cardId: '5-spades' })).toThrow(/not your turn/);
    play(0, '10-hearts');                                   // 10
    expect(play(1, '5-spades')).toEqual([{ seat: 1, points: 2, why: 'fifteen' }]);          // 15
    play(0, '5-hearts');                                    // 20, a pair
    expect(s.events).toEqual([{ seat: 0, points: 2, why: 'pair' }]);
    play(1, '9-spades');                                    // 29: 0 has K and A; A fits
    expect(legalFor(s, 0).map(c => c.rank)).toEqual(['A']);
    play(0, 'A-hearts');                                    // 30: 1 has 6 and Q — neither fits; 0 has K, no
    // Neither can play: 0 played last, so 0 gets 1 for the go; 1 leads the new count
    expect(s.events).toEqual([{ seat: 0, points: 1, why: 'go' }]);
    expect(s.peg.count).toBe(0);
    expect(waitingFor(s)).toBe(1);
    play(1, '6-spades');
    play(0, 'K-hearts');                                    // 16
    expect(s.peg.turn).toBe(1);
    play(1, 'Q-spades');                                    // 26, the last card of the hand: 1
    expect(s.events[0]).toEqual({ seat: 1, points: 1, why: 'last card' });
    // Then the show: the non-dealer first, then the dealer's hand and the crib
    expect(s.phase).toBe('show');
    expect(s.show.map(c => [c.seat, c.what])).toEqual([[0, 'hand'], [1, 'hand'], [1, 'crib']]);
    const [nd] = s.show;
    // 10 K 5 A (all hearts) with the 4: fifteens 10+5, K+5, 10+A+4, K+A+4 (8) and a 4-card flush
    expect(nd.items.map(i => i.kind)).toEqual(['fifteen', 'fifteen', 'fifteen', 'fifteen', 'flush']);
    expect(nd.total).toBe(12);
    expect(s.scores[0]).toBe(2 + 1 + 12);                   // pair, go, then the hand
  });

  it('31 is 2 and starts the count again', () => {
    let s = newGame({ dealer: 1, deck: stacked(
      [card('10'), card('J'), card('2'), card('3'), card('7'), card('8')],
      [card('K', 'spades'), card('A', 'spades'), card('9', 'spades'), card('4', 'spades'), card('7', 'spades'), card('8', 'spades')],
      card('6', 'clubs')) });
    s = act(s, { type: 'discard', seat: 0, cardIds: ['7-hearts', '8-hearts'] });
    s = act(s, { type: 'discard', seat: 1, cardIds: ['7-spades', '8-spades'] });
    for (const [seat, id] of [[0, '10-hearts'], [1, 'K-spades'], [0, 'J-hearts'], [1, 'A-spades']]) s = act(s, { type: 'play', seat, cardId: id });
    expect(s.events).toEqual([{ seat: 1, points: 2, why: 'thirty-one' }]);
    expect(s.peg.count).toBe(0);
    expect(waitingFor(s)).toBe(0);
  });

  it('the first to 121 wins straight away — even during pegging', () => {
    let s = newGame({ dealer: 1, deck: stacked(
      [card('10'), card('K'), card('5'), card('A'), card('2'), card('3')],
      [card('5', 'spades'), card('6', 'spades'), card('Q', 'spades'), card('9', 'spades'), card('2', 'spades'), card('3', 'spades')],
      card('4', 'clubs')) });
    s = { ...s, scores: [100, 119] };
    s = act(s, { type: 'discard', seat: 0, cardIds: ['2-hearts', '3-hearts'] });
    s = act(s, { type: 'discard', seat: 1, cardIds: ['2-spades', '3-spades'] });
    s = act(s, { type: 'play', seat: 0, cardId: '10-hearts' });
    s = act(s, { type: 'play', seat: 1, cardId: '5-spades' });          // fifteen for 2: 121
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(1);
    expect(s.scores).toEqual([100, 121]);
    expect(s.skunk).toBe(false);                                         // 100 is past the skunk line (91)
  });

  it('never shows the other hand, the crib or the deck — until the show', () => {
    let s = newGame();
    const v = viewFor(s, 0);
    expect(v.hands[1].every(c => c === null)).toBe(true);
    expect(v.deck.every(c => c === null)).toBe(true);
    s = autoplay(s, undefined, x => x.phase === 'play');
    expect(viewFor(s, 0).crib.every(c => c === null)).toBe(true);
    expect(viewFor(s, 1).kept[0].every(c => c === null)).toBe(true);
    s = autoplay(s, undefined, x => x.phase === 'show' || x.phase === 'gameOver');
    expect(viewFor(s, 0).crib.every(Boolean)).toBe(true);
  });

  it('turns round so either player sees themselves as seat 0', () => {
    const s = autoplay(newGame({ dealer: 0 }), undefined, x => x.phase === 'play' && x.peg.played.length > 0);
    const r = rotate(s, 1);
    expect(r.dealer).toBe(1);
    expect(r.hands[0]).toBe(s.hands[1]);
    expect(r.scores).toEqual([s.scores[1], s.scores[0]]);
    expect(r.peg.played[0].seat).toBe(1 - s.peg.played[0].seat);
  });

  it('Hard beats Easy over many games', () => {
    let hardWins = 0;
    for (let g = 0; g < 30; g++) if (autoplay(newGame({ dealer: g % 2 }), ['hard', 'easy']).winner === 0) hardWins++;
    expect(hardWins).toBeGreaterThan(18);
  });
});
