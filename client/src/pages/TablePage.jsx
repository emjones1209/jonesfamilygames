/**
 * A play-together table: the lobby (seats, robots, start) and then the game.
 * The server sends this player's own view of the game; it's turned round so
 * that you always sit at the bottom of the screen.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getSocket, request } from '../utils/socket';
import { rotate } from '../games/rook/rookEngine';
import { RookTable } from '../games/rook/RookTable';
import { LAST_TABLE_KEY } from './PlayTogetherPage';

const REACTIONS = ['👍', '😂', '😮', '😬', '🎉', '👏', 'Nice!', 'Oops!', 'Good one!', 'Hurry up! 😄'];
const GAME_NAMES = { rook: 'Rook' };
const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
const remember = code => { try { localStorage.setItem(LAST_TABLE_KEY, code); } catch { /* private mode */ } };
const forget = () => { try { localStorage.removeItem(LAST_TABLE_KEY); } catch { /* private mode */ } };

export default function TablePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [table, setTable] = useState(null);
  const [missing, setMissing] = useState(null);         // why the table can't be joined
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [reactions, setReactions] = useState([]);       // [{ id, seat, emoji }] shown for a few seconds
  const [picker, setPicker] = useState(false);
  const errorTimer = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    const join = async () => {
      const res = await request('mp:join', { code });
      if (res?.error) { setMissing(res.error); forget(); } else remember(code);
    };
    const onTable = t => { if (t.code === code) setTable(t); };
    const onReaction = r => {
      const id = Math.random();
      setReactions(list => [...list, { ...r, id }]);
      setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), 3500);
    };
    const onError = e => {
      setError(e.message);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(''), 4000);
    };
    const onConnect = () => { setConnected(true); join(); };      // (re)join every time we (re)connect
    const onDisconnect = () => setConnected(false);
    socket.on('mp:table', onTable);
    socket.on('mp:reaction', onReaction);
    socket.on('mp:error', onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) join(); else socket.connect();
    return () => {
      socket.off('mp:table', onTable);
      socket.off('mp:reaction', onReaction);
      socket.off('mp:error', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [code]);

  const send = (event, data) => getSocket().emit(event, data);
  const leave = () => { send('mp:leave'); forget(); navigate('/'); };

  if (missing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-indigo-950 p-5 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">🤷</div>
        <p className="text-white text-lg">{missing}</p>
        <p className="text-white/50 text-sm">Tables close after a few hours, or when the server restarts.</p>
        <Button variant="gold" onClick={() => navigate('/together')}>Back to Play Together</Button>
      </div>
    );
  }
  if (!table) {
    return <div className="min-h-screen bg-game-bg flex items-center justify-center text-white/60">Joining table {code}…</div>;
  }

  const n = table.seats.length;
  const you = table.you;
  const isHost = table.hostId === user?.id;
  const seatName = seat => (!seat ? 'Empty seat' : seat.type === 'robot' ? '🤖 Robot' : seat.name + (seat.away ? ' (robot playing)' : !seat.connected ? ' (reconnecting…)' : ''));
  const banner = !connected && (
    <div className="fixed top-safe left-0 right-0 z-50 bg-amber-500 text-game-bg text-center text-sm font-semibold py-1">
      Reconnecting…
    </div>
  );

  // Reactions: a button that opens the choices, and bubbles for the latest ones
  const reactionBar = (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {picker && (
        <div className="card-panel p-2 grid grid-cols-3 gap-2 w-64">
          {REACTIONS.map(r => (
            <button key={r} onClick={() => { send('mp:react', { emoji: r }); setPicker(false); }}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white py-2 min-h-[44px] text-lg leading-tight">
              {r}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setPicker(p => !p)} aria-label="Send a reaction"
        className="w-14 h-14 rounded-full bg-game-gold text-2xl shadow-lg">{picker ? '✕' : '😊'}</button>
    </div>
  );
  const toasts = (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 pointer-events-none">
      {reactions.map(r => (
        <div key={r.id} className="bg-black/70 text-white rounded-full px-4 py-1 text-lg shadow">
          <span className="text-sm text-white/70 mr-2">{r.seat === you ? 'You' : table.seats[r.seat]?.name ?? 'Robot'}</span>{r.emoji}
        </div>
      ))}
    </div>
  );

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (table.status === 'lobby') {
    const host = table.seats.find(s => s?.userId === table.hostId)?.name ?? 'the host';
    const full = table.seats.every(Boolean);
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-indigo-950 p-5">
        {banner}
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <button onClick={leave} className="flex items-center gap-2 text-white/50 hover:text-white self-start min-h-[44px]">
            <ArrowLeft size={18} /> Leave table
          </button>
          <div className="text-center">
            <h1 className="game-title text-3xl">{GAME_NAMES[table.game]} table</h1>
            <p className="text-white/60 text-sm mt-2">Tell the others this code:</p>
            <div className="text-5xl font-black tracking-[0.3em] text-game-gold my-2">{table.code}</div>
            <p className="text-white/40 text-xs">They open Play Together and type it in.</p>
          </div>

          <div className="card-panel flex flex-col gap-2">
            <p className="text-white/50 text-xs">Seats 1 &amp; 3 are partners, and so are seats 2 &amp; 4.</p>
            {table.seats.map((seat, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${i === you ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
                <span className="text-white/40 text-sm w-6">{i + 1}</span>
                <span className="flex-1 text-white">{seatName(seat)}{i === you ? ' (you)' : ''}</span>
                {!seat && <button onClick={() => send('mp:sit', { seat: i })} className="text-sm text-white bg-white/10 rounded-lg px-3 min-h-[40px]">Sit here</button>}
                {!seat && <button onClick={() => send('mp:robot', { seat: i, on: true })} className="text-sm text-white bg-white/10 rounded-lg px-3 min-h-[40px]">Add robot</button>}
                {seat?.type === 'robot' && <button onClick={() => send('mp:robot', { seat: i, on: false })} className="text-sm text-white bg-white/10 rounded-lg px-3 min-h-[40px]">Remove</button>}
              </div>
            ))}
          </div>

          {isHost ? (
            <div className="card-panel flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/70 text-sm">Robots play at</span>
                <div className="flex gap-1">
                  {LEVELS.map(([l, label]) => (
                    <button key={l} onClick={() => send('mp:level', { level: l })}
                      className={`rounded-lg px-3 min-h-[40px] text-sm ${table.level === l ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <Button variant="gold" disabled={!full} onClick={() => send('mp:start')}>
                {full ? 'Start the game' : `Waiting for ${n - table.seats.filter(Boolean).length} more (or add robots)`}
              </Button>
            </div>
          ) : (
            <p className="text-white/60 text-center">Waiting for {host} to start the game… (robots play at {table.level})</p>
          )}
          {error && <p className="text-red-300 text-center">{error}</p>}
        </div>
        {toasts}
        {reactionBar}
      </div>
    );
  }

  // ── Game in progress, but you haven't got a seat ─────────────────────────
  if (you == null || !table.view) {
    const robots = table.seats.map((s, i) => (s?.type === 'robot' ? i : -1)).filter(i => i >= 0);
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-indigo-950 p-5 flex flex-col items-center justify-center gap-4 text-center">
        {banner}
        <p className="text-white text-lg">This game has already started.</p>
        {robots.length ? (
          <>
            <p className="text-white/60 text-sm">You can take over from a robot:</p>
            {robots.map(i => <Button key={i} variant="gold" onClick={() => send('mp:sit', { seat: i })}>Take seat {i + 1}</Button>)}
          </>
        ) : <p className="text-white/60 text-sm">Every seat is taken by a person.</p>}
        <Button variant="ghost" onClick={() => { forget(); navigate('/'); }}>Home</Button>
      </div>
    );
  }

  // ── Playing: turn the table so you're at the bottom ──────────────────────
  const view = rotate(table.view, you);
  const names = Array.from({ length: n }, (_, i) => {
    const seat = table.seats[(i + you) % n];
    if (i === 0) return 'You';
    return seat.type === 'robot' ? 'Robot' : seat.away ? `${seat.name} 🤖` : seat.name;
  });
  const shown = {};
  for (const r of reactions) shown[(r.seat - you + n) % n] = r.emoji;

  return (
    <RookTable view={view} names={names} error={error} reactions={shown}
      onAction={action => send('mp:action', { action })}   // the server fills in your real seat
      onExit={() => navigate('/')}
      overlay={<>{banner}{toasts}{reactionBar}</>}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={leave}>Leave</Button>
          <Button variant="gold" className="flex-1" onClick={() => send('mp:action', { action: { type: 'newGame' } })}>Play Again</Button>
        </div>
      } />
  );
}
