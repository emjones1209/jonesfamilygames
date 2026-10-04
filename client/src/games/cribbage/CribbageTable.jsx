/**
 * CribbageTable — the Cribbage screen, drawn from a game view (see
 * cribbageEngine.js) in which the player looking at it is seat 0. Used by the
 * single-player game and by play-together tables alike.
 *
 * Top to bottom: the peg board, the other player, the starter / crib / pegging
 * area with the running count, and your hand (tap two cards for the crib, then
 * tap a card twice to peg it). After each hand, the show spells out every count.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { Wide } from '../../components/Wide';
import { useMediaQuery, SHORT_SCREEN } from '../../utils/useMediaQuery';
import { SUIT_SYMBOLS } from '../../utils/cardEngine';
import { HiddenHand } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { GAME_TARGET, MAX_COUNT } from './cribbageRules';
import { waitingOn, legalFor } from './cribbageEngine';

const BG = 'from-game-bg to-amber-950';
const cardName = c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`;
const KIND = { fifteen: 'Fifteen', pair: 'Pair', run: 'Run', flush: 'Flush', nobs: 'Nobs (the Jack of the starter\'s suit)' };
const PEG_COLOR = ['bg-game-gold', 'bg-sky-400'];

/** One player's track on the peg board: 0 to 121, front peg and back peg. */
function Track({ name, score, back, color, active }) {
  const at = n => `${(Math.min(n, GAME_TARGET) / GAME_TARGET) * 100}%`;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-16 md:w-24 shrink-0 text-xs truncate ${active ? 'text-game-gold font-bold' : 'text-white/70'}`}>{name}</span>
      <div className="relative flex-1 h-4 rounded-full bg-black/40 border border-white/10">
        {/* Holes every 5, with the streets (every 30) marked */}
        {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(n => (
          <span key={n} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ${n % 30 === 0 ? 'w-1 h-3 bg-white/30' : 'w-0.5 h-1.5 bg-white/20'}`}
            style={{ left: at(n) }} />
        ))}
        {back > 0 && back !== score && (
          <span className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full opacity-50 ${color}`} style={{ left: at(back) }} />
        )}
        <span className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow transition-all duration-500 ${color}`}
          style={{ left: at(score) }} />
      </div>
      <span className="w-8 text-right text-sm font-bold text-white">{score}</span>
    </div>
  );
}

/** "Phoebe: fifteen for 2 · pair for 2" */
function eventText(events, names) {
  if (!events.length) return '';
  const bySeat = [0, 1].map(seat => events.filter(e => e.seat === seat)).filter(list => list.length);
  return bySeat.map(list => `${names[list[0].seat]}: ${list.map(e => `${e.why} for ${e.points}`).join(' · ')}`).join('  —  ');
}

/** One count in the show, with what made it up. */
function Count({ title, count, starter }) {
  const small = c => <PlayingCard key={c.id} card={{ ...c, faceUp: true }} size="xs" />;
  return (
    <div className="text-left bg-white/5 rounded-2xl p-2">
      <div className="flex items-center justify-between text-sm text-white/80 mb-1">
        <span>{title}</span><b className="text-game-gold">{count.total}</b>
      </div>
      <div className="flex gap-1 items-end mb-1">
        {count.cards.map(small)}
        <span className="text-white/30 text-xs mx-1">+</span>
        {small(starter)}
      </div>
      {count.items.length ? (
        <ul className="text-xs text-white/60 space-y-0.5">
          {count.items.map((i, k) => (
            <li key={k}>{KIND[i.kind]} for {i.points}: {i.cards.map(cardName).join(' ')}</li>
          ))}
        </ul>
      ) : <p className="text-xs text-white/40">Nothing — a "nineteen"</p>}
    </div>
  );
}

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function CribbageTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [picked, setPicked] = useState([]);
  const short = useMediaQuery(SHORT_SCREEN);       // a phone turned sideways: everything more compact
  const phase = view.phase;
  const waiting = waitingOn(view);
  const yourMove = waiting.includes(0);
  const yourCrib = view.dealer === 0;
  const cribOwner = yourCrib ? 'your' : `${names[1]}'s`;
  const hand = view.hands[0];
  const chosen = picked.filter(id => hand.some(c => c.id === id));
  const act = a => onAction({ ...a, seat: 0 });
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p.filter(x => hand.some(c => c.id === x)), id].slice(-2)));
  const peg = view.peg;
  const over = phase === 'show' || phase === 'gameOver';

  const prompt = phase === 'discard'
    ? (yourMove ? `Choose 2 cards for ${cribOwner} crib${yourCrib ? ' — they\'ll count for you' : ' — they\'ll count for them, so give nothing away'}`
      : `Waiting for ${names[1]} to choose…`)
    : phase === 'play'
      ? (yourMove ? '' : `${names[1]} is thinking…`)
      : '';
  const goNote = phase === 'play' && peg.goBy != null ? `${peg.goBy === 0 ? 'You say' : `${names[1]} says`} “go”` : '';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 short:py-1 flex flex-col gap-2 short:gap-1 select-none`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="cribbage" title="Cribbage" />
        </div>
        <div className="text-white/80 text-sm font-semibold min-w-0 truncate">Cribbage{subtitle && <Wide> · {subtitle}</Wide>}</div>
        <div className="text-white/60 text-[11px] md:text-xs text-right shrink-0">first to {GAME_TARGET}</div>
      </header>

      {/* The peg board */}
      <div className="card-panel p-2 short:py-1 md:p-3 flex flex-col gap-1.5 short:gap-1">
        {[1, 0].map(seat => (
          <Track key={seat} name={names[seat]} score={view.scores[seat]} back={view.back[seat]} color={PEG_COLOR[seat]}
            active={waiting.includes(seat)} />
        ))}
      </div>

      {/* The other player */}
      <div className="flex flex-col items-center gap-1">
        <div className={`text-xs px-2 py-0.5 rounded-full ${waiting.includes(1) && !over ? 'bg-game-gold text-game-bg font-bold' : 'text-white/60'}`}>
          {names[1]}{view.dealer === 1 ? ' · deals (their crib)' : ''}{phase === 'discard' && view.thrown[1] ? ' · ready' : ''}{reactions[1] ? ` ${reactions[1]}` : ''}
        </div>
        {!short && <HiddenHand count={view.hands[1].length} />}
      </div>

      {/* Starter, crib and the cards played so far this count */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 short:gap-1">
        {/* (Sideways, the played cards sit in the same row as the starter, crib and count) */}
        <div className="flex flex-col short:flex-row items-center gap-2 short:gap-6">
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-center gap-1">
            {view.starter ? <PlayingCard card={{ ...view.starter, faceUp: true }} size="sm" />
              : <PlayingCard card={{ id: 'deck', faceUp: false }} faceDown size="sm" />}
            <span className="text-white/40 text-[11px]">Starter</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              {view.crib.length ? <PlayingCard card={{ id: 'crib', faceUp: false }} faceDown size="sm" />
                : <div className="w-10 h-16 md:w-16 md:h-24 rounded-xl border-2 border-dashed border-white/20" />}
              {view.crib.length > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-white/90 text-game-bg rounded-full px-1.5 font-bold">{view.crib.length}</span>}
            </div>
            <span className="text-white/40 text-[11px]">{yourCrib ? 'Your crib' : `${names[1]}'s crib`}</span>
          </div>
          {phase === 'play' && (
            <div className="flex flex-col items-center ml-2">
              <span className="text-white/40 text-[11px]">Count</span>
              <span className="text-4xl font-black text-white tabular-nums">{peg.count}</span>
              <span className="text-white/30 text-[10px]">of {MAX_COUNT}</span>
            </div>
          )}
        </div>
        {phase === 'play' && (
          <div className="flex items-end justify-center min-h-[4.5rem] -space-x-3">
            {peg.seq.map(c => (
              <div key={c.id} className={`rounded-xl ${c.seat === 0 ? 'ring-2 ring-game-gold' : 'ring-2 ring-sky-400'}`}>
                <PlayingCard card={{ ...c, faceUp: true }} size="sm" />
              </div>
            ))}
          </div>
        )}
        </div>
        <p className="text-amber-300 text-sm font-semibold text-center min-h-[1.25rem]">{error || eventText(view.events, names) || goNote}</p>
      </div>

      {/* Your hand */}
      <div className="flex flex-col items-center gap-2">
        <div className={`short:hidden text-xs px-2 py-0.5 rounded-full ${yourMove && !over ? 'bg-game-gold text-game-bg font-bold' : 'text-white/60'}`}>
          {names[0]}{yourCrib ? ' · your deal (your crib)' : ''}
        </div>
        {phase === 'discard' && !view.thrown[0] ? (
          <>
            <div className="flex flex-wrap justify-center gap-1">
              {hand.map(c => (
                <PlayingCard key={c.id} card={{ ...c, faceUp: true }} size={short ? 'sm' : 'md'} selected={chosen.includes(c.id)} onClick={() => toggle(c.id)} />
              ))}
            </div>
            <Button variant="gold" disabled={chosen.length !== 2} onClick={() => { act({ type: 'discard', cardIds: chosen }); setPicked([]); }}>
              {chosen.length === 2 ? `Put them in ${cribOwner} crib` : `Choose ${2 - chosen.length} more`}
            </Button>
          </>
        ) : phase === 'play' || phase === 'discard' ? (
          <CardHand cards={hand} legal={legalFor(view, 0)} onPlay={c => act({ type: 'play', cardId: c.id })}
            hints={{ selected: 'Tap again to play it', active: 'Your turn — tap a card, then tap it again to play it' }} />
        ) : null}
        <p className="text-center text-white/50 text-xs min-h-[1rem]">{prompt}</p>
      </div>
      {overlay}

      {over && view.show && <ShowPanel view={view} names={names} onNext={() => onAction({ type: 'nextHand' })} gameOverActions={gameOverActions} />}
      {phase === 'gameOver' && !view.show && <ShowPanel view={view} names={names} gameOverActions={gameOverActions} />}
    </div>
  );
}

/** The show (and the end of the game). */
function ShowPanel({ view, names, onNext, gameOverActions }) {
  const over = view.phase === 'gameOver';
  const title = c => (c.what === 'crib' ? `${c.seat === 0 ? 'Your' : `${names[1]}'s`} crib` : `${c.seat === 0 ? 'Your' : `${names[1]}'s`} hand`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card-panel text-center max-w-md w-full max-h-[92vh] overflow-y-auto p-4">
        {over && <div className="text-5xl mb-1">{view.winner === 0 ? '🏆' : '😢'}</div>}
        <h2 className="text-xl font-bold text-game-gold mb-1">
          {over ? `${view.winner === 0 ? `${names[0]} win` : `${names[1]} wins`}${view.skunk ? ' — a skunk!' : '!'}` : 'The show'}
        </h2>
        {over && !view.show && <p className="text-white/60 text-sm mb-2">Pegged out — no need to count the hands.</p>}
        {view.show && (
          <div className="flex flex-col gap-2 my-3">
            {view.show.map((c, i) => <Count key={i} title={title(c)} count={c} starter={view.starter} />)}
            {over && view.show.length < 3 && <p className="text-white/50 text-xs">{names[view.winner]} reached {GAME_TARGET} — the rest isn&apos;t counted.</p>}
          </div>
        )}
        <p className="text-white/70 text-sm mb-4">
          {names[0]} {view.scores[0]} · {names[1]} {view.scores[1]} <span className="text-white/40">(first to {GAME_TARGET})</span>
        </p>
        {over ? gameOverActions : <Button variant="primary" className="w-full" onClick={onNext}>Next Hand</Button>}
      </div>
    </div>
  );
}
