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
 *   { type: 'activate', seat, perm, ability, targets }       e.g. Prodigal Pyromancer's ping, or Equip
 *   { type: 'attack', seat, attackers: [ids] }               in your first main phase ([] = no combat)
 *   { type: 'block', seat, blocks: [{ blocker, attacker }] }
 *   { type: 'pass', seat }                                   done: let the top spell resolve, or move on
 *   { type: 'endTurn', seat }                                from a main phase, straight to the end of turn
 *   { type: 'resign', seat }
 *
 * The turn, simplified for the screen but true to the rules:
 *   untap, ('upkeep' if something triggers then), draw → main1 → (attack: 'attacks' → 'declareBlockers' → 'blocks' → damage)
 *   → main2 → 'end' → cleanup
 * Who may act at instant speed in each step, and who first:
 *   upkeep:      the player whose turn it is
 *   main1/main2: the player whose turn it is (the other player only to respond to a spell)
 *   attacks:     the defending player (after attackers are declared)
 *   blocks:      the attacking player, then the defender (after blockers are declared)
 *   end:         the player whose turn it isn't
 * Casting a spell or activating an ability counts as passing priority, so the
 * other player gets the chance to respond; when both pass in a row the top of
 * the stack resolves. A player with nothing they could do passes automatically.
 *
 * Triggered abilities ("whenever…", "when … dies", "at the beginning of your
 * upkeep…", see cardPool.js) are collected as they trigger and put on the stack
 * the next time a player would get priority — the active player's first, so the
 * other player's resolve first — and then resolve like spells.
 */
import { deckById, deckList } from './decks.js';
import { TOKENS } from './cardPool.js';
import {
  defOf, parseCost, isLand, isCreature, isArtifact, isInstant, isPermanentCard, stats, has, perm, creaturesOf, allCreatures,
  payment, isLegalTarget, targetSpecs, targetsAvailable, canAttack, canBlock, blockProblem,
  combatDamage, hasFirstStrikeStep, HAND_LIMIT, START_LIFE, COLORS,
} from './mtgRules.js';

const other = seat => 1 - seat;
const OPENING_HAND = 7;
const LOG_LENGTH = 60;

const WINDOWS = {
  upkeep: { opener: 'active' },
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
 * Log entries: { seat, v: [verb for "you", verb for others], rest } or { text }, plus
 *   why    lines explaining what happened and the rules behind it
 *   about  the player whose action (or spell, or attack) it was
 *   card   { name, token } the card it's about, to show
 *   minor  nothing much to explain (a land played, a new turn)
 * In `rest`/`text`/`why`, @0 and @1 stand for the players (see describeLog). The
 * wording takes seat 0 as "you".
 */
function log(s, entry) {
  s.log.push({ n: s.logNo++, ...entry });
  if (s.log.length > LOG_LENGTH) s.log.shift();
}
const said = (s, seat, v, rest = '', extra = {}) => log(s, { seat, v, rest, about: seat, ...extra });
const note = (s, text, extra = {}) => log(s, { text, ...extra });
/** "@0 draw" / "@1 draws" */
const subj = (seat, you, them) => `@${seat} ${seat === 0 ? you : them}`;
/** Explanation lines are collected here while a spell resolves or combat damage is dealt. */
const explain = (s, line) => { if (s.why) s.why.push(line); };

const fillNames = (t, names, viewer) => t.replace(/@(\d)/g, (_, i) => (Number(i) === viewer ? 'you' : names[i]));
const capital = t => t.charAt(0).toUpperCase() + t.slice(1);

/** A log entry as text, for `viewer` (who's "you"); names[seat] for the others. */
export function describeLog(entry, names, viewer = 0) {
  if (entry.text) return capital(fillNames(entry.text, names, viewer));
  const subject = entry.seat === viewer ? 'You' : names[entry.seat];
  return `${subject} ${entry.v[entry.seat === viewer ? 0 : 1]}${entry.rest ? ` ${fillNames(entry.rest, names, viewer)}` : ''}`;
}

/** A log entry's explanation, as lines of text. */
export const explainLog = (entry, names, viewer = 0) => (entry.why ?? []).map(t => capital(fillNames(t, names, viewer)));

const ptText = (s, p) => { const st = stats(s, p); return `${st.power}/${st.toughness}`; };
const article = word => (/^[AEIOU]/i.test(word) ? `an ${word}` : `a ${word}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cardRef = c => ({ name: c.name, token: c.token ?? null });

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
    triggered: [],             // triggered abilities waiting to go on the stack
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
  if (ab.sorcery && !sorcerySpeed(s, seat)) return false;
  if (ab.tap && (p.tapped || (isCreature(defOf(p)) && p.sick && !has(s, p, 'haste')))) return false;
  if (ab.cost && !payment(s, seat, ab.cost, ab.tap ? p.id : null)) return false;
  return targetsAvailable(s, seat, ab.targets ?? []);
}

const pumps = effects => (effects ?? []).every(e => e.do === 'pump' || e.do === 'pumpAll');
/** An ability with no target that isn't urgent (drawing a card, a counter): only worth stopping for at certain times. */
const quiet = ab => !(ab.targets ?? []).length;

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
      if (ab.sorcery || !canActivate(s, seat, p, i)) return;
      if (pumps(ab.effect) ? !pumpTime : quiet(ab) && !pumpTime && s.step !== 'end') return;
      out.push({ type: 'activate', perm: p.id, ability: i });
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

/**
 * A permanent leaves the battlefield for its owner's graveyard, hand or exile (tokens just vanish).
 * A creature put into the graveyard dies, which can trigger abilities: its own, and other
 * permanents' "whenever a creature dies" (`together`: creatures dying at the same time, which
 * see each other die).
 */
function leave(s, p, zone, together = []) {
  s.battlefield = s.battlefield.filter(x => x.id !== p.id);
  if (s.combat) {
    s.combat.attackers = s.combat.attackers.filter(a => a.id !== p.id);
    for (const a of s.combat.attackers) a.blockers = a.blockers.filter(id => id !== p.id);
  }
  if (!p.token) s.seats[p.owner][zone].push({ id: p.id, name: p.name, owner: p.owner });
  for (const x of s.battlefield.filter(x => x.attachedTo === p.id)) {
    if (defOf(x).aura) leave(s, x, 'graveyard');
    else {
      x.attachedTo = null;                      // equipment stays, unattached
      explain(s, `${x.name} stays on the battlefield, no longer attached to anything: it can be equipped to another creature.`);
    }
  }
  if (zone !== 'graveyard' || !isCreature(defOf(p))) return;
  for (const t of triggersOf(p, 'dies')) trigger(s, p, t);
  const watchers = [p, ...together.filter(x => x.id !== p.id), ...s.battlefield];
  for (const q of watchers) {
    for (const t of triggersOf(q, 'creatureDies')) if (!t.yours || q.controller === p.controller) trigger(s, q, t, { that: p.id });
  }
}

function enter(s, card, controller, { tapped = false } = {}) {
  const p = {
    id: card.id, name: card.name, owner: card.owner, controller, tapped, sick: true,
    damage: 0, deathtouched: false, counters: 0, boosts: [], attachedTo: null, token: card.token ?? null,
  };
  s.battlefield.push(p);
  const def = defOf(p);
  if (isCreature(def)) {
    for (const q of s.battlefield) {
      if (q.id === p.id) continue;
      for (const t of triggersOf(q, 'creatureEnters')) if (!t.yours || q.controller === controller) trigger(s, q, t, { that: p.id });
    }
  }
  if (isLand(def)) {
    for (const q of s.battlefield) if (q.controller === controller) for (const t of triggersOf(q, 'landfall')) trigger(s, q, t);
  }
  return p;
}

// ── Triggered abilities ──────────────────────────────────────────────────────
const triggersOf = (p, when) => (defOf(p).triggers ?? []).filter(t => t.when === when);

/** A triggered ability of permanent `p` has triggered: it waits to go on the stack. */
function trigger(s, p, t, extra = {}) {
  s.triggered.push({
    controller: p.controller, sourceId: p.id, sourceName: p.name, sourceToken: p.token ?? null, effect: t.effect, text: t.text, ...extra,
  });
}

/** Put waiting triggered abilities on the stack: the active player's first (so the other player's resolve first). */
function stackTriggers(s) {
  const waiting = s.triggered;
  s.triggered = [];
  const order = [...waiting.filter(t => t.controller === s.active), ...waiting.filter(t => t.controller !== s.active)];
  for (const t of order) {
    s.stack.push({ id: newId(s), kind: 'trigger', targets: [], ...t });
    const ref = { name: t.sourceName, token: t.sourceToken };
    note(s, `${t.sourceName}'s ability triggers.`, {
      about: t.controller, card: ref, minor: true,
      why: [`"${t.text}"`, 'A triggered ability goes on the stack like a spell, so both players can respond before it happens.'],
    });
  }
  s.passes = 0;
  s.priority = s.active;
}

/** A player gains life (which can trigger "whenever you gain life"). */
function gainLife(s, seat, n) {
  if (n <= 0) return;
  s.seats[seat].life += n;
  for (const q of s.battlefield) if (q.controller === seat) for (const t of triggersOf(q, 'gainLife')) trigger(s, q, t);
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
/** source: { id, controller, deathtouch, lifelink } (id: the permanent dealing it, if any) */
function dealDamage(s, source, to, n) {
  if (n <= 0) return;
  if (to.type === 'player') {
    s.seats[to.seat].life -= n;
    const p = source.id && perm(s, source.id);
    if (p && to.seat !== source.controller) for (const t of triggersOf(p, 'damagesOpponent')) trigger(s, p, t);
  } else {
    const p = perm(s, to.id);
    if (!p) return;
    p.damage += n;
    if (source.deathtouch) p.deathtouched = true;
  }
  if (source.lifelink) gainLife(s, source.controller, n);
}

const creatureSource = (s, p) => ({ id: p.id, controller: p.controller, deathtouch: has(s, p, 'deathtouch'), lifelink: has(s, p, 'lifelink') });

function checkState(s) {
  if (s.phase !== 'playing') return;
  for (let again = true; again;) {
    again = false;
    for (const p of [...s.battlefield]) {
      if (!perm(s, p.id)) continue;
      const def = defOf(p);
      if (def.aura && !perm(s, p.attachedTo)) {
        leave(s, p, 'graveyard');
        explain(s, `${p.name} goes to the graveyard too: an aura with nothing to enchant can't stay.`);
        again = true;
        continue;
      }
    }
    // Creatures with lethal damage (or no toughness left) all die at the same time
    const dying = [];
    for (const p of s.battlefield) {
      if (!isCreature(defOf(p))) continue;
      const { toughness } = stats(s, p);
      const reason = toughness <= 0 ? `its toughness is down to ${toughness}, and a creature with 0 toughness or less dies`
        : p.deathtouched && p.damage > 0 && p.damage < toughness ? 'it was dealt damage by a creature with deathtouch, and any amount of that is enough'
          : p.damage >= toughness ? `it has ${p.damage} damage and its toughness is ${toughness} — damage equal to toughness destroys a creature` : null;
      if (reason) dying.push({ p, reason });
    }
    for (const { p, reason } of dying) {
      leave(s, p, 'graveyard', dying.map(d => d.p));
      const line = `${p.name} dies: ${reason}.${p.token ? ' (A token that leaves the battlefield simply disappears.)' : ''}`;
      explain(s, line);
      note(s, `${p.name} dies.`, { why: [line], minor: !!s.why, card: cardRef(p) });
      again = true;
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
  // "At the beginning of your upkeep": those happen (on the stack) before the draw
  for (const p of s.battlefield) if (p.controller === seat) for (const t of triggersOf(p, 'upkeep')) trigger(s, p, t);
  if (s.triggered.length) enterStep(s, 'upkeep');
  else drawStep(s);
}

function drawStep(s) {
  const seat = s.active;
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
    case 'upkeep': drawStep(s); break;
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
  const lifeBefore = s.seats.map(p => p.life);
  const anyBlocks = s.combat.attackers.some(a => a.blocked);
  s.why = [];
  const toPlayer = [0, 0];
  if (hasFirstStrikeStep(s)) {
    explain(s, 'First strike: creatures with first strike (or double strike) deal their combat damage first. Any creature that dies then doesn\'t get to strike back.');
    damageStep(s, true, toPlayer);
    checkState(s);
    if (s.phase === 'playing') {
      explain(s, 'Then regular combat damage: everyone else (and double strikers again).');
      damageStep(s, false, toPlayer);
    }
  } else damageStep(s, null, toPlayer);
  checkState(s);
  for (const seat of [0, 1]) {
    if (s.seats[seat].life !== lifeBefore[seat]) explain(s, `@${seat}: ${lifeBefore[seat]} → ${s.seats[seat].life} life.`);
  }
  if (s.phase === 'playing' && toPlayer.creatures) explain(s, 'Damage on creatures that survived wears off at the end of the turn.');
  const hit = [0, 1].filter(seat => toPlayer[seat]);
  const text = hit.length ? hit.map(seat => `${subj(seat, 'take', 'takes')} ${toPlayer[seat]} combat damage`).join(', ') + '.' : 'Combat damage: no damage to players.';
  // (Worth explaining to you when the computer attacked, or blocked your attack)
  note(s, text, { why: s.why, about: anyBlocks || s.active === 1 ? 1 : 0 });
  s.why = null;
  if (s.phase !== 'playing') return;
  s.combat = null;
  enterStep(s, 'main2');
}

function damageStep(s, first, toPlayer) {
  const hits = combatDamage(s, first);
  const sources = new Map(hits.map(h => [h.source, creatureSource(s, perm(s, h.source))]));
  const name = id => perm(s, id)?.name;
  // Explain each fight: who hit whom, and why (blocked, trample, deathtouch, lifelink)
  for (const a of s.combat.attackers) {
    const att = perm(s, a.id);
    if (!att) continue;
    const mine = hits.filter(h => h.source === a.id);
    const back = hits.filter(h => h.to.type === 'perm' && h.to.id === a.id);
    const desc = `${att.name} (${ptText(s, att)})`;
    if (!a.blocked) {
      if (mine.length) explain(s, `${desc} wasn't blocked, so it deals ${mine[0].n} damage to @${mine[0].to.seat}.`);
      continue;
    }
    const blockers = a.blockers.map(id => perm(s, id)).filter(Boolean);
    if (!blockers.length && !mine.length) {
      if (first !== false) explain(s, `${desc} was blocked, so it deals no damage even though its blocker is gone (only trample would let it hit the player).`);
      continue;
    }
    for (const h of [...mine].sort((x, y) => (x.to.type === 'player') - (y.to.type === 'player'))) {
      if (h.to.type === 'player') explain(s, `${att.name} has trample: it only has to give its blockers enough damage to destroy them, and the other ${h.n} goes through to @${h.to.seat}.`);
      else explain(s, `${att.name} deals ${h.n} damage to ${name(h.to.id)} (${ptText(s, perm(s, h.to.id))}).`);
    }
    for (const h of back) explain(s, `${name(h.source)} (${ptText(s, perm(s, h.source))}) deals ${h.n} damage back to ${att.name}.`);
  }
  for (const [id, src] of sources) {
    const total = hits.filter(h => h.source === id).reduce((n, h) => n + h.n, 0);
    if (src.lifelink && total) explain(s, `${name(id)} has lifelink: it dealt ${total} damage, so ${subj(src.controller, 'gain', 'gains')} ${total} life.`);
    if (src.deathtouch && hits.some(h => h.source === id && h.to.type === 'perm')) explain(s, `${name(id)} has deathtouch: any damage it deals to a creature destroys it.`);
  }
  for (const h of hits) {
    dealDamage(s, sources.get(h.source), h.to, h.n);
    if (h.to.type === 'player') toPlayer[h.to.seat] += h.n;
    else if (perm(s, h.to.id)) toPlayer.creatures = true;    // (any creature hit: its damage wears off later)
  }
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
    if (s.phase !== 'playing') { s.triggered = []; return; }
    if (s.pending) return;
    if (s.triggered.length && s.step !== 'declareBlockers') { stackTriggers(s); continue; }
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
  const desc = id => { const p = perm(s, id); return `${p.name} (${ptText(s, p)})`; };
  const why = [];
  for (const a of s.combat.attackers) {
    const att = perm(s, a.id);
    if (a.blocked) {
      why.push(a.blockers.length > 1
        ? `${a.blockers.map(desc).join(' and ')} gang up on ${desc(a.id)}: ${att.name} splits its damage between them, and they all hit it.`
        : `${desc(a.blockers[0])} blocks ${desc(a.id)}: each will deal damage equal to its power to the other.`);
    } else {
      why.push(`${desc(a.id)} isn't blocked, so it will hit @${defender} for ${Math.max(0, stats(s, att).power)}.`);
    }
  }
  why.push('Before damage is dealt, both players get one last chance to cast instants (combat tricks like Giant Growth).');
  const blocked = s.combat.attackers.filter(a => a.blocked);
  if (blocked.length) {
    const rest = blocked.map(a => `${perm(s, a.id).name} with ${a.blockers.map(id => perm(s, id).name).join(' and ')}`).join('; ');
    said(s, defender, ['block', 'blocks'], `${rest}.`, { why });
  } else {
    said(s, defender, ['don\'t block.', 'doesn\'t block.'], '', { why });
  }
  enterStep(s, 'blocks');
}

// ── Resolving spells and abilities ───────────────────────────────────────────
function resolveTop(s) {
  const item = s.stack.pop();
  const seat = item.controller;
  const fizzleWhy = 'When a spell or ability resolves, it checks its targets again. Its target is gone or no longer legal, so it does nothing at all.';
  s.why = [];
  if (item.kind === 'trigger') {
    const source = perm(s, item.sourceId);
    explain(s, `"${item.text}"`);
    run(s, item.effect, {
      controller: seat, targets: [], name: item.sourceName, sourceId: item.sourceId, that: item.that,
      source: source ? creatureSource(s, source) : { controller: seat },
    });
    checkState(s);
    note(s, `${item.sourceName}'s triggered ability resolves.`, { why: s.why, about: seat, card: { name: item.sourceName, token: item.sourceToken } });
    s.why = null;
    return;
  }
  if (item.kind === 'ability') {
    const source = perm(s, item.source);
    const ab = defOf(source ?? { name: item.sourceName, token: item.sourceToken })?.abilities?.[item.ability];
    const ctx = context(s, item, ab.targets ?? []);
    const card = { name: item.sourceName, token: item.sourceToken };
    if (ctx.fizzled) {
      note(s, `${item.sourceName}'s ability has no legal target, so it does nothing.`, { why: [fizzleWhy], about: seat, card });
    } else {
      run(s, ab.effect, { ...ctx, name: item.sourceName, sourceId: item.source, source: source ? creatureSource(s, source) : { controller: seat } });
      checkState(s);
      note(s, `${item.sourceName}'s ability resolves.`, { why: s.why, about: seat, card });
    }
    s.why = null;
    return;
  }

  const card = item.card, def = defOf(card);
  const ctx = context(s, item, targetSpecs(def));
  if (!isCreature(def) && ctx.fizzled) {
    s.seats[card.owner].graveyard.push(card);
    note(s, `${card.name} has no legal target, so it does nothing.`, { why: [fizzleWhy, 'It still goes to the graveyard, and the mana spent on it is gone.'], about: seat, card: cardRef(card) });
    s.why = null;
    return;
  }
  if (isPermanentCard(def)) {
    const p = enter(s, card, seat, { tapped: !!def.entersTapped });
    if (isCreature(def)) {
      explain(s, `${card.name} (${ptText(s, p)}) enters the battlefield under ${seat === 0 ? 'your' : `@${seat}'s`} control.`);
      if (def.entersTapped) explain(s, 'It enters tapped (sideways).');
      if (has(s, p, 'haste')) explain(s, 'It has haste, so it can attack right away.');
      else explain(s, `It can't attack (or use {T} abilities) until its controller's next turn — creatures need a turn to settle in.${stats(s, p).cantBlock ? '' : ' It can block straight away, though.'}`);
    }
    if (def.aura) {
      p.attachedTo = item.targets[0].id;
      const host = perm(s, p.attachedTo);
      explain(s, `${card.name} is attached to ${host.name}: "${def.text.split('\n').slice(1).join(' ')}"`);
      if (def.aura.tapOnEnter) host.tapped = true;
      explain(s, `It stays as long as ${host.name} is on the battlefield.`);
    } else if (def.equipment) {
      explain(s, `${card.name} is equipment: it stays on the battlefield and does nothing until it's attached to a creature with its Equip ability (in its controller's main phase). Then: "${def.text.split('\n')[0]}"`);
    } else if (!isCreature(def)) {
      explain(s, `${card.name} stays on the battlefield: "${def.text}"`);
    }
    if (def.etb) {
      explain(s, 'Its "enters" ability happens now:');
      run(s, def.etb, { ...ctx, name: card.name, sourceId: p.id, source: creatureSource(s, p) });
    }
  } else {
    run(s, def.effect, { ...ctx, name: card.name, sourceId: null, source: { controller: seat } });
    s.seats[card.owner].graveyard.push(card);
    explain(s, `${card.name} then goes to its owner's graveyard (instants and sorceries are used up once they resolve).`);
  }
  checkState(s);
  note(s, `${card.name} resolves.`, { why: s.why, about: seat, card: cardRef(card) });
  s.why = null;
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
  const permRef = what => (what === 'self' ? perm(s, ctx.sourceId) : what === 'that' ? perm(s, ctx.that)
    : target(what)?.type === 'perm' ? perm(s, target(what).id) : null);
  const playerOf = who => (who === 'you' ? seat : who === 'opp' ? other(seat) : target(who)?.seat ?? null);

  const name = ctx.name ?? 'It';
  const life = (who, f) => {
    const before = s.seats[who].life;
    f();
    explain(s, `@${who}: ${before} → ${s.seats[who].life} life.`);
  };
  const hurt = (t, n, source = ctx.source, from = name) => {
    if (t.type === 'player') {
      life(t.seat, () => dealDamage(s, source, t, n));
      return;
    }
    const p = perm(s, t.id);
    if (!p) return;
    explain(s, `${from} deals ${n} damage to ${p.name} (${ptText(s, p)}${p.damage ? `, already has ${p.damage} damage` : ''}).`);
    dealDamage(s, source, t, n);
    if (p.damage < stats(s, p).toughness && !(p.deathtouched && p.damage)) explain(s, `That isn't enough to destroy ${p.name}: it survives (the damage wears off at the end of the turn).`);
  };

  for (const e of effects ?? []) {
    if (s.phase !== 'playing') return;
    switch (e.do) {
      case 'damage': {
        if (e.to === 'eachCreature') {
          explain(s, `${name} deals ${e.n} damage to every creature on the battlefield — both players' creatures.`);
          for (const p of allCreatures(s)) dealDamage(s, ctx.source, { type: 'perm', id: p.id }, e.n);
          break;
        }
        const t = target(e.to);
        if (t?.type === 'player') explain(s, `${name} deals ${e.n} damage to @${t.seat}.`);
        if (t) hurt(t, e.n);
        break;
      }
      case 'destroy': {
        const p = permRef(e.what);
        if (!p) break;
        leave(s, p, 'graveyard');
        explain(s, `${p.name} is destroyed and goes to its owner's graveyard${p.token ? ' (a token just disappears)' : ''}.`);
        break;
      }
      case 'exile': {
        const p = permRef(e.what);
        if (!p) break;
        const power = Math.max(0, stats(s, p).power);
        leave(s, p, 'exile');
        explain(s, `${p.name} is exiled: removed from the game entirely (it doesn't even go to the graveyard).`);
        if (e.lifeForPower && power) {
          explain(s, `Its controller gains life equal to its power (${power}).`);
          life(p.controller, () => gainLife(s, p.controller, power));
        }
        break;
      }
      case 'bounce': {
        const p = permRef(e.what);
        if (!p) break;
        leave(s, p, 'hand');
        explain(s, p.token
          ? `${p.name} is a token, so instead of going back to a hand it simply disappears.`
          : `${p.name} returns to its owner's hand. Any damage, counters and auras on it are gone — it can be cast again, but costs mana again (and arrives fresh, unable to attack that turn).`);
        break;
      }
      case 'pump': {
        const p = permRef(e.what);
        if (!p) break;
        p.boosts.push({ p: e.p, t: e.t, kw: e.kw });
        const sign = n => (n >= 0 ? `+${n}` : `${n}`);
        explain(s, `${p.name} gets ${sign(e.p)}/${sign(e.t)}${e.kw ? ` and ${e.kw.join(', ')}` : ''} until end of turn: it's now ${ptText(s, p)}.${e.kw?.includes('haste') ? ' With haste it can attack this turn.' : ''}`);
        break;
      }
      case 'battleCry': {
        const others = (s.combat?.attackers ?? []).map(a => perm(s, a.id)).filter(p => p && p.id !== ctx.sourceId);
        for (const p of others) p.boosts.push({ p: 1, t: 0 });
        explain(s, others.length
          ? `Battle cry: every other attacking creature gets +1/+0 until end of turn (${others.map(p => `${p.name} is now ${ptText(s, p)}`).join(', ')}).`
          : 'Battle cry: there are no other attacking creatures, so it does nothing.');
        break;
      }
      case 'attach': {
        const eq = perm(s, ctx.sourceId), p = permRef(e.what);
        if (!eq || !p) break;
        eq.attachedTo = p.id;
        explain(s, `${eq.name} is attached to ${p.name}: it's now ${ptText(s, p)}${defOf(eq).equipment.kw ? ` with ${defOf(eq).equipment.kw.join(' and ')}` : ''}. If ${p.name} leaves the battlefield, ${eq.name} stays behind, ready to be equipped again.`);
        break;
      }
      case 'countersAll': {
        const mine = creaturesOf(s, seat).filter(p => !e.artifact || isArtifact(defOf(p)));
        for (const p of mine) p.counters += e.n;
        explain(s, mine.length
          ? `A +1/+1 counter on each artifact creature ${subj(seat, 'control', 'controls')}: ${mine.map(p => `${p.name} (${ptText(s, p)})`).join(', ')}. Counters last.`
          : 'There are no artifact creatures to put counters on.');
        break;
      }
      case 'discardRandom': {
        const who = playerOf(e.who), hand = who == null ? [] : s.seats[who].hand;
        if (!hand.length) { explain(s, `${subj(who, 'have', 'has')} no cards in hand, so nothing is discarded.`); break; }
        const card = hand[Math.floor(rand(s) * hand.length)];
        discard(s, who, [card.id]);
        explain(s, `${subj(who, 'discard', 'discards')} ${card.name}, chosen at random.`);
        break;
      }
      case 'pumpAll': {
        const mine = creaturesOf(s, seat);
        for (const p of mine) p.boosts.push({ p: e.p, t: e.t, kw: e.kw });
        explain(s, `Every creature ${subj(seat, 'control', 'controls')} (${mine.length}) gets +${e.p}/+${e.t}${e.kw ? ` and ${e.kw.join(', ')}` : ''} until end of turn.`);
        break;
      }
      case 'counters': {
        const p = permRef(e.what);
        if (!p) break;
        p.counters += e.n;
        explain(s, `${p.name} gets a +1/+1 counter (that one lasts): it's now ${ptText(s, p)}.`);
        break;
      }
      case 'draw':
        draw(s, seat, e.n);
        explain(s, `${subj(seat, 'draw', 'draws')} ${plural(e.n, 'card')}.`);
        break;
      case 'gain': life(seat, () => gainLife(s, seat, e.n)); break;
      case 'lose': {
        const who = playerOf(e.who);
        if (who != null) life(who, () => { s.seats[who].life -= e.n; });
        break;
      }
      case 'discard': {
        const who = playerOf(e.who);
        if (who == null) break;
        const hand = s.seats[who].hand;
        if (hand.length <= e.n) {
          explain(s, `${subj(who, 'have', 'has')} only ${plural(hand.length, 'card')} in hand, so ${who === 0 ? 'you discard' : 'they discard'} them all.`);
          discard(s, who, hand.map(c => c.id));
        } else {
          explain(s, `${subj(who, 'choose', 'chooses')} ${plural(e.n, 'card')} to discard (the player discarding gets to choose).`);
          s.pending = { type: 'discard', seat: who, count: e.n, reason: 'spell' };
        }
        break;
      }
      case 'counter': {
        const t = target(e.what);
        const at = t ? s.stack.findIndex(i => i.id === t.id) : -1;
        if (at < 0) break;
        const [countered] = s.stack.splice(at, 1);
        s.seats[countered.card.owner].graveyard.push(countered.card);
        explain(s, `${countered.card.name} is countered: it's taken off the stack and put into the graveyard without doing anything. The mana spent on it is lost.`);
        note(s, `${countered.card.name} is countered.`, { minor: true, card: cardRef(countered.card) });
        break;
      }
      case 'token': {
        for (let i = 0; i < e.n; i++) makeToken(s, seat, e.token);
        const tk = TOKENS[e.token];
        explain(s, `${subj(seat, 'create', 'creates')} ${e.n === 1 ? 'a' : e.n} ${tk.pt.join('/')} ${tk.name} token${e.n === 1 ? '' : 's'}${tk.kw ? ` with ${tk.kw.join(', ')}` : ''}. Tokens are creatures like any other, but vanish if they ever leave the battlefield.`);
        break;
      }
      case 'fetchLand': {
        const got = fetchLand(s, seat);
        explain(s, got
          ? `${subj(seat, 'search', 'searches')} the library for a basic land, ${got}, and put${seat === 0 ? '' : 's'} it onto the battlefield tapped (extra mana from next turn), then shuffle${seat === 0 ? '' : 's'}.`
          : 'There were no basic lands left to find.');
        break;
      }
      case 'returnToHand': {
        const t = target(e.what);
        const gy = s.seats[seat].graveyard, at = t ? gy.findIndex(c => c.id === t.id) : -1;
        if (at < 0) break;
        const [c] = gy.splice(at, 1);
        s.seats[seat].hand.push(c);
        explain(s, `${c.name} comes back from the graveyard to ${seat === 0 ? 'your' : `@${seat}'s`} hand, ready to be cast again.`);
        break;
      }
      case 'fight': case 'bite': {
        const a = permRef(e.a), b = permRef(e.b);
        if (!a || !b) { explain(s, 'One of the two creatures is gone, so no damage is dealt.'); break; }
        const pa = Math.max(0, stats(s, a).power), pb = Math.max(0, stats(s, b).power);
        if (e.do === 'fight') explain(s, `${a.name} (${ptText(s, a)}) and ${b.name} (${ptText(s, b)}) fight: each deals damage equal to its power to the other.`);
        const sa = creatureSource(s, a), sb = creatureSource(s, b);
        hurt({ type: 'perm', id: b.id }, pa, sa, a.name);
        if (e.do === 'fight') hurt({ type: 'perm', id: a.id }, pb, sb, b.name);
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
  let best = null;
  if (lands.length) {
    const have = c => s.battlefield.filter(x => x.controller === seat && defOf(x).mana === c).length;
    const want = c => p.hand.reduce((n, card) => n + parseCost(defOf(card).cost)[c], 0);
    const score = card => { const c = defOf(card).mana; return want(c) * 2 - have(c); };
    best = lands.reduce((a, b) => (score(b) > score(a) ? b : a));
    p.library = p.library.filter(c => c.id !== best.id);
    enter(s, best, seat, { tapped: true });
  }
  shuffle(s, p.library);
  return best?.name ?? null;
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

function tapFor(s, seat, cost, except = null) {
  const ids = payment(s, seat, cost, except);
  if (!ids) throw new Error('You don\'t have enough mana for that.');
  for (const id of ids) perm(s, id).tapped = true;
}

const describeTargets = (s, targets) => {
  const named = targets.filter(Boolean).map(t => nameOf(s, t));
  return named.length ? ` targeting ${named.join(' and ')}` : '';
};

/** Why a spell can be cast now, what it costs and what it will do. */
function castWhy(s, seat, card, targets) {
  const def = defOf(card);
  const extra = [def.sub, def.pt?.join('/')].filter(Boolean).join(', ');
  const mv = manaValueOf(def);
  const why = [`${card.name} is ${article(def.type.toLowerCase())}${extra ? ` (${extra})` : ''}. It costs ${def.cost}, so ${subj(seat, 'tap', 'taps')} ${mv === 1 ? 'a land' : `${mv} lands`} (or other mana sources) to pay for it.`];
  if (def.text) why.push(`What it does: "${def.text.replace(/\n/g, ' ')}"`);
  const named = targets.filter(Boolean).map(t => nameOf(s, t));
  if (named.length) why.push(`It targets ${named.join(' and ')}. A target is chosen when the spell is cast.`);
  why.push(isInstant(def)
    ? 'It\'s an instant, so it can be cast at almost any time — even during the other player\'s turn, or in response to another spell.'
    : `${def.type === 'Sorcery' ? 'Sorceries' : isCreature(def) ? 'Creatures' : isArtifact(def) ? 'Artifacts' : 'Enchantments'} can only be cast in their caster's own main phase, when nothing else is waiting.`);
  why.push(`It goes on "the stack" first: before it happens, ${seat === 0 ? '@1 gets' : 'you get'} a chance to respond with an instant.`);
  return why;
}
const manaValueOf = def => { const c = parseCost(def.cost); return c.generic + COLORS.reduce((n, k) => n + c[k], 0); };

/** What an attack means, and what the attackers' keywords do. */
function attackWhy(s, ids) {
  const defender = other(s.active);
  const ps = ids.map(id => perm(s, id));
  const total = ps.reduce((n, p) => n + Math.max(0, stats(s, p).power), 0);
  const why = [`Attacking creatures tap (turn sideways) — unless they have vigilance. Together they have ${total} power.`];
  const kwLine = {
    flying: n => `${n} has flying: only creatures with flying or reach can block it.`,
    unblockable: n => `${n} can't be blocked at all.`,
    trample: n => `${n} has trample: damage beyond what its blockers need goes through to the player.`,
    firstStrike: n => `${n} has first strike: in a fight it deals its damage first.`,
    doubleStrike: n => `${n} has double strike: it deals damage twice, first and then again.`,
    deathtouch: n => `${n} has deathtouch: any damage it deals destroys a creature, so blocking it is costly.`,
    lifelink: n => `${n} has lifelink: damage it deals gains its controller that much life.`,
    vigilance: n => `${n} has vigilance, so it didn't tap — it can still block next turn.`,
    menace: n => `${n} has menace: it can only be blocked by two or more creatures.`,
  };
  for (const p of ps) for (const k of stats(s, p).kw) if (kwLine[k]) why.push(kwLine[k](p.name));
  why.push(`Next ${subj(defender, 'choose', 'chooses')} blockers: each untapped creature can block one attacker (several can block the same one). Unblocked attackers deal their damage to the player.`);
  return why;
}

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
        said(s, a.seat, ['take a mulligan.', 'takes a mulligan.'], '', {
          minor: true,
          why: ['A mulligan: the hand is shuffled back and a new 7 drawn. For each mulligan, one card goes to the bottom of the library after keeping.'],
        });
        return s;
      }
      said(s, a.seat, ['keep', 'keeps'], `${me.hand.length - me.mulligans} cards.`, { minor: true });
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
        said(s, a.seat, ['discard', 'discards'], `${names.join(' and ')}.`, {
          minor: p.reason !== 'handSize',
          why: [p.reason === 'handSize'
            ? 'At the end of a player\'s turn, they can only keep 7 cards in hand: any extra are discarded (to the graveyard).'
            : 'A spell made them discard; the player discarding chooses which cards go.'],
        });
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
      said(s, a.seat, ['play', 'plays'], `${card.name}.`, {
        minor: true, card: cardRef(card),
        why: [`Each player can play one land a turn, in their own main phase. ${card.name} taps for {${defOf(card).mana}}: one more mana to spend each turn.`],
      });
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
      const why = castWhy(s, a.seat, card, targets);
      if (!isPermanentCard(def)) {
        for (const p of s.battlefield) {
          if (p.controller !== a.seat || !defOf(p).onSpell) continue;
          run(s, defOf(p).onSpell, { controller: a.seat, targets: [], sourceId: p.id });
          why.push(`${p.name} reacts to the spell being cast: "${defOf(p).text.split('\n').pop()}" It's now ${ptText(s, p)}.`);
        }
      }
      said(s, a.seat, ['cast', 'casts'], `${card.name}${describeTargets(s, targets)}.`, { why, card: cardRef(card) });
      s.passes = 1;
      s.priority = other(a.seat);
      break;
    }

    case 'activate': {
      const p = perm(s, a.perm);
      if (!p || !canActivate(s, a.seat, p, a.ability)) throw new Error('You can\'t do that right now.');
      const ab = defOf(p).abilities[a.ability];
      const targets = checkTargets(s, a.seat, ab.targets ?? [], a.targets);
      if (ab.equip && targets[0]?.id === p.attachedTo) throw new Error(`${p.name} is already attached to that creature.`);
      if (ab.cost) tapFor(s, a.seat, ab.cost, ab.tap ? p.id : null);
      if (ab.tap) p.tapped = true;
      const lines = defOf(p).text.split('\n');
      const line = lines.find(l => (ab.equip ? l.startsWith('Equip')
        : l.includes(':') && (ab.tap ? l.includes('{T}') : !l.includes('{T}')) && (!ab.sac || l.includes('Sacrifice')))) ?? defOf(p).text;
      const why = [`${p.name} has an ability: "${line}"`];
      if (ab.equip) why.push('Equip attaches it to one of your creatures. It can only be done in your own main phase (like casting a sorcery), but as often as you can pay — moving it from one creature to another.');
      else if (ab.tap) why.push('The {T} means it taps to use it — so it can only do this once a turn, and not on the turn it arrived.');
      else if (ab.cost) why.push(`It costs ${ab.cost}, and can be used again as long as there's mana to pay.`);
      if (ab.sac) why.push(`Sacrificing ${p.name} is part of the cost: it goes to the graveyard straight away${isCreature(defOf(p)) ? ' (it dies)' : ''}, and the ability still happens.`);
      why.push('Abilities use the stack just like spells, so the other player can respond before it happens.');
      s.stack.push({ id: newId(s), kind: 'ability', source: p.id, sourceName: p.name, sourceToken: p.token, ability: a.ability, controller: a.seat, targets });
      if (ab.sac) leave(s, p, 'graveyard');
      said(s, a.seat, ['activate', 'activates'], `${p.name}${describeTargets(s, targets)}.`, { card: cardRef(p), why });
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
      said(s, a.seat, ['attack', 'attacks'], `with ${ids.map(id => perm(s, id).name).join(', ')}.`, { why: attackWhy(s, ids) });
      for (const id of ids) { const p = perm(s, id); for (const t of triggersOf(p, 'attacks')) trigger(s, p, t); }
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
