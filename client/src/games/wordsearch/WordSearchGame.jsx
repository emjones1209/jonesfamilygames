import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DadJokeModal } from '../../components/DadJokeModal';
import { RulesButton } from '../../components/RulesButton';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { avatarEmoji } from '../../utils/avatars';
import {
  DIFFICULTIES, dateKey, nextDateKey, themeForDate, dailyPuzzle, makePuzzle, snapLine, wordAt, scoreFor,
} from './wordSearchLogic';

// Highlighter colours for found words, in turn
const COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#a3e635', '#e879f9', '#2dd4bf', '#facc15'];
const MISS_MS = 500;
const MEDALS = ['🥇', '🥈', '🥉'];

const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const vibrate = pattern => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern); };

// Today's finishing times on this device, so the daily puzzle shows as done straight away
const dailyKey = (user, day) => `wordsearch:${user?.id ?? 'guest'}:${day}`;
function loadDaily(user, day) {
  try { return JSON.parse(localStorage.getItem(dailyKey(user, day))) ?? {}; } catch { return {}; }
}
function saveDaily(user, day, times) {
  try { localStorage.setItem(dailyKey(user, day), JSON.stringify(times)); } catch { /* private mode */ }
}

export default function WordSearchGame() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [today] = useState(() => dateKey());
  const theme = themeForDate(today);
  const tomorrow = themeForDate(nextDateKey(today));

  const [difficulty, setDifficulty] = useState('easy');
  const [play, setPlay] = useState(null);            // { puzzle, difficulty, daily }
  const [found, setFound] = useState([]);            // [{ word, cells }]
  const [selection, setSelection] = useState(null);  // cells under the finger while dragging
  const [pending, setPending] = useState(null);      // the first letter tapped, waiting for the last
  const [miss, setMiss] = useState(null);            // a wrong selection, shown red for a moment
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [showJoke, setShowJoke] = useState(false);
  const [myDaily, setMyDaily] = useState(() => loadDaily(user, today));   // { easy: seconds, ... }
  const [family, setFamily] = useState(null);        // today's times from the server

  const boardRef = useRef(null);
  const dragStart = useRef(null);
  const startedAt = useRef(0);
  const missTimer = useRef(null);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  const loadFamily = useCallback(() => {
    api.get(`/scores/daily/wordsearch?date=${today}`).then(({ data }) => setFamily(data)).catch(() => setFamily([]));
  }, [today]);
  useEffect(() => { loadFamily(); }, [loadFamily]);

  // The clock runs while a puzzle is being played
  useEffect(() => {
    if (!play || done) return undefined;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [play, done]);

  const start = (daily, diff = difficulty) => {
    const puzzle = daily
      ? dailyPuzzle(today, diff)
      : makePuzzle({ theme, difficulty: diff, seed: Math.floor(Math.random() * 2 ** 32) });
    setPlay({ puzzle, difficulty: diff, daily });
    setFound([]);
    setSelection(null);
    setPending(null);
    setMiss(null);
    setSeconds(0);
    setDone(false);
    startedAt.current = Date.now();
  };

  const finish = (secs) => {
    setDone(true);
    setSeconds(secs);
    vibrate([60, 40, 60, 40, 200]);
    const score = scoreFor(secs, play.difficulty);
    const firstDaily = play.daily && myDaily[play.difficulty] == null;
    if (firstDaily) {
      const times = { ...myDaily, [play.difficulty]: secs };
      setMyDaily(times);
      saveDaily(user, today, times);
    }
    api.post('/scores', {
      game: 'wordsearch', score, durationS: secs, difficulty: play.difficulty,
      metadata: { theme: theme.id, daily: firstDaily ? today : null },
    }).then(loadFamily).catch(() => {});
    setTimeout(() => setShowJoke(true), 900);
  };

  const tryWord = cells => {
    const word = wordAt(play.puzzle, cells, found.map(f => f.word));
    if (word) {
      const next = [...found, { word, cells }];
      setFound(next);
      vibrate([30]);
      if (next.length === play.puzzle.words.length) finish(Math.floor((Date.now() - startedAt.current) / 1000));
    } else if (cells.length > 1) {
      setMiss(cells);
      vibrate([15, 30, 15]);
      clearTimeout(missTimer.current);
      missTimer.current = setTimeout(() => setMiss(null), MISS_MS);
    }
  };

  // ── Selecting: drag across a word, or tap its first letter and then its last ──
  const cellAt = e => {
    const rect = boardRef.current.getBoundingClientRect();
    const size = play.puzzle.size;
    const clamp = n => Math.max(0, Math.min(size - 1, n));
    return [
      clamp(Math.floor(((e.clientY - rect.top) / rect.height) * size)),
      clamp(Math.floor(((e.clientX - rect.left) / rect.width) * size)),
    ];
  };
  const onPointerDown = e => {
    if (done || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const cell = cellAt(e);
    dragStart.current = cell;
    setSelection([cell]);
  };
  const onPointerMove = e => {
    if (!dragStart.current) return;
    setSelection(snapLine(dragStart.current, cellAt(e), play.puzzle.size));
  };
  const onPointerUp = e => {
    const from = dragStart.current;
    if (!from) return;
    dragStart.current = null;
    setSelection(null);
    const cells = snapLine(from, cellAt(e), play.puzzle.size);
    if (cells.length > 1) {
      setPending(null);
      tryWord(cells);
      return;
    }
    // A tap: the first one marks a letter, the second finishes the line
    const [cell] = cells;
    if (!pending) setPending(cell);
    else if (pending[0] === cell[0] && pending[1] === cell[1]) setPending(null);
    else {
      tryWord(snapLine(pending, cell, play.puzzle.size));
      setPending(null);
    }
  };
  const onPointerCancel = () => { dragStart.current = null; setSelection(null); };

  if (!play) {
    return (
      <Setup
        navigate={navigate} today={today} theme={theme} tomorrow={tomorrow}
        difficulty={difficulty} setDifficulty={setDifficulty} myDaily={myDaily} family={family}
        onDaily={() => start(true)} onAnother={() => start(false)}
      />
    );
  }

  const { puzzle } = play;
  const foundWords = found.map(f => f.word);
  const colorOf = word => COLORS[foundWords.indexOf(word) % COLORS.length];
  const score = scoreFor(seconds, play.difficulty);
  const todays = (family ?? []).filter(f => f.difficulty === play.difficulty);

  return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-game-card flex flex-col"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <header className="sticky top-safe z-10 bg-game-bg/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => setPlay(null)}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors active:scale-95">
            <span className="text-xl leading-none">←</span>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-1.5 text-game-gold font-bold text-lg">
            <span>{theme.emoji}</span>
            <span>{theme.name}</span>
          </div>
          <RulesButton game="wordsearch" title="Word Search" />
        </div>
      </header>

      <div className="max-w-5xl w-full mx-auto flex items-center justify-between px-4 pt-3 text-white">
        <span className="text-sm text-white/60">
          {play.daily ? "Today's puzzle" : 'Extra puzzle'} • {DIFFICULTIES[play.difficulty].label}
        </span>
        <span className="font-semibold">{found.length} / {puzzle.words.length} words</span>
        <span className="font-mono font-bold text-lg">⏱ {formatTime(seconds)}</span>
      </div>

      <div className="flex-1 flex flex-col landscape:flex-row items-center landscape:items-start justify-center gap-5 px-4 pt-4 pb-8 max-w-5xl w-full mx-auto">
        {/* The letters, with highlighter lines drawn under them */}
        <div ref={boardRef}
          className="relative shrink-0 rounded-2xl shadow-2xl bg-[#fdf8ee] w-[min(calc(100vw_-_32px),calc(100dvh_-_320px),640px)] landscape:w-[min(calc(100dvh_-_150px),calc(100vw_-_360px),720px)]"
          style={{ aspectRatio: '1', touchAction: 'none', containerType: 'inline-size', cursor: 'pointer' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${puzzle.size} ${puzzle.size}`}>
            {found.map(f => <Highlight key={f.word} cells={f.cells} color={colorOf(f.word)} opacity={0.5} />)}
            {miss && <Highlight cells={miss} color="#ef4444" opacity={0.45} />}
            {selection && <Highlight cells={selection} color="#e8b86d" opacity={0.6} />}
            {pending && !selection && (
              <circle cx={pending[1] + 0.5} cy={pending[0] + 0.5} r={0.42} fill="#e8b86d" opacity={0.6} />
            )}
          </svg>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}>
            {puzzle.grid.flatMap((row, r) => row.map((letter, c) => (
              <div key={`${r}-${c}`} className="flex items-center justify-center font-bold text-slate-800"
                style={{ fontSize: `${58 / puzzle.size}cqw` }}>
                {letter}
              </div>
            )))}
          </div>
        </div>

        {/* The words to find */}
        <div className="w-full landscape:w-64 landscape:shrink-0">
          <div className="flex flex-wrap landscape:flex-col gap-2 justify-center">
            {puzzle.words.map(({ word }) => {
              const isFound = foundWords.includes(word);
              return (
                <motion.span key={word}
                  animate={isFound ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold tracking-wide ${isFound ? 'line-through text-white/90' : 'bg-white/10 text-white'}`}
                  style={isFound ? { background: `${colorOf(word)}88` } : undefined}>
                  {word}
                </motion.span>
              );
            })}
          </div>
          <p className="text-white/25 text-xs text-center mt-4 leading-snug">
            Drag across a word • Or tap its first letter, then its last
          </p>
        </div>
      </div>

      <AnimatePresence>
        {done && !showJoke && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-game-card border border-white/20 rounded-3xl p-7 text-center shadow-2xl">
              <motion.div className="text-6xl mb-3" animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5 }}>🎉</motion.div>
              <h2 className="text-2xl font-bold text-white mb-1">All words found!</h2>
              <p className="text-white/50 text-sm mb-3">{DIFFICULTIES[play.difficulty].label} • {formatTime(seconds)}</p>
              <p className="text-game-gold font-bold text-lg mb-4">Score: {score}</p>
              {play.daily && todays.length > 0 && (
                <div className="mb-5">
                  <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Today&apos;s family times</div>
                  <FamilyTimes rows={todays} />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => start(false, play.difficulty)}
                  className="flex-1 bg-game-gold text-game-bg font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                  Another Puzzle
                </button>
                <button onClick={() => setPlay(null)}
                  className="flex-1 bg-white/10 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
                  Done
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

// A highlighter stroke from the first cell of a line to the last
function Highlight({ cells, color, opacity }) {
  const [r0, c0] = cells[0];
  const [r1, c1] = cells[cells.length - 1];
  return (
    <line x1={c0 + 0.5} y1={r0 + 0.5} x2={c1 + 0.5} y2={r1 + 0.5}
      stroke={color} strokeOpacity={opacity} strokeWidth={0.8} strokeLinecap="round" />
  );
}

function FamilyTimes({ rows }) {
  return (
    <ol className="space-y-1 text-left">
      {rows.map((f, i) => (
        <li key={`${f.displayName}-${i}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm ${f.you ? 'bg-game-gold/20 text-white' : 'bg-white/5 text-white/80'}`}>
          <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
          <span>{avatarEmoji(f.avatar)}</span>
          <span className="flex-1 truncate font-semibold">{f.displayName}{f.you ? ' (you)' : ''}</span>
          <span className="font-mono">{formatTime(f.seconds)}</span>
        </li>
      ))}
    </ol>
  );
}

function Setup({ navigate, today, theme, tomorrow, difficulty, setDifficulty, myDaily, family, onDaily, onAnother }) {
  const [y, m, d] = today.split('-').map(Number);
  const dayName = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const doneIn = myDaily[difficulty];
  const byLevel = Object.keys(DIFFICULTIES)
    .map(level => [level, (family ?? []).filter(f => f.difficulty === level)])
    .filter(([, rows]) => rows.length);

  return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-game-card flex flex-col">
      <header className="sticky top-safe z-10 bg-game-bg/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors active:scale-95">
            <span className="text-xl leading-none">←</span>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-1.5 text-game-gold font-bold text-lg">
            <span>🔍</span>
            <span>Word Search</span>
          </div>
          <RulesButton game="wordsearch" title="Word Search" />
        </div>
      </header>

      <div className="max-w-lg w-full mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-900 p-6 text-center shadow-xl">
          <div className="text-white/60 text-sm">{dayName}</div>
          <div className="text-6xl my-3">{theme.emoji}</div>
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wide">Today&apos;s theme</div>
          <div className="text-white text-2xl font-bold">{theme.name}</div>
          <div className="text-white/50 text-xs mt-3">Tomorrow: {tomorrow.emoji} {tomorrow.name}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Object.entries(DIFFICULTIES).map(([key, d]) => (
            <button key={key} onClick={() => setDifficulty(key)}
              className={`rounded-2xl p-3 text-center transition-all active:scale-95 ${
                difficulty === key ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              <div className="font-bold">{d.label}</div>
              <div className={`text-[11px] ${difficulty === key ? 'text-game-bg/70' : 'text-white/50'}`}>{d.size}×{d.size} • {d.note}</div>
              {myDaily[key] != null && <div className="text-xs font-semibold mt-1">✓ {formatTime(myDaily[key])}</div>}
            </button>
          ))}
        </div>

        {doneIn == null ? (
          <button onClick={onDaily}
            className="bg-game-gold text-game-bg font-bold py-4 rounded-2xl active:scale-95 transition-transform text-lg shadow-lg">
            Play Today&apos;s Puzzle
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-center text-white/70 text-sm">
              You finished today&apos;s {DIFFICULTIES[difficulty].label} puzzle in <span className="font-bold text-white">{formatTime(doneIn)}</span>. Come back tomorrow for a new one!
            </p>
            <button onClick={onAnother}
              className="bg-game-gold text-game-bg font-bold py-4 rounded-2xl active:scale-95 transition-transform text-lg shadow-lg">
              Play Another Puzzle
            </button>
          </div>
        )}

        <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
          <div className="text-white font-semibold mb-3">🏆 Today&apos;s family times</div>
          {family === null ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : byLevel.length === 0 ? (
            <p className="text-white/40 text-sm">No one has finished today&apos;s puzzle yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {byLevel.map(([level, rows]) => (
                <div key={level}>
                  <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">{DIFFICULTIES[level].label}</div>
                  <FamilyTimes rows={rows} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
