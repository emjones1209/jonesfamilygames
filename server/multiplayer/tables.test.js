// Play-together tables, end to end: a real Socket.io server and three family
// members' devices (plus a robot) playing Rook against each other.
// Run with: npm test (in server/)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');

process.env.JWT_SECRET = 'test-secret';
const { socketAuth } = require('../middleware/auth');
const { createTables } = require('./tables');
const engine = require('../../client/src/games/rook/rookEngine.js');

let server, io, tables, url;
const clients = [];

before(async () => {
  server = http.createServer();
  io = new Server(server);
  io.use(socketAuth);
  tables = createTables(io, { robotMs: 2, collectMs: 2, awayMs: 60 });
  await new Promise(resolve => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

after(() => {
  for (const c of clients) c.disconnect();
  tables.stop();
  io.close();
  server.close();
});

/** A family member's device: connects, remembers the latest table it was sent. */
function player(id, name) {
  const token = jwt.sign({ id, displayName: name }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const socket = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  const p = { id, name, socket, table: null, reactions: [], errors: [], sawOthersCards: false };
  socket.on('mp:table', t => {
    p.table = t;
    // Privacy: another player's hand must never arrive
    if (t.view) {
      const hands = t.view.table ? t.view.table.hands : t.view.hands;
      hands.forEach((h, seat) => { if (seat !== t.you && h.some(c => c !== null)) p.sawOthersCards = true; });
      if (t.view.nest.some(c => c !== null)) p.sawOthersCards = true;
    }
  });
  socket.on('mp:reaction', r => p.reactions.push(r));
  socket.on('mp:error', e => p.errors.push(e.message));
  p.emit = (event, data) => new Promise(resolve => socket.emit(event, data, resolve));
  return p;
}

const until = async (check, ms = 5000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 5));
  }
};

/** Each person plays their own turns as soon as it's their move (simple choices). */
function autoplay(p) {
  const move = () => {
    const t = p.table;
    if (!t?.view || t.you == null) return;
    const v = t.view;
    if (v.phase === 'handOver' && t.you === 0) return p.socket.emit('mp:action', { action: { type: 'nextHand' } });
    if (engine.waitingFor(v) !== t.you) return;
    let action;
    if (v.phase === 'bidding') action = { type: 'bid', bid: engine.mustBid(v) ? 70 : 'pass' };
    else if (v.phase === 'nest') action = { type: 'nest', discard: v.hands[t.you].slice(0, 5).map(c => c.id), trump: 'red' };
    else action = { type: 'play', cardId: engine.legalFor(v, t.you)[0].id };
    p.socket.emit('mp:action', { action });
  };
  p.socket.on('mp:table', () => setTimeout(move, 1));
}

test('three people and a robot play Rook together', async () => {
  const mom = player(1, 'Mom'), dad = player(2, 'Dad'), me = player(3, 'Emily');
  await until(() => mom.socket.connected && dad.socket.connected && me.socket.connected);

  const { code } = await mom.emit('mp:create', { game: 'rook' });
  assert.match(code, /^[A-Z]{4}$/);
  assert.deepEqual(await dad.emit('mp:join', { code: code.toLowerCase() }), { ok: true, code });
  await me.emit('mp:join', { code });
  await until(() => mom.table?.seats.filter(Boolean).length === 3);
  assert.deepEqual(mom.table.seats.map(s => s?.name ?? null), ['Mom', 'Dad', 'Emily', null]);
  assert.equal(dad.table.you, 1);

  // Only the host can start, and every seat needs filling
  dad.socket.emit('mp:start');
  mom.socket.emit('mp:start');
  await until(() => mom.errors.length === 1);
  assert.match(mom.errors[0], /Fill every seat/);
  mom.socket.emit('mp:robot', { seat: 3, on: true });
  await until(() => mom.table.seats[3]?.type === 'robot');

  // Quick reactions reach everyone, but not too fast
  me.socket.emit('mp:react', { emoji: '👍' });
  me.socket.emit('mp:react', { emoji: '🎉' });           // too soon after the first: dropped
  me.socket.emit('mp:react', { emoji: 'rude word' });    // not on the list: dropped
  await until(() => dad.reactions.length >= 1);
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(dad.reactions, [{ seat: 2, emoji: '👍' }]);

  [mom, dad, me].forEach(autoplay);
  mom.socket.emit('mp:start');
  await until(() => mom.table.status === 'playing');

  // Somebody's iPad goes to sleep mid-hand: after a moment a robot plays for them…
  await until(() => mom.table.view.phase === 'playing' && mom.table.view.table.history.length >= 2);
  me.socket.disconnect();
  await until(() => mom.table.seats[2].away === true);
  const handsBefore = mom.table.view.handNo;
  await until(() => mom.table.view.handNo > handsBefore || mom.table.view.phase === 'gameOver', 10000);

  // …and when they come back they're in their seat again with their own cards
  const back = player(3, 'Emily');
  autoplay(back);
  await until(() => back.socket.connected);
  await back.emit('mp:join', { code });
  await until(() => back.table?.you === 2 && back.table.seats[2].away === false);
  assert.ok(back.table.view.hands[2].every(c => c !== null) || back.table.view.phase !== 'bidding');

  // Play on to the end of the game
  await until(() => mom.table.view.phase === 'gameOver', 20000);
  assert.ok(Math.max(...mom.table.view.scores) >= 300);
  assert.deepEqual(dad.table.view.scores, mom.table.view.scores);

  for (const p of [mom, dad, me, back]) assert.equal(p.sawOthersCards, false, `${p.name} saw someone else's cards`);
});

test('moves are checked: only on your turn, only legal cards', async () => {
  const a = player(10, 'A'), b = player(11, 'B');
  await until(() => a.socket.connected && b.socket.connected);
  const { code } = await a.emit('mp:create', { game: 'rook' });
  await b.emit('mp:join', { code });
  for (const seat of [2, 3]) a.socket.emit('mp:robot', { seat, on: true });
  await until(() => a.table?.seats.every(Boolean));
  a.socket.emit('mp:start');
  await until(() => a.table.status === 'playing');
  // Dealer is seat 3, so seat 0 (A) bids first; B trying to bid now is refused
  b.socket.emit('mp:action', { action: { type: 'bid', bid: 80 } });
  await until(() => b.errors.length === 1);
  assert.match(b.errors[0], /not your turn/);
  // A bid that isn't allowed explains why
  a.socket.emit('mp:action', { action: { type: 'bid', bid: 73 } });
  await until(() => a.errors.length === 1);
  assert.match(a.errors[0], /steps of 5/);
  // An unknown table code
  const res = await b.emit('mp:join', { code: 'ZZZZ' });
  assert.match(res.error, /No table/);
});
