/**
 * The "it's your turn" nudges for play-together tables: a short, soft chime
 * (Web Audio, so there's no sound file to load) and a buzz on phones that can.
 *
 * Phones only let a page make sound after the player has touched it, so
 * `unlockSound` is called on the first tap; until then the chime is silent.
 */
const SOUND_KEY = 'turnSound';
let ctx = null;

export const soundOn = () => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
};
export const setSoundOn = on => {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};

export function unlockSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no sound on this device */ }
}

/** Two gentle rising notes. */
export function chime() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  [[660, 0], [880, 0.14]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(0.18, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.5);
  });
}

export function buzz() {
  try { navigator.vibrate?.(150); } catch { /* not supported (e.g. iPhone) */ }
}
