import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { GAME_TARGET } from './cribbageRules';
import { newGame, act, waitingOn, robotAction } from './cribbageEngine';
import { CribbageTable } from './CribbageTable';
import api from '../../utils/api';

// Pauses so you can follow the computer's moves
const THROW_MS = 700, PLAY_MS = 1000;

export default function CribbageGame() {
  const navigate = useNavigate();
  const robots = useRobots(2);
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('cribbage', game, robots.cast);
  const posted = useRef(false);
  // The latest game: you and Phoebe choose crib cards at the same time, so a move must
  // apply to whatever the other has just done
  const latest = useRef(null);

  const startGame = diff => {
    setDifficulty(diff);
    latest.current = newGame();   // Phoebe deals first (her crib), so you lead the first pegging
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

  useEffect(() => {
    if (!game) return;
    if (waitingOn(game).includes(1)) {
      const timer = setTimeout(() => apply(robotAction(game, 1, difficulty, robots.styleOf(1))), game.phase === 'discard' ? THROW_MS : PLAY_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      api.post('/scores', { game: 'cribbage', score: game.scores[0], difficulty, metadata: { won: game.winner === 0, them: game.scores[1], skunk: game.skunk } }).catch(() => {});
    }
  }, [game, difficulty, robots]);

  if (!game) {
    return (
      <GameSetup emoji="🎯" title="Cribbage" subtitle="Fifteen-two, fifteen-four… peg your way to 121!"
        note={`You vs ${robots.who(1)} · first to ${GAME_TARGET}`}
        bgClass="from-game-bg to-amber-950" tutorial={TUTORIALS.cribbage} onStart={startGame} />
    );
  }

  return (
    <CribbageTable view={game} names={robots.names}
      overlay={<ReactionBursts reactions={reactions} you={0} players={2} nameOf={seat => robots.names[seat]} />} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => { robots.recast(); startGame(difficulty); }}>Play Again</Button>
        </div>
      } />
  );
}
