/**
 * CanastaTable — the Canasta screen, drawn from a game view (see
 * canastaEngine.js) in which the player looking at it is seat 0 (partnered
 * with seat 2). Used by the single-player game and by play-together tables.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_BOX } from '../../components/cardSizes';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { Wide, Narrow } from '../../components/Wide';
import { TurnUpright } from '../../components/TurnUpright';
import { ResultPanel } from '../cards/GameSetup';
import {
  sortHand, topOfPile, pileFrozen, teamOf, needed, meldedValue, isWild, isBlackThree, isCanasta, isNaturalMeld,
} from './canastaRules';
import { waitingFor } from './canastaEngine';

const BG = 'from-game-bg to-emerald-900';
const SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const label = c => (c.rank === 'JK' ? 'Joker' : `${c.rank}${SUIT[c.suit]}`);
const cardCount = n => `${n} card${n === 1 ? '' : 's'}`;
const plural = (n, rank) => `${n === 1 ? 'a' : n} ${rank === 'JK' ? 'Joker' : rank}${n === 1 ? '' : 's'}`;

function CanastaCard({ card, size = 'sm', selected, onClick }) {
  if (card.rank === 'JK') {
    return (
      <div onClick={onClick}
        className={`${CARD_BOX[size]} rounded-xl border-2 bg-purple-700 flex flex-col items-center justify-center select-none shrink-0
          ${selected ? 'border-yellow-400 -translate-y-2 shadow-lg shadow-yellow-400/40' : 'border-purple-400'} ${onClick ? 'cursor-pointer' : ''}`}>
        <span className="text-xl md:text-2xl">🃏</span>
        <span className="text-white text-[9px] md:text-[11px] font-bold">JOKER</span>
      </div>
    );
  }
  return <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} onClick={onClick} />;
}

/** One meld: its rank, how many cards (and wild cards), gold when it's a canasta. */
function MeldTile({ meld, onClick, highlight, fresh }) {
  const wild = meld.cards.filter(isWild).length;
  const canasta = isCanasta(meld);
  const natural = canasta && isNaturalMeld(meld);
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`relative w-14 h-[4.5rem] md:w-16 md:h-20 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold
        ${canasta ? (natural ? 'bg-red-50 border-4 border-red-500 text-red-700' : 'bg-gray-100 border-4 border-gray-800 text-gray-900') : 'bg-white border-2 border-gray-300 text-gray-900'}
        ${highlight ? 'ring-4 ring-game-gold' : fresh ? 'ring-4 ring-game-gold scale-110' : ''} transition-transform ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <span className="text-xl md:text-2xl leading-none">{meld.rank}</span>
      <span className="text-xs md:text-sm">×{meld.cards.length}</span>
      {wild > 0 && <span className="text-[9px] md:text-[10px] text-purple-700">{wild} wild</span>}
      {canasta && <span className="absolute -top-2 -right-2 text-[9px] bg-game-gold text-game-bg rounded-full px-1.5">{natural ? 500 : 300}</span>}
    </button>
  );
}

function MeldArea({ title, melds, redThrees, onMeldClick, extra, freshRank }) {
  return (
    <div className="card-panel p-2">
      <div className="flex items-center justify-between text-xs text-white/60 mb-1">
        <span className="font-semibold text-white/80">{title}</span>
        <span>{redThrees > 0 && `Red 3s: ${'🔴'.repeat(redThrees)}`} {extra}</span>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[3rem] md:min-h-[5rem] items-center">
        {melds.length === 0 && <span className="text-white/30 text-xs">No melds yet</span>}
        {melds.map(m => <MeldTile key={m.rank} meld={m} onClick={onMeldClick ? () => onMeldClick(m) : undefined} highlight={!!onMeldClick} fresh={m.rank === freshRank} />)}
      </div>
    </div>
  );
}

/** A move in words: "Phoebe takes the pile (7 cards) with the 9s!" */
function describe(m, names, phase) {
  if (!m) return '';
  const you = m.seat === 0, who = names[m.seat];
  const v = (they, yours) => `${who} ${you ? yours : they}`;
  switch (m.kind) {
    case 'draw': return phase !== 'draw' && phase !== 'play' && !m.reds ? 'The stock has run out — the hand is over.'
      : `${v('draws', 'draw')} a card${m.reds ? ` (and ${m.reds > 1 ? `${m.reds} red 3s` : 'a red 3'} — +100)` : ''}.`;
    case 'takePile': return `${v('takes', 'take')} the pile (${cardCount(m.count)}) with the ${m.rank}s!`;
    case 'meld': return m.added ? `${v('adds', 'add')} ${m.count} to the ${m.rank}s.` : `${v('melds', 'meld')} ${plural(m.count, m.rank)}.`;
    case 'discard': return `${v('discards', 'discard')} the ${label(m.card)}.`;
    case 'undo': return `${v('takes', 'take')} back ${you ? 'your' : 'their'} melds.`;
    default: return '';
  }
}

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function CanastaTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [picked, setSelected] = useState([]);                 // ids of your selected cards
  const [note, setNote] = useState(null);                     // a hint of yours, until the next move
  const hand = sortHand(view.hands[0]);
  const selected = picked.filter(id => hand.some(c => c.id === id));   // (cards that have left your hand drop out)
  const playing = view.phase === 'draw' || view.phase === 'play';
  const yourTurn = playing && waitingFor(view) === 0;
  const act = a => { onAction({ ...a, seat: 0 }); setNote(null); };

  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel.filter(x => hand.some(c => c.id === x)), id]));
  const drawCard = () => { if (yourTurn && view.phase === 'draw') act({ type: 'draw' }); };
  const takePile = () => { if (yourTurn && view.phase === 'draw') { act({ type: 'takePile', ids: selected }); setSelected([]); } };
  const meld = rank => { if (yourTurn && view.phase === 'play') { act({ type: 'meld', ids: selected, rank }); setSelected([]); } };
  const discard = () => {
    if (!yourTurn || view.phase !== 'play') return;
    if (selected.length !== 1) { setNote({ text: 'Select one card to discard.', move: view.moves[0] }); return; }
    act({ type: 'discard', id: selected[0] }); setSelected([]);
  };
  const undo = () => { act({ type: 'undo' }); setSelected([]); };

  // What changed last (outlined in gold) while other players move
  const last = view.moves[0];
  const fresh = last && last.seat !== 0
    ? (last.kind === 'discard' ? 'pile' : last.kind === 'meld' || last.kind === 'takePile' ? { team: teamOf(last.seat), rank: last.rank } : null)
    : null;
  const top = topOfPile(view);
  const frozen = pileFrozen(view);
  const ourNeed = view.initialDone[0] ? null : needed(view, 0);
  const hint = !playing ? '' : !yourTurn ? `${names[view.turn]} is playing…`
    : view.phase === 'draw'
      ? 'Tap the stock to draw — or select cards that match the top of the pile, then tap the pile to take it.'
      : 'Select cards and tap Meld (or tap one of your melds to add to it). Finish by discarding one card.';
  const localNote = note && note.move === view.moves[0] ? note.text : null;
  const result = view.result;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col gap-2 select-none`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="canasta" title="Canasta" />
        </div>
        <div className="text-white/80 text-sm font-semibold min-w-0 truncate">Canasta{subtitle && <Wide> · {subtitle}</Wide>}</div>
        <div className="text-right text-[11px] md:text-xs leading-snug shrink-0">
          <div className="text-white/90 font-semibold">Us {view.scores[0]} · Them {view.scores[1]}</div>
          <div className="text-white/50">
            {ourNeed ? <><Wide>Your first meld needs</Wide><Narrow>First meld</Narrow> {ourNeed}</> : <><Wide>Your team has </Wide><Narrow>We&apos;ve </Narrow>melded</>}
          </div>
        </div>
      </header>

      {/* Other players */}
      <div className="flex justify-center gap-2 text-xs flex-wrap">
        {[1, 2, 3].map(seat => (
          <div key={seat} className={`px-3 py-1 rounded-full ${playing && view.turn === seat ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {names[seat]}{seat === 2 ? ' (partner)' : ''} · {view.hands[seat].length}<Wide> cards</Wide>{reactions[seat] ? ` ${reactions[seat]}` : ''}
          </div>
        ))}
      </div>

      <MeldArea title="Their melds" melds={view.melds[1]} redThrees={view.redThrees[1].length}
        freshRank={fresh?.team === 1 ? fresh.rank : null} />

      {/* Stock and discard pile */}
      <div className="flex justify-center items-end gap-6">
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">Stock ({view.stock.length})</p>
          <div onClick={drawCard} className={yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}>
            <PlayingCard card={{ id: 'stock', faceUp: false }} faceDown size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">
            Pile ({view.discard.length}){frozen && <span className="text-sky-300"> · ❄ frozen</span>}
            {top && isBlackThree(top) && <span className="text-amber-300"> · blocked</span>}
          </p>
          <div onClick={takePile} className={`rounded-xl ${fresh === 'pile' ? 'ring-4 ring-game-gold' : frozen ? 'ring-2 ring-sky-300' : ''} ${yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}`}>
            {top ? <CanastaCard card={top} /> : <div className={`${CARD_BOX.sm} rounded-xl border-2 border-dashed border-white/20`} />}
          </div>
        </div>
      </div>

      <MeldArea title="Our melds" melds={view.melds[0]} redThrees={view.redThrees[0].length}
        freshRank={fresh?.team === 0 ? fresh.rank : null}
        extra={!view.initialDone[0] && view.melds[0].length ? `(${meldedValue(view, 0)} of ${ourNeed})` : ''}
        onMeldClick={yourTurn && view.phase === 'play' && selected.length ? m => meld(m.rank) : undefined} />

      {/* The latest move, with the one before it underneath (fixed height, so nothing jumps) */}
      <div className="text-center min-h-[2.5rem]">
        <p className={`text-sm md:text-base font-semibold ${error || localNote ? 'text-red-300' : 'text-amber-300'}`}>
          {error || localNote || describe(view.moves[0], names, view.phase)}
        </p>
        <p className="text-xs md:text-sm text-white/40">{describe(view.moves[1], names, 'play')}</p>
      </div>

      {/* Your hand: tap cards to select several. The cards overlap less on phones
          (where they're smaller), so each card's suit still shows; they wrap into rows. */}
      <div className="flex flex-wrap justify-center gap-y-3 pt-2 pl-3 md:pl-8">
        {hand.map(c => (
          <div key={c.id} className="-ml-3 md:-ml-8">
            <CanastaCard card={c} selected={selected.includes(c.id)} onClick={yourTurn ? () => toggle(c.id) : undefined} />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
        {view.phase === 'draw' || !yourTurn ? (
          <>
            <Button variant="primary" disabled={!yourTurn || view.phase !== 'draw'} onClick={drawCard}>Draw</Button>
            <Button variant="secondary" disabled={!yourTurn || view.phase !== 'draw' || !top} onClick={takePile}>Take pile</Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!selected.length} onClick={() => meld()}>Meld</Button>
            <Button variant="gold" disabled={selected.length !== 1} onClick={discard}>Discard</Button>
            <Button variant="ghost" onClick={undo}>Undo</Button>
          </>
        )}
      </div>
      <p className="text-center text-white/50 text-xs">{hint}</p>
      {overlay}
      <TurnUpright game="Canasta" />

      {result && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : '😞'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{view.winner === 0 ? 'Your team wins!' : 'They win!'}</h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-white mb-2">
              {result.outBy == null ? 'The stock ran out' : `${names[result.outBy]} went out`}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Us</th><th>Them</th></tr></thead>
            <tbody>
              {[
                ['Canastas', r => r.natural * 500 + r.mixed * 300],
                ['Red 3s', r => r.redThrees],
                ['Going out', r => r.goingOut],
                ['Cards melded', r => r.cards],
                ['Cards in hand', r => -r.inHand],
              ].map(([name, f]) => (
                <tr key={name}><td className="text-left">{name}</td><td>{f(result.res[0])}</td><td>{f(result.res[1])}</td></tr>
              ))}
              <tr className="font-semibold border-t border-white/10"><td className="text-left">This hand</td><td>{result.res[0].total}</td><td>{result.res[1].total}</td></tr>
              <tr className="font-bold text-game-gold"><td className="text-left">Total</td><td>{view.scores[0]}</td><td>{view.scores[1]}</td></tr>
            </tbody>
          </table>
          {view.phase === 'handOver'
            ? <Button variant="gold" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
            : gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}
