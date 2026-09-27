import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { total } from './diceRules';
import { newGame, act, waitingFor, robotAction } from './diceEngine';
import { DiceTable } from './DiceTable';
import api from '../../utils/api';

const NAMES = tableNames(2);             // you and Phoebe
const ROBOT_MS = 1600;                   // a computer step (roll, keep, score) — slow enough to follow

export default function DiceGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame({ players: 2 }));
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
      const timer = setTimeout(() => apply(robotAction(game, seat, difficulty)), ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'dice', score: total(game.cards[0]), difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="🎲" title="Five Dice" subtitle={`Roll, hold and fill your scorecard — beat ${NAMES[1]}!`}
        note="Three rolls a turn · 13 turns each" bgClass="from-game-bg to-rose-900" tutorial={TUTORIALS.dice} onStart={startGame} />
    );
  }

  return (
    <DiceTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
