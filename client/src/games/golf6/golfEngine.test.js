import { describe, it, expect } from 'vitest';
import { newGame, act, waitingOn, waitingFor, robotAction, viewFor, rotate } from './golfEngine';
import { gridScore } from './golfRules';

/** Let computer players play until `until` (or the game ends). */
function autoplay(s, levels = ['hard', 'medium', 'easy', 'hard'], until = () => false) {
  for (let step = 0; step < 20000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'holeOver') { s = act(s, { type: 'nextHole' }); continue; }
    const seat = waitingOn(s)[0];
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

const cardCount = s => s.grids.flat(2).length + s.stock.length + s.discard.length + (s.drawn ? 1 : 0);

describe('6-Card Golf game engine', () => {
  it('plays whole games for 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      for (let g = 0; g < 5; g++) {
        const s = autoplay(newGame({ players, holes: 3 }));
        expect(s.phase).toBe('gameOver');
        expect(s.history).toHaveLength(3);
        expect(s.totals).toEqual(s.history.reduce((t, h) => t.map((x, i) => x + h[i]), Array(players).fill(0)));
        expect(s.winners.every(w => s.totals[w] === Math.min(...s.totals))).toBe(true);
      }
    }
  });

  it('keeps all 54 cards in play', () => {
    let s = newGame({ players: 4, holes: 1 });
    for (let step = 0; step < 500 && s.phase !== 'gameOver'; step++) {
      expect(cardCount(s)).toBe(54);
      s = act(s, robotAction(s, waitingOn(s)[0], 'medium'));
    }
  });

  it('starts with everyone turning over two cards, then the player after the dealer', () => {
    let s = newGame({ players: 3, holes: 1 });            // dealer is seat 2
    expect(waitingOn(s)).toEqual([0, 1, 2]);
    expect(waitingFor(s)).toBe(null);
    s = act(s, { type: 'peek', seat: 1, row: 0, col: 0 });
    expect(() => act(s, { type: 'peek', seat: 1, row: 0, col: 0 })).toThrow(/already face up/);
    s = act(s, { type: 'peek', seat: 1, row: 1, col: 2 });
    expect(() => act(s, { type: 'peek', seat: 1, row: 0, col: 1 })).toThrow(/already turned over 2/);
    expect(waitingOn(s)).toEqual([0, 2]);
    for (const seat of [0, 2]) for (const col of [0, 1]) s = act(s, { type: 'peek', seat, row: 0, col });
    expect(s.phase).toBe('playing');
    expect(waitingFor(s)).toBe(0);
  });

  it('only lets the right player move, one draw at a time', () => {
    let s = autoplay(newGame({ players: 2, holes: 1 }), undefined, x => x.phase === 'playing');
    const me = s.turn, other = 1 - me;
    expect(() => act(s, { type: 'draw', seat: other, from: 'stock' })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'place', seat: me, row: 0, col: 0 })).toThrow(/Draw a card first/);
    const top = s.discard[0];
    s = act(s, { type: 'draw', seat: me, from: 'discard' });
    expect(s.drawn.card).toEqual(top);
    expect(() => act(s, { type: 'draw', seat: me, from: 'stock' })).toThrow(/already drawn/);
    expect(() => act(s, { type: 'flip', seat: me, row: 0, col: 0 })).toThrow(/Put the card/);
    const old = s.grids[me][1][1];
    s = act(s, { type: 'place', seat: me, row: 1, col: 1 });
    expect(s.grids[me][1][1]).toEqual({ ...top, faceUp: true });
    expect(s.discard[0]).toEqual({ ...old, faceUp: true });
    expect(s.turn).toBe(other);
  });

  it('gives everyone else one more turn after someone finishes', () => {
    let s = autoplay(newGame({ players: 3, holes: 1 }), undefined, x => x.phase === 'playing');
    // Seat 0 turns over every card they have left, one flip per turn
    while (s.finisher == null) {
      const seat = s.turn;
      if (seat === 0) {
        const [row, col] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]].find(([r, c]) => !s.grids[0][r][c].faceUp);
        s = act(s, { type: 'flip', seat, row, col });
      } else {
        s = act(s, { type: 'draw', seat, from: 'stock' });
        s = act(s, { type: 'discard', seat });
      }
    }
    expect(s.finisher).toBe(0);
    expect(s.turn).toBe(1);
    for (const seat of [1, 2]) {
      expect(s.phase).toBe('playing');
      s = act(s, { type: 'draw', seat, from: 'stock' });
      s = act(s, { type: 'discard', seat });
    }
    expect(s.phase).toBe('gameOver');
    expect(s.grids.flat(2).every(c => c.faceUp)).toBe(true);
    expect(s.lastHole.scores).toEqual(s.grids.map(gridScore));
  });

  it('never shows anyone a face-down card or the deck', () => {
    const s = autoplay(newGame({ players: 3 }), undefined, x => x.phase === 'playing' && x.turn === 1);
    const v = viewFor(s, 1);
    const json = JSON.stringify(v);
    for (const c of [...s.stock, ...s.grids.flat(2).filter(c => !c.faceUp)]) expect(json).not.toContain(`"${c.id}"`);
    expect(v.stock).toHaveLength(s.stock.length);
    expect(v.grids.flat(2).filter(c => c.faceUp)).toEqual(s.grids.flat(2).filter(c => c.faceUp));
  });

  it('turns the table round so each player sits at the bottom', () => {
    const s = autoplay(newGame({ players: 4, holes: 3 }), undefined, x => x.holeNo === 1 && x.phase === 'playing' && x.lastMove);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.grids[0]).toEqual(s.grids[seat]);
      expect(r.totals[0]).toBe(s.totals[seat]);
      expect(r.turn).toBe((s.turn - seat + 4) % 4);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);                // and back again
    }
  });
});
