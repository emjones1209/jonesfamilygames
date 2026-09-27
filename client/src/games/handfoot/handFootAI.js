/**
 * Hand and Foot computer players.
 *
 * easy   – takes the pile only now and then, melds whatever it can, and
 *          discards at random
 * medium – takes the pile whenever it can, melds sets, finishes books with
 *          wild cards, and throws away cards it has no use for (black 3s first)
 * hard   – races through its hand to reach its foot sooner, pairing cards
 *          with wild cards and spending wild cards on any meld
 *
 * (Simulated games: medium beats easy by about 5,800 points a game, and hard
 * beats medium by 1,100 to 1,800.)
 */
import {
  act, topOfPile, openMeld, teamOf, minimumFor, bookCount, canGoOut,
  isWild, isNatural, isBlackThree, isBook, valueOf, cardValue, BOOK, MAX_WILD,
} from './handFootRules.js';

const attempt = (s, action) => { try { return act(s, action); } catch { return null; } };

/** Natural cards grouped by rank (3s left out), plus the wild cards (2s before jokers). */
function groupHand(hand) {
  const byRank = {};
  for (const c of hand) if (isNatural(c)) (byRank[c.rank] ||= []).push(c);
  const wilds = hand.filter(isWild).sort((a, b) => cardValue(a) - cardValue(b));
  return { byRank, wilds };
}

// ── Drawing ──────────────────────────────────────────────────────────────────
/** Take the pile (with a pair matching its top card) or draw two from the stock. */
export function chooseDraw(s, level) {
  const seat = s.turn, top = topOfPile(s);
  const pair = top ? (groupHand(s.hands[seat]).byRank[top.rank] ?? []).slice(0, 2) : [];
  const ids = pair.map(c => c.id);
  const ok = pair.length === 2 && attempt(s, { type: 'takePile', ids });
  if (ok && (level !== 'easy' || Math.random() < 0.4)) return { type: 'takePile', ids };
  return { type: 'draw' };
}

// ── Melding and discarding ───────────────────────────────────────────────────
/** The rest of the turn after drawing: melds, then a discard (unless it goes out). */
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
    const sets = Object.values(byRank).filter(g => g.length >= 3).map(g => g.slice(0, BOOK)).sort((a, b) => valueOf(b) - valueOf(a));
    const pairs = Object.values(byRank).filter(g => g.length === 2).sort((a, b) => valueOf(b) - valueOf(a));
    const plan = [];
    let value = 0;
    const spare = [...wilds];
    for (const g of sets) { if (value >= minimumFor(cur)) break; plan.push(g); value += valueOf(g); }
    for (const g of pairs) {
      if (value >= minimumFor(cur) || !spare.length) break;
      const meld = [...g, spare.shift()];
      plan.push(meld); value += valueOf(meld);
    }
    if (value >= minimumFor(cur)) {
      for (const g of plan) run({ type: 'meld', ids: g.map(c => c.id) });
      // Didn't work out (a meld was refused)? Take them back and keep the cards
      const melded = cur.melds[team].reduce((t, m) => t + valueOf(m.cards), 0);
      if (cur.phase !== 'over' && melded < minimumFor(cur)) { cur = act(cur, { type: 'undo' }); actions.length = 0; }
    }
  }

  // 2. Once melded: add to our melds, lay down new sets, finish books with wild cards
  if (cur.melds[team].length) {
    for (let pass = 0; pass < 4 && cur.phase === 'play'; pass++) {
      for (const c of hand().filter(isNatural)) {
        if (cur.phase !== 'play') break;
        if (openMeld(cur, team, c.rank)) run({ type: 'meld', ids: [c.id] });
      }
      const { byRank } = groupHand(hand());
      for (const g of Object.values(byRank)) {
        if (cur.phase === 'play' && g.length >= 3) run({ type: 'meld', ids: g.slice(0, BOOK).map(c => c.id) });
      }
      // Pairs plus a wild card: to start the dirty book we need, or to empty the foot and go out
      if (cur.phase === 'play' && level !== 'easy' && (goingOut() || racing() || bookCount(cur, team).dirty === 0)) {
        for (const g of Object.values(groupHand(hand()).byRank)) {
          const wild = hand().find(isWild);
          if (cur.phase === 'play' && wild && g.length === 2 && !openMeld(cur, team, g[0].rank)) {
            run({ type: 'meld', ids: [...g, wild].map(c => c.id) });
          }
        }
      }
      if (cur.phase === 'play') playWilds();
    }
  }
  if (cur.phase !== 'play') return actions;

  // 3. Discard
  const ordered = discardOrder(cur, level);
  for (const card of ordered) if (run({ type: 'discard', id: card.id })) return actions;
  // Shouldn't happen, but never get stuck: skip the melds and discard anything allowed
  actions.length = 0; cur = s;
  for (const c of hand()) if (run({ type: 'discard', id: c.id })) break;
  return actions;

  // Hard races through its hand to reach its foot
  function racing() { return level === 'hard' && !cur.inFoot[seat]; }

  // In our foot with the books we need: empty the hand and go out
  function goingOut() { return cur.inFoot[seat] && canGoOut(cur, team); }

  function playWilds() {
    for (let guard = 0; guard < 10 && cur.phase === 'play'; guard++) {
      const wilds = hand().filter(isWild).sort((a, b) => cardValue(a) - cardValue(b));
      if (!wilds.length) return;
      const out = goingOut() || racing();
      // The meld closest to a book that can take wild cards
      const targets = cur.melds[team]
        .filter(m => !isBook(m) && (out || m.cards.length >= 4))
        .filter(m => m.cards.filter(isWild).length < MAX_WILD)
        .sort((a, b) => b.cards.length - a.cards.length);
      const target = targets[0];
      if (!target) return;
      const room = Math.min(BOOK - target.cards.length, MAX_WILD - target.cards.filter(isWild).length,
        target.cards.filter(c => !isWild(c)).length - target.cards.filter(isWild).length);
      const need = Math.min(BOOK - target.cards.length, MAX_WILD - target.cards.filter(isWild).length);
      if (room <= 0) return;
      // Medium and hard only spend wild cards when it finishes the book (or when going out)
      if (level !== 'easy' && !out && need > wilds.length) return;
      if (!run({ type: 'meld', ids: wilds.slice(0, Math.min(room, wilds.length)).map(c => c.id), rank: target.rank })) return;
    }
  }
}

/** Cards in the order the computer would rather throw them away. */
function discardOrder(s, level) {
  const seat = s.turn, team = teamOf(seat);
  const hand = s.hands[seat];
  if (level === 'easy') return [...hand].sort(() => Math.random() - 0.5);
  const { byRank } = groupHand(hand);
  const keep = c => {
    if (isBlackThree(c)) return -1000;                          // useless to us, and blocks the pile
    if (isWild(c)) return 1000;
    let score = 0;
    const count = byRank[c.rank]?.length ?? 0;
    if (openMeld(s, team, c.rank)) score += 200;                 // goes on one of our melds
    score += count * 40;                                          // pairs and sets are worth keeping
    score -= cardValue(c);                                        // otherwise shed points
    return score;
  };
  return [...hand].sort((a, b) => keep(a) - keep(b));
}
