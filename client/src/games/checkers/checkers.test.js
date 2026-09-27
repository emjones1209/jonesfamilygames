import { describe, it, expect } from 'vitest';
import {
  startBoard, legalMoves, applyMove, chooseMove, explainMove, threatened, countPieces, evaluate, SIZE,
} from './checkersRules';
import { newGame, act, waitingFor, robotAction, rotate, unrotateAction, legalFor, QUIET_LIMIT } from './checkersEngine';

// A board from a picture: rows top to bottom; '.' empty, 'a' seat 0's man, 'A' its king, 'b'/'B' seat 1's
function board(rows) {
  let n = 0;
  return rows.map(row => [...row].map(ch => (ch === '.' ? null
    : { id: `p${n++}`, seat: ch.toLowerCase() === 'a' ? 0 : 1, king: ch === ch.toUpperCase() })));
}
const paths = moves => moves.map(m => JSON.stringify(m.path)).sort();

describe('the board and simple moves', () => {
  it('starts with 12 pieces each on the dark squares', () => {
    const b = startBoard();
    expect(countPieces(b)).toEqual([{ men: 12, kings: 0 }, { men: 12, kings: 0 }]);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r][c]) expect((r + c) % 2).toBe(1);
  });

  it('gives each side 7 opening moves', () => {
    expect(legalMoves(startBoard(), 0)).toHaveLength(7);
    expect(legalMoves(startBoard(), 1)).toHaveLength(7);
  });

  it('moves men forward only, kings both ways', () => {
    const b = board([
      '........',
      '........',
      '........',
      '...a....',
      '........',
      '.....B..',
      '........',
      '........',
    ]);
    expect(paths(legalMoves(b, 0))).toEqual(paths([{ path: [[3, 3], [2, 2]] }, { path: [[3, 3], [2, 4]] }]));
    expect(legalMoves(b, 1)).toHaveLength(4);
  });
});

describe('jumping', () => {
  it('makes you jump when you can', () => {
    const b = board([
      '........',
      '........',
      '........',
      '..b.....',
      '...a....',
      '........',
      '.a......',
      '........',
    ]);
    const moves = legalMoves(b, 0);
    expect(paths(moves)).toEqual([JSON.stringify([[4, 3], [2, 1]])]);
    expect(moves[0].captures).toEqual([[3, 2]]);
  });

  it('keeps jumping with the same piece (a double jump is one move)', () => {
    const b = board([
      '........',
      '........',
      '..b.b...',
      '........',
      '..b.....',
      '...a....',
      '........',
      '........',
    ]);
    const moves = legalMoves(b, 0);
    // Only the whole double jump is legal: stopping after the first jump isn't allowed
    expect(paths(moves)).toEqual([JSON.stringify([[5, 3], [3, 1], [1, 3]])]);
    const dbl = moves[0];
    expect(dbl.captures).toEqual([[4, 2], [2, 2]]);
    expect(dbl.path).toEqual([[5, 3], [3, 1], [1, 3]]);
    const after = applyMove(b, dbl);
    expect(after[4][2]).toBe(null);
    expect(after[2][2]).toBe(null);
    expect(after[1][3].seat).toBe(0);
  });

  it('crowns a man that reaches the far row, and that ends its move', () => {
    const b = board([
      '........',
      '..b.b...',
      '...a....',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    // Jumping the b at (1,2) lands on row 0 and stops there — no carrying on backwards as a new king
    const moves = legalMoves(b, 0);
    for (const m of moves) expect(m.captures).toHaveLength(1);
    const after = applyMove(b, moves[0]);
    expect(after[0][moves[0].path[1][1]].king).toBe(true);
  });

  it('lets kings jump backwards', () => {
    const b = board([
      '........',
      '........',
      '........',
      '...A....',
      '..b.....',
      '........',
      '........',
      '........',
    ]);
    expect(legalMoves(b, 0)).toEqual([{ path: [[3, 3], [5, 1]], captures: [[4, 2]] }]);
  });

  it('knows which of your pieces are in danger', () => {
    const b = board([
      '........',
      '........',
      '........',
      '..b.....',
      '...a....',
      '........',
      '........',
      '........',
    ]);
    expect(threatened(b, 0)).toEqual([[4, 3]]);
    expect(threatened(b, 1)).toEqual([[3, 2]]);
  });
});

describe('the computer player', () => {
  it('takes a free piece', () => {
    const b = board([
      '........',
      '........',
      '........',
      '..b.....',
      '...a....',
      '......a.',
      '........',
      '........',
    ]);
    // Seat 1's b at (3,2) can take the a at (4,3)
    expect(chooseMove(b, 1, 'medium').captures).toEqual([[4, 3]]);
  });

  it('sees a trade coming: doesn\'t step into a capture for nothing', () => {
    const b = board([
      '........',
      '........',
      '........',
      '........',
      '....b...',
      '........',
      '..a...a.',
      '........',
    ]);
    // Moving the a at (6,6) to (5,5) lets b jump it; (6,6)→(5,7) is safe
    for (const level of ['medium', 'hard']) {
      const m = chooseMove(b, 0, level, () => 0.5);
      expect(JSON.stringify(m.path)).not.toBe(JSON.stringify([[6, 6], [5, 5]]));
    }
  });

  it('finds a double jump set up by a sacrifice-free move', () => {
    const b = board([
      '........',
      '........',
      '..b.b...',
      '........',
      '..b.....',
      '...a....',
      '........',
      '........',
    ]);
    expect(chooseMove(b, 0, 'hard').captures).toHaveLength(2);
  });

  it('explains its suggestions in plain words', () => {
    const b = board([
      '........',
      '..b.b...',
      '...a....',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const m = legalMoves(b, 0)[0];
    const why = explainMove(b, 0, m).join(' ');
    expect(why).toMatch(/captures a piece/);
    expect(why).toMatch(/becomes a king/);
  });

  it('rates material first', () => {
    const b = board(['........', '........', '........', '...a....', '........', '..a.....', '........', '....b...']);
    expect(evaluate(b, 0)).toBeGreaterThan(0);
    expect(evaluate(b, 1)).toBeLessThan(0);
  });
});

describe('Checkers game engine', () => {
  const autoplay = (s, levels, until = x => x.phase === 'gameOver') => {
    for (let i = 0; i < 400 && !until(s); i++) s = act(s, robotAction(s, s.turn, levels[s.turn]));
    return s;
  };

  it('plays whole games to a result', () => {
    for (let g = 0; g < 4; g++) {
      const s = autoplay(newGame({ black: g % 2 }), ['medium', 'easy']);
      expect(s.phase).toBe('gameOver');
      expect(['noMoves', 'quiet', 'repetition']).toContain(s.reason);
    }
  }, 60000);

  it('Black moves first, and only in turn', () => {
    let s = newGame({ black: 1 });
    expect(waitingFor(s)).toBe(1);
    expect(() => act(s, { type: 'move', seat: 0, path: [[5, 0], [4, 1]] })).toThrow(/not your turn/);
    expect(() => act(s, { type: 'move', seat: 1, path: [[2, 1], [4, 3]] })).toThrow(/can't move there/);
    s = act(s, { type: 'move', seat: 1, path: [[2, 1], [3, 2]] });
    expect(waitingFor(s)).toBe(0);
  });

  it('refuses a step when a jump is on', () => {
    let s = newGame();
    s = { ...s, board: board([
      '........', '........', '........', '..b.....', '...a....', '........', '.a......', '........',
    ]) };
    expect(() => act(s, { type: 'move', seat: 0, path: [[6, 1], [5, 0]] })).toThrow(/must jump/);
    s = act(s, { type: 'move', seat: 0, path: [[4, 3], [2, 1]] });
    expect(s.phase).toBe('gameOver');                              // seat 1 has nothing left
    expect(s).toMatchObject({ winner: 0, reason: 'noMoves', wins: [1, 0] });
  });

  it('calls a draw after 40 moves each of kings shuffling about', () => {
    let s = newGame();
    s = { ...s, board: board([
      'B.......', '........', '........', '........', '........', '........', '........', '......A.',
    ]) };
    for (let i = 0; s.phase === 'playing' && i < QUIET_LIMIT + 10; i++) s = act(s, robotAction(s, s.turn, 'easy'));
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(null);
    expect(['quiet', 'repetition']).toContain(s.reason);
  });

  it('lets a player resign, and swaps colours for the next game', () => {
    let s = act(newGame({ black: 0 }), { type: 'resign', seat: 0 });
    expect(s).toMatchObject({ phase: 'gameOver', winner: 1, reason: 'resigned', wins: [0, 1] });
    s = act(s, { type: 'newGame' });
    expect(s).toMatchObject({ black: 1, turn: 1, phase: 'playing', wins: [0, 1] });
  });

  it('turns the board round for the other player, and turns their moves back', () => {
    let s = newGame({ black: 1 });
    const r = rotate(s, 1);
    // Seat 1 sees their own pieces at the bottom, moving up, with the same moves available
    expect(r.board[7][0]).toMatchObject({ seat: 0 });
    expect(legalFor(r, 0)).toHaveLength(7);
    const mine = legalFor(r, 0)[0];
    s = act(s, unrotateAction({ type: 'move', seat: 1, path: mine.path }, 1));
    expect(s.turn).toBe(0);
    expect(rotate(rotate(s, 1), 1)).toEqual(s);
  });

  it('Hard beats Easy', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) if (autoplay(newGame({ black: g % 2 }), ['hard', 'easy']).winner === 0) wins++;
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 120000);
});
