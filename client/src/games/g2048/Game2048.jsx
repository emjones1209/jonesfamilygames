import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { DadJokeModal } from '../../components/DadJokeModal';
import { RulesButton } from '../../components/RulesButton';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { newGame, move, keepGoing, biggestTile, SIZE, WIN_VALUE } from './game2048Logic';

// Board layout in percent of the board's width (the board is square, so it works for top too)
const GAP = 2.5;
const TILE = (100 - GAP * (SIZE + 1)) / SIZE;
const pos = i => `${GAP + i * (TILE + GAP)}%`;
const SLIDE_S = 0.1;
const SWIPE_PX = 24;
const CONFIRM_MS = 3000;

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
};

// Classic 2048 colours
const TILE_COLORS = {
  2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#f9f6f2'],
  16: ['#f59563', '#f9f6f2'], 32: ['#f67c5f', '#f9f6f2'], 64: ['#f65e3b', '#f9f6f2'],
  128: ['#edcf72', '#f9f6f2'], 256: ['#edcc61', '#f9f6f2'], 512: ['#edc850', '#f9f6f2'],
  1024: ['#edc53f', '#f9f6f2'], 2048: ['#edc22e', '#f9f6f2'],
};
const BIG_TILE = ['#3c3a32', '#f9f6f2'];
// Font size in percent of the board's width, smaller as the numbers get longer
const FONT_CQW = { 1: 11, 2: 10, 3: 8.5, 4: 7, 5: 5.8 };

// The game in progress and the best score are kept on this device for each family member
const storageKey = user => `game2048:${user?.id ?? 'guest'}`;
function loadSaved(user) {
  try { return JSON.parse(localStorage.getItem(storageKey(user))) ?? {}; } catch { return {}; }
}
function save(user, data) {
  try { localStorage.setItem(storageKey(user), JSON.stringify(data)); } catch { /* private mode */ }
}
const postScore = g => {
  if (g.score > 0) api.post('/scores', { game: '2048', score: g.score, metadata: { biggest: biggestTile(g), moves: g.moves } }).catch(() => {});
};

export default function Game2048() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved] = useState(() => loadSaved(user));

  // A finished game isn't worth coming back to: start a fresh one
  const [game, setGame] = useState(() => (saved.game && !saved.game.over ? saved.game : newGame()));
  const [prev, setPrev] = useState(null);             // the board before the last move, for Undo
  const [bestBefore, setBestBefore] = useState(saved.best ?? 0);   // best score before this game
  const best = Math.max(bestBefore, game.score);
  const [showJoke, setShowJoke] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const confirmTimer = useRef(null);
  const swipeStart = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);
  useEffect(() => { save(user, { game, best }); }, [user, game, best]);

  // The latest board, so a move never works from a stale one (and side effects stay out of setState)
  const gameRef = useRef(game);
  useLayoutEffect(() => { gameRef.current = game; }, [game]);

  const slide = useCallback(dir => {
    const g = gameRef.current;
    if (g.over || (g.won && !g.keepGoing)) return;
    const next = move(g, dir);
    if (next === g) return;
    gameRef.current = next;
    setPrev(g);
    setGame(next);
    if (next.won && !g.won) setTimeout(() => setShowJoke(true), 600);
    if (next.over) postScore(next);
  }, []);

  const undo = () => {
    if (!prev || game.undosLeft < 1) return;
    setGame({ ...prev, undosLeft: game.undosLeft - 1 });
    setPrev(null);
  };

  const startNew = () => {
    if (!game.over) postScore(game);
    clearTimeout(confirmTimer.current);
    setConfirmNew(false);
    setPrev(null);
    setBestBefore(best);
    setGame(newGame());
  };

  // Starting again part-way through takes a second tap, so a stray tap doesn't lose a good game
  const askNew = () => {
    if (game.over || game.score === 0 || confirmNew) { startNew(); return; }
    setConfirmNew(true);
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmNew(false), CONFIRM_MS);
  };

  // Arrow keys (and WASD) on a keyboard
  useEffect(() => {
    const onKey = e => {
      const dir = KEYS[e.key];
      if (!dir || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      slide(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slide]);

  // Swipes anywhere in the play area
  const onPointerDown = e => {
    if (e.button > 0) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = e => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 'right' : 'left');
    else slide(dy > 0 ? 'down' : 'up');
  };

  const showWin = game.won && !game.keepGoing && !showJoke;
  const canUndo = prev && game.undosLeft > 0 && !showWin && !game.over;

  return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-game-card flex flex-col"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-safe z-10 bg-game-bg/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors active:scale-95">
            <span className="text-xl leading-none">←</span>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-1.5 text-game-gold font-bold text-lg">
            <span>🔢</span>
            <span>2048</span>
          </div>
          <RulesButton game="g2048" title="2048" />
        </div>
      </header>

      {/* ── Scores ─────────────────────────────────────────────────────────── */}
      <div className="max-w-lg w-full mx-auto flex items-stretch gap-2 px-4 pt-4">
        <ScoreBox label="Score" value={game.score} />
        <ScoreBox label="Best" value={best} />
        <button onClick={askNew}
          className={`flex-1 rounded-2xl font-bold text-sm px-3 active:scale-95 transition-all ${
            confirmNew ? 'bg-red-500 text-white' : 'bg-game-gold text-game-bg'}`}>
          {confirmNew ? 'Tap again to start over' : 'New Game'}
        </button>
      </div>

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-4 pt-4 pb-8 gap-4"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown} onPointerUp={onPointerUp}
        onPointerCancel={() => { swipeStart.current = null; }}>
        <div className="relative rounded-2xl shadow-2xl"
          style={{
            width: 'min(calc(100vw - 32px), calc(100dvh - 260px), 560px)',
            aspectRatio: '1', background: '#bbada0', containerType: 'inline-size',
          }}>
          {Array.from({ length: SIZE * SIZE }, (_, i) => (
            <div key={i} className="absolute rounded-[6%]"
              style={{
                left: pos(i % SIZE), top: pos(Math.floor(i / SIZE)), width: `${TILE}%`, height: `${TILE}%`,
                background: 'rgba(238, 228, 218, 0.35)',
              }} />
          ))}
          {game.tiles.map(t => <Tile key={t.id} tile={t} />)}

          <AnimatePresence>
            {game.over && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.4 } }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 rounded-2xl bg-black/65 flex flex-col items-center justify-center gap-3 text-center p-6">
                <div className="text-5xl">😅</div>
                <h2 className="text-2xl font-bold text-white">No more moves</h2>
                <p className="text-white/80">Score: <span className="font-bold text-game-gold">{game.score}</span>
                  {' '}• Biggest tile: <span className="font-bold">{biggestTile(game)}</span></p>
                {game.score > bestBefore && <p className="text-game-gold font-semibold">New best score! 🏆</p>}
                <div className="flex gap-3 mt-2">
                  <button onClick={startNew}
                    className="bg-game-gold text-game-bg font-bold px-6 py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                    Play Again
                  </button>
                  <button onClick={() => navigate('/')}
                    className="bg-white/15 text-white font-bold px-6 py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                    Menu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={undo} disabled={!canUndo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-30">
            <Undo2 size={16} /> Undo {game.undosLeft > 0 ? `(${game.undosLeft} left)` : ''}
          </button>
        </div>
        <p className="text-white/25 text-xs text-center leading-snug">
          Swipe to slide the tiles • Matching numbers join together
        </p>
      </div>

      {/* ── You made 2048 ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-game-card border border-white/20 rounded-3xl p-7 text-center shadow-2xl">
              <motion.div className="text-6xl mb-3" animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5 }}>🎉</motion.div>
              <h2 className="text-2xl font-bold text-white mb-1">You made {WIN_VALUE}!</h2>
              <p className="text-white/50 text-sm mb-4">in {game.moves} moves</p>
              <p className="text-game-gold font-bold text-lg mb-5">Score: {game.score}</p>
              <div className="flex gap-3">
                <button onClick={() => setGame(keepGoing)}
                  className="flex-1 bg-game-gold text-game-bg font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                  Keep Going
                </button>
                <button onClick={startNew}
                  className="flex-1 bg-white/10 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                  New Game
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

function ScoreBox({ label, value }) {
  return (
    <div className="flex-1 bg-white/10 rounded-2xl px-3 py-2 text-center">
      <div className="text-white/50 text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-white font-bold text-xl tabular-nums">{value}</div>
    </div>
  );
}

// Tiles slide to their new cell; a merged tile pops up once the two it replaces have slid under it
const Tile = memo(function Tile({ tile }) {
  const [bg, fg] = TILE_COLORS[tile.value] ?? BIG_TILE;
  const at = { left: pos(tile.col), top: pos(tile.row) };
  const appears = tile.merged || tile.isNew;
  return (
    <motion.div
      className="absolute rounded-[6%] flex items-center justify-center font-bold"
      style={{
        width: `${TILE}%`, height: `${TILE}%`, background: bg, color: fg,
        fontSize: `${FONT_CQW[String(tile.value).length] ?? 5}cqw`,
        zIndex: tile.gone ? 1 : tile.merged ? 3 : 2,
        boxShadow: tile.value >= 128 ? `0 0 ${Math.min(24, Math.log2(tile.value) * 2)}px ${bg}99` : 'none',
      }}
      initial={appears ? { ...at, scale: 0 } : false}
      animate={{ ...at, scale: tile.merged ? [0, 1.15, 1] : 1 }}
      transition={{
        left: { duration: SLIDE_S, ease: 'easeOut' },
        top: { duration: SLIDE_S, ease: 'easeOut' },
        scale: { delay: SLIDE_S * 0.9, duration: tile.merged ? 0.18 : 0.12 },
      }}
    >
      {tile.value}
    </motion.div>
  );
});
