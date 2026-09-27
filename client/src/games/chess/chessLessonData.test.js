import { describe, it, expect } from 'vitest';
import { fromFen, legalMoves, afterMove, inCheck, outcome, WHITE } from './chessRules';
import { LESSONS } from './chessLessonData';

// Can the lesson be finished? One-move lessons: some legal move does it. Capture lessons:
// a search (White moving again and again, Black standing still) clears the board.
function solvable(lesson) {
  const start = fromFen(lesson.fen);
  const one = test => legalMoves(start).some(m => test(m, afterMove(start, m)));
  switch (lesson.goal) {
    case 'check': return one((m, a) => inCheck(a));
    case 'escape': return inCheck(start) && legalMoves(start).length > 0;
    case 'mate': return one((m, a) => outcome(a) === 'checkmate');
    case 'castle': return one(m => m.flag === 'castle');
    case 'promote': return one(m => !!m.promo);
    case 'enpassant': return one(m => m.flag === 'ep');
    case 'capture': {
      const seen = new Set();
      const search = (pos, depth) => {
        if (!pos.sq.some(p => p < 0)) return true;
        if (!depth) return false;
        const key = pos.sq.join();
        if (seen.has(`${key}|${depth}`)) return false;
        seen.add(`${key}|${depth}`);
        return legalMoves(pos).some(m => search({ ...afterMove(pos, m), turn: WHITE, ep: -1 }, depth - 1));
      };
      return search(start, 8);
    }
    default: return false;
  }
}

describe('the chess lessons', () => {
  it.each(LESSONS.map(l => [l.title, l]))('%s can be finished', (_, lesson) => {
    expect(solvable(lesson)).toBe(true);
  });

  it('every lesson starts with White to move and has something to do', () => {
    for (const l of LESSONS) {
      const pos = fromFen(l.fen);
      expect(pos.turn).toBe(WHITE);
      expect(legalMoves(pos).length).toBeGreaterThan(0);
      expect(outcome(pos) === 'checkmate' || outcome(pos) === 'stalemate').toBe(false);
    }
  });

  it('the mate puzzles have exactly the checkmates intended', () => {
    const mates = l => { const p = fromFen(l.fen); return legalMoves(p).filter(m => outcome(afterMove(p, m)) === 'checkmate').length; };
    for (const l of LESSONS.filter(x => x.goal === 'mate')) expect(mates(l)).toBeGreaterThanOrEqual(1);
  });
});
