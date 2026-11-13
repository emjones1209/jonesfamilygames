/**
 * A win animation drawn on a canvas over the whole page, for the solitaire games that don't use
 * Klondike's bouncing cards (CardCascade). Each game has its own scene (finaleScenes.js).
 *
 * `scene` is called once with { ctx, width, height, piles, spot, layout, launch } and gives back
 * a function that draws one frame: it's called with the time since the start (ms), on a cleared
 * canvas, and returns false once the scene is over.
 *   - `piles` are [{ key, cards }] as for CardCascade (each pile bottom card first), drawn on the
 *     page in elements marked data-cascade={key}; `spot[key]` is where each one is on screen.
 *   - `layout` is anything else the scene needs from the game (where the pyramid was, say), as the
 *     game gives it, plus `anchor`: where the page's element marked data-finale is on screen.
 *   - `launch(key)` tells the game a card has left pile `key` (so it can show the card under it).
 * Tap anywhere to skip it; `onDone()` is called either way.
 */
import { useEffect, useRef } from 'react';

export function Finale({ scene, piles, layout = {}, label, onLaunch, onDone }) {
  const canvas = useRef(null);
  const callbacks = useRef({ onLaunch, onDone });
  useEffect(() => { callbacks.current = { onLaunch, onDone }; });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext('2d');
    const width = window.innerWidth, height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    el.width = width * dpr;
    el.height = height * dpr;
    ctx.scale(dpr, dpr);

    const spot = Object.fromEntries(piles.map(({ key }) => {
      const box = document.querySelector(`[data-cascade="${key}"]`)?.getBoundingClientRect();
      return [key, box ?? { left: width - 60, top: 20, width: 40, height: 56 }];
    }));
    const anchor = document.querySelector('[data-finale]')?.getBoundingClientRect() ?? { left: 0, top: 0, width, height: height / 2 };
    const frame = scene({ ctx, width, height, piles, spot, layout: { ...layout, anchor },
      launch: key => callbacks.current.onLaunch?.(key) });

    let raf = 0, start = null, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      callbacks.current.onDone();
    };
    const tick = now => {
      if (start == null) start = now;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      const more = frame(now - start);
      ctx.restore();
      if (more === false) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    el.addEventListener('pointerdown', finish);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerdown', finish); };
    // (it runs once, from the game as it was when it was won)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvas} aria-label={`${label} Tap to skip.`} className="fixed inset-0 z-40 w-screen h-screen cursor-pointer" />;
}
