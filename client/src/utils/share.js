/**
 * Invite someone to a play-together table: the phone's own share sheet
 * (Messages, WhatsApp, email, AirDrop…) where there is one, otherwise the
 * invitation is copied so it can be pasted anywhere.
 */
export const inviteText = gameName => `Want to play ${gameName} with me?`;

/**
 * Share `text` and `url`. Resolves to 'shared', 'copied', 'cancelled' (the
 * share sheet was closed) or 'failed' (nothing could be shared or copied).
 * `nav` is the browser's navigator (passed in by tests).
 */
export async function shareInvite({ title, text, url }, nav = globalThis.navigator) {
  const data = { title, text, url };
  if (nav?.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Otherwise (e.g. sharing isn't allowed here) fall back to copying
    }
  }
  try {
    await nav.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
