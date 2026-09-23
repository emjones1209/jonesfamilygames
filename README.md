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

The repo's `railway.toml` tells Railway how to build and start the app. On
startup the server creates any missing tables and seeds trivia and dad jokes
(safe to repeat). You only need to create the services, set variables and add
a domain.

1. **Create the services.** In Railway, create a project (or open an existing
   one) and add:
   - the app: **+ New → GitHub Repo →** this repository (leave *Root Directory* empty)
   - the database: **+ New → Database → PostgreSQL**
2. **Set the app's variables** (app service → **Variables**):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (a reference to the database service; use its exact name if it isn't "Postgres") |
   | `JWT_SECRET` | a long random string (see below) |
   | `JWT_REFRESH_SECRET` | a *different* long random string |
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | `https://games.example.com` — the site's final address |
   | `FAMILY_INVITE_CODE` | a word or phrase family members type to sign up (not case-sensitive) |

   Generate each secret on your own computer:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. **Deploy** and check `https://<service>.up.railway.app/api/health` returns
   `{"status":"ok",...}` (Settings → Networking → *Generate Domain* gives a
   temporary address).
4. **Add the custom domain** (Settings → Networking → *Custom Domain*), then
   create the CNAME record Railway shows at your DNS provider. HTTPS is issued
   automatically once DNS resolves.

After that, every push to `main` deploys automatically. If Railway shows the
repo in red or "Could not load branches", its GitHub app can't see this repo:
on GitHub go to Settings → Applications → Railway → Configure and grant access
to this repository.

### Create Admin Account

Register on the live site, then run this in the Postgres service's **Data → Query** tab:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```
Sign out and back in to see the Admin link.

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
