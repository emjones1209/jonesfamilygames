/**
 * Five Dice — the classic five-dice scorecard game (Yahtzee-style), as pure functions.
 *
 * Each turn: roll five dice up to three times, holding any you like between
 * rolls, then score them in one empty box. After 13 turns every box is full.
 *   Upper section  Ones … Sixes: the total of that number; 35 bonus at 63+
 *   Lower section  3 of a Kind / 4 of a Kind: total of all dice
 *                  Full House 25 · Small Straight (4 in a row) 30
 *                  Large Straight (5 in a row) 40 · Five of a Kind 50 · Chance: total
 * Another Five of a Kind after scoring 50 there earns a 100 bonus and acts as a
 * "joker" (standard rules): it must go in the matching upper box if that's
 * empty; otherwise it may fill any lower box at full value (Full House and the
 * straights included); otherwise an upper box scores 0.
 */

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'fiveKind', 'chance'];
export const BOXES = [...UPPER, ...LOWER];
export const LABELS = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: '3 of a Kind', fourKind: '4 of a Kind', fullHouse: 'Full House', smallStraight: 'Small Straight',
  largeStraight: 'Large Straight', fiveKind: 'Five of a Kind', chance: 'Chance',
};
export const HINTS = {
  ones: 'Add up the 1s', twos: 'Add up the 2s', threes: 'Add up the 3s', fours: 'Add up the 4s',
  fives: 'Add up the 5s', sixes: 'Add up the 6s', threeKind: 'Three the same: all dice', fourKind: 'Four the same: all dice',
  fullHouse: 'Three and a pair: 25', smallStraight: 'Four in a row: 30', largeStraight: 'Five in a row: 40',
  fiveKind: 'All five the same: 50', chance: 'Anything: all dice',
};
export const UPPER_BONUS_AT = 63, UPPER_BONUS = 35, FIVE_KIND_BONUS = 100, ROLLS_PER_TURN = 3;

const sum = dice => dice.reduce((a, b) => a + b, 0);
export const counts = dice => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };
const hasRun = (dice, n) => {
  const set = new Set(dice);
  for (let start = 1; start + n - 1 <= 6; start++) {
    let ok = true;
    for (let v = start; v < start + n; v++) if (!set.has(v)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
};
export const isFiveKind = dice => dice.length === 5 && dice.every(d => d === dice[0]);

/** What these dice would score in `box`, ignoring joker rules. */
export function rawScore(box, dice) {
  const c = counts(dice);
  const max = Math.max(...c);
  switch (box) {
    case 'ones': case 'twos': case 'threes': case 'fours': case 'fives': case 'sixes': {
      const v = UPPER.indexOf(box) + 1;
      return c[v] * v;
    }
    case 'threeKind': return max >= 3 ? sum(dice) : 0;
    case 'fourKind': return max >= 4 ? sum(dice) : 0;
    case 'fullHouse': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'smallStraight': return hasRun(dice, 4) ? 30 : 0;
    case 'largeStraight': return hasRun(dice, 5) ? 40 : 0;
    case 'fiveKind': return max === 5 ? 50 : 0;
    case 'chance': return sum(dice);
    default: return 0;
  }
}

/**
 * The boxes these dice may go in right now, with what each would score
 * (joker rules applied): { box: points }.
 */
export function options(card, dice) {
  const open = BOXES.filter(b => card[b] == null);
  const joker = isFiveKind(dice) && card.fiveKind != null;     // a Five of a Kind with the 50 box already used
  if (!joker) return Object.fromEntries(open.map(b => [b, rawScore(b, dice)]));
  const upper = UPPER[dice[0] - 1];
  if (card[upper] == null) return { [upper]: rawScore(upper, dice) };
  const lowerOpen = open.filter(b => LOWER.includes(b));
  if (lowerOpen.length) {
    const full = { fullHouse: 25, smallStraight: 30, largeStraight: 40 };
    return Object.fromEntries(lowerOpen.map(b => [b, full[b] ?? rawScore(b, dice)]));
  }
  return Object.fromEntries(open.map(b => [b, 0]));
}

export const upperTotal = card => UPPER.reduce((s, b) => s + (card[b] ?? 0), 0);
export const upperBonus = card => (upperTotal(card) >= UPPER_BONUS_AT ? UPPER_BONUS : 0);
export const lowerTotal = card => LOWER.reduce((s, b) => s + (card[b] ?? 0), 0);
export const total = card => upperTotal(card) + upperBonus(card) + lowerTotal(card) + (card.bonus ?? 0);
export const cardFull = card => BOXES.every(b => card[b] != null);
export const emptyCard = () => ({ bonus: 0 });

// ── A turn ───────────────────────────────────────────────────────────────────
const d6 = rng => 1 + Math.floor(rng() * 6);

export const newTurn = () => ({ dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], rollsLeft: ROLLS_PER_TURN });

/** Roll every die that isn't held. The first roll of a turn rolls all five. */
export function roll(turn, rng = Math.random) {
  if (turn.rollsLeft <= 0) throw new Error('No rolls left — choose a box to score.');
  const first = turn.rollsLeft === ROLLS_PER_TURN;
  return {
    dice: turn.dice.map((d, i) => (first || !turn.held[i] ? d6(rng) : d)),
    held: first ? [false, false, false, false, false] : turn.held,
    rollsLeft: turn.rollsLeft - 1,
  };
}

export function toggleHold(turn, i) {
  if (turn.rollsLeft === ROLLS_PER_TURN || turn.rollsLeft === 0) return turn;   // nothing to hold yet / no rolls left
  return { ...turn, held: turn.held.map((h, j) => (j === i ? !h : h)) };
}

/** Score the dice in `box`; returns the updated scorecard. */
export function score(card, box, dice) {
  if (dice.some(d => !d)) throw new Error('Roll the dice first.');
  const opts = options(card, dice);
  if (!(box in opts)) {
    throw new Error(card[box] != null ? 'That box is already filled.' : 'With a bonus Five of a Kind, you must use the matching number box first.');
  }
  const next = { ...card, [box]: opts[box] };
  if (isFiveKind(dice) && card.fiveKind === 50) next.bonus = (card.bonus ?? 0) + FIVE_KIND_BONUS;
  return next;
}
