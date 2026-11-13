/**
 * Spider: a finished run (King down to Ace) leaving the table for the cleared runs.
 *
 * If the move that finished the run left it in pieces (the cards just moved are still where they
 * were picked up, or a card was just dealt), the pieces first slide together under the King.
 * Then the run lights up gold, King to Ace, and the cards peel off, Ace first, and spin in a
 * swooping arc onto the cleared-runs pile, each with a short trail of ghosts behind it.
 * When the King lands there's a gold flash, a burst of sparks and "+100".
 *
 * `cards` are the run's cards, King first, each { card, rect, col } with `rect` where it was on
 * screen when the run was finished (or null if it wasn't on the table, e.g. just dealt —
 * then it starts at `fallback`) and `col` the column it was in. `target` is the data-cascade key of the place the run
 * goes; that place should stay hidden until `onDone()` is called.
 * Everything is drawn in a layer of its own over the page, and taken away when it's over.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { SCard } from './SolitaireKit';

const GLOW_STEP = 22;      // ms between cards lighting up, King to Ace
const LIFT_AT = 330;       // ms before the first card (the Ace) leaves
const FLY_EVERY = 55;      // ms between cards leaving
const FLIGHT = 620;        // ms each card is in the air
const GHOSTS = [{ lag: 35, opacity: 0.4 }, { lag: 70, opacity: 0.18 }];
const SPARKS = 14;
const GOLD = '#e8b86d';      // (the theme's gold: game-gold)
const GATHER = 260;        // ms for the pieces of a run to slide together

/** Points along a curve from a to b that rises `lift` pixels above the higher of the two. */
function arc(a, b, lift, steps = 8) {
  const c = { x: (a.x + b.x) / 2 + (b.x - a.x) * 0.15, y: Math.min(a.y, b.y) - lift };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y, t };
  });
}

export function RunCollect({ cards, w, target, fallback, onDone }) {
  const layer = useRef(null);
  const [end, setEnd] = useState(null);
  const done = useRef(onDone);
  useLayoutEffect(() => { done.current = onDone; });

  // Where the run is going (the page has already drawn its (hidden) place)
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-cascade="${target}"]`);
    const r = el?.getBoundingClientRect();
    if (!r) { done.current(); return; }
    setEnd({ x: r.left, y: r.top });   // eslint-disable-line react-hooks/set-state-in-effect -- (measured once, before anything is drawn)
  }, [target]);

  useLayoutEffect(() => {
    if (!end || !layer.current) return;
    const anims = [];
    const n = cards.length;
    let finish = 0;
    // Where each card sits once the run is together: under the King, as far apart as the King's column has them
    const at = cards.map(c => c.rect ?? fallback);
    const kingCol = cards[0].col;
    const gaps = [];
    for (let i = 1; i < n; i++) {
      if (cards[i].rect && cards[i - 1].rect && cards[i].col === cards[i - 1].col && cards[i].col != null) {
        gaps.push({ dy: cards[i].rect.top - cards[i - 1].rect.top, mine: cards[i].col === kingCol });
      }
    }
    const pick = gaps.find(g => g.mine) ?? gaps[0];
    const step = pick ? pick.dy : w * 0.45;
    const together = at.map((_, i) => ({ x: at[0].left, y: at[0].top + i * step }));
    const apart = at.some((r, i) => Math.abs(r.left - together[i].x) > 2 || Math.abs(r.top - together[i].y) > 2);
    const wait = apart ? GATHER : 0;
    layer.current.querySelectorAll('[data-fly]').forEach(el => {
      const i = Number(el.dataset.fly);                 // 0 = King
      const order = n - 1 - i;                          // the Ace leaves first
      const ghost = Number(el.dataset.ghost ?? -1);
      const start = at[i];
      const orig = { x: start.left, y: start.top };       // (where the card is drawn; it's moved from there)
      const from = together[i];
      const lift = 90 + order * 6;
      const spin = (order % 2 ? -1 : 1) * 360;
      const path = arc(from, end, lift).map(p => {
        const bulge = Math.sin(p.t * Math.PI);
        return {
          transform: `translate(${p.x - orig.x}px, ${p.y - orig.y}px) rotate(${spin * p.t}deg) scale(${1 + bulge * 0.18})`,
          offset: p.t,
          zIndex: 300 + order,                          // (each card lands on the one before)
        };
      });
      const lag = ghost >= 0 ? GHOSTS[ghost].lag : 0;
      const delay = wait + LIFT_AT + order * FLY_EVERY + lag;
      if (ghost >= 0) {
        // A ghost follows the card a moment behind, and fades as it lands
        const op = GHOSTS[ghost].opacity;
        anims.push(el.animate(path.map((k, j) => ({ ...k, opacity: j === path.length - 1 ? 0 : op })),
          { duration: FLIGHT, delay, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }));
        return;
      }
      // Slide into place with the rest of the run, light up (King first), then fly
      if (apart) {
        anims.push(el.animate([
          { transform: 'translate(0px, 0px)' },
          { transform: `translate(${from.x - orig.x}px, ${from.y - orig.y}px)` },
        ], { duration: GATHER, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }));
      }
      const glowAt = wait + (n - 1 - order) * GLOW_STEP;
      anims.push(el.animate([
        { boxShadow: '0 0 0 0 rgba(232,184,109,0)', filter: 'brightness(1)' },
        { boxShadow: `0 0 ${w * 0.35}px ${w * 0.06}px ${GOLD}`, filter: 'brightness(1.12)' },
        { boxShadow: `0 0 ${w * 0.2}px ${w * 0.03}px ${GOLD}`, filter: 'brightness(1)' },
      ], { duration: 260, delay: glowAt, fill: 'forwards', easing: 'ease-out' }));
      const fly = el.animate(path, { duration: FLIGHT, delay, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
      anims.push(fly);
      finish = Math.max(finish, delay + FLIGHT);
      // A little bump as each card lands
      anims.push(el.animate([
        { transform: `translate(${end.x - orig.x}px, ${end.y - orig.y}px) rotate(${spin}deg) scale(1)` },
        { transform: `translate(${end.x - orig.x}px, ${end.y - orig.y}px) rotate(${spin}deg) scale(1.1)` },
        { transform: `translate(${end.x - orig.x}px, ${end.y - orig.y}px) rotate(${spin}deg) scale(1)` },
      ], { duration: 160, delay: delay + FLIGHT, easing: 'ease-out', composite: 'replace' }));
    });

    // The King's landing: a flash, a ring, sparks and the score
    const burst = layer.current.querySelectorAll('[data-burst]');
    burst.forEach(el => {
      const kind = el.dataset.burst;
      let frames, duration = 650;
      if (kind === 'ring') {
        frames = [{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 }];
      } else if (kind === 'flash') {
        frames = [{ opacity: 0.9, transform: 'translate(-50%,-50%) scale(0.6)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }];
        duration = 420;
      } else if (kind === 'score') {
        frames = [
          { transform: 'translate(-50%,0) scale(0.5)', opacity: 0 },
          { transform: 'translate(-50%,-30px) scale(1.2)', opacity: 1, offset: 0.25 },
          { transform: 'translate(-50%,-70px) scale(1)', opacity: 0 },
        ];
        duration = 1100;
      } else {
        const a = (Number(kind) / SPARKS) * Math.PI * 2 + Math.random() * 0.3;
        const d = w * (1.1 + Math.random() * 0.9);
        frames = [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
        ];
        duration = 550 + Math.random() * 250;
      }
      anims.push(el.animate(frames, { duration, delay: finish - 40, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));
    });

    const t = setTimeout(() => done.current(), finish + 1100);      // (once the burst is over)
    return () => { clearTimeout(t); anims.forEach(a => a.cancel()); };
  }, [end, cards, fallback, w]);

  if (!end) return null;
  const h = Math.round(w * 1.4);
  const cx = end.x + w / 2, cy = end.y + h / 2;
  const at = (x, y) => ({ position: 'fixed', left: x, top: y });
  return (
    <div ref={layer} className="fixed inset-0 pointer-events-none z-40" aria-hidden="true">
      {cards.flatMap(({ card, rect }, i) => {
        const s = rect ?? fallback;
        return [
          ...GHOSTS.map((_, g) => (
            <div key={`${card.id}-g${g}`} data-fly={i} data-ghost={g} style={{ ...at(s.left, s.top), zIndex: i, opacity: 0, borderRadius: w * 0.12 }}>
              <SCard card={card} w={w} />
            </div>
          )),
          // (Stacked as in the column, the Ace on top; in the air, each card goes above the ones that have landed, so the King ends up on top)
          <div key={card.id} data-fly={i} style={{ ...at(s.left, s.top), zIndex: 100 + i, borderRadius: Math.max(4, Math.round(w * 0.12)) }}>
            <SCard card={card} w={w} />
          </div>,
        ];
      })}
      <div data-burst="flash" style={{ ...at(cx, cy), width: w * 2, height: w * 2, zIndex: 400, opacity: 0, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, ${GOLD}aa 35%, transparent 70%)` }} />
      <div data-burst="ring" style={{ ...at(cx, cy), width: w * 1.4, height: w * 1.4, zIndex: 400, opacity: 0, borderRadius: '50%',
        border: `${Math.max(2, w * 0.06)}px solid ${GOLD}`, boxShadow: `0 0 ${w * 0.3}px ${GOLD}` }} />
      {Array.from({ length: SPARKS }, (_, k) => (
        <div key={k} data-burst={k} style={{ ...at(cx, cy), width: Math.max(4, w * 0.1), height: Math.max(4, w * 0.1), zIndex: 400, opacity: 0,
          borderRadius: '50%', background: k % 3 ? GOLD : '#fff', boxShadow: `0 0 6px ${GOLD}` }} />
      ))}
      <div data-burst="score" style={{ ...at(cx, end.y + h * 0.35), zIndex: 410, opacity: 0, fontSize: Math.max(16, w * 0.4) }}
        className="font-extrabold text-game-gold drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] whitespace-nowrap">
        +100
      </div>
    </div>
  );
}
