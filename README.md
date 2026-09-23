# Family Games Suite

An ad-free web app suite of games for the whole family, optimized for iPad.

## Games
- ✝️ Bible Trivia
- 📜 History Trivia
- 🌍 Geography Trivia
- 🃏 Solitaire (Klondike)
- ♥️ Hearts
- ♠️ Spades
- 🐦 Rook
- 🌉 Bridge (Full)
- ⛳ 6-Card Golf
- 🧩 Jigsaw Puzzle (use your own photos!)
- 🌸 Garden Match (Candy Crush-style)
- 💣 Minesweeper

## Features
- Full user accounts (JWT auth)
- Easy / Medium / Hard AI opponents
- Dad jokes between levels 😄
- PWA — installable to iPad home screen

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL in production; SQLite automatically in local development
- **Tests**: Vitest (game rules and full-hand simulations)
- **Deployment**: Railway

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (production only — leave `DATABASE_URL` unset locally to use SQLite)

### Local Development

1. **Clone and install**
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

2. **Configure the server**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your JWT secrets (and DATABASE_URL for PostgreSQL)
   ```

3. **Set up the database**
   ```bash
   cd server && npm run setup
   # This runs migrations + seeds dad jokes & trivia questions.
   # Safe to re-run: it only adds questions and jokes that are missing.
   ```

4. **Run the app**
   ```bash
   # From project root:
   npm run dev
   # Client: http://localhost:5173
   # Server: http://localhost:3001
   ```

### Running the tests
```bash
cd client && npm test
```

### Railway Deployment

1. Create a new Railway project
2. Add a PostgreSQL plugin to get `DATABASE_URL`
3. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway Postgres plugin)
   - `JWT_SECRET` (long random string)
   - `JWT_REFRESH_SECRET` (another long random string)
   - `NODE_ENV=production`
   - `CLIENT_URL` (your Railway app URL)
4. After first deploy, run migrations:
   ```bash
   railway run cd server && npm run setup
   ```

### Create Admin Account

After registration, manually set a user as admin in the database:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

## Project Structure
```
games_suite/
├── client/          # React + Vite + Tailwind
│   └── src/
│       ├── components/   # Shared UI components
│       ├── context/      # Auth & Socket contexts
│       ├── games/        # Individual game implementations
│       │   └── cards/    # Shared trick-taking engine, AI and table UI
│       ├── pages/        # App pages (Landing, Login, Profile, Admin)
│       └── utils/        # API client, card engine, AI opponent
├── server/          # Node.js + Express + Socket.io
│   ├── db/          # PostgreSQL pool, migrations, seeds
│   ├── middleware/  # JWT auth middleware
│   ├── routes/      # API routes
│   └── socket/      # WebSocket handlers
└── railway.toml     # Railway deployment config
```

## Multiplayer (unfinished)
The server has room and Socket.io code, and the client has a `MultiplayerLobby`
component, but no game uses them yet, so multiplayer is hidden. The socket
layer only relays messages between players; a working version needs the server
to hold each game's state and to check that players belong to the room.
