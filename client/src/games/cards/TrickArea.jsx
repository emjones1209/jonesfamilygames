/**
 * TrickArea — the centre of the table. Each seat's card sits on that seat's
 * side and slides in from it; the winning card is highlighted while the
 * completed trick is shown.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from '../../components/PlayingCard';

// Grid cell and entry offset for seats 0-3 (bottom, left, top, right)
const SEAT_POS = [
  { area: '3 / 2', from: { y: 60 } },
  { area: '2 / 1', from: { x: -60 } },
  { area: '1 / 2', from: { y: -60 } },
  { area: '2 / 3', from: { x: 60 } },
];

const defaultRender = card => <PlayingCard card={{ ...card, faceUp: true }} size="sm" />;

export function TrickArea({ plays, names, winner = null, message, renderCard = defaultRender }) {
  return (
    <div className="flex flex-col items-center">
      <div className="grid gap-1 place-items-center"
        style={{ gridTemplateColumns: 'repeat(3, auto)', gridTemplateRows: 'repeat(3, auto)' }}>
        <AnimatePresence>
          {plays.map(({ card, seat }) => (
            <motion.div
              key={card.id}
              style={{ gridArea: SEAT_POS[seat].area }}
              initial={{ opacity: 0, ...SEAT_POS[seat].from }}
              animate={{ opacity: 1, x: 0, y: 0, scale: winner === seat ? 1.1 : 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={`flex flex-col items-center rounded-2xl ${winner === seat ? 'ring-2 ring-game-gold' : ''}`}
            >
              {renderCard(card)}
              <span className="text-white/50 text-[10px] mt-0.5">{names[seat]}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {/* Keep the grid's shape when the trick is empty */}
        <div style={{ gridArea: '2 / 2' }} className="w-10 h-16" />
      </div>
      <p className="text-white/60 text-xs mt-2 h-4 text-center">{message}</p>
    </div>
  );
}
