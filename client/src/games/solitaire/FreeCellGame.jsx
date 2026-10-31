/**
 * FreeCell (rules in freecellRules.js).
 *
 * Tap a card (with any run below it) to move it: up to its foundation when it can go, or
 * onto the only column it fits; when there's a choice, the places light up — tap one. Tap a
 * picked-up card again to send it to the best place. Cards nothing could still want go up
 * to the foundations by themselves, and once every column runs downwards, Auto-complete
 * finishes the game.
 */
import { useEffect, useState } from 'react';
import { SUITS, SUIT_SYMBOLS } from '../../utils/cardEngine';
import {
  newFreecell, runStart, move, destinations, autoHomeStep, canAutoComplete, finishStep, hint, isWon, homeCount, positionKey, CELLS, COLS,
} from './freecellRules';
import { SCard, Slot, SolitaireHeader, WinBox } from './SolitaireKit';
import { useBoardWidth, cardHeight, useNote, useHistory, lessMotion, secondsSince, count } from './solitaireHelpers';
import { CardCascade } from './CardCascade';
import { Button } from '../../components/Button';
import api from '../../utils/api';

const fresh = () => ({ ...newFreecell(), started: Date.now() });
const same = (a, b) => a && b && a.type === b.type && (a.type === 'home' ? a.suit === b.suit : a.i === b.i);

export default function FreeCellGame() {
  const [game, setGame] = useState(fresh);
  const [sel, setSel] = useState(null);            // { from, idx }
  const [shown, setShown] = useState(null);        // a hint: { from, idx, to }
  const [auto, setAuto] = useState(false);         // auto-complete running
  const [won, setWon] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [spilled, setSpilled] = useState({});
  const [note, setNote] = useNote();
  const history = useHistory();
  const board = useBoardWidth(860);

  const gap = board < 500 ? 4 : 8;
  const w = Math.floor((board - gap * (COLS - 1)) / COLS);
  const h = cardHeight(w);

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
    api.post('/scores', { game: 'freecell', score: Math.max(0, 10000 - g.moves * 10), durationS: secondsSince(g.started) }).catch(() => {});
  };

  // After each move: cards nothing could still want go up by themselves, one at a time
  // (auto-complete sends up any card that fits). These count with the move for Undo.
  useEffect(() => {
    if (won) return;
    const next = auto ? finishStep(game) : autoHomeStep(game);
    if (!next && !auto) return;
    const t = setTimeout(() => {
      if (!next) { setAuto(false); return; }
      setGame(next);
      finish(next);
    }, auto ? 90 : 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, auto, won]);

  const play = (from, idx, to) => {
    history.push(game);
    const next = move(game, from, idx, to);
    setGame(next);
    setSel(null);
    setShown(null);
    finish(next);
  };
  const restart = () => { setGame(fresh()); history.clear(); setSel(null); setShown(null); setAuto(false); setWon(false); setCascading(false); setSpilled({}); };
  const undo = () => { const last = history.pop(); if (last) { setGame(last); setSel(null); setShown(null); setAuto(false); } };

  // Tap a card (in a column, a cell or on a foundation)
  const tap = (from, idx) => {
    if (auto || won) return;
    if (sel && !same(sel.from, from)) {
      const to = from.type === 'home' ? { type: 'home', suit: from.suit } : from;
      if (destinations(game, sel.from, sel.idx).some(d => same(d, to))) { play(sel.from, sel.idx, to); return; }
    }
    if (sel && same(sel.from, from) && sel.idx === idx) {
      const best = destinations(game, from, idx)[0];
      if (best) play(from, idx, best); else setSel(null);
      return;
    }
    if (from.type === 'col' && idx < runStart(game.cols[from.i])) { setSel(null); setNote('Only cards in order (down, alternating colours) move together.'); return; }
    const dests = destinations(game, from, idx);
    if (!dests.length) {
      setSel(null);
      setNote(from.type === 'col' && game.cols[from.i].length - idx > 1 ? 'Not enough free cells and empty columns to move that many cards.' : 'There\'s nowhere for that to go yet.');
      return;
    }
    const homeTo = dests.find(d => d.type === 'home');
    const onCards = dests.filter(d => d.type === 'col' && game.cols[d.i].length);
    const others = dests.filter(d => d.type !== 'home');
    if (homeTo) { play(from, idx, homeTo); return; }
    if (onCards.length === 1) { play(from, idx, onCards[0]); return; }
    if (!onCards.length && others.length && others.every(d => d.type === 'cell')) { play(from, idx, others[0]); return; }
    setSel({ from, idx });
  };
  // Tap an empty place (a column, a cell, a foundation)
  const tapPlace = to => {
    if (!sel || auto) return;
    if (destinations(game, sel.from, sel.idx).some(d => same(d, to))) play(sel.from, sel.idx, to);
    else setSel(null);
  };
  const showHint = () => {
    const x = hint(game, new Set([...history.states, game].map(positionKey)));   // (never back to a position you've had)
    if (!x) { setNote('No moves left. Try Undo, or start a new game.'); return; }
    setSel(null);
    if (!x.from) setNote(x.why);                     // (no way to win, and nothing to point at)
    if (x.from) setShown(x);
  };

  const targets = sel ? destinations(game, sel.from, sel.idx) : [];
  const isTarget = p => targets.some(d => same(d, p)) || (shown && same(shown.to, p));
  const markFor = (place, idx, last) => {
    if (sel && same(sel.from, place) && idx >= sel.idx) return 'selected';
    if (shown && same(shown.from, place) && idx >= shown.idx) return 'hint';
    if (last && isTarget(place)) return shown && same(shown.to, place) ? 'hint' : 'target';
    return null;
  };

  // Long columns close up so they fit the screen
  const room = Math.max(h * 3, window.innerHeight - 260);
  const stepFor = n => Math.max(Math.round(w * 0.3), Math.min(Math.round(w * 0.5), n > 1 ? Math.floor((room - h) / (n - 1)) : 0));
  const homes = SUITS.map(suit => ({ key: `fc-${suit}`, cards: game.home[suit] }));

  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      <SolitaireHeader title="FreeCell" rulesGame="freecell" status={`${homeCount(game)} of 52 home · ${count(game.moves, 'move')}`}
        onUndo={undo} canUndo={history.canUndo && !won && !auto} onRestart={restart} onHint={showHint} />

      {/* Free cells, then the foundations */}
      <div className="flex justify-center mb-3" style={{ gap }}>
        {Array.from({ length: CELLS }, (_, i) => {
          const c = game.cells[i];
          const place = { type: 'cell', i };
          return c
            ? <SCard key={`cell${i}`} card={c} w={w} mark={markFor(place, 0, true)} onClick={() => tap(place, 0)} />
            : <Slot key={`cell${i}`} w={w} label="" mark={isTarget(place) ? (shown && same(shown.to, place) ? 'hint' : 'target') : null} onClick={() => tapPlace(place)} />;
        })}
        {SUITS.map(suit => {
          const pile = game.home[suit];
          const left = pile.length - (spilled[`fc-${suit}`] ?? 0);
          const place = { type: 'home', suit };
          return (
            <div key={suit} data-cascade={`fc-${suit}`} className={suit === SUITS[0] ? 'ml-2' : ''}>
              {left > 0
                ? <SCard card={pile[left - 1]} w={w} mark={markFor(place, 0, true)} onClick={() => tap(place, 0)} />
                : <Slot w={w} label={SUIT_SYMBOLS[suit]} mark={isTarget(place) ? 'target' : null} onClick={() => tapPlace(place)} />}
            </div>
          );
        })}
      </div>

      <p className="text-center text-amber-300 text-sm min-h-[1.25rem] mb-1">{note}</p>

      <div className="flex justify-center" style={{ gap }}>
        {game.cols.map((col, i) => {
          const step = stepFor(col.length);
          const place = { type: 'col', i };
          return (
            <div key={i} data-column={i} className="relative" style={{ width: w, height: Math.max(h, (col.length - 1) * step + h) + h * 0.6 }}
              onClick={() => tapPlace(place)}>
              {!col.length && <Slot w={w} mark={isTarget(place) ? (shown && same(shown.to, place) ? 'hint' : 'target') : null} />}
              {col.map((card, idx) => (
                <div key={card.id} data-col={i} data-idx={idx} className="absolute left-0" style={{ top: idx * step, zIndex: idx }}
                  onClick={e => { e.stopPropagation(); tap(place, idx); }}>
                  <SCard card={card} w={w} mark={markFor(place, idx, idx === col.length - 1)} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Once every column runs downwards, the game can finish itself */}
      <div className="flex justify-center mt-2">
        {canAutoComplete(game) && !auto && !won && (
          <Button variant="gold" className="text-sm animate-pulse" onClick={() => { history.push(game); setSel(null); setAuto(true); }}>✨ Auto-complete</Button>
        )}
      </div>

      {cascading && (
        <CardCascade piles={homes}
          onLaunch={key => setSpilled(sp => ({ ...sp, [key]: (sp[key] ?? 0) + 1 }))}
          onDone={() => setCascading(false)} />
      )}
      <WinBox show={won && !cascading} onAgain={restart} lines={[count(game.moves, 'move')]} />
    </div>
  );
}
