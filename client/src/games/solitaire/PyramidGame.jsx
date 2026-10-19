/**
 * Pyramid (rules in pyramidRules.js).
 *
 * Tap a King to take it away. For a pair, tap one card (it's picked up) and then a card
 * that makes 13 with it. The waste's top card pairs too. Tap the stock to turn a card.
 */
import { useEffect, useState } from 'react';
import {
  newPyramid, isFree, canRemove, remove, draw, whyNoDraw, hint, isWon, isStuck, left, rowOf, indexOf, VALUE, ROWS, PASSES,
} from './pyramidRules';
import { SCard, Slot, SolitaireHeader, WinBox } from './SolitaireKit';
import { useBoardWidth, cardHeight, useNote, useHistory, lessMotion, secondsSince, count } from './solitaireHelpers';
import { CardCascade } from './CardCascade';
import { Button } from '../../components/Button';
import api from '../../utils/api';

const fresh = () => ({ ...newPyramid(), started: Date.now() });
const same = (a, b) => a && b && a.type === b.type && (a.type === 'waste' || a.i === b.i);

export default function PyramidGame() {
  const [game, setGame] = useState(fresh);
  const [sel, setSel] = useState(null);            // a place picked up
  const [shown, setShown] = useState(null);        // a hint: { remove: places } or { draw: true }
  const [won, setWon] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [spilled, setSpilled] = useState(0);
  const [note, setNote] = useNote();
  const history = useHistory();
  const board = useBoardWidth(760);

  const gap = board < 500 ? 4 : 8;
  const w = Math.min(96, Math.floor((board - gap * (ROWS - 1)) / ROWS));
  const h = cardHeight(w);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [shown]);

  const change = next => {
    history.push(game);
    setGame(next);
    setSel(null);
    setShown(null);
    if (isWon(next)) {
      setWon(true);
      setCascading(!lessMotion());
      // Clearing the pyramid sooner (on an earlier pass, fewer moves) scores more
      const score = next.score + (PASSES - next.pass + 1) * 100;
      api.post('/scores', { game: 'pyramid', score, durationS: secondsSince(next.started) }).catch(() => {});
    }
  };
  const restart = () => { setGame(fresh()); history.clear(); setSel(null); setShown(null); setWon(false); setCascading(false); setSpilled(0); };
  const undo = () => { const last = history.pop(); if (last) { setGame(last); setSel(null); setShown(null); } };

  const tap = place => {
    if (won) return;
    if (place.type === 'pyr' && !isFree(game, place.i)) { setSel(null); setNote('That card is still covered.'); return; }
    if (canRemove(game, [place])) { change(remove(game, [place])); return; }            // a King
    if (sel && same(sel, place)) { setSel(null); return; }
    if (sel && canRemove(game, [sel, place])) { change(remove(game, [sel, place])); return; }
    if (sel) {
      const a = sel.type === 'waste' ? game.waste.at(-1) : game.pyramid[sel.i];
      const b = place.type === 'waste' ? game.waste.at(-1) : game.pyramid[place.i];
      setNote(`${a.rank} and ${b.rank} make ${VALUE[a.rank] + VALUE[b.rank]}, not 13.`);
    }
    setSel(place);
  };
  const turn = () => {
    const why = whyNoDraw(game);
    if (why) { setNote(why); return; }
    change(draw(game));
  };
  const showHint = () => {
    const x = hint(game);
    if (!x) { setNote('No moves left.'); return; }
    setSel(null);
    setShown(x);
  };

  const markFor = place => {
    if (sel && same(sel, place)) return 'selected';
    if (shown?.remove?.some(p => same(p, place))) return 'hint';
    return null;
  };
  const stuck = isStuck(game);
  const pile = game.removed.slice(0, game.removed.length - spilled);
  const waste = game.waste.slice(-3);              // the top card and a peek at two under it

  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      <SolitaireHeader title="Pyramid" rulesGame="pyramid"
        status={`${left(game)} left · pass ${game.pass} of ${PASSES}`}
        onUndo={undo} canUndo={history.canUndo && !won} onRestart={restart} onHint={showHint} />

      {/* The pyramid */}
      <div className="relative mx-auto mt-2" style={{ width: ROWS * w + (ROWS - 1) * gap, height: (ROWS - 1) * h * 0.5 + h }}>
        {game.pyramid.map((card, i) => {
          if (!card) return null;
          const r = rowOf(i), c = i - indexOf(r, 0);
          const free = isFree(game, i);
          return (
            <div key={card.id} data-pyr={i} className="absolute" style={{ left: ((ROWS - 1 - r) / 2 + c) * (w + gap), top: r * h * 0.5, zIndex: r }}>
              <SCard card={card} w={w} dim={!free} plain={!free} mark={markFor({ type: 'pyr', i })} onClick={() => tap({ type: 'pyr', i })} />
            </div>
          );
        })}
      </div>

      <p className="text-center text-amber-300 text-sm min-h-[1.25rem] my-2">{note}</p>

      {/* Stock, waste, and the cards taken away */}
      <div className="flex items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div onClick={turn} className="cursor-pointer" aria-label="Turn a card">
            {game.stock.length
              ? <SCard card={{ faceUp: false }} faceDown w={w} mark={shown?.draw ? 'hint' : null} />
              : <Slot w={w} label={game.pass < PASSES && game.waste.length ? '↩️' : '✕'} mark={shown?.draw ? 'hint' : null} />}
          </div>
          <span className="text-white/50 text-xs">{game.stock.length} left</span>
        </div>
        <div className="relative" style={{ width: w + 2 * w * 0.3, height: h }}>
          {!waste.length && <Slot w={w} />}
          {waste.map((card, k) => {
            const top = k === waste.length - 1;
            return (
              <div key={card.id} data-waste={top || undefined} className="absolute top-0" style={{ left: k * w * 0.3 }}>
                <SCard card={card} w={w} dim={!top} mark={top ? markFor({ type: 'waste' }) : null}
                  onClick={top ? () => tap({ type: 'waste' }) : undefined} />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1 ml-auto" data-cascade="removed">
          {pile.length ? <SCard card={pile.at(-1)} w={w} dim /> : <Slot w={w} />}
          <span className="text-white/50 text-xs">{game.removed.length} taken</span>
        </div>
      </div>

      {stuck && !won && (
        <div className="card-panel mt-4 mx-auto max-w-sm text-center flex flex-col gap-3">
          <p className="text-white font-semibold">No more moves — {count(left(game), 'card')} left in the pyramid.</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={undo} disabled={!history.canUndo}>Undo</Button>
            <Button variant="gold" className="flex-1" onClick={restart}>New game</Button>
          </div>
        </div>
      )}

      {cascading && (
        <CardCascade piles={[{ key: 'removed', cards: game.removed }]}
          onLaunch={() => setSpilled(n => n + 1)} onDone={() => setCascading(false)} />
      )}
      <WinBox show={won && !cascading} onAgain={restart} lines={[`Cleared on pass ${game.pass} of ${PASSES}`, count(game.moves, 'move')]} />
    </div>
  );
}
