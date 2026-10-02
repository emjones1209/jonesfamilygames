/**
 * Quick reactions at a play-together table: a big button that springs open a
 * picker, and each reaction bursting onto everyone's screen: a giant emoji (or
 * a comic-style bubble for words like "Nice!") that pops up on the sender's
 * side of the table, throws out a spray of little copies, and floats away.
 */
import { motion, AnimatePresence } from 'framer-motion';

export const REACTION_MS = 3500;     // how long a reaction stays on screen

// Big emoji come from vector pictures (Noto Emoji, in public/emoji) rather than the
// device's emoji font, which turns blocky when blown up this large
const EMOJI_FILES = {
  '👍': '1f44d', '😂': '1f602', '😮': '1f62e', '😬': '1f62c', '🥺': '1f97a', '🤦': '1f926',
  '🎉': '1f389', '👏': '1f44f', '😄': '1f604', '✨': '2728',
};

/** An emoji as a sharp picture (falling back to the font for any we haven't a picture of). */
function Emoji({ char, className = 'inline-block w-[1em] h-[1em] align-[-0.125em]' }) {
  const file = EMOJI_FILES[char];
  return file ? <img src={`/emoji/${file}.svg`} alt={char} draggable={false} className={className} /> : <span>{char}</span>;
}

/** Text with any emoji in it drawn as pictures ("Hurry up! 😄"). */
const WithEmoji = ({ text }) => [...text].map((ch, i) => (EMOJI_FILES[ch] ? <Emoji key={i} char={ch} /> : ch));

const isWords = r => /[A-Za-z]/.test(r);
const BUBBLES = [
  'from-pink-500 to-orange-400', 'from-sky-500 to-indigo-500', 'from-emerald-500 to-lime-400', 'from-fuchsia-500 to-purple-600',
];
const bubbleFor = r => BUBBLES[[...r].reduce((h, ch) => h + ch.codePointAt(0), 0) % BUBBLES.length];
const SPARKS = 10;

/** One reaction: pops in, sprays sparks, drifts up and fades. */
function Burst({ reaction, you, players, name }) {
  const { emoji } = reaction;
  const rel = (reaction.seat - you + players) % players;
  // You at the bottom; everyone else spread across the top, in their seats' order round the table
  // (pulled in from the edges a little, so a wide bubble still fits on a phone)
  const left = rel === 0 ? 50 : 50 + ((rel / players) * 100 - 50) * 0.8;
  const top = rel === 0 ? 62 : 22;
  const words = isWords(emoji);
  const spark = words ? '✨' : emoji;
  return (
    // A plain wrapper does the centring; framer-motion's transforms would replace Tailwind's
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
    <motion.div className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, 0, -40, -110] }}
      transition={{ duration: REACTION_MS / 1000, times: [0, 0.08, 0.7, 1], ease: 'easeOut' }}>
      {/* The spray of little copies */}
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2 + (reaction.id % 1);
        const dist = 90 + (i % 3) * 30;
        return (
          <span key={i} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.span className="block"
              initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
              animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: 1, opacity: 0, rotate: 180 }}
              transition={{ duration: 1.1, delay: 0.1, ease: 'easeOut' }}>
              <Emoji char={spark} className="block w-7 h-7 md:w-9 md:h-9" />
            </motion.span>
          </span>
        );
      })}
      {/* The reaction itself: a spring pop and a little wobble */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.35, 1], rotate: [-20, 10, -6, 4, 0] }}
        transition={{ duration: 0.7, ease: 'easeOut' }}>
        {words ? (
          <div className={`bg-gradient-to-br ${bubbleFor(emoji)} text-white font-black text-3xl md:text-5xl px-6 py-3 rounded-[2rem] border-4 border-white shadow-2xl -rotate-3 whitespace-nowrap`}>
            <WithEmoji text={emoji} />
          </div>
        ) : (
          <Emoji char={emoji} className="block w-28 h-28 md:w-40 md:h-40 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]" />
        )}
      </motion.div>
      <div className="mt-2 bg-black/70 text-white font-bold rounded-full px-4 py-1 text-base md:text-lg shadow-lg whitespace-nowrap">{name}</div>
    </motion.div>
    </div>
  );
}

/**
 * Everyone's latest reactions, drawn over the whole table.
 * @param reactions  [{ id, seat, emoji }]
 * @param you        your seat number
 * @param players    number of seats
 * @param nameOf     seat → name to show
 */
export function ReactionBursts({ reactions, you, players, nameOf }) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {reactions.map(r => (
          <Burst key={r.id} reaction={r} you={you ?? 0} players={players} name={r.seat === you ? 'You' : nameOf(r.seat)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** The 😊 button and the choices it springs open. */
/** `extra` goes at the bottom of the choices (e.g. a setting). */
export function ReactionPicker({ choices, open, onToggle, onPick, extra }) {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div className="card-panel p-3 grid grid-cols-3 gap-2 w-72 md:w-80 origin-bottom-right"
            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
            {choices.map((r, i) => (
              <motion.button key={r} onClick={() => onPick(r)}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.03, type: 'spring', stiffness: 500, damping: 18 }}
                whileTap={{ scale: 1.3 }}
                className={`rounded-2xl bg-white/10 hover:bg-white/20 text-white min-h-[64px] leading-tight
                  ${isWords(r) ? 'text-base font-bold' : 'text-4xl'}`}>
                {isWords(r) ? <WithEmoji text={r} /> : <Emoji char={r} className="block w-10 h-10 md:w-11 md:h-11 mx-auto" />}
              </motion.button>
            ))}
            {extra}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button onClick={onToggle} aria-label="Send a reaction" whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.08 }}
        className="w-16 h-16 rounded-full bg-game-gold text-3xl shadow-xl shadow-black/40 border-4 border-white/80">
        {open ? '✕' : '😊'}
      </motion.button>
    </div>
  );
}
