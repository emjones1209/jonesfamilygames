/**
 * GinTable — the Gin Rummy screen, drawn from a game view (see ginEngine.js)
 * in which the player looking at it is seat 0. Used by the single-player game
 * and by play-together tables alike.
 *
 * Your hand is always shown arranged into its best melds (outlined), with the
 * deadwood after them, so you can see how close you are to knocking.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { Wide } from '../../components/Wide';
import { useMediaQuery, SHORT_SCREEN } from '../../utils/useMediaQuery';
import { SUIT_SYMBOLS } from '../../utils/cardEngine';
import { HiddenHand } from '../cards/CardTable';
import { bestMelds, isRun, order, sumValue, KNOCK_LIMIT, GAME_TARGET, HAND_BONUS, GAME_BONUS } from './ginRules';
import { waitingFor, knockCheck, mustDrawStock } from './ginEngine';

const BG = 'from-game-bg to-indigo-950';
const SUIT_ORDER = ['spades', 'hearts', 'clubs', 'diamonds'];
const cardName = c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`;
const bySuitThenRank = (a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || order(a) - order(b);
const sortMeld = m => [...m].sort(isRun(m) ? (a, b) => order(a) - order(b) : bySuitThenRank);

/**
 * Melds (low to high) then deadwood, for showing a hand. Runs that carry on
 * from each other (A-2-3♦ and 4-5-6♦) are shown as one.
 */
function laidOut(arrangement) {
  const melds = arrangement.melds.map(sortMeld).sort((a, b) => order(a[0]) - order(b[0]));
  const joined = [];
  for (const m of melds) {
    const prev = joined.find(p => isRun(p) && isRun(m) && p[0].suit === m[0].suit && order(p[p.length - 1]) + 1 === order(m[0]));
    if (prev) prev.push(...m);
    else joined.push([...m]);
  }
  return { melds: joined, deadwood: [...arrangement.deadwood].sort(bySuitThenRank) };
}

function describe(move, names) {
  if (!move) return '';
  const who = names[move.seat];
  const you = move.seat === 0;
  switch (move.kind) {
    case 'pass': return `${who} ${you ? 'pass' : 'passes'} on the face-up card.`;
    case 'stock': return `${who} ${you ? 'draw' : 'draws'} from the stock${you && move.card ? ` — the ${cardName(move.card)}` : ''}.`;
    case 'pile': return `${who} ${you ? 'take' : 'takes'} the ${cardName(move.card)} from the pile.`;
    case 'discard': return `${who} ${you ? 'throw' : 'throws'} away the ${cardName(move.card)}.`;
    case 'knock': return `${who} ${you ? 'knock' : 'knocks'}!`;
    default: return '';
  }
}

/**
 * @param view        game view with the viewer as seat 0
 * @param names       [you, opponent]
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 */
export function GinTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [selectedId, setSelectedId] = useState(null);
  const short = useMediaQuery(SHORT_SCREEN);    // a phone turned sideways: smaller piles
  const mine = view.hands[0];
  const arrangement = useMemo(() => laidOut(bestMelds(mine)), [mine]);
  const myTurn = waitingFor(view) === 0;
  const phase = view.phase;
  const top = view.discard[view.discard.length - 1];
  const selected = myTurn && phase === 'discard' ? mine.find(c => c.id === selectedId) : null;
  const newCard = myTurn && phase === 'discard' ? (view.takenFromPile ?? (view.lastMove?.kind === 'stock' ? view.lastMove.card : null)) : null;
  const knock = selected ? knockCheck(view, 0, selected.id) : null;
  const bigGin = myTurn && phase === 'discard' ? knockCheck(view, 0, null) : null;
  const afterDiscard = selected ? bestMelds(mine.filter(c => c.id !== selected.id)).points : null;

  const canTakePile = myTurn && (phase === 'firstTake' || (phase === 'draw' && !mustDrawStock(view))) && top;
  const canDrawStock = myTurn && phase === 'draw';
  const act = action => { setSelectedId(null); onAction({ ...action, seat: 0 }); };
  const tapCard = card => {
    if (!myTurn || phase !== 'discard') return;
    setSelectedId(id => (id === card.id ? null : card.id));
  };

  const prompt = phase === 'handOver' || phase === 'gameOver' ? ''
    : !myTurn ? `${names[1]} is thinking…`
    : phase === 'firstTake' ? `Take the ${cardName(top)} to start, or pass?`
      : phase === 'draw' ? (mustDrawStock(view) ? 'Draw from the stock.' : `Draw from the stock, or take the ${cardName(top)} from the pile.`)
        : 'Tap a card to throw away — or knock if you can.';

  const renderCard = card => {
    const isNew = newCard?.id === card.id;
    const locked = view.takenFromPile?.id === card.id;
    return (
      <div key={card.id} className={`relative rounded-xl ${isNew ? 'ring-2 ring-game-gold' : ''}`}>
        <PlayingCard card={{ ...card, faceUp: true }} size="sm" selected={selectedId === card.id && !!selected}
          disabled={phase === 'discard' && myTurn && locked}
          onClick={myTurn && phase === 'discard' && !locked ? () => tapCard(card) : undefined} />
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 short:py-1 flex flex-col select-none`}>
      <header className="flex items-center justify-between mb-2 short:mb-0 gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="gin" title="Gin Rummy" />
        </div>
        <div className="text-white/80 text-sm font-semibold min-w-0 truncate">Gin Rummy{subtitle && <Wide> · {subtitle}</Wide>}</div>
        <div className="text-white/60 text-[11px] md:text-xs text-right leading-snug shrink-0">
          <div className="text-white/90 font-semibold">{names[0]} {view.scores[0]} · {names[1]} {view.scores[1]}</div>
          <div>first to {GAME_TARGET}</div>
        </div>
      </header>

      {/* The other player, then the stock and pile — side by side on a phone turned sideways */}
      <div className="flex-1 flex flex-col short:flex-row short:items-center short:justify-center short:gap-8">
      <div className="flex flex-col items-center gap-1">
        <div className={`text-xs px-2 py-0.5 rounded-full ${waitingFor(view) === 1 ? 'bg-game-gold text-game-bg font-bold' : 'text-white/60'}`}>
          {names[1]}{view.dealer === 1 ? ' (dealer)' : ''}{reactions[1] ? ` ${reactions[1]}` : ''}
        </div>
        <HiddenHand count={view.hands[1].length} />
      </div>

      {/* Stock and pile */}
      <div className="flex-1 short:flex-none flex flex-col short:flex-row items-center justify-center gap-3 short:gap-6 py-3 short:py-1">
        <div className="flex items-end gap-6">
          <div className="flex flex-col items-center gap-1">
            <div onClick={canDrawStock ? () => act({ type: 'draw', from: 'stock' }) : undefined}
              className={`rounded-xl ${canDrawStock ? 'cursor-pointer ring-4 ring-game-gold animate-pulse' : ''}`}>
              <PlayingCard card={{ id: 'stock', faceUp: false }} faceDown size={short ? 'sm' : 'md'} />
            </div>
            <span className="text-white/40 text-xs">Stock ({view.stock.length})</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div onClick={canTakePile ? () => act({ type: 'draw', from: 'discard' }) : undefined}
              className={`rounded-xl ${canTakePile ? 'cursor-pointer ring-4 ring-game-gold' : ''}`}>
              {top ? <PlayingCard card={{ ...top, faceUp: true }} size={short ? 'sm' : 'md'} />
                : <div className={`${short ? 'w-10 h-16' : 'w-14 h-20 md:w-20 md:h-[7.5rem]'} rounded-2xl border-2 border-dashed border-white/20`} />}
            </div>
            <span className="text-white/40 text-xs">Pile</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 short:gap-1 short:max-w-xs">
        <p className="text-white/60 text-sm text-center min-h-[1.25rem]">{error || (view.lastMove?.seat === 1 ? describe(view.lastMove, names) : '')}</p>
        <p className={`text-center font-semibold ${myTurn ? 'text-game-gold' : 'text-white/50 animate-pulse'}`}>{prompt}</p>
        {myTurn && phase === 'firstTake' && (
          <div className="flex gap-3">
            <Button variant="gold" onClick={() => act({ type: 'draw', from: 'discard' })}>Take {cardName(top)}</Button>
            <Button variant="ghost" onClick={() => act({ type: 'pass' })}>Pass</Button>
          </div>
        )}
        </div>
      </div>
      </div>

      {/* Your hand, in melds */}
      <div className="flex flex-col items-center gap-2 short:gap-1">
        <div className="text-white/70 text-sm text-center">
          Deadwood: <span className={`font-bold ${arrangement.deadwood.length ? 'text-white' : 'text-green-400'}`}>{sumValue(arrangement.deadwood)}</span>
          {selected && (
            <span className="text-white/60"> · without the {cardName(selected)}: <b className={afterDiscard <= KNOCK_LIMIT ? 'text-green-400' : 'text-white'}>{afterDiscard}</b>
              {afterDiscard <= KNOCK_LIMIT ? (afterDiscard === 0 ? ' — gin!' : ' — you can knock!') : ''}</span>
          )}
          {!selected && <span className="text-white/40"> · knock at {KNOCK_LIMIT} or less</span>}
        </div>
        <div className="flex flex-wrap justify-center items-end gap-2">
          {arrangement.melds.map(m => (
            <div key={m.map(c => c.id).join()} className="flex gap-0.5 p-1 rounded-2xl bg-green-400/15 border border-green-400/40">
              {m.map(renderCard)}
            </div>
          ))}
          {arrangement.deadwood.length > 0 && (
            <div className="flex flex-wrap justify-center gap-0.5 p-1">{arrangement.deadwood.map(renderCard)}</div>
          )}
        </div>
        <div className="flex gap-3 min-h-[48px] short:min-h-0 items-center">
          {myTurn && phase === 'discard' && (
            <>
              {bigGin && <Button variant="gold" onClick={() => act({ type: 'knock', cardId: null })}>Big Gin! 🎉</Button>}
              <Button variant="primary" disabled={!selected} onClick={() => act({ type: 'discard', cardId: selected.id })}>
                {selected ? `Throw away ${cardName(selected)}` : 'Pick a card to throw away'}
              </Button>
              {knock && (
                <Button variant="gold" onClick={() => act({ type: 'knock', cardId: selected.id })}>
                  {knock.kind === 'gin' ? 'Gin! 🎉' : 'Knock ✊'}
                </Button>
              )}
            </>
          )}
        </div>
        {myTurn && phase === 'discard' && view.takenFromPile && (
          <p className="text-white/40 text-xs">You can&apos;t throw back the {cardName(view.takenFromPile)} you just took.</p>
        )}
        <div className="text-xs text-white/40">{names[0]}{view.dealer === 0 ? ' (dealer)' : ''}</div>
      </div>
      {overlay}

      {(phase === 'handOver' || phase === 'gameOver') && view.result && (
        <HandResult view={view} names={names} onNext={() => onAction({ type: 'nextHand' })} gameOverActions={gameOverActions} />
      )}
    </div>
  );
}

function headline(result, names) {
  if (result.kind === 'draw') return 'The stock ran out — no score';
  const who = names[result.knocker];
  const you = result.knocker === 0;
  if (result.kind === 'bigGin') return `${who} ${you ? 'go' : 'goes'} Big Gin! 🎉`;
  if (result.kind === 'gin') return `${who} ${you ? 'go' : 'goes'} Gin! 🎉`;
  if (result.undercut) return `Undercut! ${names[result.winner]} ${result.winner === 0 ? 'win' : 'wins'} 😮`;
  return `${who} knocked and ${you ? 'win' : 'wins'}`;
}

function HandShown({ name, arrangement, knocker }) {
  const { melds, deadwood } = laidOut(arrangement);
  const laidOff = arrangement.laidOff ?? [];
  const small = c => <PlayingCard key={c.id} card={{ ...c, faceUp: true }} size="xs" />;
  return (
    <div className="text-left">
      <div className="text-white/70 text-xs mb-1">
        {name}{knocker ? ' (knocked)' : ''} · deadwood <b className="text-white">{arrangement.points}</b>
      </div>
      <div className="flex flex-wrap gap-1.5 items-end">
        {melds.map(m => <div key={m.map(c => c.id).join()} className="flex gap-0.5 p-0.5 rounded-lg bg-green-400/15 border border-green-400/40">{m.map(small)}</div>)}
        {deadwood.length > 0 && <div className="flex gap-0.5 p-0.5 opacity-80">{deadwood.map(small)}</div>}
      </div>
      {laidOff.length > 0 && (
        <div className="text-white/50 text-xs mt-1">Laid off: {laidOff.map(l => cardName(l.card)).join(', ')}</div>
      )}
    </div>
  );
}

function HandResult({ view, names, onNext, gameOverActions }) {
  const r = view.result;
  const over = view.phase === 'gameOver';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card-panel text-center max-w-xl w-full max-h-[92vh] overflow-y-auto">
        {over && <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : '😢'}</div>}
        <h2 className="text-xl font-bold text-game-gold mb-1">
          {over ? (view.winner === 0 ? `${names[0]} win the game!` : `${names[1]} wins the game!`) : headline(r, names)}
        </h2>
        {over && <p className="text-white/60 text-sm mb-2">{headline(r, names)}</p>}
        {r.kind !== 'draw' && (
          <p className="text-white/80 text-sm mb-3">
            {names[r.winner]} {r.winner === 0 ? 'score' : 'scores'} <b className="text-green-400">{r.points}</b>
            {r.kind === 'gin' || r.kind === 'bigGin' ? ` (${r.kind === 'gin' ? 25 : 31} bonus + ${r.hands[1 - r.knocker].points} deadwood)` : ''}
            {r.undercut ? ` (${r.points - 25} + 25 undercut bonus)` : ''}
          </p>
        )}
        <div className="flex flex-col gap-3 mb-4">
          {[0, 1].map(seat => (
            <HandShown key={seat} name={names[seat]} arrangement={r.hands[seat]} knocker={r.knocker === seat} />
          ))}
        </div>
        {over ? (
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Points</th><th>Hands won</th><th>Game</th><th>Total</th></tr></thead>
            <tbody>
              {[0, 1].map(seat => (
                <tr key={seat}>
                  <td className="text-left">{names[seat]}</td>
                  <td>{view.scores[seat]}</td>
                  <td>{view.handsWon[seat]} × {HAND_BONUS}</td>
                  <td>{seat === view.winner ? `+${GAME_BONUS}` : '–'}</td>
                  <td className="font-bold">{view.final[seat]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-white/70 text-sm mb-4">
            {names[0]} {view.scores[0]} · {names[1]} {view.scores[1]} <span className="text-white/40">(first to {GAME_TARGET})</span>
          </p>
        )}
        {over ? gameOverActions : <Button variant="primary" className="w-full" onClick={onNext}>Next Hand</Button>}
      </div>
    </div>
  );
}
