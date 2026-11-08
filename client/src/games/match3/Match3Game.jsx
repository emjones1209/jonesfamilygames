import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { DadJokeModal } from '../../components/DadJokeModal';
import api from '../../utils/api';
import { RulesButton } from '../../components/RulesButton';
import { useAuth } from '../../context/AuthContext';

import {
  ROWS, COLS, FLOWERS, SPECIAL_ICON, LEVELS, CHAPTERS,
  initBoard, getMatchGroups, fullCascade, trySwapBoard, hasValidMove, reshuffleBoard,
  loadReached, saveReached, reachedFromScores,
} from './match3Logic';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAdj = (r1, c1, r2, c2) => Math.abs(r1-r2) + Math.abs(c1-c2) === 1;
const getDiff = id => id <= 7 ? 'easy' : id <= 14 ? 'medium' : 'hard';
const STEP_MS = 260;   // pause between animation stages
const SWIPE_PX = 18;   // how far a finger must move for a swipe

// Tile size: as big as fits (up to 72px) in both the screen's width and its
// height — about 14rem goes to the header, goal panel and hint — but never
// below 44px. 7.4 allows for the 7 tiles plus gaps and padding.
const TILE_SIZE = 'clamp(2.75rem, min(calc((100vw - 3rem) / 7.4), calc((var(--screen-h) - 14rem) / 7.4)), 4.5rem)';
const BOARD_WIDTH = `calc(var(--tile) * ${COLS} + ${(COLS - 1) * 3 + 16}px)`;   // tiles + 3px gaps + padding

function goalText(level) {
  const { target: t } = level;
  if (t.type === 'score')   return `Score ${t.value.toLocaleString()} pts`;
  if (t.type === 'collect') return `Collect ${t.value} ${FLOWERS[t.flowerType]}`;
  return `Clear ${t.value} 🟫`;
}

function goalProgress(level, score, collected, blockersLeft) {
  const { target: t } = level;
  if (t.type === 'score')   return Math.min(1, score / t.value);
  if (t.type === 'collect') return Math.min(1, collected / t.value);
  const total = level.obstacles?.length || 1;
  return Math.min(1, (total - blockersLeft) / total);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Match3Game() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // Only the id matters here, and the user object can be replaced when it's refreshed
  const userId = authUser?.id;
  const user = useMemo(() => ({ id: userId }), [userId]);
  // The furthest level reached (LEVELS.length + 1 once every level is won)
  const [reached,      setReached]      = useState(() => loadReached(user));
  const [mapOpen,      setMapOpen]      = useState(false);
  const [lvlIdx,       setLvlIdx]       = useState(0);
  const [board,        setBoard]        = useState(null);
  const [sel,          setSel]          = useState(null);  // {r,c}
  const [phase,        setPhase]        = useState('playing'); // playing|gameOver|allDone
  const [movesLeft,    setMovesLeft]    = useState(0);
  const [score,        setScore]        = useState(0);
  const [collected,    setCollected]    = useState(0);
  const [blockersLeft, setBlockersLeft] = useState(0);
  const [jokeOpen,     setJokeOpen]     = useState(false);
  const [locked,       setLocked]       = useState(false); // prevent input during cascade
  const [notice,       setNotice]       = useState('');

  // Pending animation timers, cancelled when a level (re)loads or we leave
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const cancelTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => cancelTimers, []);

  const level = LEVELS[lvlIdx] ?? LEVELS[LEVELS.length - 1];

  const movedYet = useRef(false);   // has a move been made since the game opened?

  const loadLevel = useCallback(idx => {
    const lv = LEVELS[idx];
    cancelTimers();
    setLvlIdx(idx);
    setMapOpen(false);
    if (!lv) { setPhase('allDone'); return; }
    const b = initBoard(lv);
    setBoard(hasValidMove(b) ? b : reshuffleBoard(b));
    setMovesLeft(lv.moves);
    setScore(0);
    setCollected(0);
    setBlockersLeft(lv.obstacles?.length ?? 0);
    setSel(null);
    setPhase('playing');
    setLocked(false);
  }, []);

  // Carry on from the furthest level reached on this device…
  useEffect(() => { loadLevel(Math.min(loadReached(user), LEVELS.length + 1) - 1); }, [loadLevel, user]);

  // …or further, if the scores saved on the server show it was reached on
  // another device. Jump there only if no move has been made yet.
  useEffect(() => {
    let live = true;
    api.get('/scores/me', { params: { game: 'match3', limit: 500 } })
      .then(({ data }) => {
        const fromServer = reachedFromScores(data);
        if (!live || fromServer <= loadReached(user)) return;
        saveReached(user, fromServer);
        setReached(fromServer);
        if (!movedYet.current) loadLevel(fromServer - 1);
      })
      .catch(() => { /* offline: this device's progress will do */ });
    return () => { live = false; };
  }, [loadLevel, user]);

  const isComplete = useCallback((sc, col, bl) => {
    const { target: t } = level;
    if (t.type === 'score'   && sc  >= t.value) return true;
    if (t.type === 'collect' && col >= t.value) return true;
    if (t.type === 'clear'   && bl  <= 0)       return true;
    return false;
  }, [level]);

  /** Swap two neighbouring tiles (after a tap-tap or a swipe): they slide into
   *  each other's places, then any matches play out — or they slide back. */
  const swapTiles = useCallback((r1, c1, r2, c2) => {
    if (!board || phase !== 'playing' || locked) return;
    if (!isAdj(r1, c1, r2, c2) || board[r1][c1].isBlocker || board[r2][c2].isBlocker) return;
    const swapped = trySwapBoard(board, r1, c1, r2, c2);
    movedYet.current = true;
    setSel(null);
    setBoard(swapped);
    setLocked(true);

    if (getMatchGroups(swapped).length === 0) {
      // No match: slide them back
      later(() => { setBoard(board); setLocked(false); }, STEP_MS + 80);
      return;
    }

    const ft = level.target.type === 'collect' ? level.target.flowerType : -1;
    const res = fullCascade(swapped, ft);
    const newScore    = score    + res.totalScore;
    const newCollect  = collected + res.totalCollected;
    const newBlockers = Math.max(0, blockersLeft - res.totalBlockers);
    const newMoves    = movesLeft - 1;

    // Play the cascade: matches sparkle away, tiles fall, new ones drop in
    res.steps.forEach((step, i) => later(() => setBoard(step), STEP_MS * (i + 1)));

    later(() => {
      // Never leave the player stuck with no possible move
      if (!hasValidMove(res.board)) {
        setBoard(reshuffleBoard(res.board));
        setNotice('No moves left — reshuffled!');
        later(() => setNotice(''), 1500);
      }
      setScore(newScore);
      setCollected(newCollect);
      setBlockersLeft(newBlockers);
      setMovesLeft(newMoves);
      setLocked(false);
      if (isComplete(newScore, newCollect, newBlockers)) {
        later(() => setJokeOpen(true), 250);
      } else if (newMoves <= 0) {
        later(() => setPhase('gameOver'), 250);
      }
    }, STEP_MS * (res.steps.length + 1));
  }, [board, phase, locked, level, score, collected, blockersLeft, movesLeft, isComplete]);

  const handleTap = useCallback((r, c) => {
    if (!board || phase !== 'playing' || locked) return;
    const tapped = board[r][c];
    if (tapped.isBlocker) return;

    // First tap: select
    if (!sel) { setSel({ r, c }); return; }
    // Same tile: deselect
    if (sel.r === r && sel.c === c) { setSel(null); return; }
    // Non-adjacent: re-select
    if (!isAdj(sel.r, sel.c, r, c)) { setSel({ r, c }); return; }

    // Adjacent tap: swap them
    swapTiles(sel.r, sel.c, r, c);
  }, [board, phase, locked, sel, swapTiles]);

  const handleJokeClose = useCallback(async () => {
    setJokeOpen(false);
    // Unlock the next level straight away, then save the win (with its level,
    // which is how other devices learn how far you've got)
    const next = Math.max(reached, level.id + 1);
    saveReached(user, next);
    setReached(next);
    try {
      await api.post('/scores', { game: 'match3', score, difficulty: getDiff(level.id), metadata: { level: level.id } });
    } catch { /* offline: progress is still saved on this device */ }
    loadLevel(lvlIdx + 1);
  }, [score, level, lvlIdx, loadLevel, reached, user]);

  // Swipe to swap. Remember where a press started; once the finger has moved far
  // enough, swap with the neighbour in that direction. The press's own click is
  // then ignored so it doesn't also select the tile.
  const swipe = useRef(null);       // { r, c, x, y, swiped }
  const onTilePointerDown = (e, r, c) => {
    swipe.current = { r, c, x: e.clientX, y: e.clientY, swiped: false };
    // Keep getting moves past the tile's edge (can throw if the pointer is already gone)
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not essential */ }
  };
  const onTilePointerMove = e => {
    const s = swipe.current;
    if (!s || s.swiped) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    s.swiped = true;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
    const r2 = s.r + dr, c2 = s.c + dc;
    if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS) swapTiles(s.r, s.c, r2, c2);
  };
  const onTileClick = (r, c) => {
    if (swipe.current?.swiped) return;   // that press was a swipe, not a tap
    handleTap(r, c);
  };

  const cellEmoji = cl => {
    if (cl.isBlocker)  return '🟫';
    if (cl.type < 0)   return '✨';          // just cleared
    return FLOWERS[cl.type];
  };

  // Pick any level up to the furthest reached, like a level map
  const levelMap = mapOpen && (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={() => setMapOpen(false)}>
      <div className="bg-game-card rounded-2xl p-5 w-full max-w-sm shadow-xl flex flex-col max-h-[90dvh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-game-gold font-bold text-xl">🌱 Levels</h2>
          <button className="text-white/50 hover:text-white p-2" aria-label="Close levels"
            onClick={() => setMapOpen(false)}>✕</button>
        </div>
        {/* Scrolls when the levels don't all fit, starting at the current one */}
        <div className="overflow-y-auto -mx-2 px-2 pt-1">
          {CHAPTERS.map(ch => (
            <section key={ch.name} className="mb-3">
              <h3 className="text-white/60 text-sm font-semibold mb-2">{ch.emoji} {ch.name}</h3>
              <div className="grid grid-cols-5 gap-2">
                {LEVELS.slice(ch.from - 1, ch.to).map(lv => {
                  const i = lv.id - 1;
                  const open = lv.id <= reached;
                  const won = lv.id < reached;
                  const here = i === lvlIdx && phase !== 'allDone';
                  return (
                    <button key={lv.id} disabled={!open}
                      ref={here ? el => el?.scrollIntoView({ block: 'center' }) : undefined}
                      onClick={() => { movedYet.current = true; loadLevel(i); }}
                      aria-label={open ? `Level ${lv.id}${won ? ' (won)' : ''}` : `Level ${lv.id} (locked)`}
                      className={[
                        'relative aspect-square rounded-xl font-bold text-lg flex items-center justify-center',
                        !open ? 'bg-white/5 text-white/25 cursor-not-allowed'
                          : here ? 'bg-game-gold text-game-bg ring-2 ring-game-gold'
                          : 'bg-game-accent/50 text-white hover:bg-game-accent/70',
                      ].join(' ')}>
                      {open ? lv.id : '🔒'}
                      {won && <span className="absolute -top-1 -right-1 text-sm">🌸</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="text-white/40 text-xs text-center mt-2">
          Win a level to unlock the next one. Replay any level you've reached.
        </p>
      </div>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!board) return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center">
      <span className="text-white/40 text-lg">Loading…</span>
    </div>
  );

  // ── All done ─────────────────────────────────────────────────────────────
  if (phase === 'allDone') return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-7xl">🏆</div>
      <h1 className="text-game-gold text-3xl font-bold">Garden Complete!</h1>
      <p className="text-white/60">You've mastered all {LEVELS.length} levels!</p>
      <Button variant="primary" onClick={() => loadLevel(0)}>Play Again</Button>
      <Button variant="secondary" onClick={() => setMapOpen(true)}>Levels</Button>
      <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
      {levelMap}
    </div>
  );

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === 'gameOver') return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-7xl">🥀</div>
      <h1 className="text-game-gold text-3xl font-bold">Out of Moves!</h1>
      <p className="text-white/60">Level {level.id} · Score: {score.toLocaleString()}</p>
      <Button variant="primary" onClick={() => loadLevel(lvlIdx)}>Try Again</Button>
      <Button variant="secondary" onClick={() => setMapOpen(true)}>Levels</Button>
      <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
      {levelMap}
    </div>
  );

  const progress = goalProgress(level, score, collected, blockersLeft);

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center gap-3 p-3"
      style={{ touchAction: 'manipulation', userSelect: 'none', '--tile': TILE_SIZE }}>

      {/* Header row */}
      <div className="flex items-center justify-between w-full" style={{ maxWidth: BOARD_WIDTH }}>
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={20} /></Button>
        <div className="flex items-center gap-1">
          <button onClick={() => setMapOpen(true)} aria-label="Choose a level"
            className="text-game-gold font-bold text-lg flex items-center gap-1 hover:opacity-80">
            <MapIcon size={18} /> Level {level.id}
          </button>
          <RulesButton game="match3" title="Garden Match" className="ml-1" />
        </div>
        <span className={`font-bold text-sm ${movesLeft <= 5 ? 'text-game-red' : 'text-white/60'}`}>
          {movesLeft} moves
        </span>
      </div>

      {/* Stats card */}
      <div className="w-full bg-game-card rounded-xl px-4 py-3 flex justify-between items-center gap-2" style={{ maxWidth: BOARD_WIDTH }}>
        <div className="text-center">
          <p className="text-white/40 text-xs">Score</p>
          <p className="text-game-gold font-bold tabular-nums">{score.toLocaleString()}</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-white/40 text-xs">Goal</p>
          <p className="text-white text-sm leading-tight">{goalText(level)}</p>
        </div>
        <div className="text-center">
          <p className="text-white/40 text-xs">Difficulty</p>
          <p className="text-white/80 text-sm capitalize">{getDiff(level.id)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden" style={{ maxWidth: BOARD_WIDTH }}>
        <motion.div className="h-full bg-game-gold rounded-full"
          animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Board */}
      <div className="bg-game-card p-2 rounded-2xl shadow-xl"
        // touch-action: none stops the iPad scrolling the page during a swipe
        style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, auto)`, gap: '3px', touchAction: 'none' }}>
        {board.map((row, r) =>
          row.map((cl, c) => {
            const isSel = sel?.r === r && sel?.c === c;
            const cleared = !cl.isBlocker && cl.type < 0;
            return (
              <motion.button
                key={cl.id}
                layout
                style={{ width: 'var(--tile)', height: 'var(--tile)', fontSize: 'calc(var(--tile) * 0.56)' }}
                onPointerDown={e => onTilePointerDown(e, r, c)}
                onPointerMove={onTilePointerMove}
                onClick={() => onTileClick(r, c)}
                // New tiles drop in from above; cleared spots pop a sparkle
                initial={cleared ? { scale: 0.3, opacity: 0 } : { y: -28, opacity: 0 }}
                animate={{ scale: isSel ? 1.15 : 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={[
                    'relative flex items-center justify-center rounded-lg md:rounded-xl',
                  'transition-colors duration-100 active:opacity-70',
                  cl.isBlocker
                    ? 'bg-amber-900/60 cursor-not-allowed'
                    : isSel
                      ? 'bg-game-gold/40 ring-2 ring-game-gold'
                      : cl.special
                        ? 'bg-game-accent/60 ring-2 ring-yellow-300/70 cursor-pointer'   // specials glow
                        : 'bg-game-accent/40 hover:bg-game-accent/60 cursor-pointer',
                ].join(' ')}
              >
                {cellEmoji(cl)}
                {/* A special still shows its flower (that's what it matches with), plus a badge */}
                {cl.special && !cl.isBlocker && cl.type >= 0 && (
                  <span className="absolute -top-1 -right-1 pointer-events-none drop-shadow"
                    style={{ fontSize: 'calc(var(--tile) * 0.34)' }}>
                    {SPECIAL_ICON[cl.special]}
                  </span>
                )}
              </motion.button>
            );
          })
        )}
      </div>

      <p className={`text-xs text-center ${notice ? 'text-game-gold font-semibold' : 'text-white/30'}`}>
        {notice || 'Swipe a flower toward a neighbour to swap them — or tap one, then the other'}
      </p>

      <DadJokeModal isOpen={jokeOpen} onClose={handleJokeClose} />
      {levelMap}
    </div>
  );
}
