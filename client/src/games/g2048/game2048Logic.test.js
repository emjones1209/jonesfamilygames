import { describe, it, expect } from 'vitest';
import { slideLine, move, newGame, toGrid, canMove, keepGoing, biggestTile, WIN_VALUE } from './game2048Logic';

// A game from a picture of the board: rows of numbers, 0 = empty
function game(rows, extra = {}) {
  let id = 1;
  const tiles = [];
  rows.forEach((row, r) => row.forEach((value, c) => { if (value) tiles.push({ id: id++, value, row: r, col: c }); }));
  return { tiles, nextId: id, score: 0, moves: 0, won: false, keepGoing: false, over: false, undosLeft: 1, ...extra };
}
// Always put the new tile in the first empty cell, and make it a 2
const first = () => 0;
// The board without the tile that appeared after the move
const withoutNew = s => toGrid(s.tiles.filter(t => !t.isNew));

describe('sliding one line', () => {
  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8],          // the new 8 doesn't merge again with the old 8
    [[2, 0, 0, 2], [4, 0, 0, 0], 4],
    [[2, 2, 4, 4], [4, 8, 0, 0], 12],
    [[2, 4, 2, 4], [2, 4, 2, 4], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[8, 8, 8, 0], [16, 8, 0, 0], 16],        // the pair nearest the edge merges first
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
  ])('%j → %j', (values, line, gained) => {
    expect(slideLine(values)).toEqual({ line, gained });
  });
});

describe('moving the board', () => {
  const board = [
    [2, 2, 4, 0],
    [0, 4, 0, 4],
    [8, 0, 8, 8],
    [0, 0, 0, 2],
  ];

  it('slides left', () => {
    expect(withoutNew(move(game(board), 'left', first))).toEqual([
      [4, 4, 0, 0],
      [8, 0, 0, 0],
      [16, 8, 0, 0],
      [2, 0, 0, 0],
    ]);
  });

  it('slides right', () => {
    expect(withoutNew(move(game(board), 'right', first))).toEqual([
      [0, 0, 4, 4],
      [0, 0, 0, 8],
      [0, 0, 8, 16],
      [0, 0, 0, 2],
    ]);
  });

  it('slides up', () => {
    expect(withoutNew(move(game(board), 'up', first))).toEqual([
      [2, 2, 4, 4],
      [8, 4, 8, 8],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
    ]);
  });

  it('slides down', () => {
    expect(withoutNew(move(game(board), 'down', first))).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 4],
      [2, 2, 4, 8],
      [8, 4, 8, 2],
    ]);
  });

  it('adds the merged tiles to the score', () => {
    const s = move(game(board), 'left', first);
    expect(s.score).toBe(4 + 8 + 16);
    expect(s.moves).toBe(1);
  });

  it('puts a new tile in an empty cell after a move', () => {
    const s = move(game(board), 'left', first);
    const fresh = s.tiles.filter(t => t.isNew);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ value: 2, row: 0, col: 2 });   // first empty cell after the move
  });

  it('makes a 4 one time in ten', () => {
    const rolls = [0, 0.95];   // cell, then value
    const s = move(game(board), 'left', () => rolls.shift());
    expect(s.tiles.find(t => t.isNew).value).toBe(4);
  });

  it('does nothing when no tile can move that way', () => {
    const s = game([
      [2, 4, 0, 0],
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(s, 'left', first)).toBe(s);
    expect(move(s, 'up', first)).toBe(s);
    expect(move(s, 'right', first)).not.toBe(s);
  });

  it('keeps tile ids as they slide, and shows the merged tiles sliding under the new one', () => {
    const s = game([[0, 0, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const next = move(s, 'left', () => 0.99);    // new tile goes in the last empty cell
    const gone = next.tiles.filter(t => t.gone);
    expect(gone.map(t => t.id).sort()).toEqual([1, 2]);
    expect(gone.every(t => t.row === 0 && t.col === 0)).toBe(true);
    expect(next.tiles.find(t => t.merged)).toMatchObject({ value: 4, row: 0, col: 0 });
    // The next move drops them
    const after = move(next, 'right', first);
    expect(after.tiles.some(t => t.id === 1 || t.id === 2)).toBe(false);
  });

  it('clears the merged and new marks on the next move', () => {
    const s = move(game([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', first);
    const after = move(s, 'down', first);
    expect(after.tiles.filter(t => t.merged || t.isNew || t.gone)).toEqual(after.tiles.filter(t => t.isNew));
  });
});

describe('winning and losing', () => {
  it('wins on making 2048', () => {
    const s = move(game([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left', first);
    expect(s.won).toBe(true);
    expect(biggestTile(s)).toBe(WIN_VALUE);
    const on = move(keepGoing(s), 'right', first);
    expect(on).toMatchObject({ won: true, keepGoing: true, over: false });
  });

  it('is over when the board is full and no neighbours match', () => {
    const full = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(game(full).tiles)).toBe(false);
  });

  it('knows a full board with a matching pair can still move', () => {
    const s = game([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 4],
    ]);
    expect(canMove(s.tiles)).toBe(true);
  });

  it('ends the game when the new tile leaves no moves', () => {
    const s = move(game([
      [2, 4, 2, 4],
      [4, 2, 8, 2],
      [2, 8, 4, 8],
      [8, 8, 4, 2],
    ]), 'left', () => 0.95);    // 16 lands at the left; the new tile is a 4 in the last cell
    expect(toGrid(s.tiles)[3]).toEqual([16, 4, 2, 4]);
    expect(s.over).toBe(true);
    expect(move(s, 'up', first)).toBe(s);
  });
});

describe('a new game', () => {
  it('starts with two tiles and nothing scored', () => {
    const s = newGame();
    expect(s.tiles).toHaveLength(2);
    expect(s.tiles.every(t => t.value === 2 || t.value === 4)).toBe(true);
    expect(new Set(s.tiles.map(t => `${t.row},${t.col}`)).size).toBe(2);
    expect(s).toMatchObject({ score: 0, moves: 0, won: false, over: false, undosLeft: 1 });
  });
});
