import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { DadJokeModal } from '../../components/DadJokeModal';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import api from '../../utils/api';

// ── Theme ─────────────────────────────────────────────────────────────────────
const ROWS = 7, COLS = 7;
const FLOWERS = ['🌸', '🌻', '🌺', '🌼', '💐', '🌷'];
const SPECIAL_ICON = { row: '🌟', col: '💧', area: '☀️' };

// ── Levels ────────────────────────────────────────────────────────────────────
// Targets tuned by simulating a greedy player (win rate falls from ~100% to ~60%)
const LEVELS = [
  // Levels 1-5: Intro — still easy but not trivially so
  { id:  1, target: { type: 'score',   value:   800 }, moves: 15 },
  { id:  2, target: { type: 'score',   value:  1500 }, moves: 14 },
  { id:  3, target: { type: 'score',   value:  2500 }, moves: 12 },
  { id:  4, target: { type: 'score',   value:  3500 }, moves: 11 },
  { id:  5, target: { type: 'score',   value:  5000 }, moves: 10,
    obstacles: [{ row: 3, col: 3 }] },
  // Levels 6-10: Moderate challenge
  { id:  6, target: { type: 'collect', value:    12, flowerType: 0 }, moves: 14,
    obstacles: [{ row: 2, col: 2 }, { row: 4, col: 4 }] },
  { id:  7, target: { type: 'score',   value:  6500 }, moves: 10,
    obstacles: [{ row: 3, col: 3 }] },
  { id:  8, target: { type: 'score',   value:  7000 }, moves: 10,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 3 }] },
  { id:  9, target: { type: 'clear',   value:     4 }, moves: 15,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  { id: 10, target: { type: 'score',   value:  8000 }, moves: 11,
    obstacles: [{ row: 3, col: 2 }, { row: 3, col: 4 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  // Levels 11-15: Tough
  { id: 11, target: { type: 'collect', value:    16, flowerType: 1 }, moves: 13,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id: 12, target: { type: 'score',   value:  9000 }, moves: 12,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }, { row: 3, col: 3 }] },
  { id: 13, target: { type: 'clear',   value:     6 }, moves: 16,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id: 14, target: { type: 'score',   value: 10000 }, moves: 12 },
  { id: 15, target: { type: 'collect', value:    20, flowerType: 2 }, moves: 14,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 4 }] },
  // Levels 16-20: Expert
  { id: 16, target: { type: 'score',   value: 11000 }, moves: 13,
    obstacles: [{ row: 0, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 6, col: 3 }, { row: 3, col: 3 }] },
  { id: 17, target: { type: 'clear',   value:     8 }, moves: 18,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id: 18, target: { type: 'score',   value: 12000 }, moves: 14 },
  { id: 19, target: { type: 'collect', value:    22, flowerType: 3 }, moves: 14,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 3, col: 3 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id: 20, target: { type: 'score',   value: 13500 }, moves: 15,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
];

// ── Board logic ───────────────────────────────────────────────────────────────
const rnd  = () => Math.floor(Math.random() * FLOWERS.length);
// Every tile gets a unique id so it can animate as it moves around the board
let tileSeq = 0;
const mkCell = (type, special = null, isBlocker = false) => ({ id: ++tileSeq, type, special, isBlocker });

function initBoard(level) {
  const b = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => mkCell(rnd())));
  level.obstacles?.forEach(({ row, col }) => { b[row][col] = mkCell(-1, null, true); });
  // Dissolve any matches present at start
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c].isBlocker) continue;
      let tries = 0;
      while (tries++ < 30 && hasInitialMatch(b, r, c)) b[r][c] = mkCell(rnd());
    }
  }
  return b;
}

function hasInitialMatch(b, r, c) {
  const t = b[r][c].type;
  if (t < 0) return false;
  const eq = (nr, nc) =>
    nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !b[nr][nc].isBlocker && b[nr][nc].type === t;
  return (eq(r, c-1) && eq(r, c-2)) || (eq(r, c+1) && eq(r, c+2)) || (eq(r, c-1) && eq(r, c+1))
      || (eq(r-1, c) && eq(r-2, c)) || (eq(r+1, c) && eq(r+2, c)) || (eq(r-1, c) && eq(r+1, c));
}

function getMatchGroups(b) {
  const groups = [];
  // Horizontal runs
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { c++; continue; }
      let len = 1;
      while (c + len < COLS && !b[r][c+len].isBlocker && b[r][c+len].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r, c: c+i })), len, dir: 'h' });
      c += len;
    }
  }
  // Vertical runs
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && !b[r+len][c].isBlocker && b[r+len][c].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r: r+i, c })), len, dir: 'v' });
      r += len;
    }
  }
  return groups;
}

function processMatches(b, groups, targetType = -1) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  const toRemove = new Set();
  let score = 0, collected = 0, blockersRemoved = 0;

  // Activate special tiles and accumulate removal set
  groups.forEach(g => {
    g.cells.forEach(({ r, c }) => {
      const orig = b[r][c];
      if (orig.special === 'row') {
        for (let cc = 0; cc < COLS; cc++) if (!nb[r][cc].isBlocker) toRemove.add(`${r},${cc}`);
      } else if (orig.special === 'col') {
        for (let rr = 0; rr < ROWS; rr++) if (!nb[rr][c].isBlocker) toRemove.add(`${rr},${c}`);
      } else if (orig.special === 'area') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r+dr, nc = c+dc;
          if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !nb[nr][nc].isBlocker) toRemove.add(`${nr},${nc}`);
        }
      }
      toRemove.add(`${r},${c}`);
    });
    score += g.len * 100 * (g.len >= 5 ? 3 : g.len >= 4 ? 2 : 1);
  });

  // Damage adjacent blockers
  [...toRemove].forEach(key => {
    const [r, c] = key.split(',').map(Number);
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && nb[nr][nc].isBlocker) {
        nb[nr][nc] = mkCell(-1);
        blockersRemoved++;
      }
    });
  });

  // Promote long matches to special tiles (before removal)
  const hSet = new Set(), vSet = new Set();
  groups.forEach(g => g.cells.forEach(({ r, c }) => (g.dir === 'h' ? hSet : vSet).add(`${r},${c}`)));

  groups.forEach(g => {
    const mid = g.cells[Math.floor(g.len / 2)];
    const key = `${mid.r},${mid.c}`;
    const origType = b[mid.r][mid.c].type;
    if (g.len >= 5 && toRemove.has(key)) {
      nb[mid.r][mid.c] = mkCell(origType, 'col'); toRemove.delete(key);
    } else if (g.len === 4 && toRemove.has(key)) {
      nb[mid.r][mid.c] = mkCell(origType, 'row'); toRemove.delete(key);
    }
  });

  // L/T intersections → area special
  [...hSet].filter(k => vSet.has(k) && toRemove.has(k)).forEach(key => {
    const [r, c] = key.split(',').map(Number);
    nb[r][c] = mkCell(b[r][c].type, 'area');
    toRemove.delete(key);
  });

  // Count collected then remove
  toRemove.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (targetType >= 0 && b[r][c].type === targetType) collected++;
    nb[r][c] = mkCell(-1);
  });

  return { board: nb, score, collected, blockersRemoved };
}

function applyGravity(b) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!nb[r][c].isBlocker && nb[r][c].type >= 0) col.push(nb[r][c]);
    }
    let ci = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (nb[r][c].isBlocker) continue;
      nb[r][c] = ci < col.length ? col[ci++] : mkCell(-1);
    }
  }
  return nb;
}

const fillBoard = b =>
  b.map(row => row.map(cl => (!cl.isBlocker && cl.type < 0 ? mkCell(rnd()) : cl)));

/** Resolve every match. `steps` holds the board after each stage (matches
 *  cleared, then tiles dropped and refilled, repeated) so it can be animated. */
function fullCascade(b, targetType = -1) {
  let cur = b, totalScore = 0, totalCollected = 0, totalBlockers = 0;
  const steps = [];
  let groups = getMatchGroups(cur);
  while (groups.length > 0) {
    const res = processMatches(cur, groups, targetType);
    totalScore    += res.score;
    totalCollected += res.collected;
    totalBlockers  += res.blockersRemoved;
    steps.push(res.board);
    cur = fillBoard(applyGravity(res.board));
    steps.push(cur);
    groups = getMatchGroups(cur);
  }
  return { board: cur, steps, totalScore, totalCollected, totalBlockers };
}

function trySwapBoard(b, r1, c1, r2, c2) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  [nb[r1][c1], nb[r2][c2]] = [nb[r2][c2], nb[r1][c1]];
  return nb;
}

/** True if at least one adjacent swap would create a match. */
function hasValidMove(b) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c].isBlocker) continue;
    for (const [r2, c2] of [[r, c + 1], [r + 1, c]]) {
      if (r2 >= ROWS || c2 >= COLS || b[r2][c2].isBlocker) continue;
      if (getMatchGroups(trySwapBoard(b, r, c, r2, c2)).length > 0) return true;
    }
  }
  return false;
}

/** Rearrange the existing tiles (blockers stay put) into a layout with no
 *  ready-made matches and at least one valid move. */
function reshuffleBoard(b) {
  const spots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!b[r][c].isBlocker) spots.push([r, c]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const tiles = spots.map(([r, c]) => b[r][c]);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const nb = b.map(row => row.map(cl => ({ ...cl })));
    spots.forEach(([r, c], i) => { nb[r][c] = tiles[i]; });
    if (getMatchGroups(nb).length === 0 && hasValidMove(nb)) return nb;
  }
  // Extremely unlikely: fall back to fresh random flowers
  const nb = b.map(row => row.map(cl => (cl.isBlocker ? cl : mkCell(rnd()))));
  return getMatchGroups(nb).length === 0 && hasValidMove(nb) ? nb : reshuffleBoard(nb);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAdj = (r1, c1, r2, c2) => Math.abs(r1-r2) + Math.abs(c1-c2) === 1;
const getDiff = id => id <= 7 ? 'easy' : id <= 14 ? 'medium' : 'hard';
const STEP_MS = 260;   // pause between animation stages

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
  const [showTutorial, setShowTutorial] = useState(false);

  // Pending animation timers, cancelled when a level (re)loads or we leave
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const cancelTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => cancelTimers, []);

  const level = LEVELS[lvlIdx] ?? LEVELS[LEVELS.length - 1];

  const loadLevel = useCallback(idx => {
    const lv = LEVELS[idx];
    cancelTimers();
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

  useEffect(() => { loadLevel(0); }, [loadLevel]);

  const isComplete = useCallback((sc, col, bl) => {
    const { target: t } = level;
    if (t.type === 'score'   && sc  >= t.value) return true;
    if (t.type === 'collect' && col >= t.value) return true;
    if (t.type === 'clear'   && bl  <= 0)       return true;
    return false;
  }, [level]);

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

    // Adjacent tap: slide the two tiles into each other's places
    const swapped = trySwapBoard(board, sel.r, sel.c, r, c);
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
  }, [board, phase, locked, sel, level, score, collected, blockersLeft, movesLeft, isComplete]);

  const handleJokeClose = useCallback(async () => {
    setJokeOpen(false);
    try {
      await api.post('/scores', { game: 'match3', score, difficulty: getDiff(level.id) });
    } catch (_) {}
    loadLevel(lvlIdx + 1);
    setLvlIdx(i => i + 1);
  }, [score, level, lvlIdx, loadLevel]);

  const cellEmoji = cl => {
    if (cl.isBlocker)  return '🟫';
    if (cl.type < 0)   return '✨';          // just cleared
    if (cl.special)    return SPECIAL_ICON[cl.special];
    return FLOWERS[cl.type];
  };

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
      <p className="text-white/60">You've mastered all 20 levels!</p>
      <Button variant="primary" onClick={() => { setLvlIdx(0); loadLevel(0); }}>Play Again</Button>
      <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
    </div>
  );

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === 'gameOver') return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-7xl">🥀</div>
      <h1 className="text-game-gold text-3xl font-bold">Out of Moves!</h1>
      <p className="text-white/60">Level {level.id} · Score: {score.toLocaleString()}</p>
      <Button variant="primary" onClick={() => loadLevel(lvlIdx)}>Try Again</Button>
      <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
    </div>
  );

  const progress = goalProgress(level, score, collected, blockersLeft);

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center gap-3 p-3"
      style={{ touchAction: 'manipulation', userSelect: 'none' }}>

      {/* Header row */}
      <div className="flex items-center justify-between w-full max-w-sm">
        <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={20} /></Button>
        <div className="flex items-center gap-1">
          <h1 className="text-game-gold font-bold text-lg">Level {level.id}</h1>
          <button onClick={() => setShowTutorial(true)} className="p-2 text-white/40 hover:text-white/70" aria-label="How to play">
            <HelpCircle size={16} />
          </button>
        </div>
        <span className={`font-bold text-sm ${movesLeft <= 5 ? 'text-game-red' : 'text-white/60'}`}>
          {movesLeft} moves
        </span>
      </div>

      {/* Stats card */}
      <div className="w-full max-w-sm bg-game-card rounded-xl px-4 py-3 flex justify-between items-center gap-2">
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
      <div className="w-full max-w-sm h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div className="h-full bg-game-gold rounded-full"
          animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Board */}
      <div className="bg-game-card p-2 rounded-2xl shadow-xl"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 2.75rem)`, gap: '3px' }}>
        {board.map((row, r) =>
          row.map((cl, c) => {
            const isSel = sel?.r === r && sel?.c === c;
            const cleared = !cl.isBlocker && cl.type < 0;
            return (
              <motion.button
                key={cl.id}
                layout
                onClick={() => handleTap(r, c)}
                // New tiles drop in from above; cleared spots pop a sparkle
                initial={cleared ? { scale: 0.3, opacity: 0 } : { y: -28, opacity: 0 }}
                animate={{ scale: isSel ? 1.15 : 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={[
                  'w-11 h-11 flex items-center justify-center text-2xl rounded-lg',
                  'transition-colors duration-100 active:opacity-70',
                  cl.isBlocker
                    ? 'bg-amber-900/60 cursor-not-allowed'
                    : isSel
                      ? 'bg-game-gold/40 ring-2 ring-game-gold'
                      : 'bg-game-accent/40 hover:bg-game-accent/60 cursor-pointer',
                ].join(' ')}
              >
                {cellEmoji(cl)}
              </motion.button>
            );
          })
        )}
      </div>

      <p className={`text-xs text-center ${notice ? 'text-game-gold font-semibold' : 'text-white/30'}`}>
        {notice || 'Tap a flower, then tap an adjacent flower to swap'}
      </p>

      <DadJokeModal isOpen={jokeOpen} onClose={handleJokeClose} />
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Garden Match" slides={TUTORIALS.match3} />
    </div>
  );
}
