import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { request } from '../utils/socket';

// Games that can be played together so far (more to come)
const GAMES = [
  { id: 'rook', name: 'Rook', emoji: '🐦', note: '4 players · partners' },
  { id: 'golf', name: '6-Card Golf', emoji: '⛳', note: '2–4 players' },
];
const SOON = ['Spades', 'Hearts', 'Bridge', 'Canasta', 'Mexican Train'];

export const LAST_TABLE_KEY = 'lastTable';

export default function PlayTogetherPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async game => {
    setBusy(true); setError('');
    const res = await request('mp:create', { game });
    setBusy(false);
    if (res?.code) navigate(`/together/${res.code}`);
    else setError(res?.error ?? 'Couldn\'t open a table — try again.');
  };

  const join = async e => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { setError('Table codes are 4 letters.'); return; }
    setBusy(true); setError('');
    const res = await request('mp:join', { code: c });
    setBusy(false);
    if (res?.ok) navigate(`/together/${res.code}`);
    else setError(res?.error ?? 'Couldn\'t join — try again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-indigo-950 p-5">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white self-start min-h-[44px]">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="text-center">
          <div className="text-6xl mb-2">👥</div>
          <h1 className="game-title text-3xl mb-2">Play Together</h1>
          <p className="text-white/60 text-sm">
            Everyone plays on their own iPad at the same time. One person opens a table and shares its code;
            empty seats can be filled with robots.
          </p>
        </div>

        <form onSubmit={join} className="card-panel flex flex-col gap-3">
          <h2 className="text-white font-semibold">Join a table</h2>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text"
            className="text-center text-3xl tracking-[0.5em] font-bold uppercase rounded-xl bg-white/10 text-white py-3 placeholder:text-white/20" />
          <Button variant="gold" type="submit" disabled={busy}>Join</Button>
        </form>

        <div className="card-panel flex flex-col gap-3">
          <h2 className="text-white font-semibold">…or open a new table</h2>
          {GAMES.map(g => (
            <Button key={g.id} variant="primary" className="w-full text-lg" disabled={busy} onClick={() => open(g.id)}>
              {g.emoji} {g.name} <span className="text-white/60 text-sm ml-2">{g.note}</span>
            </Button>
          ))}
          <p className="text-white/40 text-xs text-center">Coming soon: {SOON.join(', ')}</p>
        </div>

        {error && <p className="text-red-300 text-center">{error}</p>}
      </div>
    </div>
  );
}
