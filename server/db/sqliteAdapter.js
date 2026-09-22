/**
 * SQLite adapter with a pg-compatible interface.
 * Used automatically in local dev when DATABASE_URL is not set.
 * Translates $1,$2 placeholders → ?, serialises arrays/JSON.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'local.db');

let _db;
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    setupSchema(_db);
    seedDefaultData(_db);
  }
  return _db;
}

// Convert pg $1,$2 → ?, and handle NOW() / RANDOM()
function translateSql(sql) {
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/TIMESTAMPTZ/gi, 'TEXT')
    .replace(/expires_at > NOW\(\)/gi, "expires_at > datetime('now')")
    .replace(/ORDER BY RANDOM\(\)/gi, 'ORDER BY RANDOM()')
    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/BOOLEAN/gi, 'INTEGER')
    .replace(/JSONB/gi, 'TEXT')
    .replace(/TEXT\[\]/gi, 'TEXT');
}

// Fields that hold JSON arrays/objects in SQLite but need to be parsed
const JSON_FIELDS = new Set(['wrong_answers', 'state', 'players', 'metadata']);

function serializeParams(params) {
  if (!params) return [];
  return params.map(p => {
    if (Array.isArray(p) || (p && typeof p === 'object')) return JSON.stringify(p);
    return p;
  });
}

function deserializeRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of JSON_FIELDS) {
    if (key in out && typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch {}
    }
  }
  // Coerce is_admin to boolean
  if ('is_admin' in out) out.is_admin = Boolean(out.is_admin);
  return out;
}

function query(sql, params = []) {
  const db = getDb();
  const translated = translateSql(sql);
  const serialized = serializeParams(params);

  const upper = sql.trim().toUpperCase();
  const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
  const hasReturning = /RETURNING/i.test(sql);

  try {
    if (isSelect) {
      const stmt = db.prepare(translated);
      const rows = stmt.all(...serialized).map(deserializeRow);
      return Promise.resolve({ rows, rowCount: rows.length });
    } else if (hasReturning) {
      // better-sqlite3 supports RETURNING in SQLite >= 3.35
      const stmt = db.prepare(translated);
      const rows = stmt.all(...serialized).map(deserializeRow);
      return Promise.resolve({ rows, rowCount: rows.length });
    } else {
      const stmt = db.prepare(translated);
      const info = stmt.run(...serialized);
      return Promise.resolve({ rows: [], rowCount: info.changes });
    }
  } catch (err) {
    // Map SQLite unique constraint → pg error code
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      err.code = '23505';
    }
    return Promise.reject(err);
  }
}

// pg pool.connect() shim — routes only need pool.query, but migrate.js uses connect()
function connect() {
  const client = {
    query,
    release: () => {},
  };
  return Promise.resolve(client);
}

function setupSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar        TEXT DEFAULT 'default',
      is_admin      INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      game       TEXT NOT NULL,
      score      INTEGER NOT NULL,
      duration_s INTEGER,
      difficulty TEXT,
      metadata   TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trivia_questions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      category       TEXT NOT NULL,
      difficulty     TEXT NOT NULL,
      question       TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      wrong_answers  TEXT NOT NULL,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dad_jokes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      joke      TEXT NOT NULL,
      punchline TEXT NOT NULL,
      used_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS game_rooms (
      id         TEXT PRIMARY KEY,
      game_type  TEXT NOT NULL,
      host_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      state      TEXT DEFAULT '{}',
      players    TEXT DEFAULT '[]',
      status     TEXT DEFAULT 'waiting',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedDefaultData(db) {
  const jokeCount = db.prepare('SELECT COUNT(*) as n FROM dad_jokes').get();
  if (jokeCount.n > 0) return;

  const jokes = [
    ['Why don\'t scientists trust atoms?', 'Because they make up everything!'],
    ['Why did the scarecrow win an award?', 'Because he was outstanding in his field!'],
    ['I\'m reading a book about anti-gravity.', 'It\'s impossible to put down!'],
    ['Did you hear about the mathematician who\'s afraid of negative numbers?', 'He\'ll stop at nothing to avoid them!'],
    ['Why can\'t you give Elsa a balloon?', 'Because she\'ll let it go!'],
    ['What do you call fake spaghetti?', 'An impasta!'],
    ['Why did the bicycle fall over?', 'Because it was two-tired!'],
    ['What do you call a fish without eyes?', 'A fsh!'],
    ['I used to hate facial hair...', 'but then it grew on me!'],
    ['What do you call a sleeping dinosaur?', 'A dino-snore!'],
    ['Why don\'t eggs tell jokes?', 'Because they\'d crack each other up!'],
    ['What do you call cheese that isn\'t yours?', 'Nacho cheese!'],
    ['Why did the cookie go to the doctor?', 'Because it was feeling crumby!'],
    ['What do you call a bear with no teeth?', 'A gummy bear!'],
    ['Why can\'t Elsa have a balloon?', 'She\'ll let it go!'],
    ['How do you organize a space party?', 'You planet!'],
    ['What do you call a pile of cats?', 'A meow-ntain!'],
    ['Why do cows wear bells?', 'Because their horns don\'t work!'],
    ['What did the ocean say to the beach?', 'Nothing, it just waved!'],
    ['Why don\'t scientists trust atoms?', 'They make up everything!'],
  ];

  const insert = db.prepare('INSERT INTO dad_jokes (joke, punchline) VALUES (?, ?)');
  const insertMany = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
  insertMany(jokes);

  // Seed some trivia questions
  const triviaCount = db.prepare('SELECT COUNT(*) as n FROM trivia_questions').get();
  if (triviaCount.n > 0) return;

  const triviaInsert = db.prepare('INSERT INTO trivia_questions (category, difficulty, question, correct_answer, wrong_answers) VALUES (?, ?, ?, ?, ?)');
  const triviaData = [
    ['bible','easy','Who built the ark?','Noah',JSON.stringify(['Moses','David','Abraham'])],
    ['bible','easy','How many disciples did Jesus have?','12',JSON.stringify(['7','10','15'])],
    ['bible','easy','What is the first book of the Bible?','Genesis',JSON.stringify(['Exodus','Matthew','Psalms'])],
    ['bible','easy','What did God create on the first day?','Light',JSON.stringify(['Water','Animals','Plants'])],
    ['bible','medium','Who was swallowed by a large fish?','Jonah',JSON.stringify(['Elijah','Paul','Peter'])],
    ['bible','medium','How many days did it rain during the flood?','40',JSON.stringify(['7','14','100'])],
    ['bible','hard','Who was the father of King Solomon?','David',JSON.stringify(['Saul','Abraham','Moses'])],
    ['history','easy','Who was the first US President?','George Washington',JSON.stringify(['Abraham Lincoln','Thomas Jefferson','John Adams'])],
    ['history','easy','In what year did World War II end?','1945',JSON.stringify(['1918','1939','1950'])],
    ['history','easy','Who invented the telephone?','Alexander Graham Bell',JSON.stringify(['Thomas Edison','Nikola Tesla','Guglielmo Marconi'])],
    ['history','medium','What ancient wonder was located in Alexandria?','The Lighthouse',JSON.stringify(['The Colossus','The Pyramids','The Hanging Gardens'])],
    ['history','medium','Who wrote the Declaration of Independence?','Thomas Jefferson',JSON.stringify(['George Washington','Benjamin Franklin','John Adams'])],
    ['history','hard','In what year did the Berlin Wall fall?','1989',JSON.stringify(['1979','1991','1985'])],
    ['geography','easy','What is the capital of France?','Paris',JSON.stringify(['London','Rome','Berlin'])],
    ['geography','easy','What is the largest ocean?','Pacific',JSON.stringify(['Atlantic','Indian','Arctic'])],
    ['geography','easy','What is the longest river in the world?','Nile',JSON.stringify(['Amazon','Mississippi','Yangtze'])],
    ['geography','medium','What country has the most natural lakes?','Canada',JSON.stringify(['Russia','USA','Brazil'])],
    ['geography','medium','What is the smallest country in the world?','Vatican City',JSON.stringify(['Monaco','San Marino','Liechtenstein'])],
    ['geography','hard','What is the capital of Australia?','Canberra',JSON.stringify(['Sydney','Melbourne','Brisbane'])],
  ];

  const insertTrivia = db.transaction((rows) => { for (const r of rows) triviaInsert.run(...r); });
  insertTrivia(triviaData);
}

module.exports = { query, connect };
