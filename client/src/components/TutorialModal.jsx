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

// ── Tutorial content for each game ────────────────────────────────────────────

export const TUTORIALS = {
  trivia: [
    { emoji: '🎯', heading: 'How to Play Trivia', body: 'Answer multiple-choice questions by tapping your answer. Each correct answer earns points based on difficulty.' },
    { emoji: '🔥', heading: 'Streak Bonus', body: 'Get 3 or more correct answers in a row to earn a 1.5× streak bonus on every subsequent correct answer!' },
    { emoji: '⏱️', heading: 'The Timer', body: 'A timer counts down for each question — it\'s just a hint, not a deadline. Take your time and choose wisely.' },
    { emoji: '⭐', heading: 'Difficulty Levels', body: 'Easy: basic knowledge\nMedium: moderate challenge\nHard: deep expertise required (biblical scholars beware — these are tough!)' },
  ],
  solitaire: [
    { emoji: '🃏', heading: 'Goal', body: 'Move all 52 cards to the four foundation piles, one per suit, from Ace up to King.' },
    { emoji: '📐', heading: 'Tableau Rules', body: 'Build columns in descending order, alternating red/black colors. Only Kings may be placed on empty columns.' },
    { emoji: '👆', heading: 'Moving Cards', body: 'Tap a card to select it (highlighted), then tap the destination. Or drag-and-drop cards directly to where you want them!' },
    { emoji: '🃏', heading: 'Stock Pile', body: 'Tap the face-down stock pile to flip cards to the waste. When stock is empty, tap it again to recycle the waste.' },
    { emoji: '✨', heading: 'Auto-Move', body: 'Tap "Auto-Move to Foundation" at the bottom to automatically send any eligible cards to the foundations.' },
  ],
  hearts: [
    { emoji: '♥️', heading: 'Goal', body: 'Avoid taking tricks that contain hearts (1 point each) or the Queen of Spades (13 points). Lowest score wins!' },
    { emoji: '🃏', heading: 'Passing Phase', body: 'At the start of each round, pass 3 cards to another player. Plan your hand carefully!' },
    { emoji: '🎮', heading: 'Playing Tricks', body: 'Follow the lead suit if you can. If you can\'t follow suit, play any card. Highest card of the lead suit wins the trick.' },
    { emoji: '🌙', heading: 'Shoot the Moon', body: 'Take ALL hearts plus the Queen of Spades to "shoot the moon" — all other players get 26 points instead!' },
    { emoji: '🚫', heading: 'Breaking Hearts', body: 'You cannot lead with a heart until hearts have been "broken" (played on a previous trick).' },
  ],
  spades: [
    { emoji: '♠️', heading: 'Goal', body: 'Work with your partner to win at least as many tricks as you bid. Spades are always trump.' },
    { emoji: '🤔', heading: 'Bidding', body: 'Before playing, bid how many tricks you expect to win. You and your partner\'s bids are combined. Bid "Nil" to attempt zero tricks for a big bonus.' },
    { emoji: '🎮', heading: 'Playing', body: 'Follow the lead suit if possible. Spades beat all other suits. Highest card of the lead suit wins (or highest spade if any were played).' },
    { emoji: '📊', heading: 'Scoring', body: 'Making your bid = 10× bid points. Over-tricks (bags) = 1 point each, but 10 bags = −100 penalty. Nil bid success = +100, failure = −100.' },
  ],
  golf6: [
    { emoji: '⛳', heading: 'Goal', body: 'Achieve the lowest score possible! Unlike most card games — in Golf, low score wins.' },
    { emoji: '🃏', heading: 'Setup', body: 'Each player gets 6 face-down cards in a 2×3 grid. You may peek at 2 of your cards before play begins.' },
    { emoji: '🔄', heading: 'Your Turn', body: 'Draw from the deck or discard pile. You may swap any drawn card with one of your 6 grid cards (which flips face-up). Or discard the drawn card.' },
    { emoji: '🔢', heading: 'Scoring', body: 'Face value for 3-10 • Ace=1 • 2s=−2 • Jokers=−3 • Face cards=10 • A matching pair in a column = 0 points for that column!' },
  ],
  rook: [
    { emoji: '🐦', heading: 'Goal', body: 'Win the bid and capture at least your bid amount in points. Points come from counting cards (1s, 5s, 10s, 14s = 5 pts each, Rook = 20 pts).' },
    { emoji: '🃏', heading: 'The Deck', body: 'Rook uses cards numbered 1-14 in 4 colors (Black, Red, Green, Yellow) plus the Rook Bird card (a powerful trump card).' },
    { emoji: '💰', heading: 'The Nest', body: '5 cards are set aside in the "nest." The winning bidder swaps cards with the nest and declares trump.' },
    { emoji: '🏆', heading: 'Bidding', body: 'Bid points (70-120+) to win the nest. The Rook Bird always belongs to the trump suit and beats all other cards.' },
  ],
  bridge: [
    { emoji: '🃏', heading: 'Goal', body: 'As declarer, win at least as many tricks as your contract. As defenders, stop the declarer from making their contract.' },
    { emoji: '🗣️', heading: 'Bidding', body: 'Bid the number of tricks ABOVE 6 you expect to win, plus a suit (or NoTrump). The highest bid becomes the contract.' },
    { emoji: '🤝', heading: 'Dummy', body: 'After the opening lead, declarer\'s partner (dummy) places their hand face-up. Declarer plays both their own hand and dummy\'s.' },
    { emoji: '📊', heading: 'Scoring', body: 'Making your contract earns points based on suit and level. Overtricks, slams, and doubled contracts add bonuses. Failing the contract gives the opponents points.' },
  ],
  jigsaw: [
    { emoji: '🧩', heading: 'Goal', body: 'Assemble all the puzzle pieces to recreate the original photo. Choose a photo from your library to get started!' },
    { emoji: '📸', heading: 'Choose a Photo', body: 'Tap "Choose Photo" to select any image from your device. The puzzle will be cut from that image.' },
    { emoji: '🖐️', heading: 'Placing Pieces', body: 'Drag and drop pieces anywhere on the board. When a piece is within 40px of its correct position, it will snap into place automatically.' },
    { emoji: '🎚️', heading: 'Difficulty', body: 'Easy: 12 pieces • Medium: 30 pieces • Hard: 80 pieces. Harder difficulties have more, smaller pieces!' },
  ],
  match3: [
    { emoji: '🌸', heading: 'Goal', body: 'Match 3 or more flowers of the same type in a row or column to clear them and score points. Complete the level goal before you run out of moves!' },
    { emoji: '✨', heading: 'Special Tiles', body: '🌟 Match 4 in a row = star (clears entire row)\n💧 Match 4 in an L = water drop (clears column)\n☀️ Match 5 = sunflower (clears 3×3 area)' },
    { emoji: '🪨', heading: 'Blockers', body: 'Gray blocker tiles cannot be matched directly. Make matches ADJACENT to a blocker to damage it. Two hits destroys it.' },
    { emoji: '🎯', heading: 'Level Goals', body: 'Score: reach the target score\nCollect: match a specific flower enough times\nClear: destroy all blocker tiles\n\nEach goal type requires different strategy!' },
  ],
};
