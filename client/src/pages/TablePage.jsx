/**
 * A play-together table: the lobby (seats, robots, start) and then the game.
 * The server sends this player's own view of the game; it's turned round so
 * that you always sit at the bottom of the screen.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getSocket, request } from '../utils/socket';
import { inviteText, shareInvite } from '../utils/share';
import { rotate as rotateRook, waitingFor as waitingRook } from '../games/rook/rookEngine';
import { RookTable } from '../games/rook/RookTable';
import { rotate as rotateGolf, HOLE_CHOICES, waitingOn as waitingOnGolf } from '../games/golf6/golfEngine';
import { GolfTable } from '../games/golf6/GolfTable';
import { rotate as rotateTrain, unrotateAction as unrotateTrain, ROUND_CHOICES, waitingFor as waitingTrain } from '../games/train/trainEngine';
import { TrainTable } from '../games/train/TrainTable';
import { rotate as rotateHearts, waitingOn as waitingOnHearts } from '../games/hearts/heartsEngine';
import { HeartsTable } from '../games/hearts/HeartsTable';
import { rotate as rotateSpades, waitingFor as waitingSpades } from '../games/spades/spadesEngine';
import { TARGET_CHOICES } from '../games/spades/spadesRules';
import { SpadesTable } from '../games/spades/SpadesTable';
import { rotate as rotateBridge, waitingFor as waitingBridge } from '../games/bridge/bridgeEngine';
import { BridgeTable } from '../games/bridge/BridgeTable';
import { rotate as rotateCanasta, waitingFor as waitingCanasta } from '../games/canasta/canastaEngine';
import { CanastaTable } from '../games/canasta/CanastaTable';
import { rotate as rotateDice, waitingFor as waitingDice } from '../games/dice/diceEngine';
import { DiceTable } from '../games/dice/DiceTable';
import { rotate as rotateHandFoot, waitingFor as waitingHandFoot } from '../games/handfoot/handFootEngine';
import { HandFootTable } from '../games/handfoot/HandFootTable';
import { rotate as rotateEuchre, waitingFor as waitingEuchre } from '../games/euchre/euchreEngine';
import { EuchreTable } from '../games/euchre/EuchreTable';
import { rotate as rotateGin, waitingFor as waitingGin } from '../games/gin/ginEngine';
import { GinTable } from '../games/gin/GinTable';
import { rotate as rotateCribbage, waitingOn as waitingOnCribbage } from '../games/cribbage/cribbageEngine';
import { CribbageTable } from '../games/cribbage/CribbageTable';
import { rotate as rotatePinochle, waitingOn as waitingOnPinochle } from '../games/pinochle/pinochleEngine';
import { PinochleTable } from '../games/pinochle/PinochleTable';
import { rotate as rotateCheckers, unrotateAction as unrotateCheckers, waitingFor as waitingCheckers } from '../games/checkers/checkersEngine';
import { CheckersTable } from '../games/checkers/CheckersTable';
import { rotate as rotateChess, waitingFor as waitingChess } from '../games/chess/chessEngine';
import { ChessTable } from '../games/chess/ChessTable';
import { LAST_TABLE_KEY } from './PlayTogetherPage';
import { ReactionBursts, ReactionPicker, REACTION_MS } from '../components/Reactions';
import { TurnAlert, TurnSoundToggle } from '../components/TurnAlert';
import { NotifyToggle } from '../components/NotifyToggle';
import { stillNotifying } from '../utils/push';

const REACTIONS = ['👍', '😂', '😮', '😬', '🥺', '🤦', '🎉', '👏', 'Nice!', 'Oops!', 'Good one!', 'Hurry up! 😄'];
const PARTNERS = 'Seats 1 & 3 are partners, and so are seats 2 & 4.';
// Each game's screen, how to turn its view round, what the lobby says about seats,
// whether opposite seats are partners, the setting the host picks (if any), and — for moves that name a seat's
// things (Mexican Train's trains) — how to turn a move back the right way round
const GAMES = {
  rook: { name: 'Rook', Table: RookTable, rotate: rotateRook, seatNote: PARTNERS, teams: true },
  golf: {
    name: '6-Card Golf', Table: GolfTable, rotate: rotateGolf, minSeats: 2,
    seatNote: '2 to 4 players. Empty seats are left out when the game starts.',
    option: { key: 'holes', label: 'Holes to play', values: HOLE_CHOICES, unit: 'hole' },
  },
  train: {
    name: 'Mexican Train', Table: TrainTable, rotate: rotateTrain, unrotate: unrotateTrain, minSeats: 2,
    seatNote: '2 to 4 players. Empty seats are left out when the game starts.',
    option: { key: 'rounds', label: 'Rounds', values: ROUND_CHOICES, unit: 'round' },
  },
  hearts: { name: 'Hearts', Table: HeartsTable, rotate: rotateHearts, seatNote: 'Four players, each playing for themselves.' },
  spades: {
    name: 'Spades', Table: SpadesTable, rotate: rotateSpades, seatNote: PARTNERS, teams: true,
    option: { key: 'target', label: 'Play to', values: TARGET_CHOICES, unit: 'point' },
  },
  bridge: { name: 'Bridge', Table: BridgeTable, rotate: rotateBridge, seatNote: `${PARTNERS} Everyone sees themselves as South.`, teams: true },
  canasta: { name: 'Canasta', Table: CanastaTable, rotate: rotateCanasta, seatNote: PARTNERS, teams: true },
  euchre: { name: 'Euchre', Table: EuchreTable, rotate: rotateEuchre, seatNote: PARTNERS, teams: true },
  gin: { name: 'Gin Rummy', Table: GinTable, rotate: rotateGin, seatNote: 'Two players, head to head.' },
  pinochle: { name: 'Pinochle', Table: PinochleTable, rotate: rotatePinochle, seatNote: PARTNERS, teams: true },
  cribbage: { name: 'Cribbage', Table: CribbageTable, rotate: rotateCribbage, seatNote: 'Two players, head to head. Seat 2 deals first (their crib).' },
  checkers: {
    name: 'Checkers', Table: CheckersTable, rotate: rotateCheckers, unrotate: unrotateCheckers,
    seatNote: 'Two players. Seat 1 plays Black and moves first; colours swap each game.',
  },
  chess: {
    name: 'Chess', Table: ChessTable, rotate: rotateChess,
    seatNote: 'Two players. Seat 1 plays White and moves first; colours swap each game.',
  },
  handfoot: {
    name: 'Hand and Foot', Table: HandFootTable, rotate: rotateHandFoot, minSeats: 3,
    seatNote: 'Four players: seats 1 & 3 are partners, and so are seats 2 & 4. Or three, each for themselves (leave a seat empty).',
  },
  dice: {
    name: 'Five Dice', Table: DiceTable, rotate: rotateDice, minSeats: 2,
    seatNote: '2 to 4 players. Empty seats are left out when the game starts.',
  },
};
// The seats each game is waiting on (several at once in some games, e.g. everyone
// passing in Hearts), so the table can tell you when it's your turn
const WAITING = {
  rook: v => [waitingRook(v)],
  golf: waitingOnGolf,
  train: v => [waitingTrain(v)],
  hearts: waitingOnHearts,
  spades: v => [waitingSpades(v)],
  bridge: v => [waitingBridge(v)],
  canasta: v => [waitingCanasta(v)],
  dice: v => [waitingDice(v)],
  handfoot: v => [waitingHandFoot(v)],
  euchre: v => [waitingEuchre(v)],
  gin: v => [waitingGin(v)],
  pinochle: waitingOnPinochle,
  cribbage: waitingOnCribbage,
  checkers: v => [waitingCheckers(v)],
  chess: v => [waitingChess(v)],
};
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
  const [moving, setMoving] = useState(null);           // the seat the host is moving (lobby)
  const [shared, setShared] = useState('');             // what happened to the last invite ('copied', 'failed')
  const errorTimer = useRef(null);
  const [waiting, setWaiting] = useState([]);           // seats of missing players you chose to keep waiting for

  useEffect(() => {
    const socket = getSocket();
    const join = async () => {
      const res = await request('mp:join', { code });
      if (res?.offline) return;                                   // no answer: join again when we reconnect
      if (res?.error) { setMissing(res.error); forget(); return; }
      remember(code);
      // Switched on "tell me when someone arrives" before? Then do so at this table too
      if (await stillNotifying()) socket.emit('mp:watch', { on: true });
    };
    const onTable = t => {
      if (t.code !== code) return;
      setTable(t);
      setWaiting(w => w.filter(i => t.seats[i]?.gone));          // (back again: ask afresh next time)
    };
    const onReaction = r => {
      const id = Math.random();
      setReactions(list => [...list, { ...r, id }]);
      setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), REACTION_MS);
    };
    const onError = e => {
      setError(e.message);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(''), 4000);
    };
    const onClosed = c => { if (c.code === code) { setMissing('The host closed this table.'); forget(); } };
    const onConnect = () => { setConnected(true); join(); };      // (re)join every time we (re)connect
    const onDisconnect = () => setConnected(false);
    socket.on('mp:table', onTable);
    socket.on('mp:reaction', onReaction);
    socket.on('mp:error', onError);
    socket.on('mp:closed', onClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) join(); else socket.connect();
    return () => {
      socket.off('mp:table', onTable);
      socket.off('mp:reaction', onReaction);
      socket.off('mp:error', onError);
      socket.off('mp:closed', onClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [code]);

  const send = (event, data) => getSocket().emit(event, data);
  const leave = () => { send('mp:leave'); forget(); navigate('/'); };
  // The host stepping away from the lobby keeps the table open for guests still to come
  // (it stays on the home screen, to come back to); closing it ends it for everyone
  const stepAway = () => { send('mp:leave'); navigate('/'); };
  const closeTable = () => { send('mp:leave', { close: true }); forget(); navigate('/'); };

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

  const game = GAMES[table.game];
  const n = table.seats.length;
  const you = table.you;
  const isHost = table.hostId === user?.id;
  const seatName = seat => (!seat ? 'Empty seat' : seat.type === 'robot' ? `🤖 ${seat.name}`
    : seat.name + (seat.away ? ' (robot playing)' : !seat.connected ? (table.status === 'lobby' ? ' (away)' : ' (reconnecting…)') : ''));
  const banner = !connected && (
    <div className="fixed top-safe left-0 right-0 z-50 bg-amber-500 text-game-bg text-center text-sm font-semibold py-1">
      Reconnecting…
    </div>
  );

  // Reactions: a button that springs open the choices, and big bursts for everyone's latest ones
  const reactionBar = (
    <ReactionPicker choices={REACTIONS} open={picker} onToggle={() => setPicker(p => !p)}
      onPick={r => { send('mp:react', { emoji: r }); setPicker(false); }}
      extra={table.status === 'playing' && <TurnSoundToggle />} />
  );
  const toasts = (
    <ReactionBursts reactions={reactions} you={you} players={n}
      nameOf={seat => table.seats[seat]?.name ?? ''} />
  );

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (table.status === 'lobby') {
    const hostSeat = table.seats.find(s => s?.userId === table.hostId);
    const host = hostSeat?.name ?? 'the host';
    const filled = table.seats.filter(Boolean).length;
    const needed = (game.minSeats ?? n) - filled;
    const option = game.option;
    const chosen = option && table.options?.[option.key];
    const chosenText = option ? `${chosen} ${option.unit}${chosen === 1 ? '' : 's'}` : '';
    const teamOf = i => (you != null ? (i % 2 === you % 2 ? 'Your team' : 'Other team') : `Team ${i % 2 ? 'B' : 'A'}`);
    const moveTo = i => { send('mp:swap', { from: moving, to: i }); setMoving(null); };
    const small = 'text-sm text-white bg-white/10 rounded-lg px-3 min-h-[40px]';
    const invite = async () => {
      const url = `${window.location.origin}/together/${table.code}`;
      const result = await shareInvite({ title: `${game.name} — Family Games`, text: inviteText(game.name), url });
      setShared(result);
      if (result === 'copied' || result === 'failed') setTimeout(() => setShared(''), 4000);
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-indigo-950 p-5">
        {banner}
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <button onClick={isHost ? stepAway : leave} className="flex items-center gap-2 text-white/50 hover:text-white self-start min-h-[44px]">
            <ArrowLeft size={18} /> {isHost ? 'Back (the table stays open)' : 'Leave table'}
          </button>
          <div className="text-center">
            <h1 className="game-title text-3xl">{game.name} table</h1>
            <p className="text-white/60 text-sm mt-2">Tell the others this code:</p>
            <div className="text-5xl font-black tracking-[0.3em] text-game-gold my-2">{table.code}</div>
            <p className="text-white/40 text-xs">They open Play Together and type it in — or send them a link:</p>
            <Button variant="gold" className="mt-3 inline-flex items-center gap-2" onClick={invite}>
              <Share2 size={18} /> Share invite
            </Button>
            {shared === 'copied' && <p className="text-game-gold text-sm mt-2">Invitation copied — paste it into a message.</p>}
            {shared === 'failed' && <p className="text-red-300 text-sm mt-2">Couldn't share from here — send them the code instead.</p>}
          </div>

          {you != null && (
            <NotifyToggle watching={table.seats[you]?.watching} onChange={on => send('mp:watch', { on })} />
          )}

          <div className="card-panel flex flex-col gap-2">
            <p className="text-white/50 text-xs">{game.seatNote}</p>
            {table.seats.map((seat, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${i === you ? 'bg-game-gold/20 border border-game-gold' : i === moving ? 'bg-white/15 border border-white/40' : 'bg-white/5'}`}>
                <span className="text-white/40 text-sm w-6">{i + 1}</span>
                <span className="flex-1 min-w-0 text-white">
                  {seatName(seat)}{i === you ? ' (you)' : ''}
                  {game.teams && <span className="block text-xs text-white/40">{teamOf(i)}</span>}
                </span>
                {moving != null ? (
                  i === moving
                    ? <button onClick={() => setMoving(null)} className={small}>Cancel</button>
                    : <button onClick={() => moveTo(i)} className={small}>{seat ? 'Swap here' : 'Move here'}</button>
                ) : (
                  <>
                    {!seat && <button onClick={() => send('mp:sit', { seat: i })} className={small}>Sit here</button>}
                    {!seat && <button onClick={() => send('mp:robot', { seat: i, on: true })} className={small}>Add robot</button>}
                    {seat && isHost && <button onClick={() => setMoving(i)} className={small}>Move</button>}
                    {seat?.type === 'robot' && <button onClick={() => send('mp:robot', { seat: i, on: false })} className={small}>Remove</button>}
                  </>
                )}
              </div>
            ))}
            {isHost && game.teams && <p className="text-white/50 text-xs">Tap Move to choose who partners whom.</p>}
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
              {option && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/70 text-sm">{option.label}</span>
                  <div className="flex gap-1">
                    {option.values.map(v => (
                      <button key={v} onClick={() => send('mp:option', { key: option.key, value: v })}
                        className={`rounded-lg px-4 min-h-[40px] text-sm ${chosen === v ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white'}`}>{v}</button>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="gold" disabled={needed > 0} onClick={() => send('mp:start')}>
                {needed > 0 ? `Waiting for ${needed} more (or add robots)`
                  : filled < n ? `Start with ${filled} players` : 'Start the game'}
              </Button>
              <p className="text-white/40 text-xs text-center">
                Going back keeps this table open for a few hours, so people you&apos;ve invited can still join. It&apos;ll be on your home screen.
              </p>
              <button onClick={closeTable} className="text-red-300/80 hover:text-red-300 text-sm min-h-[40px]">Close this table</button>
            </div>
          ) : (
            <div className="text-center flex flex-col gap-2">
              {hostSeat && !hostSeat.connected && (
                <p className="text-game-gold">
                  {host} has stepped away{hostSeat.watching ? ' — they\'ve been sent a notification that you\'re here.' : '.'}
                </p>
              )}
              <p className="text-white/60">
                Waiting for {host} to start the game… (robots play at {table.level}{option ? `; ${chosenText}` : ''})
              </p>
            </div>
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
            {robots.map(i => <Button key={i} variant="gold" onClick={() => send('mp:sit', { seat: i })}>Take over from {table.seats[i].name}</Button>)}
          </>
        ) : <p className="text-white/60 text-sm">Every seat is taken by a person.</p>}
        <Button variant="ghost" onClick={() => { forget(); navigate('/'); }}>Home</Button>
      </div>
    );
  }

  // ── Playing: turn the table so you're at the bottom ──────────────────────
  const view = game.rotate(table.view, you);
  const names = Array.from({ length: n }, (_, i) => {
    const seat = table.seats[(i + you) % n];
    if (i === 0) return 'You';
    return seat.away ? `${seat.name} 🤖` : seat.name;
  });
  const shown = {};
  for (const r of reactions) shown[(r.seat - you + n) % n] = r.emoji;
  const yourTurn = (WAITING[table.game]?.(table.view) ?? []).includes(you);
  // Someone's been gone a while (a phone gone to sleep, say): you choose whether a robot
  // plays for them until they come back, or keep waiting. (Once they're back — or someone
  // else has chosen — this goes away; "keep waiting" lasts until they next go missing.)
  const gone = table.seats.map((seat, i) => i).filter(i => i !== you && table.seats[i]?.gone);
  const lost = gone.filter(i => !waiting.includes(i));
  const standIn = lost.length > 0 && (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm card-panel border-2 border-amber-400 p-3 flex flex-col gap-2 shadow-xl">
      {lost.map(i => (
        <div key={i} className="flex flex-col gap-2">
          <p className="text-white text-sm text-center">📵 <b>{table.seats[i].name}</b> has lost their connection.</p>
          <div className="flex gap-2">
            <Button variant="gold" className="flex-1" onClick={() => send('mp:standIn', { seat: i })}>🤖 Play for {table.seats[i].name}</Button>
            <Button variant="ghost" className="flex-1" onClick={() => setWaiting(w => [...w, i])}>Keep waiting</Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <game.Table view={view} names={names} error={error} reactions={shown}
      // The server fills in your real seat; anything counted from your seat is turned back first
      onAction={action => send('mp:action', { action: game.unrotate ? game.unrotate(action, you, n) : action })}
      onExit={() => navigate('/')}
      overlay={<>{banner}{standIn}<TurnAlert active={yourTurn} />{toasts}{reactionBar}</>}
      gameOverActions={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={leave}>Leave</Button>
          <Button variant="gold" className="flex-1" onClick={() => send('mp:action', { action: { type: 'newGame' } })}>Play Again</Button>
        </div>
      } />
  );
}
