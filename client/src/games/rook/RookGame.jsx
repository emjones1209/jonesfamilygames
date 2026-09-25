import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { WINNING_SCORE } from './rookRules';
import { newGame, act, waitingFor, robotAction } from './rookEngine';
import { RookTable } from './RookTable';
import api from '../../utils/api';

const NAMES = ['You', 'Left', 'Partner', 'Right'];
// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const ROBOT_MS = 700, COLLECT_MS = 1300;

export default function RookGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame());
    setError('');
    posted.current = false;
  };

  // Apply a move to the current game; a refused move explains why
  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  // Computer players, and the pause that leaves a finished trick on the table
  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat != null && seat !== 0) {
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty))), ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && game.winner === 0 && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'rook', score: game.scores[0], difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="🐦" title="Rook" subtitle="Bid, name trump, and capture the counters!"
        note={`You and Partner vs Left and Right · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-orange-900" tutorial={TUTORIALS.rook} onStart={startGame} />
    );
  }

  return (
    <RookTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
