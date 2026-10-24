import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useRobots, useRobotChatter } from '../useRobots';
import { ReactionBursts } from '../../components/Reactions';
import { Button } from '../../components/Button';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import { newGame, act, waitingFor, viewFor } from './mtgEngine';
import { robotAction } from './mtgAI';
import { DECKS } from './decks';
import { Symbol } from './CardFace';
import { MtgTable } from './MtgTable';
import api from '../../utils/api';

const ROBOT_MS = 900;
const DECK_KEY = 'mtg:deck';
const LEVELS = [['easy', '😊 Easy'], ['medium', '🤔 Medium'], ['hard', '🔥 Hard']];

const remembered = () => { try { return localStorage.getItem(DECK_KEY); } catch { return null; } };
const randomDeck = (not = null) => {
  const pool = DECKS.filter(d => d.id !== not);
  return pool[Math.floor(Math.random() * pool.length)].id;
};

export default function MtgGame() {
  const navigate = useNavigate();
  const robots = useRobots(2);
  const [difficulty, setDifficulty] = useState(null);
  const [myDeck, setMyDeck] = useState(() => (DECKS.some(d => d.id === remembered()) ? remembered() : 'green'));
  const [theirChoice, setTheirChoice] = useState('random');
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const reactions = useRobotChatter('mtg', game, robots.cast);
  const posted = useRef(false);

  const startGame = (diff, previous = null) => {
    setDifficulty(diff);
    try { localStorage.setItem(DECK_KEY, myDeck); } catch { /* private mode */ }
    const theirs = theirChoice === 'random' ? randomDeck(myDeck) : theirChoice;
    // In a rematch, whoever lost goes first
    const first = previous && previous.winner != null ? 1 - previous.winner : null;
    setGame(newGame({ decks: [myDeck, theirs], first, wins: previous?.wins }));
    setError('');
    posted.current = false;
  };

  const apply = action => {
    try {
      setGame(act(game, action));
      setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!game) return;
    if (waitingFor(game) === 1) {
      const timer = setTimeout(() => {
        try {
          setGame(act(game, robotAction(game, 1, difficulty, robots.styleOf(1))));
        } catch (e) {
          // Shouldn't happen; let the robot pass rather than get stuck
          console.error('Magic robot', e);
          try { setGame(act(game, { type: 'pass', seat: 1 })); } catch { setGame(act(game, { type: 'resign', seat: 1 })); }
        }
      }, ROBOT_MS);
      return () => clearTimeout(timer);
    }
    if (game.phase === 'gameOver' && !posted.current) {
      posted.current = true;
      const score = game.winner === 0 ? 100 + Math.max(0, game.seats[0].life) : 0;
      api.post('/scores', {
        game: 'mtg', score, difficulty,
        metadata: { result: game.winner === 0 ? 'win' : game.winner == null ? 'draw' : 'loss', reason: game.reason, deck: game.seats[0].deck, against: game.seats[1].deck },
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, difficulty]);

  const view = useMemo(() => game && viewFor(game, 0), [game]);

  if (!game) {
    return (
      <MtgSetup myDeck={myDeck} setMyDeck={setMyDeck} theirChoice={theirChoice} setTheirChoice={setTheirChoice}
        opponent={robots.who(1)} onStart={startGame} />
    );
  }

  return (
    <MtgTable view={view} names={robots.names} onAction={apply} onExit={() => navigate('/')} error={error} subtitle={difficulty}
      overlay={<ReactionBursts reactions={reactions} you={0} players={2} nameOf={seat => robots.names[seat]} />}
      gameOverActions={
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
            <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty, game)}>Play Again</Button>
          </div>
          <Button variant="ghost" onClick={() => setGame(null)}>Choose other decks</Button>
        </div>
      } />
  );
}

function Pips({ colors }) {
  return <span className="inline-flex gap-0.5">{colors.map(c => <Symbol key={c} sym={c} size={18} />)}</span>;
}

function MtgSetup({ myDeck, setMyDeck, theirChoice, setTheirChoice, opponent, onStart }) {
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);
  const deckButton = (d, selected, onPick) => (
    <button key={d.id} type="button" onClick={onPick}
      className={`text-left rounded-2xl p-3 border transition-all ${selected ? 'border-game-gold bg-white/15 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-white">{d.name}</span>
        <Pips colors={d.colors} />
      </div>
      <p className="text-white/55 text-xs mt-1 leading-snug">{d.blurb}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1b1424] to-[#0d1a14] p-4 md:p-6 flex flex-col">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-2 self-start min-h-[44px]">
        <ArrowLeft size={18} /> Back
      </button>
      <div className="max-w-3xl mx-auto w-full flex flex-col items-center">
        <div className="text-5xl mb-2">🧙</div>
        <h1 className="game-title text-3xl mb-1">Magic: The Gathering</h1>
        <p className="text-white/50 mb-4 text-center">Cast spells, summon creatures, and bring your opponent from 20 life to 0.</p>

        <h2 className="text-game-gold font-semibold self-start mb-2">Your deck</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mb-4">
          {DECKS.map(d => deckButton(d, d.id === myDeck, () => setMyDeck(d.id)))}
        </div>

        <label className="self-start text-sm text-white/70 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-game-gold font-semibold">Opponent's deck:</span>
          <select value={theirChoice} onChange={e => setTheirChoice(e.target.value)}
            className="bg-white/10 text-white rounded-lg px-2 py-1.5 border border-white/20">
            <option value="random" className="text-black">Surprise me</option>
            {DECKS.map(d => <option key={d.id} value={d.id} className="text-black">{d.name}</option>)}
          </select>
        </label>

        <p className="text-white/30 text-xs mb-2 text-center">You vs {opponent}</p>
        <div className="w-full max-w-sm space-y-3 mb-3">
          {LEVELS.map(([d, label]) => (
            <Button key={d} variant="primary" className="w-full text-lg" onClick={() => onStart(d)}>{label}</Button>
          ))}
        </div>
        <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm min-h-[44px]">
          <HelpCircle size={16} /> How to play
        </button>
        <p className="text-white/25 text-[10px] text-center mt-6 max-w-lg leading-snug">
          Magic: The Gathering is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards.
          Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </p>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Magic" slides={TUTORIALS.mtg} />
    </div>
  );
}
