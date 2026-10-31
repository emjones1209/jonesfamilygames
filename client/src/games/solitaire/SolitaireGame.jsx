/**
 * Klondike, the classic Solitaire (rules in klondikeRules.js).
 *
 * Tap a card (with any cards on it) to move it: up to its foundation when it can go, or onto
 * the only card it fits (a King goes into an empty column); when there's a choice, the places
 * light up — tap one. Tap a picked-up card again to send it to the best place. Tap the stock
 * to turn a card. Cards nothing could still want go up to the foundations by themselves, and
 * once every card in the columns is face up, Auto-complete finishes the game.
 */
import { useEffect, useState } from 'react';
import { buildDeck, shuffle, SUITS, SUIT_SYMBOLS } from '../../utils/cardEngine';
import { destinations, applyMove, runStart, turnStock, autoHomeStep, hint, isWon, positionKey } from './klondikeRules';
import { autoStep, canAutoComplete, foundationCount } from './autoComplete';
import { SCard, Slot, SolitaireHeader, WinBox } from './SolitaireKit';
import { useBoardWidth, cardHeight, useNote, useHistory, lessMotion, secondsSince, count } from './solitaireHelpers';
import { CardCascade } from './CardCascade';
import { Button } from '../../components/Button';
import api from '../../utils/api';

const COLS = 7;

function fresh() {
  const deck = shuffle(buildDeck());
  let i = 0;
  const tableau = Array.from({ length: COLS }, (_, c) => Array.from({ length: c + 1 }, (_, r) => ({ ...deck[i++], faceUp: r === c })));
  return {
    tableau, stock: deck.slice(i).map(c => ({ ...c, faceUp: false })), waste: [],
    foundations: { spades: [], hearts: [], diamonds: [], clubs: [] }, moves: 0, started: Date.now(),
  };
}

/** The same pile (and, for `exact`, the same card in a column)? */
const same = (a, b, exact = false) => !!a && !!b && a.type === b.type
  && (a.type === 'foundation' ? a.suit === b.suit : a.type === 'waste' || (a.colIdx === b.colIdx && (!exact || a.rowIdx === b.rowIdx)));

export default function SolitaireGame() {
  const [game, setGame] = useState(fresh);
  const [sel, setSel] = useState(null);            // the cards picked up: a place (waste, column + row, foundation)
  const [shown, setShown] = useState(null);        // a hint: { from, to } or { draw: true }
  const [auto, setAuto] = useState(false);         // auto-complete running
  const [won, setWon] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [spilled, setSpilled] = useState({});      // suit → cards bounced off its foundation
  const [note, setNote] = useNote();
  const history = useHistory();
  const board = useBoardWidth(800);

  const gap = board < 500 ? 4 : 8;
  const w = Math.floor((board - gap * (COLS - 1)) / COLS);
  const h = cardHeight(w);

  // Hints fade after a moment
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [shown]);

  const finish = g => {
    if (!isWon(g) || won) return;
    setWon(true);
    setAuto(false);
    setCascading(!lessMotion());
    api.post('/scores', { game: 'solitaire', score: Math.max(0, 10000 - g.moves * 10), durationS: secondsSince(g.started) }).catch(() => {});
  };

  // After each move: cards nothing could still want go up by themselves, one at a time
  // (auto-complete plays everything out, drawing through the stock). These count with the move for Undo.
  useEffect(() => {
    if (won) return;
    const next = auto ? autoStep(game) : autoHomeStep(game);
    if (!next && !auto) return;
    const t = setTimeout(() => {
      if (!next) { setAuto(false); return; }
      const { kind: _kind, ...g } = next;
      setGame(g);
      finish(g);
    }, auto ? (next?.kind === 'draw' ? 60 : 100) : 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, auto, won]);

  const change = next => {
    history.push(game);
    const g = { ...next, moves: game.moves + 1 };
    setGame(g);
    setSel(null);
    setShown(null);
    finish(g);
  };
  const play = (from, to) => change(applyMove(game, { from, to }));
  const restart = () => { setGame(fresh()); history.clear(); setSel(null); setShown(null); setAuto(false); setWon(false); setCascading(false); setSpilled({}); };
  const undo = () => { const last = history.pop(); if (last) { setGame(last); setSel(null); setShown(null); setAuto(false); } };

  const draw = () => {
    if (auto || won) return;
    const next = turnStock(game);
    if (next) change(next); else setSel(null);
  };

  // Tap a card (the waste's top card, one in a column, or a foundation's)
  const tap = from => {
    if (auto || won) return;
    // Something picked up already: this pile is where it goes (if it fits)
    if (sel && !same(sel.from, from)) {
      const to = from.type === 'tableau' ? { type: 'tableau', colIdx: from.colIdx } : from.type === 'foundation' ? from : null;
      if (to && destinations(game, sel.from).some(d => same(d, to))) { play(sel.from, to); return; }
    }
    if (sel && same(sel.from, from, true)) {
      const best = destinations(game, from)[0];
      if (best) play(from, best); else setSel(null);
      return;
    }
    if (from.type === 'tableau') {
      const col = game.tableau[from.colIdx];
      if (!col[from.rowIdx].faceUp) { setSel(null); return; }
      if (from.rowIdx < runStart(col)) { setSel(null); setNote('Only cards in order (down, alternating colours) move together.'); return; }
    }
    const dests = destinations(game, from);
    if (!dests.length) { setSel(null); setNote('There\'s nowhere for that to go yet.'); return; }
    // (A card on a foundation is only picked up — taking one back down is never by accident)
    if (from.type !== 'foundation') {
      const up = dests.find(d => d.type === 'foundation');
      const onCards = dests.filter(d => d.type === 'tableau' && game.tableau[d.colIdx].length);
      if (up) { play(from, up); return; }
      if (onCards.length === 1) { play(from, onCards[0]); return; }
      if (!onCards.length) { play(from, dests[0]); return; }     // (a King: any empty column will do)
    }
    setSel({ from });
  };
  // Tap an empty place (a column, a foundation, or the space below a column)
  const tapPlace = to => {
    if (!sel || auto) return;
    if (destinations(game, sel.from).some(d => same(d, to))) play(sel.from, to);
    else setSel(null);
  };
  const showHint = () => {
    if (auto || won) return;
    const x = hint(game, new Set([...history.states, game].map(positionKey)));   // (never back to a position you've had)
    setSel(null);
    if (!x) { setNote('Nothing useful left to do. Try Undo, or start a new game.'); return; }
    setShown(x);
  };

  const targets = sel ? destinations(game, sel.from) : [];
  const isTarget = p => targets.some(d => same(d, p));
  const isHintTo = p => !!shown?.to && same(shown.to, p);
  const markFor = (place, last) => {
    if (sel && same(sel.from, place) && (place.type !== 'tableau' || place.rowIdx >= sel.from.rowIdx)) return 'selected';
    if (shown?.from && same(shown.from, place) && (place.type !== 'tableau' || place.rowIdx >= shown.from.rowIdx)) return 'hint';
    if (last && isHintTo(place)) return 'hint';
    if (last && isTarget(place)) return 'target';
    return null;
  };
  const slotMark = p => (isHintTo(p) ? 'hint' : isTarget(p) ? 'target' : null);

  // How far apart cards sit in a column: closer together when a column gets long
  const room = Math.max(h * 3, window.innerHeight - h - 200);
  const layout = col => {
    const down = col.filter(c => !c.faceUp).length;
    let downStep = Math.round(w * 0.22), upStep = Math.round(w * 0.5);
    const up = Math.max(0, col.length - down - 1);
    const need = down * downStep + up * upStep;
    if (need + h > room && need > 0) {
      const f = (room - h) / need;
      downStep = Math.max(3, Math.floor(downStep * f));
      upStep = Math.max(Math.round(w * 0.32), Math.floor(upStep * f));
    }
    let y = 0;
    const tops = col.map((c, i) => { const t = y; y += i < col.length - 1 ? (c.faceUp ? upStep : downStep) : 0; return t; });
    return { tops, height: (tops.at(-1) ?? 0) + h };
  };

  const waste = game.waste[0];
  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      <SolitaireHeader title="Solitaire" rulesGame="solitaire" status={`${foundationCount(game)} of 52 up · ${count(game.moves, 'move')}`}
        onUndo={undo} canUndo={history.canUndo && !won && !auto} onRestart={restart} onHint={showHint} />

      {/* The stock and the waste, then the foundations — lined up with the columns */}
      <div className="flex justify-center mb-3" style={{ gap }}>
        <div onClick={draw} className="cursor-pointer" aria-label={game.stock.length ? 'Turn a card' : 'Turn the waste back over'}>
          {game.stock.length
            ? <SCard card={{ faceUp: false }} faceDown w={w} mark={shown?.draw ? 'hint' : null} />
            : <Slot w={w} label={game.waste.length ? '↺' : ''} mark={shown?.draw ? 'hint' : null} />}
        </div>
        {/* (Keyed by card, so each card turned over is drawn afresh) */}
        {waste
          ? <SCard key={waste.id} card={waste} w={w} mark={markFor({ type: 'waste' }, true)} onClick={() => tap({ type: 'waste' })} />
          : <Slot w={w} />}
        <div style={{ width: w }} />
        {SUITS.map(suit => {
          const pile = game.foundations[suit];
          const left = pile.length - (spilled[suit] ?? 0);      // (the finale bounces them off one by one)
          const place = { type: 'foundation', suit };
          return (
            <div key={suit} data-cascade={suit}>
              {left > 0
                ? <SCard card={pile[left - 1]} w={w} mark={markFor(place, true)} onClick={() => tap(place)} />
                : <Slot w={w} label={SUIT_SYMBOLS[suit]} mark={slotMark(place)} onClick={() => tapPlace(place)} />}
            </div>
          );
        })}
      </div>

      <p className="text-center text-amber-300 text-sm min-h-[1.25rem] mb-1">{note}</p>

      <div className="flex justify-center" style={{ gap }}>
        {game.tableau.map((col, colIdx) => {
          const { tops, height } = layout(col);
          const place = { type: 'tableau', colIdx };
          return (
            <div key={colIdx} data-column={colIdx} className="relative" style={{ width: w, height: height + h * 0.6 }}
              onClick={() => tapPlace(place)}>
              {!col.length && <Slot w={w} label="K" mark={slotMark(place)} />}
              {col.map((card, rowIdx) => (
                <div key={card.id} data-col={colIdx} data-idx={rowIdx} className="absolute left-0" style={{ top: tops[rowIdx], zIndex: rowIdx }}
                  onClick={e => { e.stopPropagation(); tap({ type: 'tableau', colIdx, rowIdx }); }}>
                  <SCard card={card} w={w} mark={card.faceUp ? markFor({ type: 'tableau', colIdx, rowIdx }, rowIdx === col.length - 1) : null} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Once every card in the columns is face up, the game can finish itself */}
      <div className="flex justify-center mt-2">
        {canAutoComplete(game) && !auto && !won && (
          <Button variant="gold" className="text-sm animate-pulse" onClick={() => { history.push(game); setSel(null); setShown(null); setAuto(true); }}>✨ Auto-complete</Button>
        )}
      </div>

      {cascading && (
        <CardCascade piles={SUITS.map(suit => ({ key: suit, cards: game.foundations[suit] }))}
          onLaunch={suit => setSpilled(sp => ({ ...sp, [suit]: (sp[suit] ?? 0) + 1 }))}
          onDone={() => setCascading(false)} />
      )}
      <WinBox show={won && !cascading} onAgain={restart} lines={[count(game.moves, 'move')]} />
    </div>
  );
}
