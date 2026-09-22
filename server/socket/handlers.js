const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Active rooms in memory: roomId -> { gameType, players, state, ... }
const rooms = new Map();

function initSocketHandlers(io) {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.displayName} (${socket.id})`);

    // ── Room Management ──────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      try {
        const result = await pool.query(`SELECT * FROM game_rooms WHERE id = $1`, [roomId]);
        const room = result.rows[0];
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (room.status === 'finished') return socket.emit('error', { message: 'Game already finished' });

        socket.join(roomId);

        // Update players list
        const players = room.players;
        const alreadyIn = players.find(p => p.id === socket.user.id);
        if (!alreadyIn) {
          players.push({ id: socket.user.id, displayName: socket.user.displayName, ready: false });
          await pool.query(`UPDATE game_rooms SET players = $1 WHERE id = $2`, [JSON.stringify(players), roomId]);
        }

        io.to(roomId).emit('room:updated', { roomId, players, status: room.status });
        socket.emit('room:joined', { roomId, gameType: room.game_type, players });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(roomId);
      try {
        const result = await pool.query(`SELECT * FROM game_rooms WHERE id = $1`, [roomId]);
        const room = result.rows[0];
        if (!room) return;
        const players = room.players.filter(p => p.id !== socket.user.id);
        await pool.query(`UPDATE game_rooms SET players = $1 WHERE id = $2`, [JSON.stringify(players), roomId]);
        io.to(roomId).emit('room:updated', { roomId, players });
      } catch {}
    });

    socket.on('room:ready', async ({ roomId }) => {
      try {
        const result = await pool.query(`SELECT * FROM game_rooms WHERE id = $1`, [roomId]);
        const room = result.rows[0];
        if (!room) return;
        const players = room.players.map(p =>
          p.id === socket.user.id ? { ...p, ready: true } : p
        );
        await pool.query(`UPDATE game_rooms SET players = $1 WHERE id = $2`, [JSON.stringify(players), roomId]);
        io.to(roomId).emit('room:updated', { roomId, players });
      } catch {}
    });

    // ── Game Events ──────────────────────────────────────────────────
    // Generic game action relay — each game handles its own state logic
    socket.on('game:action', async ({ roomId, action, payload }) => {
      try {
        const result = await pool.query(`SELECT * FROM game_rooms WHERE id = $1`, [roomId]);
        const room = result.rows[0];
        if (!room || room.status !== 'playing') return;

        // Broadcast action to all other players in the room
        socket.to(roomId).emit('game:action', {
          playerId: socket.user.id,
          playerName: socket.user.displayName,
          action,
          payload,
          timestamp: Date.now(),
        });

        // Persist updated game state if provided
        if (payload?.newState) {
          await pool.query(
            `UPDATE game_rooms SET state = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(payload.newState), roomId]
          );
        }
      } catch {}
    });

    socket.on('game:start', async ({ roomId }) => {
      try {
        await pool.query(`UPDATE game_rooms SET status = 'playing' WHERE id = $1`, [roomId]);
        io.to(roomId).emit('game:started', { roomId });
      } catch {}
    });

    socket.on('game:end', async ({ roomId, results }) => {
      try {
        await pool.query(`UPDATE game_rooms SET status = 'finished', state = $1 WHERE id = $2`,
          [JSON.stringify({ results }), roomId]);
        io.to(roomId).emit('game:ended', { roomId, results });
      } catch {}
    });

    // ── Chat within a room ───────────────────────────────────────────
    socket.on('room:chat', ({ roomId, message }) => {
      io.to(roomId).emit('room:chat', {
        playerId: socket.user.id,
        playerName: socket.user.displayName,
        message: message.slice(0, 200),
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.user?.displayName}`);
    });
  });
}

module.exports = { initSocketHandlers };
