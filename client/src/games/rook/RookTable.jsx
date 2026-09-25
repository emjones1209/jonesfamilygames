/**
 * RookTable — the Rook screen, drawn from a game view (see rookEngine.js) in
 * which the player looking at it is seat 0. Used by the single-player game and
 * by multiplayer tables alike: moves go out through `onAction` (with seat 0),
 * and the caller works out what they mean.
 */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { CARD_BOX, CARD_TEXT } from '../../components/cardSizes';
import { RulesButton } from '../../components/RulesButton';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { cardPoints, sortHand, COLOURS, COLOUR_STYLE, MAX_BID, NEST_SIZE } from './rookRules';
import { waitingFor, nextBid, mustBid, handPoints, legalFor } from './rookEngine';

export function RookCard({ card, size = 'sm', selected, disabled, onClick }) {
  const color = card.isRook ? '#f97316' : COLOUR_STYLE[card.colour].color;
  return (
    <motion.div
      onClick={onClick}
      whileTap={onClick ? { scale: 0.95 } : {}}
      className={`${CARD_BOX[size]} ${CARD_TEXT[size]} rounded-lg border-2 flex flex-col items-center justify-center select-none shrink-0
        ${selected ? 'border-yellow-400 -translate-y-2 shadow-lg shadow-yellow-400/40' : 'border-transparent'}
        ${disabled ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      style={{ color, backgroundColor: '#1f2937' }}
    >
      <span className="font-bold leading-none">{card.isRook ? '🐦' : card.value}</span>
      <span className="text-[9px] md:text-[11px] leading-none mt-0.5 uppercase">{card.isRook ? 'Rook' : COLOUR_STYLE[card.colour].label}</span>
      {cardPoints(card) > 0 && !card.isRook && <span className="text-[8px] md:text-[10px] text-white/50 leading-none">{cardPoints(card)}pt</span>}
    </motion.div>
  );
}
const renderRook = (card, props) => <RookCard card={card} {...props} />;

const BG = 'from-game-bg to-orange-900';
const takes = (names, seat) => `${names[seat]} ${seat === 0 ? 'take' : 'takes'}`;

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param onExit      leave the table
 * @param error       a message to show (e.g. a refused move)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function RookTable({ view, names, onAction, onExit, error, reactions = {}, overlay, gameOverActions }) {
  const [nestSel, setNestSel] = useState([]);
  const turn = waitingFor(view);
  const myHand = useMemo(() => sortHand(view.table?.hands[0] ?? view.hands[0] ?? [], view.trump), [view]);
  const scoreLine = `Us ${view.scores[0]} · Them ${view.scores[1]}`;
  const reactionFor = seat => (reactions[seat] ? <span className="text-lg ml-1">{reactions[seat]}</span> : null);
  const header = (
    <div className="w-full flex items-center justify-between">
      <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
      <RulesButton game="rook" title="Rook" />
    </div>
  );

  if (view.phase === 'bidding') {
    const next = nextBid(view);
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 flex flex-col items-center gap-4`}>
        {header}
        <div className="text-white/60 text-sm">{scoreLine}</div>
        <h2 className="text-2xl font-bold text-white">Bidding</h2>
        <p className="text-white/50 text-sm text-center max-w-sm">
          Bid how many points your team will capture (counters: 5s, 10s and 14s, the Rook = 20, plus the nest).
        </p>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {names.map((name, seat) => (
            <div key={seat} className={`rounded-xl p-2 text-center ${seat === view.bidTurn ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs truncate">{name}{seat === view.dealer ? ' (dealer)' : ''}{reactionFor(seat)}</div>
              <div className="text-white font-bold">{view.bids[seat] == null ? '—' : view.bids[seat] === 'pass' ? 'Pass' : view.bids[seat]}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(c => <RookCard key={c.id} card={c} />)}
        </div>
        {turn === 0 ? (
          <div className="flex gap-3">
            <Button variant="ghost" disabled={mustBid(view)} onClick={() => onAction({ type: 'bid', seat: 0, bid: 'pass' })}>Pass</Button>
            <Button variant="gold" disabled={next == null || next > MAX_BID} onClick={() => onAction({ type: 'bid', seat: 0, bid: next })}>Bid {next}</Button>
          </div>
        ) : (
          <p className="text-white/50 animate-pulse">{names[view.bidTurn]} is thinking…</p>
        )}
        {mustBid(view) && turn === 0 && <p className="text-amber-400 text-xs">Everyone else passed — you must take the bid.</p>}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  if (view.phase === 'nest') {
    if (view.bidWinner !== 0) {
      return (
        <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 flex flex-col items-center gap-4`}>
          {header}
          <h2 className="text-2xl font-bold text-white">{names[view.bidWinner]} won the bid at {view.high.bid}</h2>
          <p className="text-white/50 animate-pulse">{names[view.bidWinner]} is choosing the nest and trump…{reactionFor(view.bidWinner)}</p>
          <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
            {myHand.map(c => <RookCard key={c.id} card={c} />)}
          </div>
          {overlay}
        </div>
      );
    }
    const toggle = id => setNestSel(sel =>
      sel.includes(id) ? sel.filter(x => x !== id) : sel.length < NEST_SIZE ? [...sel, id] : sel);
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 flex flex-col items-center gap-4`}>
        {header}
        <h2 className="text-2xl font-bold text-game-gold">You won the bid at {view.high.bid}!</h2>
        <p className="text-white/70 text-sm text-center max-w-sm">
          The nest's 5 cards (outlined) are now in your hand. Choose <b>5 cards to put back</b> in the nest,
          then pick trump. Points left in the nest go to whoever wins the last trick.
        </p>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(c => (
            <div key={c.id} className={view.fromNest.includes(c.id) ? 'rounded-lg ring-2 ring-sky-400' : ''}>
              <RookCard card={c} selected={nestSel.includes(c.id)} onClick={() => toggle(c.id)} />
            </div>
          ))}
        </div>
        <p className="text-white/60 text-sm">{nestSel.length}/{NEST_SIZE} selected</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {COLOURS.map(colour => (
            <button key={colour} disabled={nestSel.length !== NEST_SIZE}
              onClick={() => { onAction({ type: 'nest', seat: 0, discard: nestSel, trump: colour }); setNestSel([]); }}
              className="rounded-xl px-4 py-3 font-bold bg-white/10 hover:bg-white/20 disabled:opacity-30 min-h-[52px]"
              style={{ color: COLOUR_STYLE[colour].color }}>
              {COLOUR_STYLE[colour].label} trump
            </button>
          ))}
        </div>
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  // ── Playing, and the end of a hand ────────────────────────────────────────
  const table = view.table;
  const trumpStyle = view.trump ? COLOUR_STYLE[view.trump] : null;
  const points = handPoints(view);
  const message = error
    || (table?.status === 'collecting' ? `${takes(names, table.winner)} the trick`
      : table?.trickNumber === 0 && table.trick.length === 0
        ? `${names[view.bidWinner]} won the bid at ${view.high.bid} and ${view.bidWinner === 0 ? 'lead' : 'leads'}` : '');
  const last = view.lastHand;

  return (
    <>
      <CardTable
        title={<span>Trump: <b style={{ color: trumpStyle?.color }}>{trumpStyle?.label}</b> · Bid {view.high.bid} ({names[view.bidWinner]})</span>}
        rules={{ game: 'rook', title: 'Rook' }}
        onBack={onExit}
        scoreLine={
          <>
            <div className="text-white/90 font-semibold">This hand: Us {points[0]} · Them {points[1]}</div>
            <div className="text-white/50">Game: {scoreLine}</div>
          </>
        }
        names={names}
        table={table}
        seatDetail={seat => {
          const parts = [seat === view.bidWinner ? 'bidder' : null, reactions[seat]].filter(Boolean);
          return parts.length ? parts.join(' ') : null;
        }}
        message={message}
        renderTrickCard={card => <RookCard card={card} />}
        bgClass={BG}
      >
        <CardHand cards={myHand} legal={legalFor(view, 0)}
          onPlay={card => onAction({ type: 'play', seat: 0, cardId: card.id })} renderCard={renderRook} />
      </CardTable>
      {overlay}

      {(view.phase === 'handOver' || view.phase === 'gameOver') && last && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : '😞'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{view.winner === 0 ? 'Your team wins!' : 'They win!'}</h2>
            </>
          ) : (
            <h2 className={`text-xl font-bold mb-2 ${last.made ? 'text-green-400' : 'text-game-red'}`}>
              {last.bidTeam === 0 ? 'Your team' : 'They'} {last.made ? 'made' : 'missed'} the bid of {last.bid}
            </h2>
          )}
          <div className="space-y-1 text-white/80 text-sm mb-4">
            <div>Points captured — Us {last.taken[0]} · Them {last.taken[1]}</div>
            <div className="text-white/50 text-xs">Nest ({last.nestPoints} pts) went to {last.nestTo === 0 ? 'us' : 'them'}</div>
            <div className="font-semibold pt-2 border-t border-white/10">Total — Us {view.scores[0]} · Them {view.scores[1]}</div>
          </div>
          {view.phase === 'handOver' ? (
            <Button variant="gold" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
          ) : gameOverActions}
        </ResultPanel>
      )}
    </>
  );
}
