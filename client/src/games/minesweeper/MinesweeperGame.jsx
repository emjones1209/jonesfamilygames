import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DadJokeModal } from '../../components/DadJokeModal';
import api from '../../utils/api';
import {
  emptyBoard, placeMines, floodReveal, chordReveal, revealAllMines, countRevealed,
} from './minesweeperLogic';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: 'Easy' },
  medium: { rows: 12, cols: 12, mines: 25, label: 'Medium' },
  hard:   { rows: 16, cols: 16, mines: 50, label: 'Hard' },
};

// Classic Minesweeper number colours
const NUM_COLORS = [
  '',
  '#60a5fa', // 1 – blue-400
  '#4ade80', // 2 – green-400
  '#f87171', // 3 – red-400
  '#a78bfa', // 4 – violet-400
  '#f97316', // 5 – orange-500
  '#22d3ee', // 6 – cyan-400
  '#e5e7eb', // 7 – gray-200
  '#9ca3af', // 8 – gray-400
];

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MinesweeperGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState('easy');
  const [board, setBoard] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | playing | won | lost
  const [flagMode, setFlagMode] = useState(false);
  const [minesLeft, setMinesLeft] = useState(10);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showJoke, setShowJoke] = useState(false);
  // Covered squares highlighted after tapping a number that isn't satisfied yet
  const [hint, setHint] = useState(null);          // Set of "r,c" keys
  const hintTimer = useRef(null);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const timerRef = useRef(null);
  const timeRef = useRef(0); // shadow of timeElapsed for use in callbacks

  const startNewGame = useCallback((diff) => {
    clearInterval(timerRef.current);
    clearTimeout(hintTimer.current);
    setHint(null);
    const d = DIFFICULTIES[diff];
    setDifficulty(diff);
    setBoard(emptyBoard(d.rows, d.cols));
    setPhase('idle');
    setFlagMode(false);
    setMinesLeft(d.mines);
    setTimeElapsed(0);
    timeRef.current = 0;
  }, []);

  // Bootstrap first game
  useEffect(() => { startNewGame('easy'); }, [startNewGame]);

  // Timer – starts when phase becomes 'playing', stops on win/lose
  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => {
        timeRef.current += 1;
        setTimeElapsed(t => t + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const { rows, cols, mines } = DIFFICULTIES[difficulty];

  const checkAndSetWin = useCallback((nextBoard, diff) => {
    const { rows: r, cols: c, mines: m } = DIFFICULTIES[diff];
    if (countRevealed(nextBoard) === r * c - m) {
      setBoard(nextBoard);
      setPhase('won');
      vibrate([60, 40, 60, 40, 200]);
      setTimeout(() => setShowJoke(true), 800);
      api.post('/scores', {
        game: 'minesweeper',
        score: Math.max(1, 999 - timeRef.current),
        difficulty: diff,
      }).catch(() => {});
      return true;
    }
    return false;
  }, []);

  const handleReveal = useCallback((r, c) => {
    if (phase === 'won' || phase === 'lost') return;

    let currentBoard = board;

    // First tap: place mines (safe zone around tap) and start clock
    if (phase === 'idle') {
      currentBoard = placeMines(rows, cols, mines, r, c);
      setPhase('playing');
    }

    const cell = currentBoard[r][c];

    // Tapping a revealed numbered cell attempts a chord reveal
    if (cell.revealed) {
      const result = chordReveal(currentBoard, rows, cols, r, c);
      if (!result) return;
      if (result.hint) {
        // Not enough flags yet: briefly highlight the squares this number counts
        clearTimeout(hintTimer.current);
        setHint(new Set(result.hint.map(([hr, hc]) => `${hr},${hc}`)));
        hintTimer.current = setTimeout(() => setHint(null), 900);
        vibrate([15]);
        return;
      }
      if (result.explode) {
        const [er, ec] = result.explode;
        setBoard(revealAllMines(currentBoard, er, ec));
        setPhase('lost');
        vibrate([200, 100, 200]);
        return;
      }
      if (!checkAndSetWin(result.board, difficulty)) setBoard(result.board);
      return;
    }

    if (cell.flagged) return;

    if (cell.mine) {
      setBoard(revealAllMines(currentBoard, r, c));
      setPhase('lost');
      vibrate([200, 100, 200]);
      return;
    }

    const revealed = floodReveal(currentBoard, rows, cols, r, c);
    if (!checkAndSetWin(revealed, difficulty)) setBoard(revealed);
  }, [board, phase, rows, cols, mines, difficulty, checkAndSetWin]);

  const handleFlag = useCallback((r, c) => {
    if (phase === 'won' || phase === 'lost' || phase === 'idle') return;
    const cell = board?.[r]?.[c];
    if (!cell || cell.revealed) return;

    vibrate([40]);
    setBoard(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      next[r][c].flagged = !next[r][c].flagged;
      return next;
    });
    setMinesLeft(prev => cell.flagged ? prev + 1 : prev - 1);
  }, [board, phase]);

  const handleCellTap = useCallback((r, c) => {
    // A revealed number can't be flagged, so tapping one always chords (even in Flag mode)
    if (flagMode && !board?.[r]?.[c]?.revealed) handleFlag(r, c);
    else handleReveal(r, c);
  }, [flagMode, board, handleFlag, handleReveal]);

  const formatTime = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const faceEmoji = phase === 'won' ? '😎' : phase === 'lost' ? '😵' : '🙂';
  const score = Math.max(1, 999 - timeElapsed);

  if (!board) return null;

  // Responsive cell size: fills container up to 44 px per cell
  const maxCellPx = 44;
  const gridMaxWidth = cols * maxCellPx + (cols - 1); // 1px gaps

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-game-bg to-game-card flex flex-col"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-safe z-10 bg-game-bg/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors active:scale-95"
          >
            <span className="text-xl leading-none">←</span>
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-1.5 text-game-gold font-bold text-lg">
            <span>💣</span>
            <span>Minesweeper</span>
          </div>

          {/* Face button restarts the game */}
          <button
            onClick={() => startNewGame(difficulty)}
            className="text-2xl active:scale-90 transition-transform"
            aria-label="New game"
          >
            {faceEmoji}
          </button>
        </div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="bg-game-card/60 border-b border-white/10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2 gap-2">
          {/* Mine counter */}
          <div className="flex items-center gap-1 font-mono font-bold text-lg text-white min-w-[3.5rem]">
            <span>🚩</span>
            <span>{String(minesLeft).padStart(3, '0')}</span>
          </div>

          {/* Difficulty selector */}
          <div className="flex gap-1.5">
            {Object.entries(DIFFICULTIES).map(([key, d]) => (
              <button
                key={key}
                onClick={() => startNewGame(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
                  difficulty === key
                    ? 'bg-game-gold text-game-bg'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-1 font-mono font-bold text-lg text-white min-w-[3.5rem] justify-end">
            <span>⏱</span>
            <span>{formatTime(timeElapsed)}</span>
          </div>
        </div>
      </div>

      {/* ── Game area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center pt-4 pb-8 px-3 gap-4">

        {/* Reveal / Flag mode toggle */}
        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
          <button
            onClick={() => setFlagMode(false)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              !flagMode
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span>⛏️</span>
            <span>Reveal</span>
          </button>
          <button
            onClick={() => setFlagMode(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              flagMode
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span>🚩</span>
            <span>Flag</span>
          </button>
        </div>

        {/* Board – responsive width, scrollable if wider than viewport */}
        <div className="overflow-auto max-w-full">
          <div
            className="rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden bg-gray-600"
            style={{ width: `min(calc(100vw - 24px), ${gridMaxWidth}px)` }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: '1px',
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => (
                  <Cell
                    key={`${r}-${c}`}
                    cell={cell}
                    cols={cols}
                    hinted={!!hint?.has(`${r},${c}`)}
                    onTap={() => handleCellTap(r, c)}
                    onFlag={() => handleFlag(r, c)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <p className="text-white/25 text-xs text-center leading-snug">
          {flagMode
            ? 'Tap a cell to place or remove a flag'
            : 'Tap to reveal • Hold to flag • Tap a number to open around it, or to see which squares it counts'}
        </p>
      </div>

      {/* ── Win / Lose sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'won' || phase === 'lost') && !showJoke && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-game-card border border-white/20 rounded-3xl p-7 text-center shadow-2xl"
            >
              <motion.div
                className="text-6xl mb-3"
                animate={phase === 'won' ? { rotate: [0, -10, 10, -10, 0] } : { scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5 }}
              >
                {phase === 'won' ? '🎉' : '💥'}
              </motion.div>

              <h2 className="text-2xl font-bold text-white mb-1">
                {phase === 'won' ? 'Minefield Cleared!' : 'Boom!'}
              </h2>
              <p className="text-white/50 text-sm mb-4">
                {phase === 'won'
                  ? `${DIFFICULTIES[difficulty].label} • ${formatTime(timeElapsed)}`
                  : 'You hit a mine. Better luck next time!'}
              </p>
              {phase === 'won' && (
                <p className="text-game-gold font-bold text-lg mb-5">Score: {score}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => startNewGame(difficulty)}
                  className="flex-1 bg-game-gold text-game-bg font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
                >
                  Play Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 bg-white/10 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
                >
                  Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DadJokeModal isOpen={showJoke} onClose={() => setShowJoke(false)} />
    </div>
  );
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ cell, cols, hinted, onTap, onFlag }) {
  const pressTimer = useRef(null);
  const hasMoved = useRef(false);
  const didLongPress = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button > 0) return; // primary only
    hasMoved.current = false;
    didLongPress.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    pressTimer.current = setTimeout(() => {
      if (!hasMoved.current) {
        didLongPress.current = true;
        onFlag?.();
      }
      pressTimer.current = null;
    }, 450);
  };

  const handlePointerMove = (e) => {
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 8 || dy > 8) { hasMoved.current = true; cancelPress(); }
  };

  const handlePointerUp = () => {
    cancelPress();
    if (!hasMoved.current && !didLongPress.current) onTap?.();
    didLongPress.current = false;
  };

  // Desktop right-click → flag
  const handleContextMenu = (e) => { e.preventDefault(); onFlag?.(); };

  // ── Visuals ────────────────────────────────────────────────────────────────
  let bg, content, contentColor;

  if (!cell.revealed) {
    // Hinted squares look pressed in and lit up, like classic Minesweeper
    bg = cell.flagged ? '#b91c1c' : hinted ? '#fbbf24' : '#6b7280';
    content = cell.flagged ? '🚩' : null;
  } else if (cell.wrongFlag) {
    bg = '#374151';
    content = '❌';
  } else if (cell.mine) {
    bg = cell.exploded ? '#dc2626' : '#374151';
    content = '💣';
  } else {
    bg = '#374151';
    content = cell.count > 0 ? String(cell.count) : null;
    contentColor = NUM_COLORS[cell.count];
  }

  // Font scales with grid size
  const fontSize = cols <= 9 ? 15 : cols <= 12 ? 13 : 11;

  const boxShadow = !cell.revealed && !cell.flagged && !hinted
    ? 'inset 1px 1px 0 rgba(255,255,255,0.22), inset -1px -1px 0 rgba(0,0,0,0.28)'
    : 'none';

  return (
    <motion.div
      role="button"
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelPress}
      onContextMenu={handleContextMenu}
      style={{
        aspectRatio: '1',
        background: bg,
        boxShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 'bold',
        color: contentColor,
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
      whileTap={!cell.revealed ? { scale: 0.82 } : {}}
      animate={
        cell.exploded
          ? { scale: [1, 1.5, 1], transition: { duration: 0.3 } }
          : hinted
            ? { scale: [1, 0.85, 0.92], transition: { duration: 0.25 } }
            : { scale: 1 }
      }
    >
      {content}
    </motion.div>
  );
}
