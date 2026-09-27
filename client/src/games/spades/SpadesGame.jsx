import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { WINNING_SCORE } from './spadesRules';
import { newGame, act, waitingFor, robotAction } from './spadesEngine';
import { SpadesTable } from './SpadesTable';
import api from '../../utils/api';

const NAMES = tableNames(4);
// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const BID_MS = 600, ROBOT_MS = 700, COLLECT_MS = 1300;

export default function SpadesGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame());          // Heraldo (on your right) deals first, so you bid and lead first
    setError('');
    posted.current = false;
  };

  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  // Computer players, and the pause that leaves a finished trick on the table
  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat != null && seat !== 0) {
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty))), game.phase === 'bidding' ? BID_MS : ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'spades', score: Math.max(0, game.scores[0]), difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="♠️" title="Spades" subtitle="Bid carefully — spades are always trump!"
        note={`You and Xavier (your partner) vs Phoebe and Heraldo · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-slate-900" tutorial={TUTORIALS.spades} onStart={startGame} />
    );
  }

  return (
    <SpadesTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
