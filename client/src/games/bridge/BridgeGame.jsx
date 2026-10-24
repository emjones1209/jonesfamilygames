import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { newGame, act, waitingFor, robotAction } from './bridgeEngine';
import { BridgeTable } from './BridgeTable';
import api from '../../utils/api';

// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const BID_MS = 700, ROBOT_MS = 700, COLLECT_MS = 1300;

export default function BridgeGame() {
  const navigate = useNavigate();
  const robots = useRobots(4);
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('bridge', game, robots.cast);
  const posted = useRef(-1);             // the hand whose score was last posted

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame());
    setError('');
  };

  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  // Computer players (a computer declarer plays dummy's cards too), and the pause over a finished trick
  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat != null && seat !== 0) {
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty), robots.styleOf(seat))), game.phase === 'bidding' ? BID_MS : ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'playing' && game.table.status === 'collecting') {
      const timer = setTimeout(() => apply({ type: 'collect' }), COLLECT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'handOver' && !game.result.passedOut && posted.current !== game.handNo) {
      posted.current = game.handNo;
      api.post('/scores', { game: 'bridge', score: game.scores.ns, difficulty }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="🌉" title="Bridge" subtitle="Contract bridge with bidding."
        note={`You play South with North (${robots.who(2)}) as your partner, against ${robots.who(1)} and ${robots.who(3)}. The deal rotates each hand.`}
        bgClass="from-game-bg to-teal-900" tutorial={TUTORIALS.bridge} onStart={startGame} />
    );
  }

  return <BridgeTable view={game} names={robots.names}
      overlay={<ReactionBursts reactions={reactions} you={0} players={4} nameOf={seat => robots.names[seat]} />} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty} />;
}
