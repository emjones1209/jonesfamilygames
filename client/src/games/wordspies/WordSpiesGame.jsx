/**
 * Word Spies from the home screen: what it is, how to play, and a button that opens
 * a play-together table (it's only played together, on everyone's own iPad).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { request } from '../../utils/socket';

export default function WordSpiesGame() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = async () => {
    setBusy(true); setError('');
    const res = await request('mp:create', { game: 'wordspies' });
    setBusy(false);
    if (res?.code) navigate(`/together/${res.code}`);
    else setError(res?.error ?? 'Couldn\'t open a table — try again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-5">
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white min-h-[44px]">
            <ArrowLeft size={18} /> Back
          </button>
          <RulesButton game="wordspies" title="Word Spies" />
        </div>
        <div className="text-center">
          <div className="text-6xl mb-2">🕵️</div>
          <h1 className="game-title text-3xl mb-2">Word Spies</h1>
          <p className="text-white/70">
            Give one-word clues to help the others find the secret words — and steer them away from the traps 💣.
          </p>
        </div>
        <div className="card-panel flex flex-col gap-3 text-sm text-white/80">
          <p><b className="text-game-gold">🤝 Together</b> — everyone against the game, 2 to 8 players. Each side sees its own secret key and you take turns giving clues.</p>
          <p><b className="text-game-gold">☀️ vs 🌙 Teams</b> — two teams race to find their words first, 4 to 8 players. One clue giver on each team sees the key.</p>
          <p className="text-white/50">Everyone plays on their own iPad, in the same room or on a call. It&apos;s for people only — no robots.</p>
        </div>
        <Button variant="gold" className="text-lg" disabled={busy} onClick={open}>{busy ? 'Opening…' : 'Open a table'}</Button>
        <Button variant="ghost" onClick={() => navigate('/together')}>Join with a code</Button>
        {error && <p role="alert" className="text-red-300 text-center">{error}</p>}
      </div>
    </div>
  );
}
