import { describe, it, expect, vi, afterEach } from 'vitest';
import { skipOnTap } from './canvasCards';

describe('skipOnTap', () => {
  afterEach(() => vi.restoreAllMocks());
  const at = ms => vi.spyOn(performance, 'now').mockReturnValue(ms);

  it('ignores a tap in the first moment (one left over from the last moves)', () => {
    const el = new EventTarget(), skip = vi.fn();
    at(1000);
    skipOnTap(el, skip);
    at(1300);
    el.dispatchEvent(new Event('pointerdown'));
    expect(skip).not.toHaveBeenCalled();
  });

  it('skips on a tap after that', () => {
    const el = new EventTarget(), skip = vi.fn();
    at(1000);
    skipOnTap(el, skip);
    at(2300);
    el.dispatchEvent(new Event('pointerdown'));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('stops listening when told to', () => {
    const el = new EventTarget(), skip = vi.fn();
    at(0);
    const stop = skipOnTap(el, skip);
    stop();
    at(5000);
    el.dispatchEvent(new Event('pointerdown'));
    expect(skip).not.toHaveBeenCalled();
  });
});
