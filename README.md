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

## Features
- Full user accounts (JWT auth) — up to 5 family members
- Easy / Medium / Hard AI opponents
- Real-time family multiplayer (Socket.io)
- Dad jokes between levels 😄
- PWA — installable to iPad home screen

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL
- **Deployment**: Railway

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

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
   # Edit server/.env with your DATABASE_URL and JWT secrets
   ```

3. **Set up the database**
   ```bash
   cd server && npm run setup
   # This runs migrations + seeds dad jokes & trivia questions
   ```

4. **Run the app**
   ```bash
   # From project root:
   npm run dev
   # Client: http://localhost:5173
   # Server: http://localhost:3001
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
│       ├── pages/        # App pages (Landing, Login, Profile, Admin)
│       └── utils/        # API client, card engine, AI opponent
├── server/          # Node.js + Express + Socket.io
│   ├── db/          # PostgreSQL pool, migrations, seeds
│   ├── middleware/  # JWT auth middleware
│   ├── routes/      # API routes
│   └── socket/      # WebSocket handlers
└── railway.toml     # Railway deployment config
```
