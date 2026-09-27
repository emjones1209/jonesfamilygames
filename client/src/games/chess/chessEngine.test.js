import { describe, it, expect } from 'vitest';
import { fromFen, legalMoves, san, squareIndex, afterMove, START } from './chessRules';
import { chooseMove, rankMoves } from './chessAI';
import { hanging, warnMove, explainMove, threatsAfter, mateInOne } from './chessCoach';
import { newGame, act, waitingFor, robotAction, rotate, legalFor } from './chessEngine';

const sq = squareIndex;
const find = (pos, name) => legalMoves(pos).find(m => san(pos, m).replace(/[+#]/, '') === name);

describe('the computer player', () => {
  it('takes a free queen', () => {
    const pos = fromFen('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    for (const level of ['medium', 'hard']) expect(san(pos, chooseMove(pos, level))).toBe('Rxd5');
  });

  it('doesn\'t take a pawn when the queen would be lost for it (Medium and Hard)', () => {
    // Qxd5?? is answered by ...Rxd5 — Easy only looks one move ahead and may fall for it
    const pos = fromFen('3rk3/8/8/3p4/8/8/8/3QK3 w - - 0 1');
    for (const level of ['medium', 'hard']) expect(san(pos, chooseMove(pos, level))).not.toBe('Qxd5');
  });

  it('finds checkmate in one', () => {
    const pos = fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    for (const level of ['medium', 'hard']) expect(san(pos, chooseMove(pos, level))).toBe('Ra8#');
  });

  it('finds checkmate in two (Hard)', () => {
    // Two rooks "ladder" the king: 1. Ra7 (cutting it off from the 7th rank), then 2. Rb8#
    const pos = fromFen('6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1');
    const best = rankMoves(pos, 'hard')[0];
    expect(best.score).toBeGreaterThan(50000);
  });

  it('ranks moves best first, with exact scores for those near the top', () => {
    const ranked = rankMoves(fromFen(START), 'medium');
    expect(ranked).toHaveLength(20);
    expect(ranked[0].exact).toBe(true);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
  });
});

describe('the coach', () => {
  it('spots pieces that can be taken for free', () => {
    const pos = fromFen('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    expect(hanging(pos, -1).map(h => h.square)).toEqual([sq('d5')]);
    expect(hanging(pos, 1)).toEqual([]);          // the rook on d2 is attacked, but the king defends it (and the queen is worth more)
  });

  it('warns before giving the queen away', () => {
    const pos = fromFen('3rk3/8/8/3p4/8/8/8/3QK3 w - - 0 1');
    expect(warnMove(pos, find(pos, 'Qxd5'))).toMatch(/queen on d5 could be taken by their rook/);
    expect(warnMove(pos, find(pos, 'Qe2'))).toBe(null);
  });

  it('warns before a move that allows checkmate', () => {
    // Moving the rook off the back row lets ...Re1# (the pawns box the king in); h3 gives it an escape square
    const pos = fromFen('4r1k1/8/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    expect(warnMove(pos, find(pos, 'Rd2'))).toMatch(/checkmate/);
    expect(warnMove(pos, find(pos, 'h3'))).toBe(null);
  });

  it('explains good moves in plain words', () => {
    const pos = fromFen('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    expect(explainMove(pos, find(pos, 'Rxd5')).join(' ')).toMatch(/Takes their queen for free/);
    const mate = fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(explainMove(mate, find(mate, 'Ra8')).join(' ')).toMatch(/Checkmate/);
    const start = fromFen(START);
    expect(explainMove(start, find(start, 'Nf3')).join(' ')).toMatch(/off the back row/);
    expect(explainMove(start, find(start, 'e4')).join(' ')).toMatch(/middle of the board/);
  });

  it('points out threats after the opponent moves', () => {
    const pos = fromFen('4k3/8/8/3q4/8/8/3R4/4K3 b - - 0 1');
    expect(threatsAfter(pos, -1).join(' ')).toMatch(/queen on d5 could be taken by their rook/);
    const check = fromFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1');
    expect(threatsAfter(check, 1)[0]).toMatch(/Check!/);
  });

  it('finds a mate in one for the other side', () => {
    const pos = fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(san(pos, mateInOne(pos))).toBe('Ra8#');
  });
});

describe('Chess game engine', () => {
  const autoplay = (s, levels, maxPly = 300) => {
    for (let i = 0; i < maxPly && s.phase === 'playing'; i++) s = act(s, robotAction(s, waitingFor(s), levels[waitingFor(s)]));
    return s;
  };

  it('plays whole games to a result', () => {
    for (let g = 0; g < 2; g++) {
      const s = autoplay(newGame({ white: g % 2 }), ['medium', 'easy']);
      expect(s.phase).toBe('gameOver');
      expect(s.winner).toBe(0);
    }
  }, 60000);

  it('White moves first, and only in turn', () => {
    let s = newGame({ white: 1 });
    expect(waitingFor(s)).toBe(1);
    expect(() => act(s, { type: 'move', seat: 0, from: sq('e7'), to: sq('e5') })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'move', seat: 1, from: sq('e2'), to: sq('e5') })).toThrow(/can't move there/);
    s = act(s, { type: 'move', seat: 1, from: sq('e2'), to: sq('e4') });
    expect(s.history).toEqual(['e4']);
    expect(s.ids[sq('e4')]).toBe(`w1-${sq('e2')}`);
    expect(waitingFor(s)).toBe(0);
  });

  it('ends in checkmate (the fool\'s mate) and counts the win', () => {
    let s = newGame({ white: 0 });
    for (const [seat, from, to] of [[0, 'f2', 'f3'], [1, 'e7', 'e5'], [0, 'g2', 'g4'], [1, 'd8', 'h4']]) {
      s = act(s, { type: 'move', seat, from: sq(from), to: sq(to) });
    }
    expect(s).toMatchObject({ phase: 'gameOver', winner: 1, reason: 'checkmate', wins: [0, 1] });
    expect(s.history.at(-1)).toBe('Qh4#');
  });

  it('promotes to the piece chosen (a queen if none is)', () => {
    let s = newGame({ fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1' });
    const knight = act(s, { type: 'move', seat: 0, from: sq('e7'), to: sq('e8'), promo: 2 });
    expect(knight.pos.sq[sq('e8')]).toBe(2);
    s = act(s, { type: 'move', seat: 0, from: sq('e7'), to: sq('e8') });
    expect(s.pos.sq[sq('e8')]).toBe(5);
  });

  it('moves the rook when castling, keeping every piece\'s id', () => {
    let s = newGame({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
    const rook = s.ids[sq('h1')];
    s = act(s, { type: 'move', seat: 0, from: sq('e1'), to: sq('g1') });
    expect(s.ids[sq('f1')]).toBe(rook);
    expect(s.history).toEqual(['O-O']);
  });

  it('calls a draw on the third repetition', () => {
    let s = newGame({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1' });
    const shuffle = [[0, 'a1', 'a2'], [1, 'e8', 'd8'], [0, 'a2', 'a1'], [1, 'd8', 'e8']];
    for (let i = 0; i < 2; i++) for (const [seat, from, to] of shuffle) s = act(s, { type: 'move', seat, from: sq(from), to: sq(to) });
    expect(s).toMatchObject({ phase: 'gameOver', winner: null, reason: 'repetition' });
  });

  it('resigning, and the next game swaps colours', () => {
    let s = act(newGame({ white: 0 }), { type: 'resign', seat: 0 });
    expect(s).toMatchObject({ winner: 1, reason: 'resigned' });
    s = act(s, { type: 'newGame' });
    expect(s).toMatchObject({ white: 1, phase: 'playing', wins: [0, 1] });
  });

  it('turns the table round for the other player', () => {
    const s = newGame({ white: 0 });
    const r = rotate(s, 1);
    expect(r.white).toBe(1);
    expect(legalFor(r, 1)).toHaveLength(20);
    expect(rotate(r, 1)).toEqual(s);
  });

  it('never gets stuck in the lesson positions (no kings)', () => {
    const pos = fromFen('8/8/5p2/3p4/8/2p5/8/1N6 w - - 0 1');
    expect(legalMoves(afterMove(pos, legalMoves(pos)[0]))).toBeDefined();
  });
});
