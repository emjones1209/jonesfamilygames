import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import { useAuth } from '../../context/AuthContext';
import { newGame, act, waitingFor, robotAction } from './chessEngine';
import { ChessTable } from './ChessTable';
import { LESSONS, loadDone } from './chessLessonData';
import api from '../../utils/api';

const NAMES = tableNames(2);
const ROBOT_MS = 500;
const LEVELS = [
  ['easy', '😊 Easy', 'Looks one move ahead — best for learning'],
  ['medium', '🤔 Medium', 'Looks two moves ahead'],
  ['hard', '🔥 Hard', 'Thinks much further ahead'],
];

export default function ChessGame() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [history, setHistory] = useState([]);      // the game before each of your moves, for Undo
  const [error, setError] = useState('');
  const [tutorial, setTutorial] = useState(false);
  const posted = useRef(false);
  const lessonsDone = loadDone(user).length;

  const startGame = (diff, from = null) => {
    setDifficulty(diff);
    setGame(from ? act(from, { type: 'newGame' }) : newGame());   // you're White in the first game, then colours swap
    setHistory([]);
    setError('');
    posted.current = false;
  };

  const apply = action => {
    try {
      const next = act(game, action);
      if (action.type === 'move' && action.seat === 0) setHistory(h => [...h, game]);
      setGame(next);
      setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!game) return;
    if (waitingFor(game) === 1) {
      const timer = setTimeout(() => apply(robotAction(game, 1, difficulty)), ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      const result = game.winner === 0 ? 'win' : game.winner == null ? 'draw' : 'loss';
      const score = result === 'win' ? Math.max(20, 200 - game.history.length) : result === 'draw' ? 50 : 0;
      api.post('/scores', { game: 'chess', score, difficulty, metadata: { result, reason: game.reason, moves: game.history.length } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-emerald-950 p-5 flex flex-col">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6 self-start min-h-[44px]">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full gap-3">
          <div className="text-6xl">♟️</div>
          <h1 className="game-title text-3xl">Chess</h1>
          <p className="text-white/50 text-center">Trap the enemy king to win!</p>
          <button onClick={() => navigate('/games/chess/learn')}
            className="w-full mt-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-left active:scale-95 transition-transform shadow-lg">
            <div className="text-white font-bold text-lg">📚 Learn to Play</div>
            <div className="text-white/70 text-sm">
              {lessonsDone ? `${lessonsDone} of ${LESSONS.length} lessons done — carry on` : `New to chess? Start here: ${LESSONS.length} short lessons`}
            </div>
          </button>
          <p className="text-white/40 text-xs mt-3">Play the computer (you&apos;re White first, then colours swap):</p>
          {LEVELS.map(([d, label, note]) => (
            <Button key={d} variant="primary" className="w-full text-lg" onClick={() => startGame(d)}>
              {label}<span className="block text-xs font-normal opacity-70">{note}</span>
            </Button>
          ))}
          <button onClick={() => setTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm min-h-[44px]">
            <HelpCircle size={16} /> How the pieces move
          </button>
        </div>
        <TutorialModal isOpen={tutorial} onClose={() => setTutorial(false)} title="Chess" slides={TUTORIALS.chess} />
      </div>
    );
  }

  const undo = {
    enabled: history.length > 0 && waitingFor(game) === 0,
    run: () => { setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setError(''); },
  };

  return (
    <ChessTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      onUndo={undo} onLearn={() => navigate('/games/chess/learn')}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty, game)}>Play Again</Button>
        </div>
      } />
  );
}
