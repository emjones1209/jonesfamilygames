/**
 * The classic Solitaire finale: the cards leap off the foundations one after another,
 * Kings first, and bounce across the screen, each leaving a trail of itself behind
 * (the canvas is never cleared). Tap anywhere to skip it.
 *
 * `piles` are the piles the cards leave from — [{ key, cards }], each pile bottom card first,
 * drawn on the page in an element marked data-cascade={key}. The top cards go first, taking
 * turns round the piles. `onLaunch(key)` is called as each card leaves (so the pile can show
 * the card under it), and `onDone()` when the last one is gone.
 */
import { useEffect, useRef } from 'react';
import { SUIT_SYMBOLS } from '../../utils/cardEngine';

const GRAVITY = 0.5;          // px per frame²
const LAUNCH_EVERY = 14;      // frames between cards leaving the foundations

/** A card face, drawn straight onto the canvas: white, rounded, rank and suit in its colour. */
function drawCard(ctx, card, x, y, w, h) {
  const r = Math.max(4, w * 0.1);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#9ca3af';
  ctx.stroke();
  ctx.fillStyle = card.suit === 'hearts' || card.suit === 'diamonds' ? '#dc2626' : '#111827';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.round(w * 0.3)}px system-ui, sans-serif`;
  ctx.fillText(card.rank, x + w * 0.1, y + w * 0.08);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(w * 0.5)}px system-ui, sans-serif`;
  ctx.fillText(SUIT_SYMBOLS[card.suit], x + w / 2, y + h * 0.58);
}

export function CardCascade({ piles, onLaunch, onDone }) {
  const canvas = useRef(null);
  const callbacks = useRef({ onLaunch, onDone });
  callbacks.current = { onLaunch, onDone };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext('2d');
    const width = window.innerWidth, height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    el.width = width * dpr;
    el.height = height * dpr;
    ctx.scale(dpr, dpr);

    // The order they leave in: the top card of each pile in turn (every King, then every Queen, …)
    const queue = [];
    const tallest = Math.max(0, ...piles.map(p => p.cards.length));
    for (let depth = 1; depth <= tallest; depth++) {
      for (const { key, cards } of piles) {
        const card = cards[cards.length - depth];
        if (card) queue.push({ key, card });
      }
    }
    // Where each pile is on screen (the cards start from there)
    const spot = Object.fromEntries(piles.map(({ key }) => {
      const box = document.querySelector(`[data-cascade="${key}"]`)?.getBoundingClientRect();
      return [key, box ?? { left: width - 60, top: 20, width: 40, height: 64 }];
    }));

    const flying = [];
    let frame = 0, raf = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      callbacks.current.onDone();
    };
    const tick = () => {
      if (frame % LAUNCH_EVERY === 0 && queue.length) {
        const { key, card } = queue.shift();
        const box = spot[key];
        const speed = 2.5 + Math.random() * 4.5;
        flying.push({
          card, x: box.left, y: box.top, w: box.width, h: box.height,
          vx: (Math.random() < 0.5 ? -1 : 1) * speed,
          vy: -Math.random() * 8,
          bounce: 0.65 + Math.random() * 0.2,
        });
        callbacks.current.onLaunch(key);
      }
      for (const c of flying) {
        c.vy += GRAVITY;
        c.x += c.vx;
        c.y += c.vy;
        if (c.y + c.h > height) {                       // off the floor, losing a little height each time
          c.y = height - c.h;
          c.vy = -c.vy * c.bounce;
        }
        drawCard(ctx, c.card, c.x, c.y, c.w, c.h);
      }
      // A card that's left the screen at the side is done with
      for (let i = flying.length - 1; i >= 0; i--) {
        if (flying[i].x + flying[i].w < 0 || flying[i].x > width) flying.splice(i, 1);
      }
      frame++;
      if (!queue.length && !flying.length) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    el.addEventListener('pointerdown', finish);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerdown', finish); };
    // (it runs once, from the piles as they were when the game was won)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvas} aria-label="The cards bounce off the table. Tap to skip." className="fixed inset-0 z-40 w-screen h-screen cursor-pointer" />;
}
