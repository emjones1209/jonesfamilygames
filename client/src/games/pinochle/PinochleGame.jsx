import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableNames } from '../players';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup } from '../cards/GameSetup';
import { GAME_TARGET } from './pinochleRules';
import { newGame, act, waitingOn, robotAction } from './pinochleEngine';
import { PinochleTable } from './PinochleTable';
import api from '../../utils/api';

const NAMES = tableNames(4);
// Your partner always plays its best (Hard), so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'hard' : difficulty);
const BID_MS = 800, PASS_MS = 1000, ROBOT_MS = 700, COLLECT_MS = 1300;

export default function PinochleGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
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
      const timer = setTimeout(() => apply(robotAction(game, seat, levelFor(seat, difficulty))), ms);
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
  }, [game, difficulty]);

  if (!game) {
    return (
      <GameSetup emoji="💍" title="Pinochle" subtitle="Bid, meld and take the tricks that count"
        note={`You and Xavier (your partner) vs Phoebe and Heraldo · first team to ${GAME_TARGET.toLocaleString()}`}
        bgClass="from-game-bg to-emerald-950" tutorial={TUTORIALS.pinochle} onStart={startGame} />
    );
  }

  return (
    <PinochleTable view={game} names={NAMES} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
