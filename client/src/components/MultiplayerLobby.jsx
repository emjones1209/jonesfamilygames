/**
 * MultiplayerLobby — creates or joins a game room for live play.
 * UNFINISHED — multiplayer is hidden: no game uses this yet (see README).
 * Used by card games that support multiplayer.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Button } from './Button';
import api from '../utils/api';

export function MultiplayerLobby({ gameType, gameEmoji = '🎮', onStartGame, onPlayAI, minPlayers = 2, maxPlayers = 4 }) {
  const { user } = useAuth();
  const { emit, on } = useSocket() || {};
  const [mode, setMode] = useState('choice');        // choice | create | join
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);

  const handleRoomUpdate = useCallback(({ players: p }) => {
    setPlayers(p);
  }, []);

  const handleGameStarted = useCallback(() => {
    onStartGame({ roomId, isOnline: true });
  }, [roomId, onStartGame]);

  useEffect(() => {
    if (!on) return;
    const off1 = on('room:updated', handleRoomUpdate);
    const off2 = on('game:started', handleGameStarted);
    return () => { off1?.(); off2?.(); };
  }, [on, handleRoomUpdate, handleGameStarted]);

  const createRoom = async () => {
    setError('');
    try {
      const { data } = await api.post('/rooms', { gameType });
      setRoomId(data.roomId);
      setIsHost(true);
      emit?.('room:join', { roomId: data.roomId });
      setMode('create');
    } catch {
      setError('Could not create room. Check your connection.');
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      await api.get(`/rooms/${code}`); // Verify room exists
      emit?.('room:join', { roomId: code });
      setRoomId(code);
      setMode('join');
    } catch {
      setError('Room not found. Check the code and try again.');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const startGame = () => {
    emit?.('game:start', { roomId });
  };

  const setReady = () => {
    emit?.('room:ready', { roomId });
  };

  if (mode === 'choice') {
    return (
      <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
        <h2 className="text-xl font-bold text-white text-center">{gameEmoji} How do you want to play?</h2>
        <Button variant="primary" className="w-full" onClick={onPlayAI}>
          🤖 Play vs AI
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-game-card px-3 text-white/30 text-sm">or</span>
          </div>
        </div>
        <Button variant="secondary" className="w-full" onClick={createRoom}>
          <Users size={16} /> Create Family Room
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setMode('joining')}>
          🔗 Join a Room
        </Button>
        {error && <p className="text-game-red text-sm text-center">{error}</p>}
      </div>
    );
  }

  if (mode === 'joining') {
    return (
      <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
        <h2 className="text-xl font-bold text-white text-center">Join Room</h2>
        <input
          type="text"
          placeholder="Enter room code (e.g. A1B2)"
          className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary-400 text-base uppercase tracking-widest"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          maxLength={8}
          autoCapitalize="characters"
        />
        <Button variant="primary" className="w-full" onClick={joinRoom}>Join!</Button>
        <Button variant="ghost" className="w-full" onClick={() => setMode('choice')}>Back</Button>
        {error && <p className="text-game-red text-sm text-center">{error}</p>}
      </div>
    );
  }

  // In a room (create or join)
  return (
    <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <div className="card-panel text-center">
        <div className="text-white/50 text-sm mb-1">Room Code</div>
        <div className="text-4xl font-bold text-game-gold tracking-widest mb-2">{roomId}</div>
        <button
          onClick={copyCode}
          className="flex items-center gap-2 mx-auto text-white/60 hover:text-white text-sm transition-colors"
        >
          {copied ? <Check size={14} className="text-primary-400" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>

      <div className="card-panel">
        <div className="text-white/50 text-sm mb-3 flex items-center gap-2">
          <Users size={14} /> Players ({players.length}/{maxPlayers})
        </div>
        <div className="space-y-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="text-white text-sm">{p.displayName} {p.id === user?.id ? '(you)' : ''}</span>
              <span className={`text-xs ${p.ready ? 'text-primary-400' : 'text-white/30'}`}>
                {p.ready ? '✓ Ready' : 'Waiting...'}
              </span>
            </div>
          ))}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
            <div key={i} className="text-white/20 text-sm">Waiting for player...</div>
          ))}
        </div>
      </div>

      {!isHost && (
        <Button variant="secondary" className="w-full" onClick={setReady}>
          ✓ I'm Ready!
        </Button>
      )}
      {isHost && (
        <Button
          variant="primary"
          className="w-full"
          onClick={startGame}
          disabled={players.length < minPlayers}
        >
          {players.length < minPlayers ? `Need ${minPlayers - players.length} more player(s)` : 'Start Game! 🎮'}
        </Button>
      )}
      <Button variant="ghost" className="w-full text-sm" onClick={() => setMode('choice')}>
        Leave Room
      </Button>
    </div>
  );
}
