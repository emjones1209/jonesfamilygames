/**
 * GameShell — wraps all games with consistent layout:
 * back button, game title, score/time display.
 */
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GameShell({ title, emoji, score, time, difficulty, children, bgClass = 'bg-game-bg' }) {
  const navigate = useNavigate();
  return (
    <div className={`min-h-screen ${bgClass} flex flex-col`}>
      <header className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-white/50 hover:text-white transition-colors p-1"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Home</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-white font-semibold text-sm">{title}</span>
          {difficulty && <span className="text-white/40 text-xs capitalize">({difficulty})</span>}
        </div>
        <div className="flex items-center gap-3">
          {score != null && (
            <div className="flex items-center gap-1 text-game-gold text-sm font-bold">
              <Trophy size={14} /> {score.toLocaleString()}
            </div>
          )}
          {time != null && (
            <div className="flex items-center gap-1 text-white/50 text-sm">
              <Clock size={14} /> {formatTime(time)}
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
