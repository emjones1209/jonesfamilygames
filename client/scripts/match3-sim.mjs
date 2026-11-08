// Garden Match difficulty check: plays every level many times with three
// pretend players and prints how often each one wins.
//   human  – makes the biggest match it can see (what the levels are tuned for)
//   greedy – tries every swap and sees what drops in afterwards (no person can)
//   random – any swap that makes a match
// Run from client/:  node scripts/match3-sim.mjs        (N=500 for more games)
import * as L from '../src/games/match3/match3Logic.js';

const { ROWS, COLS, LEVELS } = L;
const N = Number(process.env.N) || 200;

function swapsThatMatch(b) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c].isBlocker) continue;
    for (const [r2, c2] of [[r, c + 1], [r + 1, c]]) {
      if (r2 >= ROWS || c2 >= COLS || b[r2][c2].isBlocker) continue;
      const s = L.trySwapBoard(b, r, c, r2, c2);
      if (L.getMatchGroups(s).length) out.push(s);
    }
  }
  return out;
}

// How much a move is worth towards this level's goal
const worth = (t, score, collected, blockers) =>
  t.type === 'score' ? score : (t.type === 'collect' ? collected : blockers) * 1000 + score;

function play(lv, who) {
  const t = lv.target, ft = t.type === 'collect' ? t.flowerType : -1;
  let b = L.initBoard(lv);
  if (!L.hasValidMove(b)) b = L.reshuffleBoard(b);
  let score = 0, collected = 0, blockers = lv.obstacles?.length ?? 0;
  for (let m = 0; m < lv.moves; m++) {
    const options = swapsThatMatch(b);
    let res;
    if (who === 'random') {
      res = L.fullCascade(options[Math.floor(Math.random() * options.length)], ft);
    } else if (who === 'human') {
      let best = -1, pick;
      for (const s of options) {
        const r = L.processMatches(s, L.getMatchGroups(s), ft);
        const v = worth(t, r.score, r.collected, r.blockersRemoved);
        if (v > best) { best = v; pick = s; }
      }
      res = L.fullCascade(pick, ft);
    } else {
      let best = -1;
      for (const s of options) {
        const r = L.fullCascade(s, ft);
        const v = worth(t, r.totalScore, r.totalCollected, r.totalBlockers);
        if (v > best) { best = v; res = r; }
      }
    }
    score += res.totalScore; collected += res.totalCollected;
    blockers = Math.max(0, blockers - res.totalBlockers);
    b = L.hasValidMove(res.board) ? res.board : L.reshuffleBoard(res.board);
    if ((t.type === 'score' && score >= t.value) || (t.type === 'collect' && collected >= t.value)
      || (t.type === 'clear' && blockers <= 0)) return true;
  }
  return false;
}

const pct = (lv, who) => `${Math.round(100 * Array.from({ length: N }, () => play(lv, who)).filter(Boolean).length / N)}%`.padStart(4);
console.log(`Win rates over ${N} games each\nlevel  goal                 human greedy random`);
for (const lv of LEVELS) {
  const goal = `${lv.target.type} ${lv.target.value} in ${lv.moves}`.padEnd(20);
  console.log(`${String(lv.id).padStart(5)}  ${goal} ${pct(lv, 'human')}  ${pct(lv, 'greedy')}  ${pct(lv, 'random')}`);
}
