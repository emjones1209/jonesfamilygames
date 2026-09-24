/**
 * TrickArea — the centre of the table. Each seat's card sits on that seat's
 * side and slides in from it; the winning card is highlighted while the
 * completed trick is shown.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_BOX } from '../../components/cardSizes';

// Grid cell and entry offset for seats 0-3 (bottom, left, top, right)
const SEAT_POS = [
  { area: '3 / 2', from: { y: 60 } },
  { area: '2 / 1', from: { x: -60 } },
  { area: '1 / 2', from: { y: -60 } },
  { area: '2 / 3', from: { x: 60 } },
];

const defaultRender = card => <PlayingCard card={{ ...card, faceUp: true }} size="sm" />;

export function TrickArea({ plays, names, winner = null, message, renderCard = defaultRender }) {
  // Every seat has a fixed, card-sized slot (plus room for its name), so cards
  // land in place without nudging the others or the rest of the table
  return (
    <div className="flex flex-col items-center">
      <div className="grid gap-1 place-items-center"
        style={{ gridTemplateColumns: 'repeat(3, auto)', gridTemplateRows: 'repeat(3, auto)' }}>
        {SEAT_POS.map(({ area }, seat) => (
          <div key={seat} style={{ gridArea: area }} className="relative flex flex-col items-center">
            <div className={CARD_BOX.sm} />
            <span className="text-[10px] mt-0.5 invisible">{names[seat]}</span>
            <AnimatePresence>
              {plays.filter(p => p.seat === seat).map(({ card }) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, ...SEAT_POS[seat].from }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: winner === seat ? 1.1 : 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className={`absolute inset-x-0 top-0 flex flex-col items-center rounded-2xl ${winner === seat ? 'ring-2 ring-game-gold' : ''}`}
                >
                  {renderCard(card)}
                  <span className="text-white/50 text-[10px] mt-0.5">{names[seat]}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
        <div style={{ gridArea: '2 / 2' }} className={CARD_BOX.sm} />
      </div>
      <p className="text-white/60 text-xs mt-2 h-4 text-center">{message}</p>
    </div>
  );
}
