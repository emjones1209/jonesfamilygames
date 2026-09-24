import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const GAMES = [
  { id: 'bible-trivia',    name: 'Bible Trivia',    emoji: '✝️',  color: 'from-purple-700 to-purple-900',   path: '/games/trivia/bible',    desc: 'Test your scripture knowledge' },
  { id: 'history-trivia',  name: 'History Trivia',  emoji: '📜',  color: 'from-amber-700 to-amber-900',     path: '/games/trivia/history',  desc: 'Journey through time' },
  { id: 'geo-trivia',      name: 'Geo Trivia',      emoji: '🌍',  color: 'from-blue-700 to-blue-900',       path: '/games/trivia/geography',desc: 'Explore the world' },
  { id: 'solitaire',       name: 'Solitaire',        emoji: '🃏',  color: 'from-green-700 to-green-900',     path: '/games/solitaire',       desc: 'Classic Klondike' },
  { id: 'hearts',          name: 'Hearts',           emoji: '♥️',  color: 'from-red-700 to-red-900',         path: '/games/hearts',          desc: 'Avoid the queen!' },
  { id: 'spades',          name: 'Spades',           emoji: '♠️',  color: 'from-slate-600 to-slate-900',     path: '/games/spades',          desc: 'Bid and win tricks' },
  { id: 'rook',            name: 'Rook',             emoji: '🐦',  color: 'from-orange-700 to-orange-900',   path: '/games/rook',            desc: 'The classic Rook card game' },
  { id: 'canasta',         name: 'Canasta',          emoji: '♣️',  color: 'from-emerald-700 to-emerald-900', path: '/games/canasta',         desc: 'Meld, build canastas, go out!' },
  { id: 'bridge',          name: 'Bridge',           emoji: '🌉',  color: 'from-teal-700 to-teal-900',       path: '/games/bridge',          desc: 'Full Bridge with bidding' },
  { id: 'train',           name: 'Mexican Train',    emoji: '🚂',  color: 'from-sky-700 to-sky-900',         path: '/games/train',           desc: 'Dominoes for the whole family' },
  { id: 'golf6',           name: '6-Card Golf',      emoji: '⛳',  color: 'from-lime-700 to-lime-900',       path: '/games/golf6',           desc: 'Lowest score wins!' },
  { id: 'jigsaw',          name: 'Jigsaw Puzzle',    emoji: '🧩',  color: 'from-pink-700 to-pink-900',       path: '/games/jigsaw',          desc: 'Use your own photos!' },
  { id: 'match3',       name: 'Garden Match',  emoji: '🌸',  color: 'from-fuchsia-700 to-fuchsia-900', path: '/games/match3',       desc: 'Match flowers to bloom!' },
  { id: 'minesweeper',  name: 'Minesweeper',   emoji: '💣',  color: 'from-zinc-600 to-zinc-900',       path: '/games/minesweeper',  desc: 'Clear the minefield!' },
];

export default function LandingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card">
      {/* Header */}
      <header className="sticky top-safe z-20 bg-game-bg/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-10 h-10" />
            <span className="font-display font-bold text-game-gold text-lg">Family Games</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-2xl px-3 py-2"
            >
              <span className="text-lg">{getAvatarEmoji(user?.avatar)}</span>
              <span className="text-white text-sm font-medium hidden sm:block">{user?.displayName}</span>
            </button>
            <button
              onClick={() => navigate('/welcome')}
              className="text-sm text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-2xl px-3 py-2"
            >
              📖 Guide
            </button>
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs text-white/40 hover:text-white/80 transition-colors"
              >
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="text-sm text-white/40 hover:text-white/80 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-5 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Good to see you, <span className="text-game-gold">{user?.displayName}!</span>
          </h1>
          <p className="text-white/50">Pick a game and let's play 🎉</p>
        </div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {GAMES.map((game) => (
            <motion.button
              key={game.id}
              variants={item}
              onClick={() => navigate(game.path)}
              className={`bg-gradient-to-br ${game.color} rounded-3xl p-5 text-left shadow-lg active:scale-95 transition-transform`}
            >
              <div className="text-4xl mb-3">{game.emoji}</div>
              <div className="text-white font-bold text-base leading-tight">{game.name}</div>
              <div className="text-white/60 text-xs mt-1 leading-snug">{game.desc}</div>
            </motion.button>
          ))}
        </motion.div>
      </main>
    </div>
  );
}

function getAvatarEmoji(avatar) {
  const avatars = {
    default: '😊', cat: '🐱', dog: '🐶', star: '⭐', heart: '❤️',
    flower: '🌸', sun: '☀️', moon: '🌙', crown: '👑', angel: '😇',
  };
  return avatars[avatar] || '😊';
}
