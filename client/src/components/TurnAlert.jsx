/**
 * Makes it obvious when it's your turn at a play-together table: while it is,
 * a glowing gold frame runs round the screen and the tab's title says so; the
 * moment it becomes your turn there's a soft chime (and a buzz, on phones that can). `TurnSoundToggle` (in the reactions panel)
 * turns the chime off and on.
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { chime, buzz, unlockSound, soundOn, setSoundOn } from '../utils/turnAlert';

export function TurnAlert({ active }) {

  // Sound is only allowed once the player has touched the page
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Just became your turn: chime and buzz
  useEffect(() => {
    if (!active) return;
    if (soundOn()) chime();
    buzz();
  }, [active]);

  // The tab's title, for when you've switched to another tab or app
  useEffect(() => {
    if (!active) return undefined;
    const before = document.title;
    document.title = `🔔 Your turn · ${before}`;
    return () => { document.title = before; };
  }, [active]);

  return active && (
    <div aria-hidden className="fixed inset-safe z-30 pointer-events-none rounded-[1.25rem] border-4 border-game-gold turn-glow" />
  );
}

/** "Chime on my turn" switch, remembered on this device. */
export function TurnSoundToggle() {
  const [sound, setSound] = useState(soundOn);
  const toggle = () => {
    setSoundOn(!sound);
    setSound(!sound);
    if (!sound) { unlockSound(); chime(); }      // a sample of what it'll sound like
  };
  return (
    <button onClick={toggle} aria-pressed={sound}
      className="col-span-4 flex items-center justify-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 text-sm min-h-[44px]">
      {sound ? <Bell size={16} /> : <BellOff size={16} />} Chime on my turn: <b>{sound ? 'On' : 'Off'}</b>
    </button>
  );
}
