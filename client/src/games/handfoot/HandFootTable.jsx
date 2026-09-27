/**
 * HandFootTable — the Hand and Foot screen, drawn from a game view (see
 * handFootEngine.js) in which the player looking at it is seat 0 — partnered
 * with seat 2 when four play; with three, everyone plays for themselves.
 * Used by the single-player game and by play-together tables.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_BOX } from '../../components/cardSizes';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import {
  act as rulesAct, sortHand, topOfPile, teamOf, minimumFor, meldedValue, bookCount, booksToGo, canGoOut,
  isWild, isBlackThree, isRedThree, isBook, isClean, ROUNDS, BOOK, CLEAN_BOOK, DIRTY_BOOK, RED_THREE, MIN_PILE,
} from './handFootRules';
import { waitingFor } from './handFootEngine';

const BG = 'from-game-bg to-cyan-900';
const SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const label = c => (c.rank === 'JK' ? 'Joker' : `${c.rank}${SUIT[c.suit]}`);
const cardCount = n => `${n} card${n === 1 ? '' : 's'}`;
const plural = (n, rank) => `${n === 1 ? 'a' : n} ${rank === 'JK' ? 'Joker' : rank}${n === 1 ? '' : 's'}`;

function HFCard({ card, size = 'sm', selected, onClick }) {
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

/** One meld: its rank and size; a finished book is red (clean) or black (dirty). */
function MeldTile({ meld, onClick, fresh }) {
  const wild = meld.cards.filter(isWild).length;
  const book = isBook(meld), clean = isClean(meld);
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`relative w-12 h-16 md:w-14 md:h-[4.5rem] rounded-xl flex flex-col items-center justify-center shrink-0 font-bold
        ${book ? (clean ? 'bg-red-50 border-4 border-red-500 text-red-700' : 'bg-gray-100 border-4 border-gray-800 text-gray-900') : 'bg-white border-2 border-gray-300 text-gray-900'}
        ${onClick ? 'ring-4 ring-game-gold cursor-pointer' : fresh ? 'ring-4 ring-game-gold scale-110' : 'cursor-default'} transition-transform`}>
      <span className="text-lg md:text-xl leading-none">{meld.rank}</span>
      <span className="text-[11px] md:text-xs">{book ? (meld.cards.length > BOOK ? `book·${meld.cards.length}` : 'book') : `${meld.cards.length}/${BOOK}`}</span>
      {wild > 0 && <span className="text-[9px] text-purple-700">{wild} wild</span>}
      {book && <span className="absolute -top-2 -right-2 text-[9px] bg-game-gold text-game-bg rounded-full px-1.5">{clean ? CLEAN_BOOK : DIRTY_BOOK}</span>}
    </button>
  );
}

/** `canTake(i)`: whether the selected cards may go on meld i (only those light up to be tapped). */
function MeldArea({ title, melds, books, onMeldClick, canTake = () => true, extra, freshRank }) {
  return (
    <div className="card-panel p-2">
      <div className="flex items-center justify-between text-xs text-white/60 mb-1 gap-2">
        <span className="font-semibold text-white/80">{title}</span>
        <span className="text-right">
          Books: {books.clean} clean · {books.dirty} dirty {extra}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-16 md:min-h-[4.5rem] items-center">
        {melds.length === 0 && <span className="text-white/30 text-xs">No melds yet</span>}
        {melds.map((m, i) => (
          <MeldTile key={`${m.rank}-${i}`} meld={m} fresh={!isBook(m) && m.rank === freshRank}
            onClick={onMeldClick && canTake(i) ? () => onMeldClick(m, i) : undefined} />
        ))}
      </div>
    </div>
  );
}

/** A move in words: "Phoebe takes the pile (7 cards) with the 9s!" */
function describe(m, names) {
  if (!m) return '';
  const you = m.seat === 0, who = names[m.seat];
  const v = (they, yours) => `${who} ${you ? yours : they}`;
  const foot = m.foot ? ` ${you ? 'You pick up your foot' : `${who} picks up their foot`}!` : '';
  switch (m.kind) {
    case 'draw': return `${v('draws', 'draw')} 2 cards.`;
    case 'takePile': return `${v('takes', 'take')} the pile (${cardCount(m.count)}) with the ${m.rank}s!`;
    case 'meld': return `${m.book ? `${v('finishes', 'finish')} a book of ${m.rank}s!`
      : m.onBook ? `${v('adds', 'add')} ${plural(m.count, m.rank)} to the book of ${m.rank}s.`
        : `${v('melds', 'meld')} ${plural(m.count, m.rank)}.`}${foot}`;
    case 'discard': return `${v('discards', 'discard')} the ${label(m.card)}.${foot}`;
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
export function HandFootTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [picked, setSelected] = useState([]);                 // ids of your selected cards
  const [note, setNote] = useState(null);                     // a hint of yours, until the next move
  const n = view.players;
  const partners = n === 4;
  // Sides (a partnership, or one player): yours is 0; the others are named after their players
  const opponents = partners ? [1] : Array.from({ length: n - 1 }, (_, i) => i + 1);
  const sideName = side => (partners ? (side === 0 ? 'Us' : 'Them') : side === 0 ? 'You' : names[side]);
  const hand = sortHand(view.hands[0]);
  const selected = picked.filter(id => hand.some(c => c.id === id));   // (cards that have left your hand drop out)
  const playing = view.phase === 'draw' || view.phase === 'play';
  const yourTurn = playing && waitingFor(view) === 0;
  const act = a => { onAction({ ...a, seat: 0 }); setNote(null); };

  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel.filter(x => hand.some(c => c.id === x)), id]));
  const drawCards = () => { if (yourTurn && view.phase === 'draw') act({ type: 'draw' }); };
  const takePile = () => { if (yourTurn && view.phase === 'draw') { act({ type: 'takePile', ids: selected }); setSelected([]); } };
  const meld = (rank, target) => { if (yourTurn && view.phase === 'play') { act({ type: 'meld', ids: selected, rank, target }); setSelected([]); } };
  const discard = () => {
    if (!yourTurn || view.phase !== 'play') return;
    if (selected.length !== 1) { setNote({ text: 'Select one card to discard.', move: view.moves[0] }); return; }
    act({ type: 'discard', id: selected[0] }); setSelected([]);
  };
  const undo = () => { act({ type: 'undo' }); setSelected([]); };

  // What changed last (outlined in gold) while other players move
  const last = view.moves[0];
  const fresh = last && last.seat !== 0
    ? (last.kind === 'discard' ? 'pile' : last.kind === 'meld' || last.kind === 'takePile' ? { team: teamOf(view, last.seat), rank: last.rank } : null)
    : null;
  const top = topOfPile(view);
  const need = view.initialDone[0] ? null : minimumFor(view);
  const ourBooks = bookCount(view, 0);
  const canOut = canGoOut(view, 0);
  const toGo = booksToGo(view, 0);
  const booksLeft = [toGo.clean && `${toGo.clean} clean`, toGo.dirty && `${toGo.dirty} dirty`].filter(Boolean).join(' + ');
  const redThrees = hand.filter(isRedThree).length;
  const hint = !playing ? '' : !yourTurn ? `${names[view.turn]} is playing…`
    : view.phase === 'draw'
      ? (view.discard.length < MIN_PILE
        ? `Tap the stock to draw 2. (The pile can be picked up once it has ${MIN_PILE} cards.)`
        : 'Tap the stock to draw 2 — or select two cards matching the top of the pile (or one and a wild card), then tap the pile to take its top 5.')
      : 'Select cards and tap Meld (or tap one of your melds to add to it). Finish by discarding one card.';
  // Which of our melds the selected cards could go on (the rules decide, so wild cards never break the limit)
  const canTake = i => {
    try { rulesAct(view, { type: 'meld', ids: selected, target: i }); return true; } catch { return false; }
  };
  const localNote = note && note.move === view.moves[0] ? note.text : null;
  const result = view.result;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col gap-2 select-none`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="handfoot" title="Hand and Foot" />
        </div>
        <div className="text-white/80 text-sm font-semibold text-center">
          Hand and Foot · Round {view.round + 1} of {ROUNDS}{subtitle ? ` · ${subtitle}` : ''}
        </div>
        <div className="text-right text-xs">
          <div className="text-white/90 font-semibold">{view.scores.map((sc, side) => `${sideName(side)} ${sc}`).join(' · ')}</div>
          <div className="text-white/50">{need ? `First meld needs ${need}` : canOut ? 'You can go out from your foot' : `To go out: ${booksLeft} more book${toGo.clean + toGo.dirty === 1 ? '' : 's'}`}</div>
        </div>
      </header>

      {/* Other players */}
      <div className="flex justify-center gap-2 text-xs flex-wrap">
        {Array.from({ length: n - 1 }, (_, i) => i + 1).map(seat => (
          <div key={seat} className={`px-3 py-1 rounded-full ${playing && view.turn === seat ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {names[seat]}{partners && seat === 2 ? ' (partner)' : ''} · {view.hands[seat].length} cards · {view.inFoot[seat] ? '🦶 in foot' : '✋ hand'}{reactions[seat] ? ` ${reactions[seat]}` : ''}
          </div>
        ))}
      </div>

      {opponents.map(side => (
        <MeldArea key={side} title={partners ? 'Their melds' : `${names[side]}'s melds`}
          melds={view.melds[side]} books={bookCount(view, side)}
          freshRank={fresh?.team === side ? fresh.rank : null} />
      ))}

      {/* Stock and discard pile */}
      <div className="flex justify-center items-end gap-6">
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">Stock ({view.stock.length})</p>
          <div onClick={drawCards} className={yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}>
            <PlayingCard card={{ id: 'stock', faceUp: false }} faceDown size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">
            Pile ({view.discard.length}){top && isBlackThree(top) && <span className="text-amber-300"> · blocked</span>}
            {view.discard.length < MIN_PILE && <span className="text-white/30"> · needs {MIN_PILE}</span>}
          </p>
          <div onClick={takePile} className={`rounded-xl ${fresh === 'pile' ? 'ring-4 ring-game-gold' : ''} ${yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}`}>
            {top ? <HFCard card={top} /> : <div className={`${CARD_BOX.sm} rounded-xl border-2 border-dashed border-white/20`} />}
          </div>
        </div>
      </div>

      <MeldArea title={partners ? 'Our melds' : 'Your melds'} melds={view.melds[0]} books={ourBooks}
        freshRank={fresh?.team === 0 ? fresh.rank : null}
        extra={!view.initialDone[0] && view.melds[0].length ? `(${meldedValue(view, 0)} of ${need})` : ''}
        onMeldClick={yourTurn && view.phase === 'play' && selected.length ? (m, i) => meld(m.rank, i) : undefined}
        canTake={canTake} />

      {/* The latest move, with the one before it underneath (fixed height, so nothing jumps) */}
      <div className="text-center min-h-[2.5rem]">
        <p className={`text-sm md:text-base font-semibold ${error || localNote ? 'text-red-300' : 'text-amber-300'}`}>
          {error || localNote || (playing ? describe(view.moves[0], names) : result && (result.outBy == null ? 'The stock has run out — the hand is over.' : `${names[result.outBy]} ${result.outBy === 0 ? 'go' : 'goes'} out!`))}
        </p>
        <p className="text-xs md:text-sm text-white/40">{playing ? describe(view.moves[1], names) : describe(view.moves[0], names)}</p>
      </div>

      {/* Your hand (or foot): tap cards to select several */}
      <p className="text-center text-white/50 text-xs">
        {view.inFoot[0] ? '🦶 Playing your foot' : `✋ Playing your hand · your foot of ${view.feet[0].length} cards is waiting`}
        {redThrees > 0 && <span className="text-red-300"> · 🔴 {redThrees === 1 ? 'a red 3' : `${redThrees} red 3s`}: −{RED_THREE * redThrees} if you&apos;re caught with {redThrees === 1 ? 'it' : 'them'} — discard {redThrees === 1 ? 'it' : 'them'}!</span>}
      </p>
      {/* Selected cards rise well clear of the row, so they're easy to see — and their whole
          top edge shows, a bigger place to tap them again (the cards still overlap as before,
          so the card next to one stays easy to tap too) */}
      <div className="flex flex-wrap justify-center gap-y-3 pt-5 pl-6 md:pl-8">
        {hand.map(c => {
          const isSelected = selected.includes(c.id);
          return (
            <div key={c.id} className={`-ml-6 md:-ml-8 transition-transform ${isSelected ? '-translate-y-4' : ''}`}>
              <HFCard card={c} selected={isSelected} onClick={yourTurn ? () => toggle(c.id) : undefined} />
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
        {view.phase === 'draw' || !yourTurn ? (
          <>
            <Button variant="primary" disabled={!yourTurn || view.phase !== 'draw'} onClick={drawCards}>Draw 2</Button>
            <Button variant="secondary" disabled={!yourTurn || view.phase !== 'draw' || view.discard.length < MIN_PILE} onClick={takePile}>Take pile</Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!selected.length} onClick={() => meld()}>Meld</Button>
            <Button variant="gold" disabled={selected.length !== 1} onClick={discard}>Discard</Button>
            <Button variant="ghost" onClick={undo}>Undo</Button>
          </>
        )}
        {yourTurn && selected.length > 0 && (
          <Button variant="ghost" onClick={() => setSelected([])}>✕ Unselect {selected.length === 1 ? 'card' : `all ${selected.length}`}</Button>
        )}
      </div>
      <p className="text-center text-white/50 text-xs">{hint}</p>
      {overlay}

      {result && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winners.includes(0) ? '🏆' : '😞'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">
                {view.winners.length > 1 ? 'It\'s a tie!' : view.winners[0] === 0 ? (partners ? 'Your team wins!' : 'You win!')
                  : partners ? 'They win!' : `${names[view.winners[0]]} wins!`}
              </h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-white mb-2">
              Round {view.round + 1}: {result.outBy == null ? 'the stock ran out' : `${names[result.outBy]} went out`}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th />{view.scores.map((_, side) => <th key={side} className="truncate max-w-[5rem]">{sideName(side)}</th>)}</tr></thead>
            <tbody>
              {[
                ['Clean books', r => r.clean * CLEAN_BOOK],
                ['Dirty books', r => r.dirty * DIRTY_BOOK],
                ['Red 3s caught', r => r.redThrees],
                ['Going out', r => r.goingOut],
                ['Cards melded', r => r.cards],
                ['Left in hands & feet', r => -r.left],
              ].map(([name, f]) => (
                <tr key={name}><td className="text-left">{name}</td>{result.res.map((r, side) => <td key={side}>{f(r)}</td>)}</tr>
              ))}
              <tr className="font-semibold border-t border-white/10"><td className="text-left">This round</td>{result.res.map((r, side) => <td key={side}>{r.total}</td>)}</tr>
              <tr className="font-bold text-game-gold"><td className="text-left">Total</td>{view.scores.map((sc, side) => <td key={side}>{sc}</td>)}</tr>
            </tbody>
          </table>
          {view.phase === 'handOver'
            ? <Button variant="gold" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next round (first meld {minimumFor({ round: view.round + 1 })})</Button>
            : gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}
