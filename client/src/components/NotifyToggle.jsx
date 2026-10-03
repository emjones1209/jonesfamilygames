/**
 * At a table's lobby: "Tell me when someone arrives" — so you can send an
 * invitation, put the iPad down, and get a notification when they turn up.
 * `watching` is what the server has; `onChange(on)` tells it.
 */
import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { pushStatus, enableNotify, disableNotify } from '../utils/push';

export function NotifyToggle({ watching, onChange }) {
  const [status, setStatus] = useState(pushStatus);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (status === 'unsupported') return null;
  if (status === 'install') {
    return (
      <p className="text-white/50 text-xs">
        Want a notification when they arrive? Add this app to your Home Screen first
        (tap Share, then <b>Add to Home Screen</b>) and open it from there.
      </p>
    );
  }
  if (status === 'denied') {
    return (
      <p className="text-white/50 text-xs">
        Notifications are turned off for this app. To get one when someone arrives,
        turn them on in your device's Settings.
      </p>
    );
  }

  const toggle = async () => {
    setFailed(false);
    if (watching) { disableNotify(); onChange(false); return; }
    setBusy(true);
    const on = await enableNotify();
    setBusy(false);
    setStatus(pushStatus());
    if (on) onChange(true); else setFailed(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={toggle} disabled={busy} aria-pressed={!!watching}
        className={`flex items-center justify-center gap-2 rounded-xl text-sm min-h-[44px] px-3 ${watching ? 'bg-game-gold/20 border border-game-gold text-white' : 'bg-white/10 text-white/80'}`}>
        {watching ? <Bell size={16} /> : <BellOff size={16} />}
        Tell me when someone arrives: <b>{busy ? '…' : watching ? 'On' : 'Off'}</b>
      </button>
      {watching && (
        <p className="text-white/50 text-xs">
          You can close the app — you'll get a notification when someone joins. The table stays open for a few hours.
        </p>
      )}
      {failed && <p className="text-red-300 text-xs">Couldn't switch notifications on here.</p>}
    </div>
  );
}
