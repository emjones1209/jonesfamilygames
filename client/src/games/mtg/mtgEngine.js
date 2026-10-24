/**
 * A game of Magic: The Gathering for two players as a pure state machine: you
 * (seat 0) against a computer player (seat 1). Each player has a preconstructed
 * 40-card deck (decks.js).
 *
 * `act(state, action)` returns the next state or throws an Error whose message
 * explains why the action isn't allowed:
 *   { type: 'keep', seat } / { type: 'mulligan', seat }      before the game (London mulligan)
 *   { type: 'choose', seat, cards: [ids] }                   cards to put on the bottom / discard
 *   { type: 'play', seat, card }                             play a land
 *   { type: 'cast', seat, card, targets: [target|null] }      cast a spell
 *   { type: 'activate', seat, perm, ability, targets }       e.g. Prodigal Pyromancer's ping
 *   { type: 'attack', seat, attackers: [ids] }               in your first main phase ([] = no combat)
 *   { type: 'block', seat, blocks: [{ blocker, attacker }] }
 *   { type: 'pass', seat }                                   done: let the top spell resolve, or move on
 *   { type: 'endTurn', seat }                                from a main phase, straight to the end of turn
 *   { type: 'resign', seat }
 *
 * The turn, simplified for the screen but true to the rules:
 *   untap, draw → main1 → (attack: 'attacks' → 'declareBlockers' → 'blocks' → damage) → main2 → 'end' → cleanup
 * Who may act at instant speed in each step, and who first:
 *   main1/main2: the player whose turn it is (the other player only to respond to a spell)
 *   attacks:     the defending player (after attackers are declared)
 *   blocks:      the attacking player, then the defender (after blockers are declared)
 *   end:         the player whose turn it isn't
 * Casting a spell or activating an ability counts as passing priority, so the
 * other player gets the chance to respond; when both pass in a row the top of
 * the stack resolves. A player with nothing they could do passes automatically.
 */
import { deckById, deckList } from './decks.js';
import { TOKENS } from './cardPool.js';
import {
  defOf, parseCost, isLand, isCreature, isInstant, isPermanentCard, stats, has, perm, creaturesOf, allCreatures,
  payment, isLegalTarget, targetSpecs, targetsAvailable, canAttack, canBlock, blockProblem,
  combatDamage, hasFirstStrikeStep, HAND_LIMIT, START_LIFE, COLORS,
} from './mtgRules.js';

const other = seat => 1 - seat;
const OPENING_HAND = 7;
const LOG_LENGTH = 60;

const WINDOWS = {
  main1: { opener: 'active' },
  attacks: { opener: 'defender' },
  blocks: { opener: 'active', both: true },
  main2: { opener: 'active' },
  end: { opener: 'defender' },
};
const opener = s => (WINDOWS[s.step]?.opener === 'defender' ? other(s.active) : s.active);
export const isMain = s => s.step === 'main1' || s.step === 'main2';

// ── Randomness (seeded, so a game can be replayed in tests) ──────────────────
function rand(s) {
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
const newId = s => `c${s.nextId++}`;

// ── Log ──────────────────────────────────────────────────────────────────────
/**
 * Log entries: { seat, v: [verb for "you", verb for others], rest } or { text }.
 * In `rest`/`text`, @0 and @1 stand for the players (see describeLog).
 */
function log(s, entry) {
  s.log.push({ n: s.logNo++, ...entry });
  if (s.log.length > LOG_LENGTH) s.log.shift();
}
const said = (s, seat, v, rest = '') => log(s, { seat, v, rest });
const note = (s, text) => log(s, { text });

/** A log entry as text, for `viewer` (who's "you"); names[seat] for the others. */
export function describeLog(entry, names, viewer = 0) {
  const who = i => (Number(i) === viewer ? 'you' : names[i]);
  const fill = t => t.replace(/@(\d)/g, (_, i) => who(i));
  if (entry.text) return fill(entry.text).replace(/^you/, 'You');
  const subject = entry.seat === viewer ? 'You' : names[entry.seat];
  return `${subject} ${entry.v[entry.seat === viewer ? 0 : 1]}${entry.rest ? ` ${fill(entry.rest)}` : ''}`;
}

function nameOf(s, ref) {
  if (!ref) return '';
  if (ref.type === 'player') return `@${ref.seat}`;
  if (ref.type === 'perm') return perm(s, ref.id)?.name ?? 'a creature';
  if (ref.type === 'stack') return s.stack.find(i => i.id === ref.id)?.card?.name ?? 'a spell';
  if (ref.type === 'card') return s.seats.flatMap(p => p.graveyard).find(c => c.id === ref.id)?.name ?? 'a card';
  return '';
}

// ── A new game ───────────────────────────────────────────────────────────────
/**
 * @param decks  [your deck id, the opponent's]
 * @param first  who goes first (null: decided at random)
 * @param wins   running totals across games
 */
export function newGame({ decks, first = null, wins = [0, 0], seed = (Math.random() * 2 ** 31) | 0 } = {}) {
  const s = {
    seed, nextId: 1, logNo: 1,
    phase: 'mulligan',         // mulligan | playing | gameOver
    step: null,
    turnNo: 0, active: 0, first: 0,
    priority: null, passes: 0,
    battlefield: [], stack: [], combat: null,
    pending: null,             // a choice someone must make before anything else happens
    winner: null, reason: null, wins,
    log: [],
    seats: [],
  };
  s.first = first ?? (rand(s) < 0.5 ? 0 : 1);
  s.active = s.first;
  s.seats = decks.map((id, seat) => {
    const library = deckList(deckById(id)).map(name => ({ id: newId(s), name, owner: seat }));
    shuffle(s, library);
    return { deck: id, life: START_LIFE, library, hand: [], graveyard: [], exile: [], landsPlayed: 0, mulligans: 0, drewFromEmpty: false };
  });
  for (const seat of [0, 1]) draw(s, seat, OPENING_HAND);
  s.pending = { type: 'mulligan', seat: s.first };
  note(s, s.first === 0 ? 'You go first.' : `@${s.first} goes first.`);
  return s;
}

// ── Queries ──────────────────────────────────────────────────────────────────
/** The seat that must act next, or null when the game is over. */
export function waitingFor(s) {
  if (s.phase === 'gameOver') return null;
  if (s.pending) return s.pending.seat;
  if (s.step === 'declareBlockers') return other(s.active);
  return s.priority;
}

const sorcerySpeed = (s, seat) => s.phase === 'playing' && !s.pending && s.active === seat && isMain(s) && !s.stack.length && s.priority === seat;
const hasPriority = (s, seat) => s.phase === 'playing' && !s.pending && s.priority === seat && s.step !== 'declareBlockers';

export const canPlayLand = (s, seat, card) => sorcerySpeed(s, seat) && s.seats[seat].landsPlayed < 1 && isLand(defOf(card));

/** Whether `card` in your hand can be cast now (timing, mana and targets). */
export function canCast(s, seat, card) {
  const def = defOf(card);
  if (isLand(def) || !hasPriority(s, seat)) return false;
  if (!isInstant(def) && !sorcerySpeed(s, seat)) return false;
  if (!payment(s, seat, def.cost)) return false;
  // A creature can always be cast; its "enters" ability just won't do anything without a target
  return isCreature(def) || targetsAvailable(s, seat, targetSpecs(def));
}

/** Whether ability `index` of permanent `p` can be activated now. */
export function canActivate(s, seat, p, index) {
  const ab = defOf(p).abilities?.[index];
  if (!ab || p.controller !== seat || !hasPriority(s, seat)) return false;
  if (ab.tap && (p.tapped || (isCreature(defOf(p)) && p.sick && !has(s, p, 'haste')))) return false;
  if (ab.cost && !payment(s, seat, ab.cost)) return false;
  return targetsAvailable(s, seat, ab.targets ?? []);
}

const pumps = effects => (effects ?? []).every(e => e.do === 'pump' || e.do === 'pumpAll');

/**
 * What a player could do at instant speed now. Pump effects only count during
 * combat or with something on the stack (no point stopping to offer them otherwise).
 */
export function instantOptions(s, seat) {
  if (!hasPriority(s, seat)) return [];
  const pumpTime = !!s.combat || s.stack.length > 0;
  const out = [];
  for (const card of s.seats[seat].hand) {
    const def = defOf(card);
    if (isInstant(def) && canCast(s, seat, card) && (pumpTime || !pumps(def.effect))) out.push({ type: 'cast', card: card.id });
  }
  for (const p of s.battlefield) {
    (defOf(p).abilities ?? []).forEach((ab, i) => {
      if (canActivate(s, seat, p, i) && (pumpTime || !pumps(ab.effect))) out.push({ type: 'activate', perm: p.id, ability: i });
    });
  }
  return out;
}

/** Whether passing is all a player can do (they then pass automatically). */
function onlyPass(s, seat) {
  if (sorcerySpeed(s, seat)) return false;
  return instantOptions(s, seat).length === 0;
}

/** Possible blocks for the defending player: some creature of theirs can block some attacker. */
export function canBlockAny(s) {
  if (!s.combat) return false;
  const blockers = creaturesOf(s, other(s.active));
  return s.combat.attackers.some(a => {
    const att = perm(s, a.id);
    return att && blockers.some(b => canBlock(s, b, att));
  });
}

export const attackersFor = s => s.battlefield.filter(p => canAttack(s, p));

// ── Moving cards ─────────────────────────────────────────────────────────────
function draw(s, seat, n = 1) {
  const p = s.seats[seat];
  for (let i = 0; i < n; i++) {
    if (!p.library.length) { p.drewFromEmpty = true; return; }
    p.hand.push(p.library.shift());
  }
}

/** A permanent leaves the battlefield for its owner's graveyard, hand or exile (tokens just vanish). */
function leave(s, p, zone) {
  s.battlefield = s.battlefield.filter(x => x.id !== p.id);
  if (s.combat) {
    s.combat.attackers = s.combat.attackers.filter(a => a.id !== p.id);
    for (const a of s.combat.attackers) a.blockers = a.blockers.filter(id => id !== p.id);
  }
  if (!p.token) s.seats[p.owner][zone].push({ id: p.id, name: p.name, owner: p.owner });
  for (const aura of s.battlefield.filter(x => x.attachedTo === p.id)) leave(s, aura, 'graveyard');
}

function enter(s, card, controller, { tapped = false } = {}) {
  const p = {
    id: card.id, name: card.name, owner: card.owner, controller, tapped, sick: true,
    damage: 0, deathtouched: false, counters: 0, boosts: [], attachedTo: null, token: card.token ?? null,
  };
  s.battlefield.push(p);
  return p;
}

function makeToken(s, controller, kind) {
  const token = TOKENS[kind];
  return enter(s, { id: newId(s), name: token.name, owner: controller, token }, controller);
}

function discard(s, seat, ids) {
  const p = s.seats[seat];
  for (const id of ids) {
    const at = p.hand.findIndex(c => c.id === id);
    if (at >= 0) p.graveyard.push(p.hand.splice(at, 1)[0]);
  }
}

// ── Damage, life and state-based actions ─────────────────────────────────────
/** source: { controller, deathtouch, lifelink } */
function dealDamage(s, source, to, n) {
  if (n <= 0) return;
  if (to.type === 'player') s.seats[to.seat].life -= n;
  else {
    const p = perm(s, to.id);
    if (!p) return;
    p.damage += n;
    if (source.deathtouch) p.deathtouched = true;
  }
  if (source.lifelink) s.seats[source.controller].life += n;
}

const creatureSource = (s, p) => ({ controller: p.controller, deathtouch: has(s, p, 'deathtouch'), lifelink: has(s, p, 'lifelink') });

function checkState(s) {
  if (s.phase !== 'playing') return;
  for (let again = true; again;) {
    again = false;
    for (const p of [...s.battlefield]) {
      if (!perm(s, p.id)) continue;
      const def = defOf(p);
      if (def.aura && !perm(s, p.attachedTo)) { leave(s, p, 'graveyard'); again = true; continue; }
      if (!isCreature(def)) continue;
      const { toughness } = stats(s, p);
      if (toughness <= 0 || p.damage >= toughness || (p.deathtouched && p.damage > 0)) {
        leave(s, p, 'graveyard');
        note(s, `${p.name} dies.`);
        again = true;
      }
    }
  }
  const lost = [0, 1].filter(seat => s.seats[seat].life <= 0 || s.seats[seat].drewFromEmpty);
  if (lost.length) {
    const reason = s.seats[lost[0]].life <= 0 ? 'life' : 'deck';
    finish(s, lost.length === 2 ? null : other(lost[0]), lost.length === 2 ? 'draw' : reason);
  }
}

function finish(s, winner, reason) {
  s.phase = 'gameOver';
  s.winner = winner;
  s.reason = reason;
  s.pending = null;
  if (winner != null) s.wins = s.wins.map((n, i) => (i === winner ? n + 1 : n));
}

// ── The turn ─────────────────────────────────────────────────────────────────
function startTurn(s) {
  const seat = s.active;
  s.turnNo += 1;
  for (const p of s.battlefield) {
    if (p.controller !== seat) continue;
    p.sick = false;
    if (p.tapped && !stats(s, p).noUntap) p.tapped = false;
  }
  s.seats[seat].landsPlayed = 0;
  note(s, `Turn ${s.turnNo}: @${seat}${seat === 0 ? 'r' : '\'s'} turn.`);
  if (!(s.turnNo === 1 && seat === s.first)) draw(s, seat, 1);      // the player going first skips their first draw
  checkState(s);
  enterStep(s, 'main1');
}

function enterStep(s, step) {
  s.step = step;
  s.passes = 0;
  s.priority = WINDOWS[step] ? opener(s) : null;
}

/** Everyone has passed with nothing on the stack: on to the next step. */
function nextStep(s) {
  switch (s.step) {
    case 'main1': enterStep(s, 'main2'); break;
    case 'attacks':
      if (!s.combat.attackers.length) { s.combat = null; enterStep(s, 'main2'); } else enterStep(s, 'declareBlockers');
      break;
    case 'blocks': combat(s); break;
    case 'main2': enterStep(s, 'end'); break;
    case 'end': cleanup(s); break;
    default: break;
  }
}

function combat(s) {
  if (hasFirstStrikeStep(s)) {
    damageStep(s, true);
    checkState(s);
    if (s.phase !== 'playing') return;
    damageStep(s, false);
  } else damageStep(s, null);
  checkState(s);
  if (s.phase !== 'playing') return;
  s.combat = null;
  enterStep(s, 'main2');
}

function damageStep(s, first) {
  const hits = combatDamage(s, first);
  const sources = new Map(hits.map(h => [h.source, creatureSource(s, perm(s, h.source))]));
  const toPlayer = [0, 0];
  for (const h of hits) {
    dealDamage(s, sources.get(h.source), h.to, h.n);
    if (h.to.type === 'player') toPlayer[h.to.seat] += h.n;
  }
  for (const seat of [0, 1]) if (toPlayer[seat]) note(s, `@${seat} take${seat === 0 ? '' : 's'} ${toPlayer[seat]} combat damage.`);
}

function cleanup(s) {
  const seat = s.active, extra = s.seats[seat].hand.length - HAND_LIMIT;
  if (extra > 0) {
    s.step = 'cleanup';
    s.pending = { type: 'discard', seat, count: extra, reason: 'handSize' };
    return;
  }
  endTurn(s);
}

function endTurn(s) {
  for (const p of s.battlefield) { p.damage = 0; p.deathtouched = false; p.boosts = []; }
  s.combat = null;
  s.active = other(s.active);
  startTurn(s);
}

/** Let the player with priority pass. */
function pass(s, seat) {
  if (s.stack.length) {
    if (s.passes >= 1) {
      resolveTop(s);
      s.passes = 0;
      if (s.phase === 'playing') s.priority = opener(s);
    } else {
      s.passes = 1;
      s.priority = other(seat);
    }
    return;
  }
  if (WINDOWS[s.step]?.both && s.passes === 0) {
    s.passes = 1;
    s.priority = other(seat);
    return;
  }
  nextStep(s);
}

/** Carry on by itself until someone has a real decision to make. */
function advance(s) {
  for (let guard = 0; guard < 500; guard++) {
    checkState(s);
    if (s.phase !== 'playing' || s.pending) return;
    if (s.step === 'declareBlockers') {
      if (canBlockAny(s)) return;
      block(s, []);
      continue;
    }
    if (s.priority != null && onlyPass(s, s.priority)) { pass(s, s.priority); continue; }
    return;
  }
}

function block(s, blocks) {
  for (const a of s.combat.attackers) {
    a.blockers = blocks.filter(b => b.attacker === a.id).map(b => b.blocker);
    a.blocked = a.blockers.length > 0;
  }
  const defender = other(s.active);
  for (const a of s.combat.attackers) {
    if (a.blocked) said(s, defender, ['block', 'blocks'], `${perm(s, a.id).name} with ${a.blockers.map(id => perm(s, id).name).join(' and ')}.`);
  }
  if (!blocks.length) said(s, defender, ['don\'t block.', 'doesn\'t block.']);
  enterStep(s, 'blocks');
}

// ── Resolving spells and abilities ───────────────────────────────────────────
function resolveTop(s) {
  const item = s.stack.pop();
  const seat = item.controller;
  if (item.kind === 'ability') {
    const source = perm(s, item.source);
    const ab = defOf(source ?? { name: item.sourceName, token: item.sourceToken })?.abilities?.[item.ability];
    const ctx = context(s, item, ab.targets ?? []);
    if (ctx.fizzled) { note(s, `${item.sourceName}'s ability has no legal target, so it does nothing.`); return; }
    run(s, ab.effect, { ...ctx, sourceId: item.source, source: source ? creatureSource(s, source) : { controller: seat } });
    checkState(s);
    return;
  }

  const card = item.card, def = defOf(card);
  const ctx = context(s, item, targetSpecs(def));
  if (!isCreature(def) && ctx.fizzled) {
    s.seats[card.owner].graveyard.push(card);
    note(s, `${card.name} has no legal target, so it does nothing.`);
    return;
  }
  if (isPermanentCard(def)) {
    const p = enter(s, card, seat, { tapped: !!def.entersTapped });
    if (def.aura) {
      p.attachedTo = item.targets[0].id;
      if (def.aura.tapOnEnter) perm(s, p.attachedTo).tapped = true;
    }
    if (def.etb) run(s, def.etb, { ...ctx, sourceId: p.id, source: creatureSource(s, p) });
  } else {
    run(s, def.effect, { ...ctx, sourceId: null, source: { controller: seat } });
    s.seats[card.owner].graveyard.push(card);
  }
  checkState(s);
}

/** Which of an item's targets are still legal; it fizzles if it had targets and none are. */
function context(s, item, specs) {
  const legal = specs.map((spec, i) => (item.targets[i] && isLegalTarget(s, item.controller, spec, item.targets[i], item.id) ? item.targets[i] : null));
  const had = item.targets.some(Boolean);
  return { controller: item.controller, targets: legal, fizzled: had && !legal.some(Boolean) };
}

function run(s, effects, ctx) {
  const seat = ctx.controller;
  const target = i => (typeof i === 'number' ? ctx.targets[i] : null);
  const permRef = what => (what === 'self' ? perm(s, ctx.sourceId) : target(what)?.type === 'perm' ? perm(s, target(what).id) : null);
  const playerOf = who => (who === 'you' ? seat : who === 'opp' ? other(seat) : target(who)?.seat ?? null);

  for (const e of effects ?? []) {
    if (s.phase !== 'playing') return;
    switch (e.do) {
      case 'damage': {
        if (e.to === 'eachCreature') { for (const p of allCreatures(s)) dealDamage(s, ctx.source, { type: 'perm', id: p.id }, e.n); break; }
        const t = target(e.to);
        if (t) dealDamage(s, ctx.source, t, e.n);
        break;
      }
      case 'destroy': { const p = permRef(e.what); if (p) leave(s, p, 'graveyard'); break; }
      case 'exile': {
        const p = permRef(e.what);
        if (!p) break;
        const power = Math.max(0, stats(s, p).power);
        leave(s, p, 'exile');
        if (e.lifeForPower && power) s.seats[p.controller].life += power;
        break;
      }
      case 'bounce': { const p = permRef(e.what); if (p) leave(s, p, 'hand'); break; }
      case 'pump': { const p = permRef(e.what); if (p) p.boosts.push({ p: e.p, t: e.t, kw: e.kw }); break; }
      case 'pumpAll': for (const p of creaturesOf(s, seat)) p.boosts.push({ p: e.p, t: e.t, kw: e.kw }); break;
      case 'counters': { const p = permRef(e.what); if (p) p.counters += e.n; break; }
      case 'draw': draw(s, seat, e.n); break;
      case 'gain': s.seats[seat].life += e.n; break;
      case 'lose': { const who = playerOf(e.who); if (who != null) s.seats[who].life -= e.n; break; }
      case 'discard': {
        const who = playerOf(e.who);
        if (who == null) break;
        const hand = s.seats[who].hand;
        if (hand.length <= e.n) discard(s, who, hand.map(c => c.id));
        else s.pending = { type: 'discard', seat: who, count: e.n, reason: 'spell' };
        break;
      }
      case 'counter': {
        const t = target(e.what);
        const at = t ? s.stack.findIndex(i => i.id === t.id) : -1;
        if (at < 0) break;
        const [countered] = s.stack.splice(at, 1);
        s.seats[countered.card.owner].graveyard.push(countered.card);
        note(s, `${countered.card.name} is countered.`);
        break;
      }
      case 'token': for (let i = 0; i < e.n; i++) makeToken(s, seat, e.token); break;
      case 'fetchLand': fetchLand(s, seat); break;
      case 'returnToHand': {
        const t = target(e.what);
        const gy = s.seats[seat].graveyard, at = t ? gy.findIndex(c => c.id === t.id) : -1;
        if (at >= 0) s.seats[seat].hand.push(gy.splice(at, 1)[0]);
        break;
      }
      case 'fight': case 'bite': {
        const a = permRef(e.a), b = permRef(e.b);
        if (!a || !b) break;
        const pa = stats(s, a).power, pb = stats(s, b).power;
        dealDamage(s, creatureSource(s, a), { type: 'perm', id: b.id }, pa);
        if (e.do === 'fight') dealDamage(s, creatureSource(s, b), { type: 'perm', id: a.id }, pb);
        break;
      }
      default: throw new Error(`Unknown effect ${e.do}`);
    }
  }
}

/** Rampant Growth: the basic land of the color your hand needs most. */
function fetchLand(s, seat) {
  const p = s.seats[seat];
  const lands = p.library.filter(c => defOf(c).type === 'Basic Land');
  if (lands.length) {
    const have = c => s.battlefield.filter(x => x.controller === seat && defOf(x).mana === c).length;
    const want = c => p.hand.reduce((n, card) => n + parseCost(defOf(card).cost)[c], 0);
    const score = card => { const c = defOf(card).mana; return want(c) * 2 - have(c); };
    const best = lands.reduce((a, b) => (score(b) > score(a) ? b : a));
    p.library = p.library.filter(c => c.id !== best.id);
    enter(s, best, seat, { tapped: true });
  }
  shuffle(s, p.library);
}

// ── Actions ──────────────────────────────────────────────────────────────────
function checkTargets(s, seat, specs, targets = [], selfId = null) {
  return specs.map((spec, i) => {
    const t = targets[i] ?? null;
    if (!t) {
      if (spec.optional) return null;
      throw new Error('Choose a target first.');
    }
    if (!isLegalTarget(s, seat, spec, t, selfId)) throw new Error('That isn\'t a legal target.');
    return t;
  });
}

function tapFor(s, seat, cost) {
  const ids = payment(s, seat, cost);
  if (!ids) throw new Error('You don\'t have enough mana for that.');
  for (const id of ids) perm(s, id).tapped = true;
}

const describeTargets = (s, targets) => {
  const named = targets.filter(Boolean).map(t => nameOf(s, t));
  return named.length ? ` targeting ${named.join(' and ')}` : '';
};

export function act(state, a) {
  if (a.type === 'resign') {
    if (state.phase === 'gameOver') throw new Error('The game is over.');
    const s = structuredClone(state);
    finish(s, other(a.seat), 'resigned');
    return s;
  }
  if (state.phase === 'gameOver') throw new Error('The game is over.');
  if (waitingFor(state) !== a.seat) throw new Error('It\'s not your turn to act.');
  const s = structuredClone(state);
  const me = s.seats[a.seat];

  switch (a.type) {
    case 'keep': case 'mulligan': {
      if (s.pending?.type !== 'mulligan') throw new Error('Not now.');
      if (a.type === 'mulligan') {
        if (me.mulligans >= 6) throw new Error('You can\'t mulligan again.');
        me.library.push(...me.hand);
        me.hand = [];
        shuffle(s, me.library);
        draw(s, a.seat, OPENING_HAND);
        me.mulligans += 1;
        said(s, a.seat, ['take a mulligan.', 'takes a mulligan.']);
        return s;
      }
      said(s, a.seat, ['keep', 'keeps'], `${me.hand.length - me.mulligans} cards.`);
      if (me.mulligans) s.pending = { type: 'bottom', seat: a.seat, count: me.mulligans };
      else afterMulligan(s, a.seat);
      break;
    }

    case 'choose': {
      const p = s.pending;
      if (!p || (p.type !== 'bottom' && p.type !== 'discard')) throw new Error('Not now.');
      const ids = [...new Set(a.cards ?? [])];
      if (ids.length !== p.count || !ids.every(id => me.hand.some(c => c.id === id))) {
        throw new Error(`Choose ${p.count} card${p.count === 1 ? '' : 's'} from your hand.`);
      }
      s.pending = null;
      if (p.type === 'bottom') {
        for (const id of ids) me.library.push(me.hand.splice(me.hand.findIndex(c => c.id === id), 1)[0]);
        afterMulligan(s, a.seat);
      } else {
        const names = ids.map(id => me.hand.find(c => c.id === id).name);
        discard(s, a.seat, ids);
        said(s, a.seat, ['discard', 'discards'], `${names.join(' and ')}.`);
        if (p.reason === 'handSize') endTurn(s);
      }
      break;
    }

    case 'play': {
      const card = me.hand.find(c => c.id === a.card);
      if (!card) throw new Error('That card isn\'t in your hand.');
      if (!isLand(defOf(card))) throw new Error('That isn\'t a land.');
      if (!sorcerySpeed(s, a.seat)) throw new Error('You can only play a land in your own main phase, when nothing is waiting to resolve.');
      if (me.landsPlayed >= 1) throw new Error('You can only play one land each turn.');
      me.hand = me.hand.filter(c => c.id !== card.id);
      enter(s, card, a.seat);
      me.landsPlayed += 1;
      said(s, a.seat, ['play', 'plays'], `${card.name}.`);
      break;
    }

    case 'cast': {
      const card = me.hand.find(c => c.id === a.card);
      if (!card) throw new Error('That card isn\'t in your hand.');
      const def = defOf(card);
      if (isLand(def)) throw new Error('Lands are played, not cast.');
      if (!hasPriority(s, a.seat)) throw new Error('You can\'t cast spells right now.');
      if (!isInstant(def) && !sorcerySpeed(s, a.seat)) {
        throw new Error(`${card.name} can only be cast in your own main phase, when nothing is waiting to resolve. Only instants can be cast at other times.`);
      }
      const specs = targetSpecs(def);
      // A creature's "enters" ability without a legal target just does nothing
      const targets = isCreature(def) && !targetsAvailable(s, a.seat, specs)
        ? specs.map(() => null)
        : checkTargets(s, a.seat, specs, a.targets);
      tapFor(s, a.seat, def.cost);
      me.hand = me.hand.filter(c => c.id !== card.id);
      const item = { id: newId(s), kind: 'spell', card, controller: a.seat, targets };
      s.stack.push(item);
      said(s, a.seat, ['cast', 'casts'], `${card.name}${describeTargets(s, targets)}.`);
      if (!isPermanentCard(def)) {
        for (const p of s.battlefield) if (p.controller === a.seat && defOf(p).onSpell) run(s, defOf(p).onSpell, { controller: a.seat, targets: [], sourceId: p.id });
      }
      s.passes = 1;
      s.priority = other(a.seat);
      break;
    }

    case 'activate': {
      const p = perm(s, a.perm);
      if (!p || !canActivate(s, a.seat, p, a.ability)) throw new Error('You can\'t do that right now.');
      const ab = defOf(p).abilities[a.ability];
      const targets = checkTargets(s, a.seat, ab.targets ?? [], a.targets);
      if (ab.cost) tapFor(s, a.seat, ab.cost);
      if (ab.tap) p.tapped = true;
      s.stack.push({ id: newId(s), kind: 'ability', source: p.id, sourceName: p.name, sourceToken: p.token, ability: a.ability, controller: a.seat, targets });
      said(s, a.seat, ['activate', 'activates'], `${p.name}${describeTargets(s, targets)}.`);
      s.passes = 1;
      s.priority = other(a.seat);
      break;
    }

    case 'attack': {
      if (s.step !== 'main1' || !sorcerySpeed(s, a.seat)) throw new Error('You can only attack from your first main phase, when nothing is waiting to resolve.');
      const ids = [...new Set(a.attackers ?? [])];
      for (const id of ids) {
        const p = perm(s, id);
        if (!p || !canAttack(s, p)) {
          if (p?.sick) throw new Error(`${p.name} just arrived: creatures can't attack on the turn they come into play (unless they have haste).`);
          throw new Error(`${p?.name ?? 'That'} can't attack.`);
        }
      }
      if (!ids.length) { enterStep(s, 'main2'); break; }
      for (const id of ids) { const p = perm(s, id); if (!has(s, p, 'vigilance')) p.tapped = true; }
      s.combat = { attackers: ids.map(id => ({ id, blockers: [], blocked: false })) };
      said(s, a.seat, ['attack', 'attacks'], `with ${ids.map(id => perm(s, id).name).join(', ')}.`);
      enterStep(s, 'attacks');
      break;
    }

    case 'block': {
      if (s.step !== 'declareBlockers') throw new Error('Not now.');
      const blocks = a.blocks ?? [];
      const problem = blockProblem(s, blocks);
      if (problem) throw new Error(problem);
      block(s, blocks);
      break;
    }

    case 'pass':
      if (!hasPriority(s, a.seat)) throw new Error('Not now.');
      pass(s, a.seat);
      break;

    case 'endTurn':
      if (!sorcerySpeed(s, a.seat)) throw new Error('Not now.');
      enterStep(s, 'end');
      break;

    default:
      throw new Error(`Unknown action ${a.type}`);
  }
  advance(s);
  return s;
}

function afterMulligan(s, seat) {
  s.pending = null;
  if (seat === s.first) s.pending = { type: 'mulligan', seat: other(seat) };
  else {
    s.phase = 'playing';
    startTurn(s);
  }
}

// ── What each player may see ─────────────────────────────────────────────────
/** The game as `seat` may see it: the other player's hand and both libraries are hidden. */
export function viewFor(s, seat) {
  return {
    ...s,
    seats: s.seats.map((p, i) => ({
      ...p,
      hand: i === seat ? p.hand : p.hand.map(c => ({ id: c.id, hidden: true })),
      library: p.library.length,
    })),
  };
}

export { other, COLORS };
