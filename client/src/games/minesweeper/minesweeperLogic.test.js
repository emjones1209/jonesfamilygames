import { describe, it, expect } from 'vitest';
import { chordReveal, floodReveal, placeMines, countRevealed } from './minesweeperLogic';

// Build a board from a picture: '*' mine, 'F' flagged mine, 'x' flagged non-mine,
// '#' covered, '.' revealed. Counts are computed from the mines.
function board(rows) {
  const b = rows.map(row => [...row].map(ch => ({
    mine: ch === '*' || ch === 'F', flagged: ch === 'F' || ch === 'x', revealed: ch === '.',
    count: 0, exploded: false, wrongFlag: false,
  })));
  const R = b.length, C = b[0].length;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && b[r + dr]?.[c + dc]?.mine) n++;
    }
    b[r][c].count = n;
  }
  return b;
}
const keys = cells => cells.map(([r, c]) => `${r},${c}`).sort();

describe('chord (tapping a revealed number)', () => {
  it('highlights the covered squares when not enough flags are placed', () => {
    // Centre "1" touches one mine, but nothing is flagged yet
    const b = board(['*##', '#.#', '###']);
    const res = chordReveal(b, 3, 3, 1, 1);
    expect(keys(res.hint)).toEqual(keys([[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]]));
  });

  it('does not highlight flagged squares', () => {
    // "2" with only one of its two mines flagged
    const b = board(['F#*', '#.#', '###']);
    const res = chordReveal(b, 3, 3, 1, 1);
    expect(res.hint).toHaveLength(7);
    expect(keys(res.hint)).not.toContain('0,0');
  });

  it('also highlights when there are too many flags', () => {
    const b = board(['Fx#', '#.#', '###']);   // "1" with two flags
    expect(chordReveal(b, 3, 3, 1, 1).hint).toHaveLength(6);
  });

  it('reveals the other neighbours when the flags match the number', () => {
    const b = board(['F##', '#.#', '###']);
    const res = chordReveal(b, 3, 3, 1, 1);
    expect(res.board).toBeDefined();
    expect(countRevealed(res.board)).toBe(8);   // everything except the flagged mine
  });

  it('explodes when a flag is on the wrong square', () => {
    const b = board(['*x#', '#.#', '###']);   // "1" satisfied by a wrong flag
    expect(chordReveal(b, 3, 3, 1, 1).explode).toEqual([0, 0]);
  });

  it('does nothing for a blank square or one with no covered neighbours', () => {
    expect(chordReveal(board(['...', '...', '...']), 3, 3, 1, 1)).toBe(null);
    expect(chordReveal(board(['F..', '...', '...']), 3, 3, 1, 1)).toBe(null);
  });
});

describe('board setup and reveal', () => {
  it('keeps the first tap and its neighbours free of mines', () => {
    for (let i = 0; i < 50; i++) {
      const b = placeMines(9, 9, 10, 4, 4);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) expect(b[4 + dr][4 + dc].mine).toBe(false);
      expect(b.flat().filter(c => c.mine)).toHaveLength(10);
    }
  });

  it('flood-reveals connected blank squares', () => {
    const b = board(['###', '###', '##*']);
    const next = floodReveal(b, 3, 3, 0, 0);
    expect(countRevealed(next)).toBe(8);        // all but the mine
  });
});
