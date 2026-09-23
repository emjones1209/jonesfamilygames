/**
 * Database setup: create any missing tables, then add any missing trivia
 * questions and dad jokes. Safe to run any number of times.
 *
 * The server runs this on startup when using PostgreSQL (DATABASE_URL set), so
 * a fresh deployment works without a separate setup step. The local SQLite
 * database creates its own tables (see sqliteAdapter.js).
 */
const { migrate } = require('./migrate');
const { seedDadJokes } = require('./seedDadJokes');
const { seedTrivia } = require('./seedTrivia');

async function setup() {
  await migrate();
  await seedDadJokes();
  await seedTrivia();
}

module.exports = { setup };

// Run directly: `npm run setup`
if (require.main === module) setup().then(() => process.exit(0)).catch(() => process.exit(1));
