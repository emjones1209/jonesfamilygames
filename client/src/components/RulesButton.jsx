/**
 * RulesButton — a "Rules" button for in-game headers. Opens a scrollable
 * review of the game's rules (all of its "How to play" slides on one page),
 * so players can check a rule mid-game without losing their place.
 */
import { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { TUTORIALS } from './tutorials';

export function RulesButton({ game, title, className = '' }) {
  const [open, setOpen] = useState(false);
  const slides = TUTORIALS[game] ?? [];
  if (!slides.length) return null;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold min-h-[36px] shrink-0 ${className}`}>
        <BookOpen size={14} /> Rules
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="bg-game-card border border-white/10 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
              <span className="text-white font-semibold">{title} — Rules</span>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-2" aria-label="Close rules">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              {slides.map(s => (
                <section key={s.heading}>
                  <h3 className="text-game-gold font-bold mb-1">{s.emoji} {s.heading}</h3>
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
                </section>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-white/10">
              <button onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 min-h-[44px]">
                Back to the game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
