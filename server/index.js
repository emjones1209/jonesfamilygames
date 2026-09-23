require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const scoreRoutes = require('./routes/scores');
const triviaRoutes = require('./routes/trivia');
const dadJokeRoutes = require('./routes/dadJokes');
const roomRoutes = require('./routes/rooms');
const { initSocketHandlers } = require('./socket/handlers');
const { setup } = require('./db/setup');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/scores',    scoreRoutes);
app.use('/api/trivia',    triviaRoutes);
app.use('/api/dad-jokes', dadJokeRoutes);
app.use('/api/rooms',     roomRoutes);

// Serve static client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  // Express 5 requires named wildcards ('*' alone throws at startup)
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Socket.io
initSocketHandlers(io);

const PORT = process.env.PORT || 3001;

async function start() {
  // PostgreSQL: create tables and seed content before taking requests
  // (idempotent). Local SQLite sets itself up in sqliteAdapter.js.
  if (process.env.DATABASE_URL) await setup();
  server.listen(PORT, () => {
    console.log(`🎮 Games Suite server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});
