/**
 * ChessBoard — the chess board and pieces, for games and lessons. Squares are
 * chess squares 0-63 (a8…h1, see chessRules.js); `flip` shows it from Black's
 * side. Pieces slide when they move (each keeps its id — see chessEngine.js).
 */
import { BoardGrid } from '../board/BoardGrid';
import { typeOf } from './chessRules';
import { glyph } from './chessGlyphs';

export function PieceGlyph({ piece, size = '10.5cqw' }) {
  const white = piece > 0;
  return (
    <span className="leading-none select-none" style={{
      fontSize: size,
      fontFamily: '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", serif',
      color: white ? '#fdfdfd' : '#1c1917',
      textShadow: white
        ? '0 0 2px #1c1917, 0 0 1px #1c1917, 1px 1px 0 #1c1917, -1px -1px 0 #1c1917, 0 2px 3px rgba(0,0,0,.5)'
        : '0 0 1px #fafaf9, 0 2px 3px rgba(0,0,0,.4)',
    }}>
      {glyph(typeOf(piece))}
    </span>
  );
}

/**
 * @param sq      the position's squares (64 numbers)
 * @param ids     a stable id for each square's piece (so moves slide); defaults to one per square
 * @param marks   { square: ['last' | 'selected' | 'target' | 'capture' | 'hint' | 'danger' | 'check'] }
 * @param onSquare  called with a chess square (0-63) when tapped
 */
export function ChessBoard({ sq, ids, flip = false, marks = {}, onSquare }) {
  const toReal = (r, c) => (flip ? 63 - (r * 8 + c) : r * 8 + c);
  const toDisplay = i => (flip ? 63 - i : i);
  const gridMarks = {};
  for (const [i, kinds] of Object.entries(marks)) {
    const d = toDisplay(Number(i));
    gridMarks[`${d >> 3},${d & 7}`] = kinds;
  }
  const pieces = [];
  sq.forEach((p, i) => {
    if (!p) return;
    const d = toDisplay(i);
    pieces.push({ id: ids?.[i] ?? `sq${i}`, row: d >> 3, col: d & 7, node: <PieceGlyph piece={p} /> });
  });
  // Files along the bottom row, ranks down the left-hand column
  const label = (r, c) => {
    const i = toReal(r, c);
    const parts = [];
    if (c === 0) parts.push(8 - (i >> 3));
    if (r === 7) parts.push('abcdefgh'[i & 7]);
    return parts.join(' ');
  };
  return (
    <BoardGrid isDark={(r, c) => (r + c) % 2 === 1} marks={gridMarks} pieces={pieces} label={label}
      colors={{ light: '#eeeed2', dark: '#769656' }}
      onSquare={onSquare ? (r, c) => onSquare(toReal(r, c)) : undefined} />
  );
}
