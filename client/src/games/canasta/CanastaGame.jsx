import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { WINNING_SCORE } from './canastaRules';
import { newGame, act, waitingFor, robotAction } from './canastaEngine';
import { CanastaTable } from './CanastaTable';
import api from '../../utils/api';

const NAMES = tableNames(4);
// Your partner always plays at Medium, so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'medium' : difficulty);
// Computer turns go slowly enough to read: a pause before drawing, then each meld or discard in turn
const THINK_MS = 1500, STEP_MS = 2200;

export default function CanastaGame() {
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

  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  // Computer turns, one visible step at a time
  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat != null && seat !== 0) {
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty))), game.phase === 'draw' ? THINK_MS : STEP_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'canasta', score: Math.max(0, game.scores[0]), difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="♣️" title="Canasta" subtitle="Meld sets, build canastas and go out first!"
        note={`You and Xavier (your partner) vs Phoebe and Heraldo · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-emerald-900" tutorial={TUTORIALS.canasta} onStart={startGame} />
    );
  }

  return (
    <CanastaTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
