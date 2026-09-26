import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import { newGame, act, waitingFor, robotAction } from './trainEngine';
import { TrainTable } from './TrainTable';
import api from '../../utils/api';

const NAMES_FOR = { 2: ['You', 'Computer'], 3: ['You', 'Left', 'Right'], 4: ['You', 'Left', 'Across', 'Right'] };
const LENGTHS = [[13, 'Full game (13 rounds)'], [7, 'Half game (7 rounds)'], [3, 'Quick game (3 rounds)']];
const AI_MS = 900;

export default function MexicanTrainGame() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ players: 4, rounds: 13 });
  const [difficulty, setDifficulty] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  const names = NAMES_FOR[settings.players];

  const startGame = diff => {
    setDifficulty(diff);
    setGame(newGame(settings));
    setError('');
  };

  // Apply a move to the current game; a refused move explains why
  const apply = action => {
    try { setGame(act(game, action)); setError(''); } catch (e) { setError(e.message); }
  };

  // Computer turns, and the score at the end of the game
  useEffect(() => {
    if (!game) return;
    const seat = waitingFor(game);
    if (seat != null && seat !== 0) {
      const timer = setTimeout(() => apply(robotAction(game, seat, difficulty)), AI_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver') api.post('/scores', { game: 'train', score: -game.totals[0], difficulty }).catch(() => {});   // negated: low scores rank high
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  // ── Setup ────────────────────────────────────────────────────────────────
  if (!difficulty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-sky-900 p-5 flex flex-col">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6 self-start min-h-[44px]">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <div className="text-6xl mb-3">🚂</div>
          <h1 className="game-title text-3xl mb-2">Mexican Train</h1>
          <p className="text-white/50 mb-5 text-center">Dominoes — play out your tiles, lowest score wins!</p>
          <p className="text-white/60 text-sm mb-2">Players (including you)</p>
          <div className="flex gap-3 mb-4">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setSettings(s => ({ ...s, players: n }))}
                className={`w-14 h-14 rounded-2xl font-bold text-xl border-2 ${settings.players === n ? 'border-game-gold bg-white/20 text-white' : 'border-white/20 bg-white/5 text-white/60'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="w-full space-y-2 mb-5">
            {LENGTHS.map(([n, text]) => (
              <button key={n} onClick={() => setSettings(s => ({ ...s, rounds: n }))}
                className={`w-full rounded-xl py-2 text-sm border-2 ${settings.rounds === n ? 'border-game-gold bg-white/20 text-white' : 'border-white/20 bg-white/5 text-white/60'}`}>
                {text}
              </button>
            ))}
          </div>
          <div className="w-full space-y-3">
            {[['easy', '😊 Easy'], ['medium', '🤔 Medium'], ['hard', '🔥 Hard']].map(([d, l]) => (
              <Button key={d} variant="primary" className="w-full text-lg" onClick={() => startGame(d)}>{l}</Button>
            ))}
          </div>
          <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mt-4 min-h-[44px]">
            <HelpCircle size={16} /> How to play
          </button>
        </div>
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Mexican Train" slides={TUTORIALS.train} />
      </div>
    );
  }
  if (!game) return null;

  return (
    <TrainTable view={game} names={names} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
          <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
        </div>
      } />
  );
}
