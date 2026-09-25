/**
 * Play-together tables: a family member opens a table for a game and shares
 * its short code; the others join from their own devices. Empty seats can be
 * filled with robots. The server holds the game (using the same rules code as
 * the browser), checks every move, runs the robots, and sends each player only
 * what they're allowed to see.
 *
 * Tables live in memory: they're for playing together in one sitting, so a
 * server restart simply ends any game in progress.
 *
 * Socket events from a player (all authenticated by their login token):
 *   mp:create { game }        → ack { code }      open a table (you take seat 1)
 *   mp:join   { code }        → ack { ok|error }  join or rejoin a table
 *   mp:sit    { seat }                            take an empty seat (or a robot's, once playing)
 *   mp:stand                                      give up your seat (before the game starts)
 *   mp:robot  { seat, on }                        put a robot in an empty seat, or take it out
 *   mp:level  { level }                           robots' skill (host only)
 *   mp:start                                      deal (host only, every seat filled)
 *   mp:action { action }                          a move in the game
 *   mp:react  { emoji }                           a quick reaction everyone sees
 *   mp:leave                                      leave the table
 * To each player:
 *   mp:table  { code, game, status, hostId, level, you, seats, view }
 *   mp:reaction { seat, emoji }
 */
const GAMES = {
  rook: { name: 'Rook', seats: 4, engine: require('../../client/src/games/rook/rookEngine.js') },
};

const REACTIONS = ['👍', '😂', '😮', '😬', '🎉', '👏', 'Nice!', 'Oops!', 'Good one!', 'Hurry up! 😄'];
const LEVELS = ['easy', 'medium', 'hard'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';        // no I, L or O (easily confused)

function createTables(io, {
  robotMs = 900,          // pause before a robot moves
  collectMs = 1400,       // how long a finished trick stays on the table
  awayMs = 30000,         // a disconnected player's robot stand-in takes over after this
  idleMs = 3 * 60 * 60 * 1000,
} = {}) {
  const tables = new Map();       // code → table

  const newCode = () => {
    for (;;) {
      const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      if (!tables.has(code)) return code;
    }
  };

  const seatOf = (table, userId) => table.seats.findIndex(s => s && s.type === 'human' && s.userId === userId);

  /** Send every player at the table their own picture of it. */
  function broadcast(table) {
    table.lastActive = Date.now();
    const { engine } = GAMES[table.game];
    for (const socket of io.sockets.adapter.rooms.get(table.code) ?? []) {
      const s = io.sockets.sockets.get(socket);
      if (!s) continue;
      const you = seatOf(table, s.user.id);
      s.emit('mp:table', {
        code: table.code,
        game: table.game,
        status: table.status,
        hostId: table.hostId,
        level: table.level,
        you: you >= 0 ? you : null,
        seats: table.seats.map(seat => seat && {
          type: seat.type,
          name: seat.type === 'robot' ? 'Robot' : seat.name,
          userId: seat.userId ?? null,
          connected: seat.type === 'robot' || seat.connected,
          away: !!seat.away,
        }),
        view: table.state && you >= 0 ? engine.viewFor(table.state, you) : null,
      });
    }
  }

  /** After any change: let robots (and robot stand-ins) move, and collect finished tricks. */
  function schedule(table) {
    clearTimeout(table.timer);
    if (table.status !== 'playing') return;
    const { engine } = GAMES[table.game];
    const s = table.state;
    const seat = engine.waitingFor(s);
    const robotTurn = seat != null && (table.seats[seat].type === 'robot' || table.seats[seat].away);
    if (robotTurn) {
      table.timer = setTimeout(() => {
        if (engine.waitingFor(table.state) !== seat) return;
        apply(table, engine.robotAction(table.state, seat, table.level));
      }, robotMs);
    } else if (s.phase === 'playing' && s.table.status === 'collecting') {
      table.timer = setTimeout(() => apply(table, { type: 'collect' }), collectMs);
    }
  }

  function apply(table, action) {
    table.state = GAMES[table.game].engine.act(table.state, action);
    broadcast(table);
    schedule(table);
  }

  const inLobby = table => table.status === 'lobby';

  io.on('connection', socket => {
    const user = socket.user;
    const current = () => tables.get(socket.data.code);
    const fail = (ack, message) => (typeof ack === 'function' ? ack({ error: message }) : socket.emit('mp:error', { message }));

    socket.on('mp:create', ({ game } = {}, ack) => {
      if (!GAMES[game]) return fail(ack, 'That game can\'t be played together yet.');
      const code = newCode();
      const table = {
        code, game, hostId: user.id, status: 'lobby', level: 'hard', state: null, timer: null,
        seats: Array(GAMES[game].seats).fill(null), lastActive: Date.now(), lastReaction: new Map(),
      };
      table.seats[0] = { type: 'human', userId: user.id, name: user.displayName, connected: true };
      tables.set(code, table);
      socket.join(code);
      socket.data.code = code;
      ack?.({ code });
      broadcast(table);
    });

    socket.on('mp:join', ({ code } = {}, ack) => {
      const table = tables.get(String(code ?? '').toUpperCase().trim());
      if (!table) return fail(ack, 'No table with that code — check the letters and try again.');
      if (socket.data.code && socket.data.code !== table.code) socket.leave(socket.data.code);
      socket.join(table.code);
      socket.data.code = table.code;
      const seat = seatOf(table, user.id);
      if (seat >= 0) {
        // Welcome back: take your seat again from the robot stand-in
        const s = table.seats[seat];
        clearTimeout(s.awayTimer);
        Object.assign(s, { connected: true, away: false, name: user.displayName });
      } else if (inLobby(table)) {
        const empty = table.seats.findIndex(s => s === null);
        if (empty >= 0) table.seats[empty] = { type: 'human', userId: user.id, name: user.displayName, connected: true };
      }
      ack?.({ ok: true, code: table.code });
      broadcast(table);
      schedule(table);
    });

    socket.on('mp:sit', ({ seat } = {}) => {
      const table = current();
      if (!table || !Number.isInteger(seat) || seat < 0 || seat >= table.seats.length) return;
      const target = table.seats[seat];
      const mine = seatOf(table, user.id);
      if (inLobby(table)) {
        if (target !== null) return fail(null, 'That seat is taken.');
        if (mine >= 0) table.seats[mine] = null;
      } else {
        // Once the game is going you can take over a robot's seat (if you haven't got one)
        if (mine >= 0 || target?.type !== 'robot') return fail(null, 'You can only take a robot\'s seat.');
      }
      table.seats[seat] = { type: 'human', userId: user.id, name: user.displayName, connected: true };
      broadcast(table);
      schedule(table);
    });

    socket.on('mp:stand', () => {
      const table = current();
      if (!table || !inLobby(table)) return;
      const mine = seatOf(table, user.id);
      if (mine >= 0) table.seats[mine] = null;
      broadcast(table);
    });

    socket.on('mp:robot', ({ seat, on } = {}) => {
      const table = current();
      if (!table || !inLobby(table) || seatOf(table, user.id) < 0) return;
      if (!Number.isInteger(seat) || seat < 0 || seat >= table.seats.length) return;
      if (on && table.seats[seat] === null) table.seats[seat] = { type: 'robot' };
      if (!on && table.seats[seat]?.type === 'robot') table.seats[seat] = null;
      broadcast(table);
    });

    socket.on('mp:level', ({ level } = {}) => {
      const table = current();
      if (!table || table.hostId !== user.id || !LEVELS.includes(level)) return;
      table.level = level;
      broadcast(table);
    });

    socket.on('mp:start', () => {
      const table = current();
      if (!table || !inLobby(table) || table.hostId !== user.id) return;
      if (table.seats.some(s => s === null)) return fail(null, 'Fill every seat (with people or robots) first.');
      table.status = 'playing';
      table.state = GAMES[table.game].engine.newGame();
      broadcast(table);
      schedule(table);
    });

    socket.on('mp:action', ({ action } = {}) => {
      const table = current();
      if (!table || table.status !== 'playing' || !action) return;
      const seat = seatOf(table, user.id);
      if (seat < 0) return fail(null, 'You\'re watching — take a seat to play.');
      try {
        if (action.type === 'nextHand' || action.type === 'newGame') apply(table, { type: action.type });
        else if (['bid', 'nest', 'play'].includes(action.type)) apply(table, { ...action, seat });
      } catch (e) {
        fail(null, e.message);
      }
    });

    socket.on('mp:react', ({ emoji } = {}) => {
      const table = current();
      if (!table || !REACTIONS.includes(emoji)) return;
      const seat = seatOf(table, user.id);
      const now = Date.now();
      if (seat < 0 || now - (table.lastReaction.get(user.id) ?? 0) < 1500) return;   // no flooding
      table.lastReaction.set(user.id, now);
      io.to(table.code).emit('mp:reaction', { seat, emoji });
    });

    socket.on('mp:leave', () => {
      const table = current();
      if (!table) return;
      const seat = seatOf(table, user.id);
      if (seat >= 0) {
        if (inLobby(table)) table.seats[seat] = null;
        else Object.assign(table.seats[seat], { connected: false, away: true });   // a robot plays for you
      }
      socket.leave(table.code);
      socket.data.code = null;
      if (inLobby(table) && !table.seats.some(s => s?.type === 'human')) { tables.delete(table.code); return; }
      broadcast(table);
      schedule(table);
    });

    socket.on('disconnect', () => {
      const table = current();
      if (!table) return;
      const seat = seatOf(table, user.id);
      if (seat < 0) return;
      // Still connected on another device or tab? Then nothing changes
      const stillHere = [...(io.sockets.adapter.rooms.get(table.code) ?? [])]
        .some(id => id !== socket.id && io.sockets.sockets.get(id)?.user.id === user.id);
      if (stillHere) return;
      const s = table.seats[seat];
      s.connected = false;
      // Give them a little while to come back (an iPad waking up, say) before a robot steps in
      clearTimeout(s.awayTimer);
      s.awayTimer = setTimeout(() => {
        if (s.connected) return;
        s.away = true;
        broadcast(table);
        schedule(table);
      }, awayMs);
      broadcast(table);
    });
  });

  // Clear away tables nobody has used for a while
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, table] of tables) {
      if (now - table.lastActive > idleMs) { clearTimeout(table.timer); tables.delete(code); }
    }
  }, 10 * 60 * 1000);
  sweeper.unref?.();

  return { tables, stop: () => { clearInterval(sweeper); for (const t of tables.values()) clearTimeout(t.timer); } };
}

module.exports = { createTables, GAMES, REACTIONS };
