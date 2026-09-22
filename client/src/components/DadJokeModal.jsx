import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { Button } from './Button';

export function DadJokeModal({ isOpen, onClose }) {
  const [joke, setJoke] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [reaction, setReaction] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRevealed(false);
      setReaction(null);
      api.get('/dad-jokes/random')
        .then(({ data }) => setJoke(data))
        .catch(() => setJoke({ joke: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md bg-gradient-to-br from-game-gold/20 to-game-card rounded-3xl shadow-2xl p-8 text-center border border-game-gold/30"
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      >
        <div className="text-5xl mb-4">😄</div>
        <div className="text-sm font-semibold text-game-gold uppercase tracking-widest mb-4">
          Dad Joke Break!
        </div>

        {joke && (
          <>
            <p className="text-white text-lg font-medium leading-relaxed mb-6">
              {joke.joke}
            </p>

            <AnimatePresence>
              {!revealed ? (
                <Button
                  key="reveal"
                  variant="gold"
                  className="w-full mb-4"
                  onClick={() => setRevealed(true)}
                >
                  Reveal Punchline 🥁
                </Button>
              ) : (
                <motion.div
                  key="punchline"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-game-gold text-xl font-bold leading-relaxed mb-6">
                    {joke.punchline}
                  </p>

                  {!reaction ? (
                    <div className="flex gap-3 justify-center mb-4">
                      <Button variant="ghost" onClick={() => setReaction('groan')} className="flex-1 text-2xl">
                        😒 Groan
                      </Button>
                      <Button variant="ghost" onClick={() => setReaction('laugh')} className="flex-1 text-2xl">
                        😂 Ha!
                      </Button>
                    </div>
                  ) : (
                    <p className="text-white/60 text-sm mb-4">
                      {reaction === 'groan' ? "Dad approved! 😎" : "A fellow comedy genius! 🎭"}
                    </p>
                  )}

                  <Button variant="primary" className="w-full" onClick={onClose}>
                    Back to the Game!
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
