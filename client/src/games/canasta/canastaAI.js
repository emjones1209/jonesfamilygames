/**
 * Canasta computer players.
 *
 * easy   – takes the pile only when it's handed over, melds whatever it can,
 *          spreads wild cards anywhere and discards at random
 * medium – takes the pile whenever it can, melds sets, uses wild cards to
 *          finish canastas, and discards sensibly: black 3s first, never a
 *          card that lets the other side take the pile
 * hard   – also remembers every card it has seen and works out the chance the
 *          next player holds a pair of a card before discarding it (weighed by
 *          the size of the pile), avoids ranks the next player has thrown away,
 *          keeps natural melds natural for the 500 bonus, and grabs the pile
 *          with a single card plus a wild card more readily
 */
import {
  act, planPileTake, topOfPile, pileFrozen, teamMeld, teamOf, nextSeat, needed,
  isWild, isBlackThree, cardValue, valueOf, hasCanasta, isCanasta, isNaturalMeld,
} from './canastaRules';

const attempt = (s, action) => { try { return act(s, action); } catch { return null; } };
const canTake = (s, seat, ids) => { try { planPileTake(s, seat, ids); return true; } catch { return false; } };

/** Natural cards grouped by rank (black 3s left out), plus the wild cards. */
function groupHand(hand) {
  const byRank = {};
  for (const c of hand) if (!isWild(c) && c.rank !== '3') (byRank[c.rank] ||= []).push(c);
  const wilds = hand.filter(isWild).sort((a, b) => cardValue(a) - cardValue(b));   // 2s before jokers
  return { byRank, wilds };
}

// ── Drawing ──────────────────────────────────────────────────────────────────
/** The computer's first move of a turn: take the pile or draw from the stock. */
export function chooseDraw(s, level) {
  const seat = s.turn, team = teamOf(seat), top = topOfPile(s);
  if (!top) return { type: 'draw' };
  const { byRank, wilds } = groupHand(s.hands[seat]);
  const pair = byRank[top.rank] ?? [];
  const options = [];

  // Add the top card straight onto one of our melds
  if (s.initialDone[team] && !pileFrozen(s) && teamMeld(s, team, top.rank)) options.push([]);
  if (level !== 'easy' || Math.random() < 0.5) {
    if (pair.length >= 2) {
      const ids = pair.map(c => c.id);
      if (!s.initialDone[team]) {
        // First meld: add other sets (and wild cards) until the minimum is met
        let value = valueOf([...pair, top]);
        for (const cards of Object.values(byRank).filter(g => g.length >= 3 && g[0].rank !== top.rank)) {
          if (value >= needed(s, team)) break;
          ids.push(...cards.map(c => c.id)); value += valueOf(cards);
        }
        for (const w of wilds.slice(0, 3)) {
          if (value >= needed(s, team)) break;
          ids.push(w.id); value += cardValue(w);
        }
      }
      options.push(ids);
    }
    // A single natural card plus a wild card (worth it for a big pile)
    const minPile = level === 'hard' ? 3 : 4;
    if (pair.length === 1 && wilds.length && s.discard.length >= minPile) options.push([pair[0].id, wilds[0].id]);
  }
  const ids = options.find(o => canTake(s, seat, o));
  return ids ? { type: 'takePile', ids } : { type: 'draw' };
}

// ── Melding and discarding ───────────────────────────────────────────────────
/** After drawing: the melds to make and the discard, as a list of actions. */
export function choosePlay(s, level) {
  const seat = s.turn, team = teamOf(seat);
  let cur = s;
  const actions = [];
  const hand = () => cur.hands[seat];
  const run = action => {
    const next = attempt(cur, action);
    if (!next) return false;
    actions.push(action); cur = next;
    return true;
  };

  // 1. First meld: sets of 3+, then pairs with a wild card, until the minimum is met
  if (!cur.initialDone[team] && !cur.melds[team].length) {
    const { byRank, wilds } = groupHand(hand());
    const sets = Object.values(byRank).filter(g => g.length >= 3).sort((a, b) => valueOf(b) - valueOf(a));
    const pairs = Object.values(byRank).filter(g => g.length === 2).sort((a, b) => valueOf(b) - valueOf(a));
    const plan = [];
    let value = 0, used = 0, spareWilds = [...wilds];
    for (const g of sets) { if (value >= needed(cur, team)) break; plan.push(g); value += valueOf(g); used += g.length; }
    for (const g of pairs) {
      if (value >= needed(cur, team) || !spareWilds.length) break;
      const meld = [...g, spareWilds.shift()];
      plan.push(meld); value += valueOf(meld); used += 3;
    }
    if (value >= needed(cur, team) && hand().length - used >= 2) {
      for (const g of plan) run({ type: 'meld', ids: g.map(c => c.id) });
      if (cur.phase !== 'over' && cur.melds[team].reduce((t, m) => t + valueOf(m.cards), 0) < needed(cur, team)) {
        cur = act(cur, { type: 'undo' }); actions.length = 0;      // didn't work out: keep the cards
      }
    }
  }

  // 2. Once melded: add to our melds, lay down new sets, use wild cards
  if (cur.phase !== 'over' && cur.melds[team].length) {
    for (let pass = 0; pass < 3 && cur.phase !== 'over'; pass++) {
      for (const c of hand().filter(c => !isWild(c) && c.rank !== '3')) {
        if (teamMeld(cur, team, c.rank)) run({ type: 'meld', ids: [c.id] });
      }
      const { byRank } = groupHand(hand());
      for (const g of Object.values(byRank)) if (g.length >= 3) run({ type: 'meld', ids: g.map(c => c.id) });
      playWilds();
    }
    // Going out: meld black 3s, then everything else we can
    if (cur.phase !== 'over' && hasCanasta(cur.melds[team])) {
      const blacks = hand().filter(isBlackThree);
      if (blacks.length >= 3 && hand().length - blacks.length <= 1) run({ type: 'meld', ids: blacks.map(c => c.id) });
      for (const w of hand().filter(isWild)) {
        const target = cur.melds[team].find(m => m.cards.filter(isWild).length < 3);
        if (target) run({ type: 'meld', ids: [w.id], rank: target.rank });
      }
    }
  }
  if (cur.phase === 'over') return actions;

  // 3. Discard
  const card = chooseDiscard(cur, level);
  if (!run({ type: 'discard', id: card.id })) {
    // Shouldn't happen, but never get stuck: skip the melds and discard anything allowed
    actions.length = 0; cur = s;
    for (const c of hand()) if (run({ type: 'discard', id: c.id })) break;
  }
  return actions;

  function playWilds() {
    for (;;) {
      const wilds = hand().filter(isWild);
      if (!wilds.length) return;
      const melds = cur.melds[team].filter(m => m.cards.filter(isWild).length < 3 && !isCanasta(m));
      let target;
      if (level === 'easy') target = melds[0];
      else {
        const noCanasta = !hasCanasta(cur.melds[team]);
        target = melds.filter(m => {
          const need = 7 - m.cards.length;
          const room = 3 - m.cards.filter(isWild).length;
          if (need > Math.min(room, wilds.length)) return false;
          // Hard keeps a natural meld natural unless the team needs its first canasta
          if (level === 'hard' && isNaturalMeld(m) && !noCanasta && m.cards.length < 6) return false;
          return m.cards.length >= 4 || noCanasta;
        }).sort((a, b) => b.cards.length - a.cards.length)[0];
      }
      if (!target) return;
      const need = level === 'easy' ? 1 : Math.max(1, 7 - target.cards.length);
      if (!run({ type: 'meld', ids: wilds.slice(0, need).map(c => c.id), rank: target.rank })) return;
    }
  }
}

/** Chance of drawing at least `k` of `good` cards when taking `n` of `total` (hypergeometric). */
function atLeast(k, good, total, n) {
  let p = 0;
  const choose = (a, b) => { if (b < 0 || b > a) return 0; let r = 1; for (let i = 1; i <= b; i++) r = r * (a - b + i) / i; return r; };
  const all = choose(total, n);
  for (let x = 0; x < k; x++) p += choose(good, x) * choose(total - good, n - x) / all;
  return 1 - p;
}

/** The card to throw away. */
export function chooseDiscard(s, level) {
  const seat = s.turn, team = teamOf(seat), hand = s.hands[seat];
  const plain = hand.filter(c => !isWild(c));
  const pool = plain.length ? plain : hand;
  if (level === 'easy') return pool[Math.floor(Math.random() * pool.length)];
  const hard = level === 'hard';
  const frozen = pileFrozen(s);
  
  const count = rank => hand.filter(c => c.rank === rank).length;
  const nextPlayer = nextSeat(seat);
  const nextDiscarded = new Set(s.discardLog.filter(d => d.seat === nextPlayer).map(d => d.card.rank));
  // Hard: everything it has seen — its hand, all melds, the pile (it watched every discard), red 3s
  const seen = [...hand, ...s.melds.flat().flatMap(m => m.cards), ...s.discard, ...s.redThrees.flat()];
  const unseen = 108 - seen.length;
  const nextHand = s.hands[nextPlayer].length;
  /** Chance the next player holds a natural pair of `rank` (and so could take the pile with it). */
  const pairChance = rank => atLeast(2, 8 - seen.filter(c => c.rank === rank).length, unseen, Math.min(nextHand, unseen));
  const pileWorth = 40 + 25 * s.discard.length;
  const bigPile = s.discard.length >= 6;
  const keep = c => {
    if (isBlackThree(c)) return -1000;                          // safe, and blocks the pile
    let score = (count(c.rank) - 1) * 40 + cardValue(c) / 10;   // keep pairs and high cards
    if (teamMeld(s, team, c.rank)) score += 60;                 // we can add it ourselves
    if (teamMeld(s, 1 - team, c.rank) && !frozen) score += hard && bigPile ? 200 : 80;  // hands them the pile
    if (hard) {
      if (nextDiscarded.has(c.rank)) score -= 30;               // the next player doesn't want it
      score += pairChance(c.rank) * pileWorth;                  // could they take the pile with it?
    }
    if (isWild(c)) score += 500;
    return score;
  };
  return pool.reduce((a, b) => (keep(b) < keep(a) ? b : a));
}
