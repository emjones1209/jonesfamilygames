import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

/**
 * TutorialModal — multi-slide tutorial overlay
 * Props:
 *   isOpen: bool
 *   onClose: fn
 *   title: string  (game name)
 *   slides: [{ heading, body, emoji? }]
 */
export function TutorialModal({ isOpen, onClose, title, slides = [] }) {
  const [idx, setIdx] = useState(0);

  if (!isOpen || slides.length === 0) return null;

  const slide = slides[idx];
  const isFirst = idx === 0;
  const isLast  = idx === slides.length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-game-card border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
              <span className="text-white/50 text-sm font-medium">{title} — How to Play</span>
              <button onClick={() => { setIdx(0); onClose(); }} className="text-white/40 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Slide content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-6 py-5 min-h-[200px] flex flex-col items-center justify-center text-center"
              >
                {slide.emoji && <div className="text-5xl mb-3">{slide.emoji}</div>}
                <h3 className="text-white font-bold text-lg mb-2">{slide.heading}</h3>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{slide.body}</p>
              </motion.div>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 pb-3">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-primary-400' : 'bg-white/20'}`}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-3 px-5 pb-5">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={isFirst}
                className="p-2 rounded-xl bg-white/10 text-white disabled:opacity-30">
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 text-center text-white/40 text-xs">
                {idx + 1} / {slides.length}
              </div>
              {isLast ? (
                <Button variant="primary" className="px-4 py-2 text-sm" onClick={() => { setIdx(0); onClose(); }}>
                  Got it! 🎮
                </Button>
              ) : (
                <button onClick={() => setIdx(i => Math.min(slides.length - 1, i + 1))}
                  className="p-2 rounded-xl bg-primary-600 text-white">
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
