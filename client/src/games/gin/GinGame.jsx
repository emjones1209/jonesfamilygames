import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { GAME_TARGET } from './ginRules';
import { newGame, act, waitingFor, robotAction } from './ginEngine';
import { GinTable } from './GinTable';
import api from '../../utils/api';

const NAMES = tableNames(2);
// A computer turn is two steps (draw, then discard); the pause lets you see each one
const DRAW_MS = 900, DISCARD_MS = 1100;

export default function GinGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame());          // Phoebe deals first, so you get the first chance at the face-up card
    setError('');
    posted.current = false;
  };

  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat === 1) {
      const timer = setTimeout(() => apply(robotAction(game, 1, difficulty)), game.phase === 'discard' ? DISCARD_MS : DRAW_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'gin', score: game.final[0], difficulty, metadata: { won: game.winner === 0, them: game.final[1] } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="🎴" title="Gin Rummy" subtitle="Make runs and sets, then knock!"
        note={`You vs Phoebe · first to ${GAME_TARGET}`}
        bgClass="from-game-bg to-indigo-950" tutorial={TUTORIALS.gin} onStart={startGame} />
    );
  }

  return (
    <GinTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
