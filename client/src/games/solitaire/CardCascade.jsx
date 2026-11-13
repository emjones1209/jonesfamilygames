/**
 * The classic Solitaire finale: the cards leap off the foundations one after another,
 * Kings first, and bounce across the screen, each leaving a trail of itself behind
 * (the canvas is never cleared), and throwing up a burst of sparkles each time it hits the
 * bottom of the screen (drawn on a second canvas over the first, which is cleared every frame,
 * so they twinkle and fade without leaving trails). Tap anywhere to skip it (once it has been
 * going for a moment: see skipOnTap).
 *
 * `piles` are the piles the cards leave from — [{ key, cards }], each pile bottom card first,
 * drawn on the page in an element marked data-cascade={key}. The top cards go first, taking
 * turns round the piles. `onLaunch(key)` is called as each card leaves (so the pile can show
 * the card under it), and `onDone()` when the last one is gone.
 */
import { useEffect, useRef } from 'react';
import { drawCard, GOLD_RGB, PALE, skipOnTap } from './canvasCards';

const GRAVITY = 0.5;          // px per frame²
const LAUNCH_EVERY = 14;      // frames between cards leaving the foundations
const SPARKLE_GRAVITY = 0.12; // px per frame², for the sparkles
const SPARKLE_COLOURS = [GOLD_RGB, PALE, '255,255,255'];

/** A four-pointed star of light, `r` px from its middle to a point. */
function drawStar(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const d = k % 2 ? r * 0.28 : r;
    const a = (k / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function CardCascade({ piles, onLaunch, onDone }) {
  const canvas = useRef(null);
  const glitter = useRef(null);
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
    const top = glitter.current;
    const gctx = top.getContext('2d');
    top.width = width * dpr;
    top.height = height * dpr;
    gctx.scale(dpr, dpr);
    const sparkles = [], flashes = [];
    // A burst of sparkles from under a card that has just hit the floor (more for a harder landing)
    const sparkle = (c, speed) => {
      const count = Math.round(12 + Math.min(22, speed * 1.8));
      flashes.push({ x: c.x + c.w / 2, y: height, r: c.w * (0.8 + Math.min(1, speed / 15)), age: 0 });
      for (let k = 0; k < count; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;          // (up and out)
        const v = 2 + Math.random() * (3 + speed * 0.5);
        sparkles.push({
          x: c.x + Math.random() * c.w, y: height - 2,
          vx: Math.cos(a) * v + c.vx * 0.3, vy: Math.sin(a) * v,
          life: 35 + Math.random() * 30, age: 0,
          r: (6 + Math.random() * 7) * Math.max(1, c.w / 60),
          spin: (Math.random() - 0.5) * 0.3, angle: Math.random() * Math.PI,
          colour: SPARKLE_COLOURS[k % SPARKLE_COLOURS.length],
        });
      }
    };

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
          if (c.vy > 2) sparkle(c, c.vy);               // (not once it's only rolling along the floor)
          c.vy = -c.vy * c.bounce;
        }
        drawCard(ctx, c.card, c.x, c.y, c.w, c.h);
      }
      // The sparkles, twinkling as they fall and fade
      gctx.clearRect(0, 0, width, height);
      gctx.globalCompositeOperation = 'lighter';
      // A glow where each card landed
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.age++;
        const p = f.age / 16;
        if (p >= 1) { flashes.splice(i, 1); continue; }
        const g = gctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + p));
        g.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - p)})`);
        g.addColorStop(0.4, `rgba(${GOLD_RGB},${0.5 * (1 - p)})`);
        g.addColorStop(1, `rgba(${GOLD_RGB},0)`);
        gctx.fillStyle = g;
        gctx.beginPath(); gctx.arc(f.x, f.y, f.r * (0.6 + p), 0, Math.PI * 2); gctx.fill();
      }
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.age++;
        if (s.age >= s.life) { sparkles.splice(i, 1); continue; }
        s.vy += SPARKLE_GRAVITY;
        s.vx *= 0.97;
        s.x += s.vx; s.y += s.vy; s.angle += s.spin;
        const left = 1 - s.age / s.life;
        const twinkle = 0.7 + 0.3 * Math.sin(s.age * 0.9 + i);
        gctx.fillStyle = `rgba(${s.colour},${left * twinkle})`;
        drawStar(gctx, s.x, s.y, s.r * (0.5 + 0.5 * left), s.angle);
        gctx.beginPath(); gctx.arc(s.x, s.y, s.r * 0.35, 0, Math.PI * 2); gctx.fill();     // (a bright heart to it)
      }
      // A card that's left the screen at the side is done with
      for (let i = flying.length - 1; i >= 0; i--) {
        if (flying[i].x + flying[i].w < 0 || flying[i].x > width) flying.splice(i, 1);
      }
      frame++;
      if (!queue.length && !flying.length && !sparkles.length && !flashes.length) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stopListening = skipOnTap(el, finish);
    return () => { cancelAnimationFrame(raf); stopListening(); };
    // (it runs once, from the piles as they were when the game was won)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas ref={canvas} aria-label="The cards bounce off the table. Tap to skip." className="fixed inset-0 z-40 w-screen h-screen cursor-pointer" />
      <canvas ref={glitter} aria-hidden="true" className="fixed inset-0 z-40 w-screen h-screen pointer-events-none" />
    </>
  );
}
