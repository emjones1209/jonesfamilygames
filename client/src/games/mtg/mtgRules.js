/**
 * Magic rules that don't move the game along: what a card is, a creature's
 * power and toughness right now, paying mana, what can be targeted, who can
 * attack and block, and how combat damage is dealt. The state machine that
 * uses them is in mtgEngine.js.
 */
import { CARDS, TOKENS } from './cardPool.js';

export const COLORS = ['W', 'U', 'B', 'R', 'G'];
export const COLOR_NAMES = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
export const HAND_LIMIT = 7;
export const START_LIFE = 20;

// ── Cards ────────────────────────────────────────────────────────────────────
/** The card (from cardPool.js) behind a card in a zone, a permanent or a token. */
export const defOf = obj => obj.token ?? CARDS[obj.name];
export const cardDef = name => CARDS[name] ?? TOKENS[name];

/** '{2}{W}{W}' → { generic: 2, W: 2 } */
export function parseCost(cost = '') {
  const out = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const [, sym] of cost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(sym)) out.generic += Number(sym);
    else if (sym in out) out[sym] += 1;
  }
  return out;
}

export const manaValue = def => {
  const c = parseCost(def.cost);
  return c.generic + COLORS.reduce((n, k) => n + c[k], 0);
};

export const colorsOf = def => def.colors ?? COLORS.filter(k => parseCost(def.cost)[k] > 0);
export const isLand = def => def.type.includes('Land');
export const isCreature = def => def.type.includes('Creature');
export const isArtifact = def => def.type.includes('Artifact');
export const isInstant = def => def.type === 'Instant';
export const isPermanentCard = def => !['Instant', 'Sorcery'].includes(def.type);

// ── Permanents ───────────────────────────────────────────────────────────────
export const perm = (s, id) => s.battlefield.find(p => p.id === id);
export const creaturesOf = (s, seat) => s.battlefield.filter(p => p.controller === seat && isCreature(defOf(p)));
export const allCreatures = s => s.battlefield.filter(p => isCreature(defOf(p)));

/**
 * A permanent as it is right now: base power/toughness plus counters, auras,
 * equipment, anthems and until-end-of-turn effects.
 */
export function stats(s, p) {
  const def = defOf(p);
  const kw = new Set(def.kw ?? []);
  let [power, toughness] = def.pt ?? [0, 0];
  const out = { cantAttack: false, cantBlock: kw.has('cantBlock'), noUntap: false };
  power += p.counters ?? 0;
  toughness += p.counters ?? 0;
  for (const b of p.boosts ?? []) {
    power += b.p ?? 0;
    toughness += b.t ?? 0;
    for (const k of b.kw ?? []) kw.add(k);
  }
  for (const other of s.battlefield) {
    const od = defOf(other);
    if (od.aura && other.attachedTo === p.id) {
      const g = od.aura.grant;
      power += g.p ?? 0;
      toughness += g.t ?? 0;
      if (g.cantAttack) out.cantAttack = true;
      if (g.cantBlock) out.cantBlock = true;
      if (g.noUntap) out.noUntap = true;
    }
    if (od.equipment && other.attachedTo === p.id) {
      power += od.equipment.p ?? 0;
      toughness += od.equipment.t ?? 0;
      for (const k of od.equipment.kw ?? []) kw.add(k);
    }
    if (od.anthem && other.controller === p.controller && isCreature(def) && !(od.anthem.others && other.id === p.id)) {
      power += od.anthem.p;
      toughness += od.anthem.t;
    }
  }
  return { ...out, power, toughness, kw };
}

export const has = (s, p, keyword) => stats(s, p).kw.has(keyword);

// ── Mana ─────────────────────────────────────────────────────────────────────
/**
 * Untapped lands, creatures and artifacts that can tap for mana now: [{ id, color, creature }]
 * (color 'C' is colorless: it only pays generic costs). `except`: a permanent that can't
 * help pay, e.g. Mind Stone paying for its own {T} ability.
 */
export function manaSources(s, seat, except = null) {
  return s.battlefield
    .filter(p => p.controller === seat && !p.tapped && defOf(p).mana && p.id !== except)
    .filter(p => !isCreature(defOf(p)) || !p.sick || has(s, p, 'haste'))
    .map(p => ({ id: p.id, color: defOf(p).mana, creature: isCreature(defOf(p)) }));
}

/**
 * Which mana sources to tap to pay `cost`, or null if you can't. Colored mana
 * first; generic mana from whatever is left, using creatures last and the
 * colors you have most to spare first.
 */
export function payment(s, seat, cost, except = null) {
  const need = parseCost(cost);
  const sources = manaSources(s, seat, except);
  const chosen = [];
  const left = [...sources].sort((a, b) => a.creature - b.creature);
  for (const c of COLORS) {
    for (let i = 0; i < need[c]; i++) {
      const at = left.findIndex(src => src.color === c);
      if (at < 0) return null;
      chosen.push(left.splice(at, 1)[0].id);
    }
  }
  if (left.length < need.generic) return null;
  const spare = c => left.filter(src => src.color === c).length;
  left.sort((a, b) => a.creature - b.creature || spare(b.color) - spare(a.color));
  chosen.push(...left.slice(0, need.generic).map(src => src.id));
  return chosen;
}

export const canPay = (s, seat, cost) => payment(s, seat, cost) != null;
export const manaAvailable = (s, seat) => manaSources(s, seat).length;

// ── Targets ──────────────────────────────────────────────────────────────────
/**
 * A target: { type: 'player', seat } | { type: 'perm', id } | { type: 'stack', id } | { type: 'card', id }
 */
export const sameTarget = (a, b) => a && b && a.type === b.type && (a.type === 'player' ? a.seat === b.seat : a.id === b.id);

function creatureOk(s, seat, spec, p) {
  const def = defOf(p);
  if (!isCreature(def) || has(s, p, 'shroud')) return false;
  if (has(s, p, 'hexproof') && p.controller !== seat) return false;     // only its controller can target it
  if (spec.controller === 'you' && p.controller !== seat) return false;
  if (spec.controller === 'opp' && p.controller === seat) return false;
  if (spec.nonColor && colorsOf(def).includes(spec.nonColor)) return false;
  if (spec.flying && !has(s, p, 'flying')) return false;
  if (spec.combat) {
    const attacking = s.combat?.attackers.some(a => a.id === p.id);
    const blocking = s.combat?.attackers.some(a => a.blockers.includes(p.id));
    if (spec.combat === 'blocking' ? !blocking : !(attacking || blocking)) return false;
  }
  return true;
}

/** Whether `ref` is a legal target for `spec`, for a spell or ability controlled by `seat`. */
export function isLegalTarget(s, seat, spec, ref, selfId = null) {
  if (!ref) return false;
  switch (spec.kind) {
    case 'player':
      return ref.type === 'player' && (!spec.opp || ref.seat !== seat);
    case 'any':
      if (ref.type === 'player') return true;
      // falls through
    case 'creature': {
      if (ref.type !== 'perm') return false;
      const p = perm(s, ref.id);
      return !!p && creatureOk(s, seat, spec, p);
    }
    case 'spell': {
      if (ref.type !== 'stack' || ref.id === selfId) return false;
      const item = s.stack.find(i => i.id === ref.id);
      if (!item || item.kind !== 'spell') return false;
      if (spec.creature != null && isCreature(defOf(item.card)) !== spec.creature) return false;
      return true;
    }
    case 'card': {
      if (ref.type !== 'card') return false;
      const card = s.seats[seat].graveyard.find(c => c.id === ref.id);
      if (!card) return false;
      const def = defOf(card);
      return spec.cardType === 'Creature' ? isCreature(def) : ['Instant', 'Sorcery'].includes(def.type);
    }
    default:
      return false;
  }
}

/** Every legal target for `spec`. */
export function legalTargets(s, seat, spec, selfId = null) {
  const refs = [
    ...[0, 1].map(i => ({ type: 'player', seat: i })),
    ...s.battlefield.map(p => ({ type: 'perm', id: p.id })),
    ...s.stack.map(i => ({ type: 'stack', id: i.id })),
    ...s.seats[seat].graveyard.map(c => ({ type: 'card', id: c.id })),
  ];
  return refs.filter(ref => isLegalTarget(s, seat, spec, ref, selfId));
}

/** The targets a card or ability needs; a creature card's targets are for its "enters" ability. */
export const targetSpecs = def => def.targets ?? [];

/** Whether every required target can be found (optional ones can be left out). */
export const targetsAvailable = (s, seat, specs) => specs.every(spec => spec.optional || legalTargets(s, seat, spec).length > 0);

// ── Combat ───────────────────────────────────────────────────────────────────
export function canAttack(s, p) {
  const st = stats(s, p);
  return isCreature(defOf(p)) && p.controller === s.active && !p.tapped && (!p.sick || st.kw.has('haste'))
    && !st.kw.has('defender') && !st.cantAttack;
}

export function canBlock(s, blocker, attacker) {
  const b = stats(s, blocker), a = stats(s, attacker);
  if (!isCreature(defOf(blocker)) || blocker.tapped || b.cantBlock) return false;
  if (a.kw.has('unblockable')) return false;
  if (a.kw.has('flying') && !b.kw.has('flying') && !b.kw.has('reach')) return false;
  return true;
}

/** Why these blocks aren't allowed, or null. blocks: [{ blocker, attacker }] */
export function blockProblem(s, blocks) {
  const seen = new Set();
  for (const { blocker, attacker } of blocks) {
    const b = perm(s, blocker), a = perm(s, attacker);
    if (!b || !a || b.controller === s.active) return 'That creature can\'t block.';
    if (!s.combat.attackers.some(x => x.id === attacker)) return 'That creature isn\'t attacking.';
    if (seen.has(blocker)) return `${b.name} can only block one creature.`;
    seen.add(blocker);
    if (!canBlock(s, b, a)) {
      const st = stats(s, a);
      if (st.kw.has('unblockable')) return `${a.name} can't be blocked.`;
      if (st.kw.has('flying') && !b.tapped && !stats(s, b).cantBlock) return `${a.name} has flying: only creatures with flying or reach can block it.`;
      return `${b.name} can't block.`;
    }
  }
  for (const a of s.combat.attackers) {
    const n = blocks.filter(x => x.attacker === a.id).length;
    const p = perm(s, a.id);
    if (n === 1 && p && has(s, p, 'menace')) return `${p.name} has menace: it can't be blocked except by two or more creatures.`;
  }
  return null;
}

/** Damage it would take to destroy this creature now (1 from a deathtouch source). */
export function lethalDamage(s, p, deathtouch = false) {
  const left = Math.max(0, stats(s, p).toughness - p.damage);
  return deathtouch ? Math.min(left, 1) : left;
}

/**
 * The damage dealt in one combat damage step: [{ source, to: { type, id|seat }, n }].
 * `first`: true for the first-strike step, false for the regular one (in a
 * combat with first strike), null if no one has first or double strike.
 */
export function combatDamage(s, first) {
  const deals = p => {
    const kw = stats(s, p).kw;
    if (first == null) return true;
    if (first) return kw.has('firstStrike') || kw.has('doubleStrike');
    return !kw.has('firstStrike') || kw.has('doubleStrike');
  };
  const defender = 1 - s.active;
  const out = [];
  for (const a of s.combat.attackers) {
    const att = perm(s, a.id);
    if (!att) continue;
    const st = stats(s, att);
    const blockers = a.blockers.map(id => perm(s, id)).filter(Boolean);
    if (deals(att) && st.power > 0) {
      if (!a.blocked) out.push({ source: att.id, to: { type: 'player', seat: defender }, n: st.power });
      else if (blockers.length || st.kw.has('trample')) {
        let left = st.power;
        const dt = st.kw.has('deathtouch');
        // Damage the blockers that are easiest to destroy first, so as many as possible die
        const order = [...blockers].sort((x, y) => lethalDamage(s, x, dt) - lethalDamage(s, y, dt));
        const given = new Map();
        for (const b of order) {
          const n = Math.min(left, lethalDamage(s, b, dt));
          given.set(b.id, n);
          left -= n;
        }
        if (left > 0) {
          if (st.kw.has('trample') || !order.length) out.push({ source: att.id, to: { type: 'player', seat: defender }, n: left });
          else given.set(order[order.length - 1].id, given.get(order[order.length - 1].id) + left);
        }
        for (const [id, n] of given) if (n > 0) out.push({ source: att.id, to: { type: 'perm', id }, n });
      }
    }
    for (const b of blockers) {
      const bs = stats(s, b);
      if (deals(b) && bs.power > 0) out.push({ source: b.id, to: { type: 'perm', id: att.id }, n: bs.power });
    }
  }
  return out;
}

/** Whether this combat has a first-strike damage step. */
export function hasFirstStrikeStep(s) {
  const ids = s.combat.attackers.flatMap(a => [a.id, ...a.blockers]);
  return ids.some(id => {
    const p = perm(s, id);
    return p && (has(s, p, 'firstStrike') || has(s, p, 'doubleStrike'));
  });
}
