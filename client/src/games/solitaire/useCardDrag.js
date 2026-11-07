/**
 * Dragging cards in the solitaire games, with a finger or a mouse (tapping still works too).
 *
 * A game spreads `drag.bind(from)` on each card that can be picked up (`from` is however the
 * game names that place; the card gets the class `touch-none` too), and marks every place cards can be dropped with
 * `data-drop={JSON.stringify(place)}`. Once a press has moved a little, it's a drag:
 * `onStart(from)` is called (the game picks the cards up, so the places they can go light
 * up) and `drag.active` is { from, dx, dy } — the game moves the cards it's carrying by
 * dx, dy. Let go and `onDrop(from, place)` is called with the place under the finger (or
 * under the middle of the card), or null over nowhere. The click that follows a drag is
 * swallowed, so a drop isn't also taken as a tap.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const START_AFTER = 6;        // px a press moves before it's a drag
const CLICK_AFTER_MS = 400;   // how long after a drop clicks are ignored

/** The place marked by data-drop at a point on screen, or null. */
function placeAt(x, y) {
  const el = document.elementFromPoint(x, y)?.closest('[data-drop]');
  if (!el) return null;
  try { return JSON.parse(el.dataset.drop); } catch { return null; }
}

export function useCardDrag({ onStart, onDrop }) {
  const [active, setActive] = useState(null);
  const press = useRef(null);                     // { from, x, y, el, started }
  const droppedAt = useRef(0);
  const callbacks = useRef({ onStart, onDrop });
  useLayoutEffect(() => { callbacks.current = { onStart, onDrop }; });

  // Swallow the click that comes after a drag
  useEffect(() => {
    const swallow = e => { if (Date.now() - droppedAt.current < CLICK_AFTER_MS) { e.stopPropagation(); e.preventDefault(); } };
    window.addEventListener('click', swallow, true);
    return () => window.removeEventListener('click', swallow, true);
  }, []);

  useEffect(() => {
    let frame = 0;
    const move = e => {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.started) {
        if (Math.hypot(dx, dy) < START_AFTER) return;
        p.started = true;
        p.box = p.el.getBoundingClientRect();
        callbacks.current.onStart?.(p.from);
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive({ from: p.from, dx, dy }));
    };
    const end = e => {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      press.current = null;
      cancelAnimationFrame(frame);
      if (!p.started) return;                     // (just a tap: the click handles it)
      droppedAt.current = Date.now();
      setActive(null);
      if (e.type === 'pointercancel') { callbacks.current.onDrop(p.from, null); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      const place = placeAt(e.clientX, e.clientY)
        ?? placeAt(p.box.left + p.box.width / 2 + dx, p.box.top + p.box.height / 2 + dy);
      callbacks.current.onDrop(p.from, place);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  return {
    active,
    /**
     * Props for a card that can be dragged from `from` (`ok` false leaves it still). Give the
     * card the class `touch-none` too, so a finger drags the card, not the page.
     */
    bind: (from, ok = true) => (ok ? {
      onPointerDown: e => {
        if (e.button > 0 || press.current) return;
        press.current = { from, x: e.clientX, y: e.clientY, el: e.currentTarget, id: e.pointerId, started: false };
      },
    } : {}),
  };
}

/** Style for a card being carried: moved with the finger, on top, and not in the way of what's under it. */
export const carried = (drag, depth = 0) => ({
  transform: `translate(${drag.active.dx}px, ${drag.active.dy}px)`,
  zIndex: 1000 + depth,
  pointerEvents: 'none',
});
