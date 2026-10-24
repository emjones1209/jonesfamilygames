import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { WINNING_SCORE } from './euchreRules';
import { newGame, act, waitingFor, robotAction } from './euchreEngine';
import { EuchreTable } from './EuchreTable';
import api from '../../utils/api';

// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const BID_MS = 900, ROBOT_MS = 700, COLLECT_MS = 1300;

export default function EuchreGame() {
  const navigate = useNavigate();
  const robots = useRobots(4);
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('euchre', game, robots.cast);
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame());          // Heraldo (on your right) deals first, so you speak and lead first
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
      const slow = game.phase === 'bidding' || game.phase === 'discard';
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty), robots.styleOf(seat))), slow ? BID_MS : ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'euchre', score: game.scores[0], difficulty, metadata: { won: game.winner === 0, them: game.scores[1] } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="♦️" title="Euchre" subtitle="Name trump, then take 3 of the 5 tricks!"
        note={`You and ${robots.who(2)}, your partner, vs ${robots.who(1)} and ${robots.who(3)} · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-rose-950" tutorial={TUTORIALS.euchre} onStart={startGame} />
    );
  }

  return (
    <EuchreTable view={game} names={robots.names}
      overlay={<ReactionBursts reactions={reactions} you={0} players={4} nameOf={seat => robots.names[seat]} />} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => { robots.recast(); startGame(difficulty); }}>Play Again</Button>
        </div>
      } />
  );
}
