/**
 * The computer player for Magic. It only looks at what a player could know:
 * its own hand, the battlefield, graveyards and the stack (never your hand or
 * either library).
 *
 *   easy   casts whatever it can, attacks and blocks on a whim
 *   medium plays sensibly: removal on the biggest threat, safe attacks, good blocks
 *   hard   also counts lethal damage, chump-blocks to survive, double-blocks,
 *          saves combat tricks and counterspells for the right moment
 *
 * A robot's boldness (players.js) makes it attack and trade more readily.
 */
import {
  defOf, stats, perm, creaturesOf, isCreature, isLand, isInstant, manaValue, parseCost, payment, manaSources,
  legalTargets, targetSpecs, canBlock, lethalDamage, COLORS,
} from './mtgRules.js';
import { waitingFor, canCast, canActivate, canPlayLand, attackersFor, isMain, other } from './mtgEngine.js';

const KW_VALUE = {
  flying: 2, firstStrike: 1, doubleStrike: 3, deathtouch: 2, lifelink: 1, trample: 1,
  vigilance: 0.5, haste: 0.3, unblockable: 2, reach: 0.5, shroud: 1,
};

// ── Values ───────────────────────────────────────────────────────────────────
export function creatureValue(s, p) {
  const st = stats(s, p), def = defOf(p);
  let v = Math.max(0, st.power) * 1.5 + Math.max(0, st.toughness);
  for (const k of st.kw) v += KW_VALUE[k] ?? 0;
  if (def.abilities) v += 1.5;
  if (def.anthem) v += 3;
  if (def.mana) v += 1;
  if (st.kw.has('defender')) v *= 0.6;
  if (st.cantAttack && st.cantBlock) v *= 0.2;
  if (st.noUntap && p.tapped) v *= 0.3;
  return v;
}

// ── Combat maths ─────────────────────────────────────────────────────────────
const dies = (toughness, damage, deathtouch) => damage > 0 && (deathtouch || damage >= toughness);

/** What happens when `att` is blocked by `blk` alone (with optional extra power/toughness): { attDies, blkDies } */
export function duel(s, att, blk, extra = {}) {
  const a = stats(s, att), b = stats(s, blk);
  const aP = Math.max(0, a.power + (extra.attP ?? 0)), aT = a.toughness + (extra.attT ?? 0) - att.damage;
  const bP = Math.max(0, b.power + (extra.blkP ?? 0)), bT = b.toughness + (extra.blkT ?? 0) - blk.damage;
  const aFirst = a.kw.has('firstStrike') || a.kw.has('doubleStrike'), bFirst = b.kw.has('firstStrike') || b.kw.has('doubleStrike');
  const aAgain = !aFirst || a.kw.has('doubleStrike'), bAgain = !bFirst || b.kw.has('doubleStrike');
  const aDt = a.kw.has('deathtouch'), bDt = b.kw.has('deathtouch');
  // First-strike step
  let toB = aFirst ? aP : 0, toA = bFirst ? bP : 0;
  const bDead1 = dies(bT, toB, aDt), aDead1 = dies(aT, toA, bDt);
  // Regular step: only creatures still standing deal damage
  if (!aDead1 && aAgain) toB += aP;
  if (!bDead1 && bAgain) toA += bP;
  return { attDies: dies(aT, toA, bDt), blkDies: dies(bT, toB, aDt) };
}

const power = (s, p) => Math.max(0, stats(s, p).power);

// ── Targets ──────────────────────────────────────────────────────────────────
/** Whether target `i` of a card or ability is meant to hurt ('harm'), help ('help'), or is a spell / card. */
function roleOf(def, i) {
  if (def.aura) {
    const g = def.aura.grant;
    return g.cantAttack || g.noUntap || (g.p ?? 0) < 0 ? 'harm' : 'help';
  }
  for (const e of [...(def.effect ?? []), ...(def.etb ?? [])]) {
    if (e.do === 'fight' || e.do === 'bite') { if (e.a === i) return 'help'; if (e.b === i) return 'harm'; continue; }
    if (![e.to, e.what, e.who].includes(i)) continue;
    if (e.do === 'counter') return 'counter';
    if (e.do === 'returnToHand') return 'card';
    if (e.do === 'counters') return 'help';
    if (e.do === 'pump') return e.p < 0 || e.t < 0 ? 'harm' : 'help';
    return 'harm';
  }
  return 'harm';
}

/** How much hurting creature `t` with this card is worth (0 if it would barely matter). */
function harmValue(s, def, t) {
  const v = creatureValue(s, t), st = stats(s, t);
  if (def.aura) {
    const g = def.aura.grant;
    if (g.cantAttack || g.noUntap) return v * 0.85;
    return st.toughness + (g.t ?? 0) <= 0 ? v : v * 0.3;
  }
  for (const e of [...(def.effect ?? []), ...(def.etb ?? [])]) {
    switch (e.do) {
      case 'destroy': case 'exile': return v;
      case 'bounce': return v * 0.45 + (t.token ? v : 0);
      case 'damage': return lethalDamage(s, t) <= e.n || (e.n > 0 && t.deathtouched) ? v : 0;
      case 'pump': if (e.t < 0) return st.toughness - t.damage + e.t <= 0 ? v : v * 0.2; break;
      default: break;
    }
  }
  return 0;
}

/** Damage this card would deal to a player (burn), or 0. */
const faceDamage = def => (def.effect ?? []).reduce((n, e) => n + (e.do === 'damage' && typeof e.to === 'number' ? e.n : 0), 0);
const canHitPlayer = def => (def.targets ?? []).some(sp => sp.kind === 'any' || sp.kind === 'player');

/**
 * Targets for a card or ability: [target|null] and how good the play is, or
 * null if there's nothing worth doing with it.
 */
function chooseTargets(s, seat, def, { level, face = false } = {}) {
  const specs = targetSpecs(def);
  if (!specs.length) return { targets: [], worth: 0 };
  const opp = other(seat);

  // Two creatures: "target creature you control" + "target creature you don't control"
  const fight = (def.effect ?? []).find(e => e.do === 'fight' || e.do === 'bite');
  if (fight) {
    let best = null;
    const mine = legalTargets(s, seat, specs[fight.a]).map(r => perm(s, r.id));
    const theirs = legalTargets(s, seat, specs[fight.b]).map(r => perm(s, r.id));
    const bonus = (def.effect ?? []).find(e => e.do === 'counters')?.n ?? 0;
    for (const m of mine) for (const t of theirs) {
      const p = power(s, m) + bonus;
      if (!dies(stats(s, t).toughness - t.damage, p, stats(s, m).kw.has('deathtouch'))) continue;
      const back = fight.do === 'fight' && dies(stats(s, m).toughness + bonus - m.damage, power(s, t), stats(s, t).kw.has('deathtouch'));
      const worth = creatureValue(s, t) - (back ? creatureValue(s, m) : 0);
      if (!best || worth > best.worth) {
        const targets = [];
        targets[fight.a] = { type: 'perm', id: m.id };
        targets[fight.b] = { type: 'perm', id: t.id };
        best = { targets, worth };
      }
    }
    return best && best.worth > 0 ? best : null;
  }

  const targets = [];
  let worth = 0;
  for (let i = 0; i < specs.length; i++) {
    const legal = legalTargets(s, seat, specs[i]);
    const role = roleOf(def, i);
    let pick = null, w = 0;
    if (role === 'counter') {
      const spell = legal.map(r => s.stack.find(x => x.id === r.id)).filter(x => x.controller === opp).pop();
      if (spell) { pick = { type: 'stack', id: spell.id }; w = 3 + manaValue(defOf(spell.card)) * 2; }
    } else if (role === 'card') {
      const cards = legal.map(r => s.seats[seat].graveyard.find(c => c.id === r.id));
      const best = cards.sort((a, b) => manaValue(defOf(b)) - manaValue(defOf(a)))[0];
      if (best) { pick = { type: 'card', id: best.id }; w = 2 + manaValue(defOf(best)); }
    } else if (role === 'help') {
      const own = legal.filter(r => r.type === 'perm' && perm(s, r.id).controller === seat).map(r => perm(s, r.id));
      const best = own.sort((a, b) => creatureValue(s, b) - creatureValue(s, a))[0];
      if (best) { pick = { type: 'perm', id: best.id }; w = 2; }
    } else {
      // Hurt: the opponent's best creature this would deal with, or the opponent
      for (const r of legal) {
        let v = 0;
        if (r.type === 'player') v = r.seat === opp ? (face ? 50 : 1 + faceDamage(def) * 0.6) : -1;
        else if (r.type === 'perm') {
          const t = perm(s, r.id);
          v = t.controller === opp ? harmValue(s, def, t) : -creatureValue(s, t);
        }
        if (level === 'easy') v += Math.random() * 3;
        if (!pick || v > w) { pick = r; w = v; }
      }
    }
    if (!pick && !specs[i].optional) return null;
    targets.push(pick);
    worth += w;
  }
  return { targets, worth };
}

// ── Choosing a move ──────────────────────────────────────────────────────────
/** The action for the robot in `seat` (a legal one for whatever it's waiting for). */
export function robotAction(s, seat, level = 'medium', style = null) {
  const bold = style?.bold ?? 0;
  const p = s.pending;
  if (p?.seat === seat) {
    if (p.type === 'mulligan') return { type: keepHand(s, seat, level) ? 'keep' : 'mulligan', seat };
    return { type: 'choose', seat, cards: worstCards(s, seat, p.count) };
  }
  if (s.step === 'declareBlockers') return { type: 'block', seat, blocks: chooseBlocks(s, seat, level) };

  const my = s.active === seat && isMain(s) && !s.stack.length;
  const response = respond(s, seat, level, bold);
  if (response) return response;
  if (my) {
    const hand = s.seats[seat].hand;
    const land = hand.filter(c => canPlayLand(s, seat, c));
    if (land.length) return { type: 'play', seat, card: bestLand(s, seat, land).id };
    const cast = mainPhaseSpell(s, seat, level, bold);
    if (cast) return cast;
    if (s.step === 'main1') return { type: 'attack', seat, attackers: chooseAttackers(s, seat, level, bold) };
    return { type: 'endTurn', seat };
  }
  return { type: 'pass', seat };
}

function keepHand(s, seat, level) {
  const me = s.seats[seat];
  if (level === 'easy' || me.mulligans >= 2) return true;
  const lands = me.hand.filter(c => isLand(defOf(c))).length;
  return lands >= 2 && lands <= 5;
}

/** The cards least worth keeping (to put on the bottom or discard). */
function worstCards(s, seat, n) {
  const me = s.seats[seat];
  const landsOut = s.battlefield.filter(p => p.controller === seat && isLand(defOf(p))).length;
  const landsHeld = me.hand.filter(c => isLand(defOf(c))).length;
  const keep = c => {
    const def = defOf(c);
    if (isLand(def)) return landsOut + landsHeld >= 6 ? 0 : 12 - (landsOut + landsHeld);
    return 10 - Math.abs(manaValue(def) - Math.min(landsOut + landsHeld, 5)) + (isCreature(def) ? 1 : 0);
  };
  return [...me.hand].sort((a, b) => keep(a) - keep(b)).slice(0, n).map(c => c.id);
}

/** The basic land that makes the color the hand needs most. */
function bestLand(s, seat, lands) {
  const have = c => s.battlefield.filter(x => x.controller === seat && defOf(x).mana === c).length;
  const want = c => s.seats[seat].hand.reduce((n, card) => n + parseCost(defOf(card).cost)[c], 0);
  const score = card => { const c = defOf(card).mana; return want(c) * 2 - have(c); };
  return lands.reduce((a, b) => (score(b) > score(a) ? b : a));
}

// ── Main phase ───────────────────────────────────────────────────────────────
function mainPhaseSpell(s, seat, level, bold) {
  const opp = other(seat), first = s.step === 'main1';
  const options = [];
  const burnLeft = totalBurn(s, seat);
  const lethal = burnLeft >= s.seats[opp].life;

  for (const card of s.seats[seat].hand) {
    if (isLand(defOf(card)) || !canCast(s, seat, card)) continue;
    const def = defOf(card);
    const t = chooseTargets(s, seat, def, { level, face: lethal });
    if (!t && !isCreature(def)) continue;
    let score = scoreSpell(s, seat, def, t, { first, level, bold, lethal });
    if (level === 'easy') score = score > -5 ? 5 + Math.random() * 10 : score;
    if (score > 0) options.push({ card, targets: t?.targets ?? targetSpecs(def).map(() => null), score });
  }
  // Activated abilities at sorcery speed: only a ping that destroys something
  for (const p of s.battlefield) {
    (defOf(p).abilities ?? []).forEach((ab, i) => {
      if (!ab.tap || !canActivate(s, seat, p, i)) return;
      const t = chooseTargets(s, seat, ab, { level, face: lethal });
      if (t && (t.worth >= 2 || lethal)) options.push({ ability: { perm: p.id, ability: i }, targets: t.targets, score: 6 + t.worth });
    });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  const best = options[0];
  if (best.ability) return { type: 'activate', seat, ...best.ability, targets: best.targets };
  return { type: 'cast', seat, card: best.card.id, targets: best.targets };
}

/** How good casting this now is (≤ 0: don't). */
function scoreSpell(s, seat, def, t, { first, level, bold, lethal }) {
  const opp = other(seat);
  const myCreatures = creaturesOf(s, seat);
  const effects = def.effect ?? [];
  const kinds = new Set(effects.map(e => e.do));

  if (isCreature(def)) {
    const haste = (def.kw ?? []).includes('haste');
    // Creatures after combat (so they don't tip off blocks), unless they can attack now
    if (first && !haste && level !== 'easy') return 0;
    let score = 10 + manaValue(def) * 2;
    // A harmful "enters" ability with no enemy to aim at hits our own creature
    if (t && def.targets && roleOf(def, 0) === 'harm' && t.worth < 0) score += t.worth * 1.5;
    if (t?.worth > 0) score += t.worth;
    return score;
  }
  if (def.anthem) return first ? 8 + myCreatures.length * 2 : 4 + myCreatures.length * 2;
  if (def.aura) return t && t.worth >= (roleOf(def, 0) === 'harm' ? 3 : 0) ? 10 + t.worth : 0;
  if (kinds.has('counter')) return 0;                                  // kept for the opponent's spells
  if (kinds.has('pump') || kinds.has('pumpAll')) {
    // Overrun-style: only when attacking with a team
    if (!first || isInstant(def) || !kinds.has('pumpAll')) return 0;
    const attackers = attackersFor(s).filter(p => p.controller === seat).length;
    return attackers >= 3 ? 25 : 0;
  }
  if (kinds.has('fight') || kinds.has('bite')) return t ? 12 + t.worth : 0;
  if (kinds.has('fetchLand')) return 14;
  if (kinds.has('token')) return first && level !== 'easy' ? 0 : 7 + effects.find(e => e.do === 'token').n;
  if (kinds.has('draw') && !def.targets) {
    if (effects.some(e => e.do === 'lose') && s.seats[seat].life <= 6) return 0;
    return first ? 0 : 7;
  }
  if (kinds.has('discard')) return s.seats[opp].hand.length ? 8 + (kinds.has('damage') ? 3 : 0) : kinds.has('damage') ? 4 : 0;
  if (kinds.has('returnToHand')) return t ? 4 + t.worth : 0;
  if (effects.some(e => e.to === 'eachCreature')) {
    const n = effects.find(e => e.to === 'eachCreature').n;
    const killed = list => list.filter(p => lethalDamage(s, p) <= n).reduce((v, p) => v + creatureValue(s, p), 0);
    return killed(creaturesOf(s, opp)) - killed(myCreatures) * 1.2 - 3;
  }
  if (kinds.has('damage') && t) {
    const atPlayer = t.targets.some(x => x?.type === 'player');
    if (atPlayer) {
      if (lethal) return 40;
      // Burn at the opponent: late in the game, after combat, if it's all it's good for
      if (first) return 0;
      const late = s.seats[opp].life <= 8 || bold > 0.5 || !canHitCreatures(def);
      return late && t.worth > 0 ? 3 + t.worth : 0;
    }
    return t.worth >= 2 ? 10 + t.worth : 0;
  }
  if (t) return t.worth >= 3 ? 10 + t.worth : 0;                       // destroy / exile / bounce
  return 1;
}

const canHitCreatures = def => (def.targets ?? []).some(sp => sp.kind === 'any' || sp.kind === 'creature');

/** All the damage this player's burn spells and pings in hand could deal to the opponent now. */
function totalBurn(s, seat) {
  let mana = manaSources(s, seat).length, n = 0;
  const burn = s.seats[seat].hand
    .map(c => defOf(c))
    .filter(def => canHitPlayer(def) && faceDamage(def) > 0)
    .sort((a, b) => faceDamage(b) / manaValue(b) - faceDamage(a) / manaValue(a));
  for (const def of burn) {
    if (manaValue(def) > mana) continue;
    if (!isInstant(def) && !(s.active === seat && isMain(s))) continue;
    mana -= manaValue(def);
    n += faceDamage(def);
  }
  for (const p of s.battlefield) {
    if (p.controller !== seat || p.tapped || p.sick) continue;
    for (const ab of defOf(p).abilities ?? []) if (ab.tap && canHitPlayer(ab)) n += faceDamage(ab);
  }
  return n;
}

// ── Attacking ────────────────────────────────────────────────────────────────
function chooseAttackers(s, seat, level, bold) {
  const opp = other(seat);
  const able = attackersFor(s).filter(p => p.controller === seat);
  if (!able.length) return [];
  const blockers = creaturesOf(s, opp).filter(b => !b.tapped && !stats(s, b).cantBlock);
  if (level === 'easy') return able.filter(() => !blockers.length || Math.random() < 0.5).map(p => p.id);

  const oppLife = s.seats[opp].life;
  // Lethal if they block the biggest attackers (each blocker stops one)
  const unblockable = able.filter(a => !blockers.some(b => canBlock(s, b, a)));
  const sorted = [...able].sort((a, b) => power(s, a) - power(s, b));
  const through = sorted.slice(0, Math.max(0, sorted.length - blockers.length)).reduce((n, a) => n + power(s, a), 0);
  const sure = unblockable.reduce((n, a) => n + power(s, a), 0);
  if (Math.max(through, sure) >= oppLife) return able.map(p => p.id);

  const chosen = able.filter(a => {
    const can = blockers.filter(b => canBlock(s, b, a));
    if (!can.length) return true;
    let worst = 'safe';
    for (const b of can) {
      const r = duel(s, a, b);
      if (r.attDies && !r.blkDies) { worst = 'bad'; break; }
      if (r.attDies && r.blkDies && creatureValue(s, b) + bold * 3 < creatureValue(s, a) - 0.5) worst = 'trade';
    }
    if (worst === 'bad') return bold > 0.8 && Math.random() < 0.25;
    if (worst === 'trade') return bold > 0.3;
    return true;
  });

  // Keep enough back so the counter-attack can't finish us off
  if (level === 'hard' || bold < 0) {
    const myLife = s.seats[seat].life;
    const theirPower = creaturesOf(s, opp).filter(c => !stats(s, c).kw.has('defender')).reduce((n, c) => n + power(s, c), 0);
    const stay = able.filter(a => !chosen.includes(a) || stats(s, a).kw.has('vigilance'));
    const held = [...chosen].sort((a, b) => creatureValue(s, a) - creatureValue(s, b));
    let defence = stay.length;
    while (held.length && theirPower - defence * 2 >= myLife) {
      const keep = held.pop();
      chosen.splice(chosen.indexOf(keep), 1);
      defence += 1;
    }
  }
  return chosen.map(p => p.id);
}

// ── Blocking ─────────────────────────────────────────────────────────────────
function chooseBlocks(s, seat, level) {
  const attackers = s.combat.attackers.map(a => perm(s, a.id)).filter(Boolean);
  const mine = creaturesOf(s, seat).filter(b => attackers.some(a => canBlock(s, b, a)));
  const blocks = [];
  const free = new Set(mine.map(b => b.id));
  const assign = (b, a) => { blocks.push({ blocker: b.id, attacker: a.id }); free.delete(b.id); };
  const candidates = a => mine.filter(b => free.has(b.id) && canBlock(s, b, a));

  if (level === 'easy') {
    for (const b of mine) {
      const can = attackers.filter(a => canBlock(s, b, a));
      if (can.length && Math.random() < 0.4) assign(b, can[Math.floor(Math.random() * can.length)]);
    }
    return blocks;
  }

  const byValue = [...attackers].sort((x, y) => creatureValue(s, y) - creatureValue(s, x));
  const blocked = new Set();
  // Blocks that destroy the attacker and survive
  for (const a of byValue) {
    const good = candidates(a).filter(b => { const r = duel(s, a, b); return r.attDies && !r.blkDies; });
    good.sort((x, y) => creatureValue(s, x) - creatureValue(s, y));
    if (good.length) { assign(good[0], a); blocked.add(a.id); }
  }
  // Even trades, and blocks where nobody dies
  for (const a of byValue) {
    if (blocked.has(a.id)) continue;
    const opts = candidates(a).map(b => ({ b, r: duel(s, a, b) }));
    const safe = opts.filter(o => !o.r.blkDies).sort((x, y) => creatureValue(s, x.b) - creatureValue(s, y.b))[0];
    const trade = opts.filter(o => o.r.attDies && o.r.blkDies && creatureValue(s, o.b) <= creatureValue(s, a) + 0.5)
      .sort((x, y) => creatureValue(s, x.b) - creatureValue(s, y.b))[0];
    const pick = trade ?? safe;
    if (pick) { assign(pick.b, a); blocked.add(a.id); }
  }
  // Hard: two blockers together destroy a big attacker, losing at most the cheaper one
  if (level === 'hard') {
    for (const a of byValue) {
      if (blocked.has(a.id)) continue;
      const opts = candidates(a).sort((x, y) => power(s, y) - power(s, x));
      if (opts.length < 2) continue;
      const [b1, b2] = opts;
      const total = power(s, b1) + power(s, b2);
      const dt = stats(s, b1).kw.has('deathtouch') || stats(s, b2).kw.has('deathtouch');
      if (dies(stats(s, a).toughness - a.damage, total, dt) && creatureValue(s, a) > Math.min(creatureValue(s, b1), creatureValue(s, b2)) + 1) {
        assign(b1, a); assign(b2, a); blocked.add(a.id);
      }
    }
  }
  // Chump-block if the unblocked damage would kill us (hard: or leave us nearly dead)
  const life = s.seats[seat].life;
  const danger = level === 'hard' ? 3 : 0;
  const unblockedDamage = () => attackers.filter(a => !blocked.has(a.id)).reduce((n, a) => n + power(s, a), 0);
  const biggest = [...attackers].sort((x, y) => power(s, y) - power(s, x));
  for (const a of biggest) {
    if (life - unblockedDamage() > danger) break;
    if (blocked.has(a.id)) continue;
    const chump = candidates(a).sort((x, y) => creatureValue(s, x) - creatureValue(s, y))[0];
    if (chump && !stats(s, a).kw.has('trample')) { assign(chump, a); blocked.add(a.id); }
  }
  return blocks;
}

// ── Instant speed ────────────────────────────────────────────────────────────
/** Something worth doing at instant speed right now, or null. */
function respond(s, seat, level, bold) {
  if (waitingFor(s) !== seat) return null;
  const opp = other(seat);
  const hand = s.seats[seat].hand.filter(c => isInstant(defOf(c)) && canCast(s, seat, c));
  const pings = [];
  for (const p of s.battlefield) (defOf(p).abilities ?? []).forEach((ab, i) => { if (canActivate(s, seat, p, i)) pings.push({ p, i, ab }); });
  if (!hand.length && !pings.length) return null;
  const cast = (card, targets) => ({ type: 'cast', seat, card: card.id, targets });
  const top = s.stack[s.stack.length - 1];
  const easyChance = level === 'easy' ? Math.random() < 0.35 : true;

  // Lethal burn at the opponent
  if (totalBurn(s, seat) >= s.seats[opp].life && (level !== 'easy' || easyChance)) {
    for (const card of hand) {
      const def = defOf(card);
      if (!canHitPlayer(def) || !faceDamage(def)) continue;
      const t = chooseTargets(s, seat, def, { level, face: true });
      if (t?.targets.some(x => x?.type === 'player' && x.seat === opp)) return cast(card, t.targets);
    }
    for (const { p, i, ab } of pings) {
      if (!ab.tap || !canHitPlayer(ab)) continue;
      return { type: 'activate', seat, perm: p.id, ability: i, targets: [{ type: 'player', seat: opp }] };
    }
  }

  // The opponent's spell on the stack: counter it, or save the creature it's aimed at
  if (top && top.controller === opp) {
    const def = top.kind === 'spell' ? defOf(top.card) : null;
    if (def) {
      const aimedAtMe = top.targets.some(t => (t?.type === 'perm' && perm(s, t.id)?.controller === seat) || (t?.type === 'player' && t.seat === seat));
      const important = manaValue(def) >= 3 || aimedAtMe || level === 'easy';
      for (const card of hand) {
        const cd = defOf(card);
        if (!(cd.effect ?? []).some(e => e.do === 'counter')) continue;
        const t = chooseTargets(s, seat, cd, { level });
        if (t?.targets[0]?.id === top.id && important && easyChance) return cast(card, t.targets);
      }
    }
    // A damage or -X/-X spell or ability at one of my creatures: pump it out of reach
    if (level !== 'easy') {
      const effects = def ? def.effect ?? [] : (defOf(perm(s, top.source) ?? { name: top.sourceName })?.abilities?.[top.ability]?.effect ?? []);
      for (const e of effects) {
        const t = typeof e.to === 'number' ? top.targets[e.to] : typeof e.what === 'number' ? top.targets[e.what] : null;
        const victim = t?.type === 'perm' ? perm(s, t.id) : null;
        if (!victim || victim.controller !== seat) continue;
        const hurt = e.do === 'damage' ? e.n : e.do === 'pump' && e.t < 0 ? -e.t : 0;
        if (!hurt) continue;
        const save = pumpFor(s, seat, hand, victim, x => stats(s, victim).toughness - victim.damage + x > hurt);
        if (save) return save;
      }
    }
    return null;
  }
  if (top) return null;                                       // my own spell is waiting: let it resolve

  // Removal at instant speed: on an attacker, at the end of the opponent's turn, or on a big threat
  const theirTurnEnd = s.step === 'end' && s.active === opp;
  const theyAttack = s.step === 'attacks' && s.active === opp;
  for (const card of hand) {
    const def = defOf(card);
    const kinds = new Set((def.effect ?? []).map(e => e.do));
    if (kinds.has('counter') || kinds.has('pump') || kinds.has('pumpAll')) continue;
    if (kinds.has('token')) {
      if (theirTurnEnd || (level === 'easy' && easyChance)) return cast(card, []);
      continue;
    }
    const t = chooseTargets(s, seat, def, { level });
    if (!t || !t.targets.length) continue;
    const onCreature = t.targets.some(x => x?.type === 'perm');
    const threshold = level === 'easy' ? 1 : theyAttack ? 3 : theirTurnEnd ? 4 : 9;
    if (onCreature && t.worth >= threshold && easyChance) return cast(card, t.targets);
    if (!onCreature && theirTurnEnd && t.worth > 0 && (s.seats[opp].life <= 8 || bold > 0.5)) return cast(card, t.targets);
  }

  // Pings: at the end of the opponent's turn, or to finish off a creature
  for (const { p, i, ab } of pings) {
    if (!ab.tap) continue;
    const t = chooseTargets(s, seat, ab, { level });
    if (!t) continue;
    if (t.worth >= 2 || (theirTurnEnd && t.targets[0]?.type === 'player')) return { type: 'activate', seat, perm: p.id, ability: i, targets: t.targets };
    if (theirTurnEnd) return { type: 'activate', seat, perm: p.id, ability: i, targets: [{ type: 'player', seat: opp }] };
  }

  // Combat tricks once blockers are declared
  if (s.step === 'blocks' && s.combat && level !== 'easy') {
    const trick = combatTrick(s, seat, hand, pings, level);
    if (trick) return trick;
  }
  if (s.step === 'blocks' && level === 'easy' && easyChance) {
    const mineInCombat = s.combat?.attackers.flatMap(a => [a.id, ...a.blockers]).map(id => perm(s, id)).filter(x => x?.controller === seat) ?? [];
    for (const card of hand) {
      const def = defOf(card);
      if (!(def.effect ?? []).some(e => e.do === 'pump' && e.p > 0) || !mineInCombat.length) continue;
      const target = mineInCombat[Math.floor(Math.random() * mineInCombat.length)];
      const spec = def.targets[0];
      if (legalTargets(s, seat, spec).some(r => r.id === target.id)) return cast(card, [{ type: 'perm', id: target.id }]);
    }
  }
  return null;
}

/** A pump spell or ability that makes `ok(extraToughness)` true for creature `c`. */
function pumpFor(s, seat, hand, c, ok) {
  for (const card of hand) {
    const def = defOf(card);
    const e = (def.effect ?? []).find(x => x.do === 'pump' && x.t > 0);
    if (!e || !legalTargets(s, seat, def.targets[0]).some(r => r.id === c.id)) continue;
    if (ok(e.t)) return { type: 'cast', seat, card: card.id, targets: [{ type: 'perm', id: c.id }] };
  }
  for (const card of hand) {
    const def = defOf(card);
    const e = (def.effect ?? []).find(x => x.do === 'pumpAll' && x.t > 0);
    if (e && ok(e.t)) return { type: 'cast', seat, card: card.id, targets: [] };
  }
  return null;
}

/** After blocks: a pump that wins a fight, or makes an unblocked attack lethal. */
function combatTrick(s, seat, hand, pings, level) {
  const opp = other(seat), attacking = s.active === seat;
  const pumps = hand.map(card => ({ card, def: defOf(card) }))
    .map(x => ({ ...x, e: (x.def.effect ?? []).find(e => (e.do === 'pump' || e.do === 'pumpAll') && e.p >= 0 && (e.p > 0 || e.t > 0)) }))
    .filter(x => x.e);

  for (const a of s.combat.attackers) {
    const att = perm(s, a.id);
    if (!att) continue;
    const blockers = a.blockers.map(id => perm(s, id)).filter(Boolean);
    // One-on-one fights where a pump changes the result
    if (blockers.length === 1) {
      const blk = blockers[0];
      const mineIsAtt = att.controller === seat;
      const me = mineIsAtt ? att : blk;
      const before = duel(s, att, blk);
      const iDie = mineIsAtt ? before.attDies : before.blkDies, theyDie = mineIsAtt ? before.blkDies : before.attDies;
      if (!iDie && theyDie) continue;
      for (const { card, def, e } of pumps) {
        const all = e.do === 'pumpAll';
        if (!all && !legalTargets(s, seat, def.targets[0]).some(r => r.id === me.id)) continue;
        const extra = mineIsAtt ? { attP: e.p, attT: e.t } : { blkP: e.p, blkT: e.t };
        const after = duel(s, att, blk, extra);
        const iDieNow = mineIsAtt ? after.attDies : after.blkDies, theyDieNow = mineIsAtt ? after.blkDies : after.attDies;
        if ((iDie && !iDieNow) || (!theyDie && theyDieNow)) return { type: 'cast', seat, card: card.id, targets: all ? [] : [{ type: 'perm', id: me.id }] };
      }
      // Firebreathing / Dread Shade
      for (const { p, i, ab } of pings) {
        if (p.id !== me.id || ab.tap) continue;
        const e = ab.effect[0];
        const extra = mineIsAtt ? { attP: e.p, attT: e.t } : { blkP: e.p, blkT: e.t };
        const after = duel(s, att, blk, extra);
        const iDieNow = mineIsAtt ? after.attDies : after.blkDies, theyDieNow = mineIsAtt ? after.blkDies : after.attDies;
        if ((iDie && !iDieNow) || (!theyDie && theyDieNow)) return { type: 'activate', seat, perm: p.id, ability: i, targets: [] };
      }
    }
  }
  // Unblocked attackers: pump for lethal, and pour spare mana into firebreathing
  if (attacking) {
    const unblocked = s.combat.attackers.filter(a => !a.blocked).map(a => perm(s, a.id)).filter(Boolean);
    const dmg = unblocked.reduce((n, a) => n + power(s, a), 0);
    const life = s.seats[opp].life;
    if (unblocked.length) {
      for (const { card, def, e } of pumps) {
        const gain = e.do === 'pumpAll' ? e.p * unblocked.length : e.p;
        if (dmg >= life || dmg + gain < life) continue;
        if (e.do === 'pumpAll') return { type: 'cast', seat, card: card.id, targets: [] };
        const legal = legalTargets(s, seat, def.targets[0]);
        const target = unblocked.find(u => legal.some(r => r.id === u.id));
        if (target) return { type: 'cast', seat, card: card.id, targets: [{ type: 'perm', id: target.id }] };
      }
      for (const { p, i, ab } of pings) {
        if (ab.tap || !unblocked.some(u => u.id === p.id) || !ab.effect[0].p) continue;
        if (level === 'hard' || dmg >= life - 4) return { type: 'activate', seat, perm: p.id, ability: i, targets: [] };
      }
    }
  }
  return null;
}

export { payment };
