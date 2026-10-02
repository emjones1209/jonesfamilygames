import { useEffect, useState } from 'react';

/** A phone held upright: narrow and taller than it is wide. */
export const PHONE_UPRIGHT = '(max-width: 767px) and (orientation: portrait)';
/** A phone turned sideways: wide but very short (same as Tailwind's `short:`). */
export const SHORT_SCREEN = '(orientation: landscape) and (max-height: 500px)';

const matches = query => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;

/** Whether a CSS media query matches, kept up to date as the screen turns or resizes. */
export function useMediaQuery(query) {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const update = () => setOn(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return on;
}
