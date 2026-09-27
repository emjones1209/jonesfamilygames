import { describe, it, expect } from 'vitest';
import {
  fromFen, toFen, START, perft, legalMoves, san, afterMove, outcome, inCheck, squareIndex, insufficientMaterial,
} from './chessRules';

// Known move counts (https://www.chessprogramming.org/Perft_Results): if every one matches,
// castling, en passant, promotion, pins and checks are all being handled right
describe('move generation (perft)', () => {
  it.each([
    ['the starting position', START, [20, 400, 8902]],
    ['"Kiwipete" (castling, pins, en passant)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['position 3 (en passant checks, rook endgame)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['position 4 (promotions, castling through check)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['position 5 (promotion with check)', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ])('%s', (_, fen, counts) => {
    const pos = fromFen(fen);
    counts.forEach((n, i) => expect(perft(pos, i + 1)).toBe(n));
    expect(toFen(pos)).toBe(fen);                                   // make/unmake put everything back
  }, 60000);

  it('the starting position, 4 moves deep', () => {
    expect(perft(fromFen(START), 4)).toBe(197281);
  }, 60000);
});

describe('FEN', () => {
  it('reads and writes positions', () => {
    for (const fen of [START, 'r3k2r/8/8/3pP3/8/8/8/R3K2R w Kq d6 0 12']) expect(toFen(fromFen(fen))).toBe(fen);
  });
});

const play = (pos, ...names) => {
  for (const name of names) {
    const moves = legalMoves(pos);
    const m = moves.find(x => san(pos, x, moves).replace(/[+#]/, '') === name);
    if (!m) throw new Error(`No move ${name} in ${toFen(pos)}`);
    pos = afterMove(pos, m);
  }
  return pos;
};

describe('special moves', () => {
  it('castles both ways, and loses the right when the king or rook moves', () => {
    let pos = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const names = legalMoves(pos).map(m => san(pos, m));
    expect(names).toEqual(expect.arrayContaining(['O-O', 'O-O-O']));
    pos = play(pos, 'O-O');
    expect(toFen(pos).split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/R4RK1');
    expect(toFen(pos).split(' ')[2]).toBe('kq');
    pos = play(pos, 'Rh7');
    expect(toFen(pos).split(' ')[2]).toBe('q');
  });

  it('won\'t castle out of, through or into check', () => {
    const through = fromFen('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');   // the rook on f2 guards f1, which the king would cross
    const names = legalMoves(through).map(m => san(through, m));
    expect(names).not.toContain('O-O');
    expect(names).toContain('O-O-O');
  });

  it('captures en passant', () => {
    let pos = fromFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    pos = play(pos, 'd5');
    expect(toFen(pos).split(' ')[3]).toBe('d6');
    pos = play(pos, 'exd6');
    expect(pos.sq[squareIndex('d5')]).toBe(0);
    expect(pos.sq[squareIndex('d6')]).toBe(1);
  });

  it('promotes, with a choice of piece', () => {
    const pos = fromFen('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
    const names = legalMoves(pos).map(m => san(pos, m));
    expect(names).toEqual(expect.arrayContaining(['e8=Q', 'e8=R', 'e8=B', 'e8=N+']));     // the knight checks the king on g7
  });

  it('names moves, telling apart two pieces that can reach the same square', () => {
    const pos = fromFen('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
    const names = legalMoves(pos).map(m => san(pos, m));
    expect(names).toContain('Rad1');
    expect(names).toContain('Rhd1');
    expect(names).toContain('Ra8+');
  });
});

describe('the end of the game', () => {
  it('knows checkmate (the fool\'s mate)', () => {
    const pos = play(fromFen(START), 'f3', 'e5', 'g4', 'Qh4');
    expect(inCheck(pos)).toBe(true);
    expect(outcome(pos)).toBe('checkmate');
  });

  it('knows stalemate', () => {
    expect(outcome(fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBe('stalemate');
  });

  it('knows when nobody can win', () => {
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1'))).toBe(true);
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/2N5/4K3/8 w - - 0 1'))).toBe(true);
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/2R5/4K3/8 w - - 0 1'))).toBe(false);
    expect(outcome(fromFen('8/8/4k3/8/8/8/4K3/8 w - - 0 1'))).toBe('material');
  });

  it('draws after 50 moves each with no capture or pawn move', () => {
    expect(outcome(fromFen('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'))).toBe('fifty');
  });

  it('works without kings (for the lessons)', () => {
    const pos = fromFen('8/8/8/8/3R4/8/8/8 w - - 0 1');
    expect(legalMoves(pos)).toHaveLength(14);
  });
});
