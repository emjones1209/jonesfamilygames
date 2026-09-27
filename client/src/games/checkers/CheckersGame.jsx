import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { newGame, act, waitingFor, robotAction, pieces } from './checkersEngine';
import { CheckersTable } from './CheckersTable';
import api from '../../utils/api';

const NAMES = tableNames(2);
const ROBOT_MS = 600;

export default function CheckersGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [history, setHistory] = useState([]);      // the game before each of your moves, for Undo
  const [error, setError] = useState('');
  const posted = useRef(false);

  const startGame = (diff, from = null) => {
    setDifficulty(diff);
    setGame(from ? act(from, { type: 'newGame' }) : newGame());   // you're Black (first) in the first game, then colours swap
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
      const left = pieces(game)[0];
      const score = game.winner === 0 ? 100 + 10 * (left.men + left.kings) : game.winner == null ? 50 : 0;
      api.post('/scores', { game: 'checkers', score, difficulty, metadata: { result: game.winner === 0 ? 'win' : game.winner == null ? 'draw' : 'loss', reason: game.reason } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="⚫" title="Checkers" subtitle="Jump your way to a king!"
        note="You vs Phoebe · you play Black and move first"
        bgClass="from-game-bg to-amber-950" tutorial={TUTORIALS.checkers} onStart={startGame} />
    );
  }

  const undo = {
    enabled: history.length > 0 && waitingFor(game) === 0,
    run: () => { setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setError(''); },
  };

  return (
    <CheckersTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      onUndo={undo}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty, game)}>Play Again</Button>
        </div>
      } />
  );
}
