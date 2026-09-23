/**
 * GameSetup — start screen shared by the card games: title, difficulty
 * buttons and a "How to play" tutorial.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { TutorialModal } from '../../components/TutorialModal';

const LEVELS = [['easy', '😊 Easy'], ['medium', '🤔 Medium'], ['hard', '🔥 Hard']];

export function GameSetup({ emoji, title, subtitle, note, bgClass, tutorial, onStart }) {
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgClass} p-5 flex flex-col`}>
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6 self-start min-h-[44px]">
        <ArrowLeft size={18} /> Back
      </button>
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-3">{emoji}</div>
        <h1 className="game-title text-3xl mb-2">{title}</h1>
        <p className="text-white/50 mb-1 text-center">{subtitle}</p>
        {note && <p className="text-white/30 text-xs mb-2 text-center">{note}</p>}
        <div className="w-full space-y-3 mt-6 mb-4">
          {LEVELS.map(([d, label]) => (
            <Button key={d} variant="primary" className="w-full text-lg" onClick={() => onStart(d)}>{label}</Button>
          ))}
        </div>
        {tutorial && (
          <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm min-h-[44px]">
            <HelpCircle size={16} /> How to play
          </button>
        )}
      </div>
      {tutorial && (
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title={title} slides={tutorial} />
      )}
    </div>
  );
}

/** Centered result panel used for "hand over" / "game over" overlays. */
export function ResultPanel({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="card-panel text-center max-w-sm w-full">{children}</div>
    </div>
  );
}
