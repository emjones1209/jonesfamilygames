/**
 * Pieces shared by the solitaire games (Klondike, Spider, FreeCell, Pyramid, TriPeaks): cards that
 * size themselves to the screen, empty places, the header and the "You win" box.
 *
 * Cards are sized in pixels from the width of the screen, so ten columns of Spider fit a
 * phone and grow on an iPad. A card's corner shows its rank *and* suit, since in a column
 * only a strip of each card shows. Selected cards keep still and show a green border inside
 * the card: nothing is drawn outside a card (iPhones could leave that behind on screen).
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Undo2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUIT_SYMBOLS } from '../../utils/cardEngine';
import { RulesButton } from '../../components/RulesButton';
import { Button } from '../../components/Button';
import { isRed, cardHeight } from './solitaireHelpers';

/**
 * One card, `w` pixels wide. `mark` outlines it: 'selected' (green), 'hint' (gold) or
 * 'target' (a place the selected cards can go). `dim` greys out a card that can't be played;
 * `plain` leaves out the big suit in the middle (for a card mostly covered by others).
 */
export function SCard({ card, w, faceDown = false, mark = null, dim = false, plain = false, onClick, style }) {
  const h = cardHeight(w);
  const radius = Math.max(4, Math.round(w * 0.12));
  const box = { width: w, height: h, borderRadius: radius, ...style };
  if (faceDown || card.faceUp === false) {
    return (
      <div onClick={onClick} style={box}
        className={`shrink-0 border-2 border-blue-700 bg-blue-900 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_4px,transparent_4px_8px)] ${mark === 'hint' ? 'ring-2 ring-inset ring-game-gold border-game-gold' : ''} ${onClick ? 'cursor-pointer' : ''}`} />
    );
  }
  const corner = Math.max(10, Math.round(w * 0.3));
  const red = isRed(card);
  const thick = w < 50 ? 'ring-2' : 'ring-4';     // (small cards: a thinner ring, to keep the corner readable)
  const ring = mark === 'selected' ? `${thick} ring-inset ring-primary-500/80 border-primary-500`
    : mark === 'hint' ? `${thick} ring-inset ring-game-gold border-game-gold`
    : mark === 'target' ? 'ring-2 ring-inset ring-primary-400 border-primary-400' : 'border-gray-300';
  return (
    <div onClick={onClick} style={box}
      className={`relative shrink-0 bg-white border-2 select-none overflow-hidden ${ring} ${dim ? 'brightness-75' : ''} ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`absolute left-[6%] top-[2%] font-bold leading-none whitespace-nowrap tracking-tighter ${red ? 'text-red-600' : 'text-gray-900'}`}
        style={{ fontSize: corner }}>
        {card.rank}<span style={{ fontSize: corner * 0.9 }}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      {!plain && (
        <div className={`absolute inset-x-0 bottom-[8%] text-center leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}
          style={{ fontSize: Math.round(w * 0.55) }}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
      )}
    </div>
  );
}

/** An empty place (a column, a free cell, a foundation), with an optional label. */
export function Slot({ w, label = '', mark = null, onClick, children }) {
  return (
    <div onClick={onClick} style={{ width: w, height: cardHeight(w), borderRadius: Math.max(4, Math.round(w * 0.12)) }}
      className={`relative shrink-0 border-2 border-dashed flex items-center justify-center text-white/30 ${mark === 'target' ? 'border-primary-400 bg-primary-500/10' : mark === 'hint' ? 'border-game-gold bg-game-gold/10' : 'border-white/20'} ${onClick ? 'cursor-pointer' : ''}`}>
      <span style={{ fontSize: Math.round(w * 0.4) }}>{label}</span>
      {children}
    </div>
  );
}

/** Back, the game's name and a status line, then Rules, Hint, Undo and New game. */
export function SolitaireHeader({ title, status, rulesGame, onUndo, canUndo, onRestart, onHint }) {
  const navigate = useNavigate();
  const icon = 'p-2 text-white/70 hover:text-white disabled:opacity-30 min-h-[40px] min-w-[40px] flex items-center justify-center';
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <button onClick={() => navigate('/')} className={icon} aria-label="Back"><ArrowLeft size={20} /></button>
      <div className="text-center min-w-0">
        <div className="text-white font-semibold leading-tight truncate">{title}</div>
        <div className="text-white/60 text-xs leading-tight">{status}</div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <RulesButton game={rulesGame} title={title} />
        {onHint && <button onClick={onHint} className={icon} aria-label="Hint"><Lightbulb size={18} /></button>}
        <button onClick={onUndo} disabled={!canUndo} className={icon} aria-label="Undo"><Undo2 size={18} /></button>
        <button onClick={onRestart} className={icon} aria-label="New game"><RefreshCw size={18} /></button>
      </div>
    </div>
  );
}

/** The "You win" box, shown once the finale is over. */
export function WinBox({ show, lines = [], onAgain, extra }) {
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="card-panel text-center max-w-sm w-full"
            initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-bold text-game-gold mb-2">You Win!</h2>
            {lines.map(l => <p key={l} className="text-white/70">{l}</p>)}
            {extra}
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
              <Button variant="primary" className="flex-1" onClick={onAgain}>Play Again</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

