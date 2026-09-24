/**
 * Mexican Train computer players. Each returns one action for the player whose
 * turn it is (a turn after a double is simply another call).
 *
 * easy   – plays any tile that fits
 * medium – plays its highest-scoring tile, preferring its own train (to keep
 *          its marker off) and covering doubles
 * hard   – plans the longest run of tiles it can lay on its own train and
 *          saves those for it, sheds its other tiles on the Mexican Train and
 *          open trains (highest first), only plays a double it can cover, takes
 *          its marker off as soon as it can, and dumps its biggest tiles when
 *          someone is about to go out
 */
import { legalMoves, openEnd, isDouble, pips, matches, MEXICAN } from './trainRules';

export function chooseAction(s, level) {
  const seat = s.turn;
  const moves = legalMoves(s, seat);
  if (!moves.length) return s.drew || !s.boneyard.length ? { type: 'pass' } : { type: 'draw' };
  const hand = s.hands[seat];
  const tile = id => hand.find(t => t.id === id);
  const play = m => ({ type: 'play', tileId: m.tileId, train: m.train });

  if (level === 'easy') return play(moves[Math.floor(Math.random() * moves.length)]);

  const own = m => s.trains[m.train].owner === seat;
  if (level === 'medium') {
    const score = m => pips(tile(m.tileId)) + (own(m) ? 5 : 0) + (isDouble(tile(m.tileId)) ? 3 : 0);
    return play(moves.reduce((a, b) => (score(b) > score(a) ? b : a)));
  }

  // ── Hard ──
  const chain = longestChain(hand, openEnd(s, seat));
  const inChain = new Set(chain.map(t => t.id));
  const someoneNearlyOut = s.hands.some((h, p) => p !== seat && h.length <= 2);
  // A double is only worth playing if we can cover it ourselves afterwards
  const coverable = m => {
    const t = tile(m.tileId);
    return !isDouble(t) || hand.some(o => o.id !== t.id && matches(o, t.a));
  };

  const score = m => {
    const t = tile(m.tileId);
    let v = pips(t);
    if (someoneNearlyOut) return v * 10 + (coverable(m) ? 1 : 0);     // just shed points
    if (!coverable(m)) v -= 100;
    if (own(m)) {
      // On our own train, follow the planned run (and take our marker off)
      if (chain.length && chain[0].id === t.id) v += 40 + (s.trains[seat].open ? 30 : 0);
      else v -= 30;                                                   // would break the run
    } else {
      // Elsewhere, get rid of tiles that aren't part of the run
      v += inChain.has(t.id) ? -40 : 20;
      if (s.trains[m.train].owner === MEXICAN) v += 2;
    }
    if (isDouble(t) && coverable(m)) v += 15;                           // doubles are hard to place later
    return v;
  };
  return play(moves.reduce((a, b) => (score(b) > score(a) ? b : a)));
}

/**
 * The longest run of tiles from `hand` that can be laid end to end starting
 * from `end` (ties broken by more pips). Searched exhaustively with a budget,
 * which is plenty for a hand of 15–25 tiles.
 */
export function longestChain(hand, end) {
  let best = [], bestPips = 0, budget = 20000;
  const used = new Set();
  const path = [];
  const dfs = cur => {
    if (--budget < 0) return;
    const p = path.reduce((s, t) => s + pips(t), 0);
    if (path.length > best.length || (path.length === best.length && p > bestPips)) { best = [...path]; bestPips = p; }
    for (const t of hand) {
      if (used.has(t.id) || !matches(t, cur)) continue;
      used.add(t.id); path.push(t);
      dfs(t.a === cur ? t.b : t.a);
      path.pop(); used.delete(t.id);
    }
  };
  dfs(end);
  return best;
}
