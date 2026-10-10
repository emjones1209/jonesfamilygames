/**
 * HandFootTable — the Hand and Foot screen, drawn from a game view (see
 * handFootEngine.js) in which the player looking at it is seat 0 — partnered
 * with seat 2 when four play; with three, everyone plays for themselves.
 * Used by the single-player game and by play-together tables.
 */
import { useState, useRef, useLayoutEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_BOX } from '../../components/cardSizes';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { Wide, Narrow } from '../../components/Wide';
import { TurnUpright } from '../../components/TurnUpright';
import { ResultPanel } from '../cards/GameSetup';
import {
  act as rulesAct, sortHand, topOfPile, teamOf, minimumFor, meldedValue, valueOf, bookCount, booksToGo, canGoOut,
  isWild, isBlackThree, isRedThree, isBook, isClean, ROUNDS, BOOK, CLEAN_BOOK, DIRTY_BOOK, RED_THREE, MIN_PILE, RANK_ORDER, TAKE,
} from './handFootRules';

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

// Your team's melds are drawn bigger than everyone else's, so they're easy to tell apart
const TILE = {
  ours: { box: 'w-14 h-[4.5rem] md:w-[4.5rem] md:h-24', rank: 'text-xl md:text-2xl', count: 'text-xs md:text-sm' },
  theirs: { box: 'w-11 h-14 md:w-12 md:h-16', rank: 'text-base md:text-lg', count: 'text-[10px] md:text-[11px]' },
};

/** One meld: its rank and size; a finished book is red (pure: no wild cards) or black (impure). */
function MeldTile({ meld, onClick, fresh, ours }) {
  const tile = TILE[ours ? 'ours' : 'theirs'];
  const wild = meld.cards.filter(isWild).length;
  const book = isBook(meld), clean = isClean(meld);
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`relative ${tile.box} rounded-xl flex flex-col items-center justify-center shrink-0 font-bold
        ${book ? (clean ? 'bg-red-50 border-4 border-red-500 text-red-700' : 'bg-gray-100 border-4 border-gray-800 text-gray-900') : 'bg-white border-2 border-gray-300 text-gray-900'}
        ${onClick ? 'ring-4 ring-game-gold cursor-pointer' : fresh ? 'ring-4 ring-game-gold scale-110' : 'cursor-default'} transition-transform`}>
      <span className={`${tile.rank} leading-none`}>{meld.rank}</span>
      <span className={tile.count}>{book ? (meld.cards.length > BOOK ? `book·${meld.cards.length}` : 'book') : `${meld.cards.length}/${BOOK}`}</span>
      {wild > 0 && <span className="text-[9px] text-purple-700">{wild} wild</span>}
      {book && <span className={`absolute -right-2 text-game-bg bg-game-gold rounded-full ${ours ? '-top-2 text-[9px] px-1.5' : '-top-2.5 text-[8px] px-1'}`}>{clean ? CLEAN_BOOK : DIRTY_BOOK}</span>}
    </button>
  );
}

/**
 * Your side's points on the table, always in the same place (so nothing below it moves).
 * Until the side's first meld: the round's minimum, big, with how far the melds — and the
 * cards you've selected — get you towards it. (Shown until every side has made its first meld.)
 */
function MeldMeter({ need, laid, picked }) {
  if (!need) {
    return (
      <div className="h-9 md:h-10 mb-1 flex items-center gap-2 text-sm md:text-base">
        <span className="text-green-300 font-semibold">✅ First meld down</span>
        <span className="text-white/70 ml-auto">Laid down <span className="text-white font-bold text-lg md:text-xl">{laid}</span> pts</span>
      </div>
    );
  }
  const total = laid + picked;
  const pct = n => `${Math.min(100, (n / need) * 100)}%`;
  return (
    <div className="h-9 md:h-10 mb-1 flex flex-col justify-center gap-1">
      <div className="flex items-baseline gap-2 text-sm md:text-base whitespace-nowrap">
        <span className="text-game-gold font-bold">🎯 First meld: {need} pts</span>
        <span className="ml-auto text-white/80">
          <span className={`font-bold text-lg md:text-xl ${total >= need ? 'text-green-300' : 'text-white'}`}>{total}</span> / {need}
          {picked > 0 && <span className="text-xs text-white/50"> (+{picked}<Wide> selected</Wide>)</span>}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-white/30 transition-all" style={{ width: pct(total) }} />
        <div className={`absolute inset-y-0 left-0 transition-all ${total >= need ? 'bg-green-400' : 'bg-game-gold'}`} style={{ width: pct(laid) }} />
      </div>
    </div>
  );
}

/** `canTake(i)`: whether the selected cards may go on meld i (only those light up to be tapped). */
function MeldArea({ title, melds, books, onMeldClick, canTake = () => true, points, meter, freshRank, ours = false }) {
  return (
    <div className="card-panel p-2">
      <div className="flex items-center justify-between text-xs text-white/60 mb-1 gap-2">
        <span className="font-semibold text-white/80">{title}</span>
        <span className="text-right">
          Books: {books.clean} pure · {books.dirty} impure{points != null && <> · <span className="text-white/80 font-semibold">{points}</span> pts</>}
        </span>
      </div>
      {meter}
      <div className={`flex flex-wrap gap-1.5 items-center ${ours ? 'min-h-[4.5rem] md:min-h-24' : 'min-h-[2.5rem] md:min-h-16'}`}>
        {melds.length === 0 && <span className="text-white/30 text-xs">No melds yet</span>}
        {/* Highest rank first (A, K, Q … 4), not in the order they were laid down; `i` stays
            the meld's place in the side's list, which is how moves name it */}
        {melds.map((m, i) => ({ m, i }))
          .sort((a, b) => RANK_ORDER.indexOf(a.m.rank) - RANK_ORDER.indexOf(b.m.rank) || a.i - b.i)
          .map(({ m, i }) => (
          <MeldTile key={`${m.rank}-${i}`} meld={m} ours={ours} fresh={!isBook(m) && m.rank === freshRank}
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
    case 'askOut': return `${v('asks', 'ask')} ${(m.seat + 2) % 4 === 0 ? 'you' : names[(m.seat + 2) % 4]}: “May I go out?”`;
    case 'answerOut': return m.yes
      ? `${v('says', 'say')} yes — ${m.asker === 0 ? 'you may go out!' : `${names[m.asker]} may go out.`}`
      : `${v('says', 'say')} not yet — ${m.asker === 0 ? 'no going out this turn.' : `${names[m.asker]} can't go out this turn.`}`;
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
  const [peeking, setPeeking] = useState(false);              // looking at the top of the pile (Jones family rules)
  const handRow = useRef(null);
  const n = view.players;
  const partners = n === 4;
  // Sides (a partnership, or one player): yours is 0; the others are named after their players
  const opponents = partners ? [1] : Array.from({ length: n - 1 }, (_, i) => i + 1);
  const sideName = side => (partners ? (side === 0 ? 'Us' : 'Them') : side === 0 ? 'You' : names[side]);
  const hand = sortHand(view.hands[0]);
  const selected = picked.filter(id => hand.some(c => c.id === id));   // (cards that have left your hand drop out)
  const playing = view.phase === 'draw' || view.phase === 'play';
  // Your own turn (not while you're waiting for your partner's answer about going out)…
  const yourTurn = playing && view.turn === 0 && view.outAsk !== 'asking';
  // …or your partner is asking you if they may go out (Jones family rules)
  const answering = playing && partners && view.turn === 2 && view.outAsk === 'asking';
  const partnerName = names[(view.turn + 2) % 4];
  const act = a => { onAction({ ...a, seat: 0 }); setNote(null); };

  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel.filter(x => hand.some(c => c.id === x)), id]));
  const drawCards = () => { if (yourTurn && view.phase === 'draw') { act({ type: 'draw' }); setPeeking(false); } };
  const takePile = () => { if (yourTurn && view.phase === 'draw') { act({ type: 'takePile', ids: selected }); setSelected([]); setPeeking(false); } };
  // Jones family rules: before choosing, you may look at the cards you'd get by taking the pile
  const canPeek = yourTurn && view.phase === 'draw' && view.discard.length > 0;
  const showPeek = peeking && canPeek;
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
  // Once every side has made its first meld, the points meter has done its job: it goes away
  const allDown = view.initialDone.every(Boolean);
  const ourBooks = bookCount(view, 0);
  const canOut = canGoOut(view, 0);
  const toGo = booksToGo(view, 0);
  const booksLeft = [toGo.clean && `${toGo.clean} pure`, toGo.dirty && `${toGo.dirty} impure`].filter(Boolean).join(' + ');
  const redThrees = hand.filter(isRedThree).length;
  const hint = !playing ? '' : answering ? ''
    : view.outAsk === 'asking' ? `${view.turn === 0 ? 'You ask' : `${names[view.turn]} asks`} ${partnerName} about going out…`
      : !yourTurn ? `${names[view.turn]} is playing…`
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
  // Nothing below your hand moves during your turn: before you draw, the hand keeps room for
  // the 2 cards to come (drawing and taking the pile both leave you 2 cards more), and it
  // doesn't shrink back as you meld until your turn is over
  const roomToDraw = yourTurn && view.phase === 'draw' ? 2 : 0;
  useLayoutEffect(() => {
    const el = handRow.current;
    if (!el) return;
    if (!yourTurn) { el.style.minHeight = ''; return; }
    el.style.minHeight = `${el.offsetHeight}px`;
  });
  const result = view.result;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col gap-2 select-none`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="handfoot" title="Hand and Foot" />
        </div>
        <div className="text-white/80 text-sm font-semibold text-center min-w-0">
          <Wide>Hand and Foot · </Wide>Round {view.round + 1} of {ROUNDS}{subtitle && <Wide> · {subtitle}</Wide>}
        </div>
        <div className="text-right text-[11px] md:text-xs leading-snug shrink-0 max-w-[55%] md:max-w-none">
          <div className="text-white/90 font-semibold">{view.scores.map((sc, side) => `${sideName(side)} ${sc}`).join(' · ')}</div>
          <div className="text-white/50">
            {need ? <span className="text-game-gold font-semibold">First meld {need}</span> : canOut ? <><Wide>You can go out from your foot</Wide><Narrow>You can go out</Narrow></>
              : <><Wide>To go out: </Wide>{booksLeft} more book{toGo.clean + toGo.dirty === 1 ? '' : 's'}<Narrow> to go out</Narrow></>}
          </div>
        </div>
      </header>

      {/* Other players */}
      <div className="flex justify-center gap-2 text-xs flex-wrap">
        {Array.from({ length: n - 1 }, (_, i) => i + 1).map(seat => (
          <div key={seat} className={`px-3 py-1 rounded-full ${playing && view.turn === seat ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {names[seat]}{partners && seat === 2 ? ' (partner)' : ''} · {view.hands[seat].length}<Wide> cards</Wide> · {view.inFoot[seat] ? '🦶' : '✋'}<Wide>{view.inFoot[seat] ? ' in foot' : ' hand'}</Wide>{reactions[seat] ? ` ${reactions[seat]}` : ''}
          </div>
        ))}
      </div>

      {opponents.map(side => (
        <MeldArea key={side} title={partners ? 'Their melds' : `${names[side]}'s melds`}
          melds={view.melds[side]} books={bookCount(view, side)} points={allDown ? null : meldedValue(view, side)}
          freshRank={fresh?.team === side ? fresh.rank : null} />
      ))}

      {/* Stock and discard pile. The layout never changes size as play goes on: the peek
          button keeps its place even when it's hidden, and the top of the pile opens out to
          the right of the pile (in space kept free for it) instead of pushing your hand down */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] gap-x-6 items-end">
        <div className="col-start-2 flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1 whitespace-nowrap">Stock {view.stock.length}</p>
          <div onClick={drawCards} className={yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}>
            <PlayingCard card={{ id: 'stock', faceUp: false }} faceDown size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1 whitespace-nowrap">Pile {view.discard.length}</p>
          <div onClick={takePile} className={`rounded-xl ${fresh === 'pile' ? 'ring-4 ring-game-gold' : ''} ${yourTurn && view.phase === 'draw' ? 'cursor-pointer' : ''}`}>
            {top ? <HFCard card={top} /> : <div className={`${CARD_BOX.sm} rounded-xl border-2 border-dashed border-white/20`} />}
          </div>
        </div>
        <div className="flex flex-col items-start min-w-0" aria-live="polite">
          {showPeek && (
            <>
              <p className="text-white/60 text-[10px] md:text-xs mb-1 whitespace-nowrap">
                {view.discard.length >= TAKE ? `You'd get these ${TAKE}` : 'Top cards'}
              </p>
              <div className="flex pl-7 md:pl-10">
                {view.discard.slice(-TAKE).map(c => <div key={c.id} className="-ml-7 md:-ml-10"><HFCard card={c} /></div>)}
              </div>
            </>
          )}
        </div>
        <div className="col-span-4 flex justify-center items-center gap-2 mt-1 min-h-[32px] text-xs whitespace-nowrap">
          {top && isBlackThree(top) && <span className="text-amber-300">Pile blocked</span>}
          {view.discard.length < MIN_PILE && <span className="text-white/30">Pile needs {MIN_PILE}</span>}
          <button onClick={() => setPeeking(p => !p)} aria-expanded={showPeek} disabled={!canPeek}
            className={`text-white/70 hover:text-white bg-white/10 rounded-full px-3 min-h-[32px] ${canPeek ? '' : 'invisible'}`}>
            {showPeek ? '🙈 Hide' : `👀 Look at top ${Math.min(TAKE, view.discard.length)}`}
          </button>
        </div>
      </div>

      <MeldArea ours title={partners ? 'Our melds' : 'Your melds'} melds={view.melds[0]} books={ourBooks}
        freshRank={fresh?.team === 0 ? fresh.rank : null}
        points={allDown ? null : meldedValue(view, 0)}
        meter={!allDown && <MeldMeter need={need} laid={meldedValue(view, 0)}
          picked={yourTurn ? valueOf(hand.filter(c => selected.includes(c.id) && !isRedThree(c) && !isBlackThree(c))) : 0} />}
        onMeldClick={yourTurn && view.phase === 'play' && selected.length ? (m, i) => meld(m.rank, i) : undefined}
        canTake={canTake} />

      {/* The latest move, with the one before it underneath (fixed height, so nothing jumps) */}
      <div className="text-center min-h-[2.5rem] md:min-h-[2.75rem]">
        <p className={`text-sm md:text-base font-semibold ${error || localNote ? 'text-red-300' : 'text-amber-300'}`}>
          {error || localNote || (playing ? describe(view.moves[0], names) : result && (result.outBy == null ? 'The stock has run out — the hand is over.' : `${names[result.outBy]} ${result.outBy === 0 ? 'go' : 'goes'} out!`))}
        </p>
        <p className="text-xs md:text-sm text-white/40">{playing ? describe(view.moves[1], names) : describe(view.moves[0], names)}</p>
      </div>

      {/* Your hand (or foot): tap cards to select several */}
      <p className="text-center text-white/50 text-xs min-h-[2rem] md:min-h-0">
        {view.inFoot[0] ? '🦶 Playing your foot' : `✋ Playing your hand · your foot of ${view.feet[0].length} cards is waiting`}
        {redThrees > 0 && <span className="text-red-300"> · 🔴 {redThrees === 1 ? 'a red 3' : `${redThrees} red 3s`}: −{RED_THREE * redThrees} if you&apos;re caught with {redThrees === 1 ? 'it' : 'them'} — discard {redThrees === 1 ? 'it' : 'them'}!</span>}
      </p>
      {/* Selected cards rise well clear of the row, so they're easy to see — and their whole
          top edge shows, a bigger place to tap them again (the cards still overlap as before,
          so the card next to one stays easy to tap too) */}
      {/* (On phones the cards are smaller, so they overlap less: each one's suit still shows) */}
      <div ref={handRow} className="flex flex-wrap justify-center content-start gap-y-3 pt-5 pl-3 md:pl-8">
        {hand.map(c => {
          const isSelected = selected.includes(c.id);
          return (
            <div key={c.id} className={`-ml-3 md:-ml-8 transition-transform ${isSelected ? '-translate-y-4' : ''}`}>
              <HFCard card={c} selected={isSelected} onClick={yourTurn ? () => toggle(c.id) : undefined} />
            </div>
          );
        })}
        {Array.from({ length: roomToDraw }, (_, i) => (
          <div key={`room-${i}`} aria-hidden className="-ml-3 md:-ml-8 invisible"><div className={CARD_BOX.sm} /></div>
        ))}
      </div>

      {/* Going out needs your partner's say-so (Jones family rules). This line keeps its place
          (with partners) so the buttons under it never move */}
      {partners && !answering && (
        <div className="min-h-[36px] flex items-center justify-center">
          {yourTurn && view.inFoot[0] && canOut && !view.outAsk ? (
            // (only once your side has all the books it needs to go out)
            <button onClick={() => act({ type: 'askOut' })}
              className="text-sm font-semibold text-white bg-game-accent rounded-full px-4 min-h-[36px]">🙋 Ask to go out</button>
          ) : view.turn === 0 && view.outAsk && playing && (
            <p className={`text-center text-sm font-semibold ${view.outAsk === 'yes' ? 'text-green-300' : view.outAsk === 'no' ? 'text-red-300' : 'text-amber-300 animate-pulse'}`}>
              {view.outAsk === 'asking' ? `Waiting for ${partnerName} to answer…`
                : view.outAsk === 'yes' ? `✅ ${partnerName} says yes — you may go out!` : `✋ ${partnerName} says not yet — no going out this turn.`}
            </p>
          )}
        </div>
      )}
      {answering ? (
        <div className="card-panel p-4 border-2 border-game-gold text-center flex flex-col gap-3 self-center w-full max-w-sm">
          <p className="text-white text-lg font-bold">{names[view.turn]} asks: “May I go out?”</p>
          <p className="text-white/60 text-xs">Going out ends the hand: cards still in your hand (and a foot you haven&apos;t reached) count against your team.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="gold" onClick={() => act({ type: 'answerOut', yes: true })}>Yes, go out</Button>
            <Button variant="ghost" onClick={() => act({ type: 'answerOut', yes: false })}>Not yet</Button>
          </div>
        </div>
      ) : (
      // Four places that never move: what's in them changes from drawing to playing, and
      // Unselect keeps its place (hidden) when no cards are selected
      <div className="grid grid-cols-4 gap-2 w-full max-w-xl self-center [&>*]:w-full [&>*]:px-1 [&>*]:text-sm md:[&>*]:text-base">
        {view.phase === 'draw' || !yourTurn ? (
          <>
            <Button variant="primary" disabled={!yourTurn || view.phase !== 'draw'} onClick={drawCards}>Draw 2</Button>
            <Button variant="secondary" disabled={!yourTurn || view.phase !== 'draw' || view.discard.length < MIN_PILE} onClick={takePile}>Take pile</Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!selected.length} onClick={() => meld()}>Meld</Button>
            <Button variant="gold" disabled={selected.length !== 1} onClick={discard}>Discard</Button>
          </>
        )}
        <Button variant="ghost" disabled={!yourTurn || view.phase !== 'play'} onClick={undo}>Undo</Button>
        <Button variant="ghost" disabled={!yourTurn || !selected.length} onClick={() => setSelected([])}
          className={yourTurn && selected.length ? '' : 'invisible'}>✕ Unselect</Button>
      </div>
      )}
      <p className="text-center text-white/50 text-xs">{hint}</p>
      {overlay}
      <TurnUpright game="Hand and Foot" />

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
                ['Pure books', r => r.clean * CLEAN_BOOK],
                ['Impure books', r => r.dirty * DIRTY_BOOK],
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
