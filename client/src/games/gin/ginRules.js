/**
 * Gin Rummy rules, scoring and AI (pure functions).
 *
 * A standard 52-card deck, aces low (A-2-3 is a run, Q-K-A isn't). Melds are
 * sets (3 or 4 of a rank) and runs (3 or more in a row in one suit). Cards
 * not in a meld are deadwood: aces 1, number cards their number, J/Q/K 10.
 * A card can only be in one meld, so a hand is scored by its best
 * arrangement — the one leaving the least deadwood (bestMelds).
 */
export const KNOCK_LIMIT = 10;
export const GIN_BONUS = 25;
export const BIG_GIN_BONUS = 31;
export const UNDERCUT_BONUS = 25;
export const GAME_TARGET = 100;
export const GAME_BONUS = 100;
export const HAND_BONUS = 25;      // "line" bonus for each hand won, added at the end
export const HAND_SIZE = 10;
export const DEAD_STOCK = 2;       // the hand is a draw when only this many cards are left

const ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
export const order = card => ORDER[card.rank];
export const value = card => Math.min(10, ORDER[card.rank]);
export const sumValue = cards => cards.reduce((n, c) => n + value(c), 0);

export const isSet = cards => cards.length >= 3 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank);
export function isRun(cards) {
  if (cards.length < 3 || !cards.every(c => c.suit === cards[0].suit)) return false;
  const o = cards.map(order).sort((a, b) => a - b);
  return o.every((x, i) => i === 0 || x === o[i - 1] + 1);
}

/** Every meld that could be made from `hand` (overlapping). */
export function allMelds(hand) {
  const melds = [];
  const byRank = {};
  for (const c of hand) (byRank[c.rank] ||= []).push(c);
  for (const cards of Object.values(byRank)) {
    if (cards.length < 3) continue;
    if (cards.length === 4) {
      melds.push(cards);
      for (let skip = 0; skip < 4; skip++) melds.push(cards.filter((_, i) => i !== skip));
    } else melds.push(cards);
  }
  const bySuit = {};
  for (const c of hand) (bySuit[c.suit] ||= []).push(c);
  for (const cards of Object.values(bySuit)) {
    const sorted = [...cards].sort((a, b) => order(a) - order(b));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && order(sorted[j]) === order(sorted[j - 1]) + 1; j++) {
        if (j - i >= 2) melds.push(sorted.slice(i, j + 1));
      }
    }
  }
  return melds;
}

/**
 * The arrangement of `hand` into melds that `cost` rates lowest (by default,
 * the least deadwood). `cost(melds, deadwood)` lets the defender count the
 * cards they could lay off, too.
 * @returns { melds: [[cards]], deadwood: [cards], points }
 */
export function bestMelds(hand, cost = (melds, deadwood) => sumValue(deadwood)) {
  const candidates = allMelds(hand);
  const index = new Map(hand.map((c, i) => [c.id, i]));
  const masks = candidates.map(m => m.reduce((mask, c) => mask | (1 << index.get(c.id)), 0));
  let best = null;
  const chosen = [];
  const consider = used => {
    const deadwood = hand.filter((_, i) => !(used & (1 << i)));
    const points = cost(chosen, deadwood);
    if (!best || points < best.points) best = { melds: [...chosen], deadwood, points };
  };
  const search = (start, used) => {
    consider(used);
    for (let i = start; i < candidates.length; i++) {
      if (masks[i] & used) continue;
      chosen.push(candidates[i]);
      search(i + 1, used | masks[i]);
      chosen.pop();
    }
  };
  search(0, 0);
  return best;
}

export const deadwoodOf = hand => bestMelds(hand).points;

/** Can `card` be added to `meld`? */
function fits(card, meld) {
  if (isSet(meld)) return meld.length < 4 && card.rank === meld[0].rank;
  if (card.suit !== meld[0].suit) return false;
  const o = meld.map(order);
  return order(card) === Math.min(...o) - 1 || order(card) === Math.max(...o) + 1;
}

/**
 * Lay deadwood cards off onto the knocker's melds, as many as will go
 * (a card laid off on a run can make room for the next one).
 * @returns { laidOff: [{ card, meld }], remaining, melds }
 */
export function layOff(deadwood, knockerMelds) {
  const melds = knockerMelds.map(m => [...m]);
  let remaining = [...deadwood];
  const laidOff = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const card of remaining) {
      const meld = melds.findIndex(m => fits(card, m));
      if (meld >= 0) {
        melds[meld].push(card);
        laidOff.push({ card, meld });
        remaining = remaining.filter(c => c !== card);
        changed = true;
        break;
      }
    }
  }
  return { laidOff, remaining, melds };
}

/**
 * The defender's best answer to a knock: their own melds, then everything
 * they can lay off onto the knocker's (none after gin).
 */
export function defend(hand, knockerMelds, gin) {
  if (gin) return { ...bestMelds(hand), laidOff: [] };
  const best = bestMelds(hand, (melds, deadwood) => sumValue(layOff(deadwood, knockerMelds).remaining));
  const { laidOff, remaining } = layOff(best.deadwood, knockerMelds);
  return { melds: best.melds, deadwood: remaining, points: sumValue(remaining), laidOff };
}

/**
 * Score a knock. `kind` is 'knock', 'gin' or 'bigGin'.
 * @returns { winner: 0|1 (relative to the knocker: 0 = knocker), points, undercut }
 */
export function scoreKnock(kind, knockerPoints, defenderPoints) {
  if (kind === 'bigGin') return { winner: 0, points: BIG_GIN_BONUS + defenderPoints, undercut: false };
  if (kind === 'gin') return { winner: 0, points: GIN_BONUS + defenderPoints, undercut: false };
  if (knockerPoints < defenderPoints) return { winner: 0, points: defenderPoints - knockerPoints, undercut: false };
  return { winner: 1, points: knockerPoints - defenderPoints + UNDERCUT_BONUS, undercut: true };
}

// ── AI ───────────────────────────────────────────────────────────────────────
const without = (hand, card) => hand.filter(c => c.id !== card.id);

/**
 * How much the opponent seems to want `card`: they picked up cards of the
 * same rank, or near it in the same suit.
 */
function danger(card, theirPickups) {
  return theirPickups.reduce((n, k) =>
    n + (k.rank === card.rank ? 2 : k.suit === card.suit && Math.abs(order(k) - order(card)) <= 2 ? 1 : 0), 0);
}

/** Unseen cards that would join a meld in `hand` if drawn: how many ways the hand can improve. */
export function outs(hand, unseen) {
  return unseen.filter(c => bestMelds([...hand, c]).melds.some(m => m.some(x => x.id === c.id))).length;
}

export const OUT_WEIGHT = 1;       // Hard: one more card that could complete a meld is worth this much deadwood
export const TAKE_MARGIN = 3;      // Hard takes the face-up card when it makes the hand at least this much better

/**
 * Hard's rating of a 10-card hand: deadwood, less credit for the ways it can
 * still improve (cards not yet seen that would make a meld).
 */
export const handRating = (hand, unseen) => deadwoodOf(hand) - OUT_WEIGHT * outs(hand, unseen);

/**
 * The card to throw away from an 11-card hand: the one leaving the least
 * deadwood (throwing high cards on ties). Hard keeps the hand with the most
 * chances to improve, and avoids cards the opponent is collecting.
 * `unseen` = cards this player hasn't seen (Hard only).
 */
export function chooseDiscard(hand, { level = 'medium', keep = null, theirPickups = [], unseen = null } = {}) {
  const hard = level === 'hard' && unseen;
  const options = hand.filter(c => c.id !== keep).map(card => {
    const rest = without(hand, card);
    return { card, dw: hard ? handRating(rest, unseen) : deadwoodOf(rest) };
  });
  const least = Math.min(...options.map(o => o.dw));
  const score = o => (level === 'hard' ? o.dw + danger(o.card, theirPickups) * 2 : o.dw) - value(o.card) / 100;
  const pool = level === 'hard' ? options.filter(o => o.dw <= least + 3) : options;
  if (level === 'easy' && Math.random() < 0.25) {
    // Easy sometimes throws away a card it should keep
    const near = options.filter(o => o.dw <= least + 6);
    return near[Math.floor(Math.random() * near.length)].card;
  }
  return pool.reduce((a, b) => (score(b) < score(a) ? b : a)).card;
}

/**
 * Take the face-up card? When it goes straight into a meld, or (Medium) it
 * cuts deadwood with a low card, or (Hard) it leaves a clearly better hand
 * than now — counting the chances to improve.
 */
export function wantsDiscard(hand, top, level = 'medium', unseen = null) {
  const withTop = [...hand, top];
  const after = without(withTop, chooseDiscard(withTop, { level: level === 'easy' ? 'medium' : level, keep: top.id, unseen }));
  const { melds, points } = bestMelds(after);
  if (melds.some(m => m.some(c => c.id === top.id))) return true;
  if (level === 'easy') return false;
  if (level === 'hard' && unseen) return handRating(after, unseen) < handRating(hand, unseen) - TAKE_MARGIN;
  return points < deadwoodOf(hand) && value(top) <= 3;
}
