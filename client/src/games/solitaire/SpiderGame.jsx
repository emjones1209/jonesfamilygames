/**
 * Spider Solitaire (rules in spiderRules.js).
 *
 * Tap a card to move it (with the cards below it): if there's one obvious place — onto
 * the same suit, or the only card it fits — it goes straight there. Otherwise it's picked
 * up and the places it can go light up; tap one. (Into an empty column always asks, so a
 * column isn't filled by accident.) Tap a picked-up card again to send it to the best place.
 * Tap the stock to deal a row.
 */
import { useEffect, useState } from 'react';
import { newSpider, runStart, move, deal, whyNoDeal, destinations, hint, isWon, positionKey, RANKS, COLUMNS } from './spiderRules';
import { SCard, Slot, SolitaireHeader, WinBox } from './SolitaireKit';
import { useBoardWidth, cardHeight, useNote, useHistory, lessMotion, secondsSince, count } from './solitaireHelpers';
import { CardCascade } from './CardCascade';
import api from '../../utils/api';

const SUIT_KEY = 'spiderSuits';
const SUIT_NAMES = { 1: '1 suit', 2: '2 suits', 4: '4 suits' };
const DIFFICULTY = { 1: 'easy', 2: 'medium', 4: 'hard' };
const fresh = n => ({ ...newSpider(n), started: Date.now() });
const loadSuits = () => { try { return Number(localStorage.getItem(SUIT_KEY)) || 1; } catch { return 1; } };

export default function SpiderGame() {
  const [suits, setSuits] = useState(loadSuits);
  const [game, setGame] = useState(() => fresh(loadSuits()));
  const [sel, setSel] = useState(null);            // { from, idx }: the cards picked up
  const [shown, setShown] = useState(null);        // a hint being shown: { from, idx, to } or { deal: true }
  const [won, setWon] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [spilled, setSpilled] = useState({});      // run → cards bounced off it
  const [note, setNote] = useNote();
  const history = useHistory();
  const board = useBoardWidth();

  const gap = board < 500 ? 3 : 6;
  const w = Math.floor((board - gap * (COLUMNS - 1)) / COLUMNS);
  const h = cardHeight(w);

  // Hints fade after a moment
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
      api.post('/scores', { game: 'spider', score: Math.max(0, next.score), difficulty: DIFFICULTY[suits],
        durationS: secondsSince(next.started) }).catch(() => {});
    }
  };

  const restart = (n = suits) => {
    setGame(fresh(n));
    history.clear();
    setSel(null); setShown(null); setWon(false); setCascading(false); setSpilled({});
  };
  const chooseSuits = n => {
    if (n === suits) return;
    if (game.moves > 0 && !won && !window.confirm(`Start a new game with ${SUIT_NAMES[n]}?`)) return;
    try { localStorage.setItem(SUIT_KEY, String(n)); } catch { /* private mode */ }
    setSuits(n);
    restart(n);
  };
  const undo = () => { const last = history.pop(); if (last) { setGame(last); setSel(null); setShown(null); } };

  const dealRow = () => {
    const why = whyNoDeal(game);
    if (why) { setNote(why); return; }
    change(deal(game));
  };

  const tapCard = (from, idx) => {
    const col = game.tableau[from];
    if (!col[idx].faceUp) { setSel(null); return; }
    // Something picked up already: this column is where it goes (if it fits)
    if (sel && sel.from !== from) {
      if (destinations(game, sel.from, sel.idx).includes(from)) { change(move(game, sel.from, sel.idx, from)); return; }
    }
    if (sel && sel.from === from && sel.idx === idx) {
      const best = destinations(game, from, idx)[0];
      if (best != null) change(move(game, from, idx, best)); else setSel(null);
      return;
    }
    if (idx < runStart(col)) { setSel(null); setNote('Only cards of one suit, in order, move together.'); return; }
    const dests = destinations(game, from, idx);
    if (!dests.length) { setSel(null); setNote('There\'s nowhere for that to go yet.'); return; }
    const card = col[idx];
    const onCards = dests.filter(to => game.tableau[to].length);
    const sameSuit = onCards.filter(to => game.tableau[to].at(-1).suit === card.suit);
    if (sameSuit.length === 1 || (!sameSuit.length && onCards.length === 1)) {
      change(move(game, from, idx, sameSuit[0] ?? onCards[0]));
      return;
    }
    setSel({ from, idx });
  };
  const tapColumn = to => {
    if (!sel) return;
    if (destinations(game, sel.from, sel.idx).includes(to)) change(move(game, sel.from, sel.idx, to));
    else setSel(null);
  };
  const showHint = () => {
    const h2 = hint(game, new Set([...history.states, game].map(positionKey)));   // (not back to where you've been)
    if (!h2) { setNote('Nothing useful left to do. Try Undo, or start a new game.'); return; }
    setSel(null);
    setShown(h2);
  };

  // How far apart cards sit in a column: closer together when a column gets long
  const room = Math.max(h * 3, window.innerHeight - 230);
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

  const targets = sel ? destinations(game, sel.from, sel.idx) : [];
  const deals = Math.ceil(game.stock.length / COLUMNS);
  const runs = game.done.map((suit, i) => ({ key: `run${i}`, cards: RANKS.map(rank => ({ id: `${rank}-${suit}-done${i}`, rank, suit, faceUp: true })) }));

  return (
    <div className="min-h-screen bg-green-900 p-3 select-none">
      <SolitaireHeader title="Spider Solitaire" rulesGame="spider"
        status={`Score ${game.score} · ${count(game.moves, 'move')}`}
        onUndo={undo} canUndo={history.canUndo && !won} onRestart={() => restart()} onHint={showHint} />

      {/* Suits, then the stock (a row left to deal for each card back) and the runs cleared */}
      <div className="flex items-center justify-center gap-1 mb-2 text-xs">
        <span className="text-white/50 mr-1">Suits:</span>
        {[1, 2, 4].map(n => (
          <button key={n} onClick={() => chooseSuits(n)}
            className={`px-3 min-h-[32px] rounded-full font-semibold ${n === suits ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white/70'}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-end justify-between mb-2" style={{ minHeight: h }}>
        <div onClick={dealRow} className="relative cursor-pointer" style={{ width: w + 4 * Math.min(deals, 5), height: h }}
          aria-label={`Deal a row (${deals} left)`}>
          {deals > 0 ? Array.from({ length: deals }, (_, i) => (
            <div key={i} className="absolute top-0" style={{ left: i * 4 }}>
              <SCard card={{ faceUp: false }} faceDown w={w} mark={shown?.deal && i === deals - 1 ? 'hint' : null} />
            </div>
          )) : <Slot w={w} label="✓" />}
        </div>
        {/* Runs cleared, each shown by its King, overlapping */}
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">{runs.length} of 8</span>
          <div className="flex">
            {runs.length ? runs.map((run, i) => {
              const left = run.cards.length - (spilled[run.key] ?? 0);
              return (
                <div key={run.key} data-cascade={run.key} style={{ marginLeft: i ? -w * 0.6 : 0 }}>
                  {left > 0 ? <SCard card={run.cards[left - 1]} w={w} /> : <Slot w={w} />}
                </div>
              );
            }) : <Slot w={w} label="K" />}
          </div>
        </div>
      </div>

      <p className="text-center text-amber-300 text-sm min-h-[1.25rem] mb-1">{note}</p>

      {/* The ten columns */}
      <div className="flex justify-center" style={{ gap }}>
        {game.tableau.map((col, from) => {
          const { tops, height } = layout(col);
          const isTarget = targets.includes(from) || shown?.to === from;
          return (
            <div key={from} data-column={from} className="relative" style={{ width: w, height: height + h * 0.6 }} onClick={() => tapColumn(from)}>
              {!col.length && <Slot w={w} mark={isTarget ? (shown?.to === from ? 'hint' : 'target') : null} />}
              {col.map((card, idx) => {
                const picked = sel && sel.from === from && idx >= sel.idx;
                const hinted = shown && !shown.deal && ((shown.from === from && idx >= shown.idx) || (shown.to === from && idx === col.length - 1));
                const mark = picked ? 'selected' : hinted ? 'hint' : isTarget && idx === col.length - 1 ? 'target' : null;
                return (
                  <div key={card.id} data-col={from} data-idx={idx} className="absolute left-0" style={{ top: tops[idx], zIndex: idx }}
                    onClick={e => { e.stopPropagation(); tapCard(from, idx); }}>
                    <SCard card={card} w={w} mark={mark} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {cascading && (
        <CardCascade piles={runs}
          onLaunch={key => setSpilled(sp => ({ ...sp, [key]: (sp[key] ?? 0) + 1 }))}
          onDone={() => setCascading(false)} />
      )}
      <WinBox show={won && !cascading} onAgain={() => restart()}
        lines={[`${SUIT_NAMES[suits]} · ${count(game.moves, 'move')}`, `Score ${game.score}`]} />
    </div>
  );
}
