/**
 * GolfTable — 6-Card Golf at a play-together table, drawn from a game view
 * (see golfEngine.js) in which the player looking at it is seat 0. Moves go out
 * through `onAction` (with seat 0) and the server works out whose they are.
 */
import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { CARD_BOX } from '../../components/cardSizes';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import { gridScore } from './golfRules';
import { PEEKS } from './golfEngine';
import { GolfCard, PlayerGrid, MiniGrid } from './GolfCards';

const BG = 'from-game-bg to-lime-900';
const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const cardLabel = c => (c.suit === 'joker' ? 'Joker' : `${c.rank}${SUIT_SYMBOL[c.suit]}`);
const RESULTS_AFTER_MS = 3500;       // leave the finished cards on screen for a moment first

/** "Dad draws the 7♥ from the deck", "You swap it for your Q♣" … */
function describeMove(m, names) {
  if (!m) return '';
  const you = m.seat === 0;
  const who = names[m.seat];
  const verb = (they, yours) => `${who} ${you ? yours : they}`;
  const card = cardLabel(m.card);
  switch (m.kind) {
    case 'draw': return m.fromDiscard
      ? `${verb('takes', 'take')} the ${card} from the discard pile`
      : `${m.reshuffled ? 'The discards are shuffled into a new deck. ' : ''}${verb('draws', 'draw')} the ${card} from the deck`;
    case 'place': return m.wasFaceUp
      ? `${verb('swaps', 'swap')} the ${card} for ${you ? 'your' : 'their'} ${cardLabel(m.replaced)}`
      : `${verb('swaps', 'swap')} the ${card} for a face-down card (a ${cardLabel(m.replaced)})`;
    case 'discard': return `${verb('discards', 'discard')} the ${card}`;
    case 'flip': return `${verb('turns', 'turn')} over a ${card}`;
    default: return '';
  }
}

const listNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHole)
 * @param onExit      leave the table
 * @param error       a message to show (e.g. a refused move)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function GolfTable({ view, names, onAction, onExit, error, reactions = {}, overlay, gameOverActions }) {
  const n = view.players;
  const over = view.phase === 'holeOver' || view.phase === 'gameOver';
  // The scores appear a moment after each hole ends (and hide again when the next one is dealt)
  const [showResults, setShowResults] = useState(false);
  const holeKey = over ? `${view.holeNo}-${view.phase}` : null;
  const [shownKey, setShownKey] = useState(holeKey);
  if (holeKey !== shownKey) { setShownKey(holeKey); setShowResults(false); }
  useEffect(() => {
    if (!holeKey) return;
    const timer = setTimeout(() => setShowResults(true), RESULTS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [holeKey]);

  const peeking = view.phase === 'peek' && view.peeks[0] < PEEKS;
  const myTurn = view.phase === 'playing' && view.turn === 0;
  const drawn = view.drawn;
  const canDraw = myTurn && !drawn;
  const move = view.lastMove;
  const litFor = seat => (move && move.seat === seat && move.row != null ? move : null);
  const act = a => onAction({ ...a, seat: 0 });

  const tapMine = (row, col) => {
    const card = view.grids[0][row][col];
    if (peeking) { if (!card.faceUp) act({ type: 'peek', row, col }); }
    else if (myTurn && drawn) act({ type: 'place', row, col });
    else if (myTurn && !card.faceUp) act({ type: 'flip', row, col });
  };

  // What's happening, in words
  let status;
  if (view.phase === 'peek') {
    const waiting = view.peeks.map((p, seat) => (p < PEEKS && seat !== 0 ? names[seat] : null)).filter(Boolean);
    status = peeking ? `Turn over ${PEEKS - view.peeks[0]} of your cards to start`
      : `Waiting for ${listNames(waiting)} to turn over their cards…`;
  } else if (view.phase === 'playing') {
    status = myTurn ? 'Your turn' : `${names[view.turn]}'s turn`;
    if (view.finisher != null) status = `${names[view.finisher]} finished — last turns! · ${status}`;
  } else {
    status = view.phase === 'gameOver' ? 'Game over' : `End of hole ${view.holeNo + 1}`;
  }
  const hint = peeking ? 'Tap two face-down cards'
    : myTurn ? (drawn ? (drawn.fromDiscard ? 'Tap a card in your grid to swap it' : 'Tap a card in your grid to swap, or discard it')
      : 'Draw a card, or tap a face-down card to flip it') : '';

  const opponents = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const small = n >= 4 ? 'xs' : 'sm';
  const emptySlot = extra => <div className={`${CARD_BOX.md} border-2 border-dashed rounded-2xl ${extra}`} />;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
          <RulesButton game="golf6" title="6-Card Golf" />
        </div>
        {over && !showResults
          ? <button onClick={() => setShowResults(true)} className="bg-game-gold text-game-bg font-bold text-sm rounded-xl px-3 min-h-[40px]">See scores</button>
          : <div className="text-white/60 text-xs text-center">Hole {view.holeNo + 1} of {view.holes}</div>}
        <div className="text-game-gold font-bold text-sm text-right">You: {view.totals[0]}{view.holeNo > 0 || over ? ' total' : ''}</div>
      </div>

      {/* Fixed-height message lines, so the board doesn't jump about */}
      <p className="text-center text-amber-400 text-sm min-h-[1.25rem]">{error || describeMove(move, names)}</p>
      <p className="text-center text-white/70 text-xs mb-2 min-h-[1rem]">{status}</p>

      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {opponents.map(seat => {
          const turn = (view.phase === 'playing' && view.turn === seat) || (view.phase === 'peek' && view.peeks[seat] < PEEKS);
          return (
            <div key={seat} className={`card-panel p-2 text-center transition-shadow ${turn ? 'ring-2 ring-game-gold' : ''}`}>
              <div className={`text-xs mb-1 truncate max-w-[10rem] mx-auto ${turn ? 'text-game-gold font-bold' : 'text-white/50'}`}>
                {names[seat]}{seat === view.finisher ? ' 🏁' : ''}{reactions[seat] && <span className="text-base ml-1">{reactions[seat]}</span>}
              </div>
              <MiniGrid grid={view.grids[seat]} size={small} lit={litFor(seat)} />
              <div className="text-white/40 text-xs mt-1">showing {gridScore(view.grids[seat])} · total {view.totals[seat]}</div>
            </div>
          );
        })}
      </div>

      {/* Piles above your grid; side by side on a wide landscape screen */}
      <div className="flex flex-col items-center lg:landscape:flex-row lg:landscape:justify-center lg:landscape:gap-12">
        <div className="flex justify-center gap-4 mb-3">
          <div className="text-center w-24 flex flex-col items-center">
            <p className="text-white/40 text-xs mb-1">Deck ({view.stock.length})</p>
            {view.stock.length > 0
              ? <div onClick={canDraw ? () => act({ type: 'draw', from: 'stock' }) : undefined} className={canDraw ? 'cursor-pointer' : ''}>
                  <GolfCard card={{ faceUp: false }} size="md" />
                </div>
              : view.discard.length > 1
                ? <div onClick={canDraw ? () => act({ type: 'draw', from: 'stock' }) : undefined}
                    className={`${CARD_BOX.md} border-2 border-dashed border-white/40 rounded-2xl flex items-center justify-center text-white/60 text-[10px] text-center leading-tight ${canDraw ? 'cursor-pointer' : ''}`}>
                    Tap to<br />reshuffle
                  </div>
                : emptySlot('border-white/20')}
          </div>
          <div className="text-center w-24 flex flex-col items-center">
            <p className="text-white/40 text-xs mb-1">Discard</p>
            {view.discard.length > 0
              ? <div onClick={canDraw ? () => act({ type: 'draw', from: 'discard' }) : undefined} className={canDraw ? 'cursor-pointer' : ''}>
                  <GolfCard card={view.discard[0]} size="md" />
                </div>
              : emptySlot('border-white/20')}
          </div>
          {/* The drawn card's slot is always there, so drawing doesn't shift the board */}
          <div className="text-center w-24 flex flex-col items-center">
            <p className={`text-xs mb-1 truncate max-w-full ${drawn && !myTurn ? 'text-game-gold' : 'text-white/40'}`}>
              {drawn && !myTurn ? `${names[view.turn]}'s card` : 'In hand'}
            </p>
            {drawn ? <GolfCard card={drawn.card} size="md" /> : emptySlot('border-white/15')}
            <button onClick={() => act({ type: 'discard' })}
              className={`text-white/60 hover:text-white text-xs mt-1 px-2 py-1 rounded-lg bg-white/10 min-h-[32px] ${myTurn && drawn ? '' : 'invisible'}`}>
              Discard it
            </button>
          </div>
        </div>
        <div className="flex justify-center">
          <div>
            <p className={`text-xs text-center mb-1 ${myTurn || peeking ? 'text-game-gold font-bold' : 'text-white/40'}`}>
              Your cards · showing {gridScore(view.grids[0])}{view.finisher === 0 ? ' 🏁' : ''}{reactions[0] ? ` ${reactions[0]}` : ''}
            </p>
            <PlayerGrid grid={view.grids[0]} onCardClick={tapMine} interactive={peeking || myTurn}
              highlight={myTurn && !!drawn} lit={litFor(0)} />
          </div>
        </div>
      </div>
      <p className="text-center text-white/40 text-xs mt-2 min-h-[1rem]">{hint}</p>
      {overlay}

      {over && showResults && view.lastHole && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winners.includes(0) ? '🏆' : '⛳'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-3">
                {view.winners.length > 1 ? `A tie: ${listNames(view.winners.map(w => names[w]))}!`
                  : view.winners[0] === 0 ? 'You win!' : `${names[view.winners[0]]} wins!`}
              </h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-game-gold mb-3">Hole {view.holeNo + 1} of {view.holes}</h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead>
              <tr className="text-white/40 text-xs">
                <th className="text-left font-normal">Player</th>
                <th className="text-right font-normal">{view.holes > 1 ? 'This hole' : 'Score'}</th>
                {view.holes > 1 && <th className="text-right font-normal">Total</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, seat) => seat)
                .sort((a, b) => view.totals[a] - view.totals[b])
                .map(seat => (
                  <tr key={seat} className={seat === 0 ? 'text-game-gold font-semibold' : ''}>
                    <td className="text-left py-0.5 truncate max-w-[10rem]">{names[seat]}{seat === view.lastHole.finisher ? ' 🏁' : ''}</td>
                    <td className="text-right">{view.lastHole.scores[seat]}</td>
                    {view.holes > 1 && <td className="text-right font-bold">{view.totals[seat]}</td>}
                  </tr>
                ))}
            </tbody>
          </table>
          {view.phase === 'holeOver'
            ? <Button variant="gold" className="w-full mb-2" onClick={() => onAction({ type: 'nextHole' })}>Next hole</Button>
            : gameOverActions}
          <Button variant="ghost" className="w-full mt-2" onClick={() => setShowResults(false)}>Look at the cards</Button>
        </ResultPanel>
      )}
    </div>
  );
}
