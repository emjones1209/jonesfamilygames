/**
 * TriPeaks (rules in tripeaksRules.js).
 *
 * Tap any uncovered card that's one higher or one lower than the waste card to play it
 * (King and Ace go round). Tap the stock to turn a new card when nothing fits.
 */
import { useEffect, useState } from 'react';
import { newTripeaks, isFree, canPlay, play, draw, hint, isWon, isStuck, left, placeOf } from './tripeaksRules';
import { SCard, Slot, SolitaireHeader, WinBox } from './SolitaireKit';
import { useBoardWidth, cardHeight, useNote, useHistory, lessMotion, secondsSince, count } from './solitaireHelpers';
import { CardCascade } from './CardCascade';
import { Button } from '../../components/Button';
import api from '../../utils/api';

const fresh = () => ({ ...newTripeaks(), started: Date.now() });

export default function TriPeaksGame() {
  const [game, setGame] = useState(fresh);
  const [shown, setShown] = useState(null);        // a hint: { play: i } or { draw: true }
  const [won, setWon] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [spilled, setSpilled] = useState(0);
  const [note, setNote] = useNote();
  const history = useHistory();
  const board = useBoardWidth(900);

  const gap = board < 500 ? 3 : 6;
  const w = Math.floor((board - gap * 9) / 10);
  const h = cardHeight(w);
  const big = Math.round(w * 1.5);                 // the stock and waste are drawn bigger

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [shown]);

  const change = next => {
    history.push(game);
    setGame(next);
    setShown(null);
    if (isWon(next)) {
      setWon(true);
      setCascading(!lessMotion());
      api.post('/scores', { game: 'tripeaks', score: next.score + next.stock.length * 5, durationS: secondsSince(next.started) }).catch(() => {});
    }
  };
  const restart = () => { setGame(fresh()); history.clear(); setShown(null); setWon(false); setCascading(false); setSpilled(0); };
  const undo = () => { const last = history.pop(); if (last) { setGame(last); setShown(null); } };

  const tap = i => {
    if (won || !isFree(game, i)) return;
    if (canPlay(game, i)) { change(play(game, i)); return; }
    const top = game.waste.at(-1);
    setNote(`Play a card one higher or lower than the ${top.rank}.`);
  };
  const turn = () => {
    if (!game.stock.length) { setNote('The stock is used up.'); return; }
    change(draw(game));
  };
  const showHint = () => {
    const x = hint(game);
    if (!x) { setNote('No moves left.'); return; }
    setShown(x);
  };

  const stuck = isStuck(game);
  const waste = game.waste.slice(0, game.waste.length - spilled);

  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      <SolitaireHeader title="TriPeaks" rulesGame="tripeaks"
        status={`Score ${game.score}${game.streak > 1 ? ` · streak ${game.streak}` : ''} · ${left(game)} left`}
        onUndo={undo} canUndo={history.canUndo && !won} onRestart={restart} onHint={showHint} />

      {/* The three peaks */}
      <div className="relative mx-auto mt-3" style={{ width: 10 * w + 9 * gap, height: 3 * h * 0.5 + h }}>
        {game.peaks.map((card, i) => {
          if (!card) return null;
          const { row, x } = placeOf(i);
          return (
            <div key={card.id} data-peak={i} className="absolute" style={{ left: x * (w + gap), top: row * h * 0.5, zIndex: row }}>
              <SCard card={card} w={w} faceDown={!card.faceUp} mark={shown?.play === i ? 'hint' : null} onClick={() => tap(i)} />
            </div>
          );
        })}
      </div>

      <p className="text-center text-amber-300 text-sm min-h-[1.25rem] my-3">{note}</p>

      {/* Stock and waste */}
      <div className="flex items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div onClick={turn} className="cursor-pointer" aria-label="Turn a card">
            {game.stock.length
              ? <SCard card={{ faceUp: false }} faceDown w={big} mark={shown?.draw ? 'hint' : null} />
              : <Slot w={big} label="✕" />}
          </div>
          <span className="text-white/50 text-xs">{game.stock.length} left</span>
        </div>
        <div data-cascade="waste">
          {waste.length ? <SCard card={waste.at(-1)} w={big} /> : <Slot w={big} />}
        </div>
      </div>

      {stuck && !won && (
        <div className="card-panel mt-4 mx-auto max-w-sm text-center flex flex-col gap-3">
          <p className="text-white font-semibold">No more moves — {count(left(game), 'card')} left. Score {game.score}.</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={undo} disabled={!history.canUndo}>Undo</Button>
            <Button variant="gold" className="flex-1" onClick={restart}>New game</Button>
          </div>
        </div>
      )}

      {cascading && (
        <CardCascade piles={[{ key: 'waste', cards: game.waste }]}
          onLaunch={() => setSpilled(n => n + 1)} onDone={() => setCascading(false)} />
      )}
      <WinBox show={won && !cascading} onAgain={restart}
        lines={[`Score ${game.score}`, `${count(game.stock.length, 'card')} left in the stock`]} />
    </div>
  );
}
