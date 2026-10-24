import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { GAME_TARGET } from './pinochleRules';
import { newGame, act, waitingOn, robotAction } from './pinochleEngine';
import { PinochleTable } from './PinochleTable';
import api from '../../utils/api';

// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const BID_MS = 800, PASS_MS = 1000, ROBOT_MS = 700, COLLECT_MS = 1300;

export default function PinochleGame() {
  const navigate = useNavigate();
  const robots = useRobots(4);
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('pinochle', game, robots.cast);
  const posted = useRef(false);
  // Everyone looks at the meld at once, so a move must apply to the very latest game
  const latest = useRef(null);

  const startGame = diff => {
    setDifficulty(diff);
    latest.current = newGame();   // Heraldo (on your right) deals first, so you bid first
    setGame(latest.current);
    setError('');
    posted.current = false;
  };

  const apply = action => {
    try {
      latest.current = act(latest.current, action);
      setGame(latest.current);
      setError('');
    } catch (e) { setError(e.message); }
  };

  // Computer players, and the pause that leaves a finished trick on the table
  useEffect(() => {
    if (!game) return;
    const seat = waitingOn(game).find(x => x !== 0);
    if (seat != null && (game.phase !== 'meld' || game.ready[0])) {
      // (While everyone looks at the meld, the computer players wait until you're ready)
      const ms = game.phase === 'bidding' ? BID_MS : game.phase === 'playing' ? ROBOT_MS : PASS_MS;
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty), robots.styleOf(seat))), ms);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'pinochle', score: Math.max(0, game.scores[0]), difficulty }).catch(() => {});
    }
  }, [game, difficulty, robots]);

  if (!game) {
    return (
      <GameSetup emoji="💍" title="Pinochle" subtitle="Bid, meld and take the tricks that count"
        note={`You and ${robots.who(2)}, your partner, vs ${robots.who(1)} and ${robots.who(3)} · first team to ${GAME_TARGET.toLocaleString()}`}
        bgClass="from-game-bg to-emerald-950" tutorial={TUTORIALS.pinochle} onStart={startGame} />
    );
  }

  return (
    <PinochleTable view={game} names={robots.names}
      overlay={<ReactionBursts reactions={reactions} you={0} players={4} nameOf={seat => robots.names[seat]} />} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => { robots.recast(); startGame(difficulty); }}>Play Again</Button>
        </div>
      } />
  );
}
