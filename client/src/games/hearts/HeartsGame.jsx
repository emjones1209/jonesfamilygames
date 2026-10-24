import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { newGame, act, waitingOn, robotAction } from './heartsEngine';
import { HeartsTable } from './HeartsTable';
import api from '../../utils/api';

const ROBOT_MS = 700, COLLECT_MS = 1300;

export default function HeartsGame() {
  const navigate = useNavigate();
  const robots = useRobots(4);
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('hearts', game, robots.cast);
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

  // Computer players (they choose their passes while you choose yours), and the pause over a finished trick
  useEffect(() => {
    if (!game) return;
    const seat = waitingOn(game).find(x => x !== 0);
    if (seat != null) {
      const timer = setTimeout(() => apply(robotAction(game, seat, difficulty, robots.styleOf(seat))), ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'hearts', score: Math.max(0, 100 - game.totals[0]), difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="♥️" title="Hearts" subtitle="Avoid taking hearts and the Queen of Spades!"
        note={`You vs ${robots.who(1)}, ${robots.who(2)} and ${robots.who(3)}`}
        bgClass="from-game-bg to-red-900" tutorial={TUTORIALS.hearts} onStart={startGame} />
    );
  }

  return (
    <HeartsTable view={game} names={robots.names}
      overlay={<ReactionBursts reactions={reactions} you={0} players={4} nameOf={seat => robots.names[seat]} />} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => { robots.recast(); startGame(difficulty); }}>Play Again</Button>
        </div>
      } />
  );
}
