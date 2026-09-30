import { describe, it, expect } from 'vitest';
import { inviteText, shareInvite } from './share';

const invite = { title: 'Family Games', text: inviteText('Spades'), url: 'https://example.com/together/ABCD' };
const abort = () => Object.assign(new Error('closed'), { name: 'AbortError' });

describe('table invitations', () => {
  it('names the game', () => {
    expect(inviteText('Mexican Train')).toBe('Want to play Mexican Train with me?');
  });

  it('opens the share sheet with the text and link where there is one', async () => {
    const shared = [];
    const nav = { share: async d => { shared.push(d); } };
    expect(await shareInvite(invite, nav)).toBe('shared');
    expect(shared).toEqual([invite]);
  });

  it('does nothing more when the share sheet is closed', async () => {
    const copied = [];
    const nav = { share: async () => { throw abort(); }, clipboard: { writeText: async t => { copied.push(t); } } };
    expect(await shareInvite(invite, nav)).toBe('cancelled');
    expect(copied).toEqual([]);
  });

  it('copies the invitation where there is no share sheet (or it can\'t be used)', async () => {
    const copied = [];
    const clipboard = { writeText: async t => { copied.push(t); } };
    expect(await shareInvite(invite, { clipboard })).toBe('copied');
    expect(await shareInvite(invite, { share: async () => { throw new Error('not allowed'); }, clipboard })).toBe('copied');
    expect(await shareInvite(invite, { share: async () => {}, canShare: () => false, clipboard })).toBe('copied');
    expect(copied).toEqual(Array(3).fill('Want to play Spades with me? https://example.com/together/ABCD'));
  });

  it('says so when it can neither share nor copy', async () => {
    expect(await shareInvite(invite, {})).toBe('failed');
    expect(await shareInvite(invite, { clipboard: { writeText: async () => { throw new Error('denied'); } } })).toBe('failed');
  });
});
