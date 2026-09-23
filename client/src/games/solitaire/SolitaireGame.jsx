import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag, useDrop } from 'react-dnd';
import { ArrowLeft, RefreshCw, Undo2, HelpCircle } from 'lucide-react';
import { buildDeck, shuffle, SUITS, RANK_VALUES } from '../../utils/cardEngine';

// Aces are low in Solitaire (the shared table ranks them high for trick-taking games)
const SOL_RANK = { ...RANK_VALUES, A: 1 };
import { PlayingCard, EmptyCardSlot } from '../../components/PlayingCard';
import { Button } from '../../components/Button';
import { TutorialModal } from '../../components/TutorialModal';
import { TUTORIALS } from '../../components/tutorials';
import api from '../../utils/api';

const DRAG_TYPE = 'CARD_STACK';

function initGame() {
  const deck = shuffle(buildDeck());

  // 7 tableau columns
  const tableau = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const cards = [];
    for (let row = 0; row <= col; row++) {
      cards.push({ ...deck[idx++], faceUp: row === col });
    }
    tableau.push(cards);
  }

  // Remaining cards go to stock
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  const waste  = [];
  const foundations = { spades: [], hearts: [], diamonds: [], clubs: [] };

  return { tableau, stock, waste, foundations, moves: 0, startTime: Date.now() };
}

// ── Draggable card ────────────────────────────────────────────────────
function DraggableCard({ card, from, cards, selected, onSelect, size = 'sm' }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAG_TYPE,
    item: { cards, from },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [cards, from]); // deps required: without them react-dnd keeps the first render's stack
  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.4 : 1 }}
         onClick={onSelect}>
      <PlayingCard card={card} size={size} faceDown={!card.faceUp} selected={selected} />
    </div>
  );
}

// ── Droppable tableau column ──────────────────────────────────────────
function DroppableTableau({ colIdx, canDrop: canDropFn, onDrop, children, style }) {
  const [{ isOver, canAccept }, drop] = useDrop(() => ({
    accept: DRAG_TYPE,
    drop: (item) => onDrop(item, colIdx),
    canDrop: (item) => canDropFn(item.cards[0], colIdx),
    collect: (monitor) => ({ isOver: monitor.isOver(), canAccept: monitor.canDrop() }),
  }), [colIdx, canDropFn, onDrop]); // deps required: otherwise drops apply to the initial deal
  return (
    <div ref={drop} style={style}
         className={`relative flex-1 min-w-0 rounded-lg transition-colors ${isOver && canAccept ? 'ring-2 ring-primary-400' : ''}`}>
      {children}
    </div>
  );
}

// ── Droppable foundation ──────────────────────────────────────────────
function DroppableFoundation({ suit, canDrop: canDropFn, onDrop, children }) {
  const [{ isOver, canAccept }, drop] = useDrop(() => ({
    accept: DRAG_TYPE,
    drop: (item) => onDrop(item, suit),
    canDrop: (item) => item.cards.length === 1 && canDropFn(item.cards[0], suit),
    collect: (monitor) => ({ isOver: monitor.isOver(), canAccept: monitor.canDrop() }),
  }), [suit, canDropFn, onDrop]);
  return (
    <div ref={drop} className={`cursor-pointer rounded-lg transition-colors ${isOver && canAccept ? 'ring-2 ring-primary-400' : ''}`}>
      {children}
    </div>
  );
}

export default function SolitaireGame() {
  const navigate = useNavigate();
  const [game, setGame] = useState(() => initGame());
  const [history, setHistory] = useState([]);
  const [won, setWon] = useState(false);
  const [selected, setSelected] = useState(null); // { from, cards }
  const [showTutorial, setShowTutorial] = useState(false);

  const saveHistory = (g) => setHistory(h => [...h.slice(-20), JSON.stringify(g)]);

  const update = useCallback((newGame, checkWin = true) => {
    const updated = { ...newGame, moves: newGame.moves + 1 };
    if (checkWin) {
      const total = Object.values(updated.foundations).reduce((s, f) => s + f.length, 0);
      if (total === 52) {
        setWon(true);
        api.post('/scores', { game: 'solitaire', score: Math.max(0, 10000 - (updated.moves * 10)), durationS: Math.floor((Date.now() - updated.startTime) / 1000) }).catch(() => {});
      }
    }
    setGame(updated);
    setSelected(null);
  }, []);

  // Draw from stock
  const drawStock = () => {
    if (game.stock.length === 0) {
      saveHistory(game);
      const newStock = [...game.waste].reverse().map(c => ({ ...c, faceUp: false }));
      update({ ...game, stock: newStock, waste: [] }, false);
      return;
    }
    saveHistory(game);
    const card = { ...game.stock[0], faceUp: true };
    update({ ...game, stock: game.stock.slice(1), waste: [card, ...game.waste] }, false);
  };

  // Can a card be placed on a tableau column
  const canPlaceOnTableau = (card, targetCol) => {
    const col = game.tableau[targetCol];
    if (col.length === 0) return card.rank === 'K';
    const top = col[col.length - 1];
    if (!top.faceUp) return false;
    const isRed = (s) => s === 'hearts' || s === 'diamonds';
    const colorsDiffer = isRed(card.suit) !== isRed(top.suit);
    return colorsDiffer && SOL_RANK[card.rank] === SOL_RANK[top.rank] - 1;
  };

  // Can a card be placed on a foundation
  const canPlaceOnFoundation = (card) => {
    const pile = game.foundations[card.suit];
    if (pile.length === 0) return card.rank === 'A';
    return SOL_RANK[card.rank] === SOL_RANK[pile[pile.length - 1].rank] + 1;
  };

  const handleCardClick = (card, from) => {
    // Try auto-move to foundation on double-tap behavior (single-tap on foundation zones)
    if (!selected) {
      setSelected({ card, from });
      return;
    }

    // Try to place selected cards
    const { card: selCard, from: selFrom } = selected;
    if (from.type === 'foundation') {
      if (canPlaceOnFoundation(selCard) && selCard.suit === from.suit && selFrom.type !== 'foundation') {
        saveHistory(game);
        const newGame = removeCards(game, selFrom, [selCard]);
        newGame.foundations[selCard.suit] = [...newGame.foundations[selCard.suit], selCard];
        update(newGame);
        return;
      }
    }
    // Tapping the bottom card of another column moves the selection onto it
    if (from.type === 'tableau' && !(selFrom.type === 'tableau' && selFrom.colIdx === from.colIdx)) {
      const col = game.tableau[from.colIdx];
      const selCards = getSelectedCards(game, selFrom, selCard);
      if (col[col.length - 1]?.id === card.id && canPlaceOnTableau(selCards[0], from.colIdx)) {
        handleTableauClick(from.colIdx);
        return;
      }
    }
    setSelected({ card, from });
  };

  const handleFoundationClick = (suit) => {
    if (!selected) return;
    const { card: selCard, from: selFrom } = selected;
    if (canPlaceOnFoundation(selCard) && selCard.suit === suit) {
      // Only move single cards to foundation
      const selCards = getSelectedCards(game, selFrom, selCard);
      if (selCards.length !== 1) { setSelected(null); return; }
      saveHistory(game);
      const newGame = removeCards(game, selFrom, selCards);
      newGame.foundations[suit] = [...newGame.foundations[suit], selCard];
      update(newGame);
    } else {
      setSelected(null);
    }
  };

  const handleTableauClick = (colIdx) => {
    if (!selected) return;
    const { card: selCard, from: selFrom } = selected;
    const selCards = getSelectedCards(game, selFrom, selCard);
    if (canPlaceOnTableau(selCards[0], colIdx)) {
      saveHistory(game);
      const newGame = removeCards(game, selFrom, selCards);
      newGame.tableau[colIdx] = [...newGame.tableau[colIdx], ...selCards];
      // Flip top card of source if needed
      if (selFrom.type === 'tableau') {
        const srcCol = newGame.tableau[selFrom.colIdx];
        if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
          srcCol[srcCol.length - 1] = { ...srcCol[srcCol.length - 1], faceUp: true };
        }
      }
      update(newGame);
    } else {
      setSelected(null);
    }
  };

  const handleDrop = useCallback((item, colIdx) => {
    const { cards: dragCards, from: dragFrom } = item;
    if (!canPlaceOnTableau(dragCards[0], colIdx)) return;
    saveHistory(game);
    const newGame = removeCards(game, dragFrom, dragCards);
    newGame.tableau[colIdx] = [...newGame.tableau[colIdx], ...dragCards];
    if (dragFrom.type === 'tableau') {
      const srcCol = newGame.tableau[dragFrom.colIdx];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        srcCol[srcCol.length - 1] = { ...srcCol[srcCol.length - 1], faceUp: true };
      }
    }
    update(newGame);
  }, [game, canPlaceOnTableau]);

  const handleFoundationDrop = useCallback((item, suit) => {
    const { cards: dragCards, from: dragFrom } = item;
    if (dragCards.length !== 1) return;
    const card = dragCards[0];
    if (!canPlaceOnFoundation(card) || card.suit !== suit) return;
    saveHistory(game);
    const newGame = removeCards(game, dragFrom, dragCards);
    newGame.foundations[suit] = [...newGame.foundations[suit], card];
    update(newGame);
  }, [game, canPlaceOnFoundation]);

  const canDropOnTableau = useCallback((card, colIdx) => canPlaceOnTableau(card, colIdx), [game]);
  const canDropOnFoundation = useCallback((card, suit) => canPlaceOnFoundation(card) && card.suit === suit, [game]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = JSON.parse(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setGame(prev);
    setSelected(null);
  };

  const restart = () => {
    setGame(initGame());
    setHistory([]);
    setSelected(null);
    setWon(false);
  };

  // Auto-move to foundation
  const autoMove = () => {
    let changed = false;
    const g = JSON.parse(JSON.stringify(game));
    // Check waste
    if (g.waste.length > 0) {
      const top = g.waste[0];
      if (canPlaceOnFoundationG(top, g)) {
        g.foundations[top.suit].push(top);
        g.waste.shift();
        changed = true;
      }
    }
    // Check tableau tops
    for (let i = 0; i < 7; i++) {
      const col = g.tableau[i];
      if (col.length > 0) {
        const top = col[col.length - 1];
        if (top.faceUp && canPlaceOnFoundationG(top, g)) {
          g.foundations[top.suit].push(top);
          g.tableau[i].pop();
          // Flip next
          if (g.tableau[i].length > 0) g.tableau[i][g.tableau[i].length - 1].faceUp = true;
          changed = true;
        }
      }
    }
    if (changed) { saveHistory(game); update(g); }
  };

  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate('/')} className="text-white/60 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="text-white font-semibold">Solitaire · {game.moves} moves</div>
        <div className="flex gap-2">
          <button onClick={() => setShowTutorial(true)} className="p-1 text-white/60 hover:text-white">
            <HelpCircle size={18} />
          </button>
          <button onClick={undo} disabled={!history.length} className="p-1 text-white/60 hover:text-white disabled:opacity-30">
            <Undo2 size={18} />
          </button>
          <button onClick={restart} className="p-1 text-white/60 hover:text-white">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Top area: stock, waste, spacers, foundations */}
      <div className="flex gap-2 mb-3 justify-between">
        {/* Stock */}
        <div onClick={drawStock} className="cursor-pointer">
          {game.stock.length > 0
            ? <PlayingCard card={{ suit: 'spades', rank: 'A', faceUp: false }} faceDown size="sm" />
            : <EmptyCardSlot size="sm" label="↩️" onClick={drawStock} />}
        </div>

        {/* Waste */}
        {game.waste.length > 0
          ? <DraggableCard
              card={game.waste[0]}
              from={{ type: 'waste' }}
              cards={[game.waste[0]]}
              size="sm"
              selected={selected?.from?.type === 'waste'}
              onSelect={() => handleCardClick(game.waste[0], { type: 'waste' })}
            />
          : <EmptyCardSlot size="sm" />}

        <div className="flex-1" />

        {/* Foundations */}
        {SUITS.map(suit => {
          const pile = game.foundations[suit];
          const top = pile[pile.length - 1];
          const symbols = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
          return (
            <DroppableFoundation key={suit} suit={suit}
              canDrop={canDropOnFoundation} onDrop={handleFoundationDrop}>
              <div onClick={() => handleFoundationClick(suit)} className="cursor-pointer">
                {top
                  ? <PlayingCard card={top} size="sm" />
                  : <EmptyCardSlot size="sm" label={symbols[suit]} onClick={() => handleFoundationClick(suit)} />}
              </div>
            </DroppableFoundation>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="flex gap-1.5 overflow-x-auto pb-4">
        {game.tableau.map((col, colIdx) => {
          const colHeight = Math.max(120, col.length * 22 + 70);
          return (
            <DroppableTableau key={colIdx} colIdx={colIdx}
              canDrop={canDropOnTableau} onDrop={handleDrop}
              style={{ minHeight: `${colHeight}px`, position: 'relative' }}>
              {col.length === 0 && (
                <EmptyCardSlot size="sm" className="absolute inset-0 w-full"
                  onClick={() => handleTableauClick(colIdx)} />
              )}
              {col.map((card, rowIdx) => {
                const isSelected = selected?.from?.type === 'tableau'
                  && selected.from.colIdx === colIdx
                  && selected.from.rowIdx <= rowIdx
                  && card.faceUp;
                const dragCards = col.slice(rowIdx);
                return (
                  <div key={card.id} style={{ position: 'absolute', top: `${rowIdx * 22}px`, zIndex: rowIdx }}>
                    {card.faceUp ? (
                      <DraggableCard
                        card={card}
                        from={{ type: 'tableau', colIdx, rowIdx }}
                        cards={dragCards}
                        size="sm"
                        selected={isSelected}
                        onSelect={() => card.faceUp && handleCardClick(card, { type: 'tableau', colIdx, rowIdx })}
                      />
                    ) : (
                      <PlayingCard card={card} size="sm" faceDown />
                    )}
                  </div>
                );
              })}
              {/* Invisible drop/click zone at the bottom of each column */}
              <div
                style={{ position: 'absolute', top: `${col.length * 22}px`, zIndex: col.length + 1, width: '100%', height: '48px', cursor: 'pointer' }}
                onClick={() => handleTableauClick(colIdx)}
              />
            </DroppableTableau>
          );
        })}
      </div>

      <div className="flex justify-center mt-4">
        <Button variant="ghost" onClick={autoMove} className="text-sm">Auto-Move to Foundation ✨</Button>
      </div>

      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Solitaire" slides={TUTORIALS.solitaire} />

      {/* Win modal */}
      <AnimatePresence>
        {won && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="card-panel text-center max-w-sm w-full"
              initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
              <div className="text-5xl mb-3">🃏</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">You Win!</h2>
              <p className="text-white/60 mb-6">{game.moves} moves</p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
                <Button variant="primary" className="flex-1" onClick={restart}>Play Again</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function getSelectedCards(game, from, selCard) {
  if (from.type === 'waste') return [selCard];
  if (from.type === 'tableau') {
    const col = game.tableau[from.colIdx];
    const idx = col.findIndex(c => c.id === selCard.id);
    return col.slice(idx);
  }
  return [selCard];
}

function removeCards(game, from, cards) {
  const g = JSON.parse(JSON.stringify(game));
  if (from.type === 'waste') {
    g.waste = g.waste.slice(1);
  } else if (from.type === 'tableau') {
    const idx = g.tableau[from.colIdx].findIndex(c => c.id === cards[0].id);
    g.tableau[from.colIdx] = g.tableau[from.colIdx].slice(0, idx);
  } else if (from.type === 'foundation') {
    g.foundations[from.suit].pop();
  }
  return g;
}

function canPlaceOnFoundationG(card, g) {
  const pile = g.foundations[card.suit];
  if (pile.length === 0) return card.rank === 'A';
  return SOL_RANK[card.rank] === SOL_RANK[pile[pile.length - 1].rank] + 1;
}
