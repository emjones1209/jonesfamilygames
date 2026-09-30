import { describe, it, expect } from 'vitest';
import { afterLogin } from './afterLogin';

describe('where signing in takes you', () => {
  it('back to the table you were invited to', () => {
    expect(afterLogin({ from: '/together/ABCD' })).toBe('/together/ABCD');
  });

  it('home otherwise, and never off the site', () => {
    for (const state of [null, undefined, {}, { from: '/login' }, { from: '//evil.example' }, { from: 'https://evil.example' }, { from: 42 }]) {
      expect(afterLogin(state)).toBe('/');
    }
  });
});
