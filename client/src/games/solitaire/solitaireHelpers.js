/**
 * Helpers shared by the solitaire games (the components are in SolitaireKit.jsx).
 */
import { useEffect, useState } from 'react';

const RED = { hearts: true, diamonds: true };
export const isRed = card => !!RED[card.suit];

/** The space the board can use: the screen's width (to 1000px) less the page's padding. */
export function useBoardWidth(max = 1000) {
  const [width, setWidth] = useState(() => Math.min(window.innerWidth, max) - 24);
  useEffect(() => {
    const onResize = () => setWidth(Math.min(window.innerWidth, max) - 24);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [max]);
  return width;
}
export const cardHeight = w => Math.round(w * 1.4);

/** A short message that shows for a moment ("Fill every empty column before dealing."). */
export function useNote() {
  const [note, setNote] = useState(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2500);
    return () => clearTimeout(t);
  }, [note]);
  return [note, setNote];
}

/** Undo history: `push(state)` before each change, `pop()` gives the last one back. */
export function useHistory(limit = 300) {
  const [stack, setStack] = useState([]);
  return {
    canUndo: stack.length > 0,
    states: stack,                              // (the positions so far, oldest first)
    push: s => setStack(h => [...h.slice(-(limit - 1)), s]),
    pop: () => { const last = stack[stack.length - 1]; setStack(h => h.slice(0, -1)); return last; },
    clear: () => setStack([]),
  };
}

// The finale is skipped for anyone who has asked their device for less motion
export const lessMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Whole seconds since a time from Date.now() (for a finished game's score). */
export const secondsSince = t => Math.floor((Date.now() - t) / 1000);

/** "1 move", "3 moves" */
export const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
