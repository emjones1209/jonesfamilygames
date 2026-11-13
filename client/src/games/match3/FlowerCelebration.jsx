import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../../components/Button';
import { FLOWERS } from './match3Logic';

// Between levels, the garden's flowers put on a little show. Each level gets
// the next show in turn, so two wins in a row never look the same.

// Flowers grow up out of the ground on stems, then sway in the breeze
function Bloom() {
  const row = [...FLOWERS, FLOWERS[0]];
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-around items-end px-4">
      {row.map((f, i) => {
        const tall = 70 + ((i * 37) % 50);   // a mix of heights
        return (
          <motion.div key={i} className="flex flex-col items-center origin-bottom"
            animate={{ rotate: [0, 6, 0, -6, 0] }}
            transition={{ delay: 1 + i * 0.15, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
            <motion.span className="text-4xl leading-none"
              initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 260, damping: 12 }}>
              {f}
            </motion.span>
            <motion.div className="w-1.5 bg-green-500 rounded-full origin-bottom relative"
              style={{ height: tall }}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.15, duration: 0.5, ease: 'easeOut' }}>
              <span className="absolute top-1/2 -left-2.5 text-sm" style={{ transform: 'rotate(-30deg)' }}>🍃</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Flowers flutter down from the sky, spinning as they fall
function Shower() {
  const drops = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    f: FLOWERS[i % FLOWERS.length],
    left: Math.random() * 92,
    delay: Math.random() * 2.5,
    dur: 2.2 + Math.random() * 1.6,
    spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
    drift: (Math.random() - 0.5) * 60,
    size: 1.5 + Math.random() * 1.2,
  })), []);
  return drops.map((d, i) => (
    <motion.span key={i} className="absolute top-0 leading-none"
      style={{ left: `${d.left}%`, fontSize: `${d.size}rem` }}
      initial={{ y: -50, x: 0, rotate: 0, opacity: 0 }}
      animate={{ y: 240, x: [0, d.drift, -d.drift / 2, d.drift], rotate: d.spin, opacity: [0, 1, 1, 0] }}
      transition={{ delay: d.delay, duration: d.dur, repeat: Infinity, ease: 'linear' }}>
      {d.f}
    </motion.span>
  ));
}

// A bouquet bursts open from the middle, then the ring of flowers twirls
function Burst() {
  const ring = [...FLOWERS, ...FLOWERS];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div className="relative w-0 h-0"
        animate={{ rotate: 360 }}
        transition={{ delay: 1, duration: 8, repeat: Infinity, ease: 'linear' }}>
        {ring.map((f, i) => {
          const a = (i / ring.length) * Math.PI * 2;
          return (
            <motion.span key={i} className="absolute text-3xl leading-none -translate-x-1/2 -translate-y-1/2"
              initial={{ x: 0, y: 0, scale: 0 }}
              animate={{ x: Math.cos(a) * 85, y: Math.sin(a) * 85, scale: [0, 1.4, 1] }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.7, ease: 'easeOut' }}>
              {f}
            </motion.span>
          );
        })}
      </motion.div>
      <motion.span className="absolute text-6xl leading-none"
        initial={{ scale: 1.6 }} animate={{ scale: [1.6, 0.6, 1, 1.12, 1] }}
        transition={{ duration: 1.2, times: [0, 0.3, 0.6, 0.8, 1] }}>
        💐
      </motion.span>
    </div>
  );
}

// The flowers march across in a hopping parade, led by a bee
function Parade() {
  const line = ['🐝', ...FLOWERS];
  return (
    <motion.div className="absolute bottom-10 flex gap-3"
      initial={{ x: '-110%', left: 0 }} animate={{ x: '0%', left: '100%' }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
      {line.reverse().map((f, i) => (
        <motion.span key={i} className="text-4xl leading-none inline-block"
          animate={{ y: [0, -28, 0], rotate: [0, -12, 0, 12, 0], scaleY: [1, 1.08, 0.85, 1] }}
          transition={{ delay: i * 0.12, duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}>
          {f}
        </motion.span>
      ))}
    </motion.div>
  );
}

// Each flower takes a turn springing up and spinning, like a wave through the crowd
function Wave() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-1">
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="text-4xl sm:text-5xl leading-none inline-block"
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, 0, -50, 0, 0], rotate: [0, 0, 360, 360, 360] }}
          transition={{
            scale: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 14 },
            default: { delay: 0.6 + i * 0.18, duration: 2.2, times: [0, 0.1, 0.35, 0.55, 1], repeat: Infinity, ease: 'easeInOut' },
          }}>
          {f}
        </motion.span>
      ))}
    </div>
  );
}

export const SHOWS = [
  { title: 'The garden is in bloom!', Show: Bloom },
  { title: "It's raining flowers!",  Show: Shower },
  { title: 'Bouquet burst!',          Show: Burst },
  { title: 'Flower parade!',          Show: Parade },
  { title: 'Doing the flower wave!',  Show: Wave },
];

export function FlowerCelebration({ isOpen, levelId, score, onClose }) {
  const reduceMotion = useReducedMotion();
  if (!isOpen) return null;
  const { title, Show } = SHOWS[(levelId - 1) % SHOWS.length];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-full max-w-md bg-gradient-to-br from-green-700/40 to-game-card rounded-3xl shadow-2xl p-6 text-center border border-green-400/30"
        initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      >
        <div className="text-sm font-semibold text-game-gold uppercase tracking-widest mb-1">
          Level {levelId} complete!
        </div>
        <p className="text-white/60 text-sm mb-3">Score: {score.toLocaleString()}</p>

        {/* The stage: a patch of sky over a strip of grass */}
        <div aria-hidden
          className="relative h-56 rounded-2xl overflow-hidden bg-gradient-to-b from-sky-400/30 via-sky-300/10 to-green-600/40 mb-4">
          <div className="absolute inset-x-0 bottom-0 h-6 bg-green-700/60" />
          {reduceMotion
            ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-4xl">{FLOWERS.join(' ')}</div>
            : <Show key={levelId} />}
        </div>

        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <Button variant="primary" className="w-full" onClick={onClose}>
          Next Level 🌱
        </Button>
      </motion.div>
    </motion.div>
  );
}
