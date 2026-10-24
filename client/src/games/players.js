/**
 * The computer players, used by every game (and by robots at play-together
 * tables). Each game picks its opponents at random from the five, so you meet
 * different ones each time.
 *
 * Each has a personality:
 *   bold      – how much risk they like, from -1 (careful) to 1 (daredevil). Every
 *               game's robot reads it at its big decisions (how high to bid, whether
 *               to shoot the moon, push on or stop, go out early or wait); how well
 *               they play is still set by the difficulty
 *   tagline   – a word or two, shown before a game and at tables
 *   reactions – what they send (now and then) when something happens:
 *               good: their side did well · bad: their side did badly ·
 *               them: you did well · win / lose: the game's over
 */
export const ROBOTS = [
  {
    name: 'Phoebe', tagline: 'steady', bold: 0,
    reactions: { good: ['👍', 'Nice!'], bad: ['😬', 'Oops!'], them: ['👏', 'Good one!'], win: ['🎉', '👏'], lose: ['👏', 'Good one!'] },
  },
  {
    name: 'Xavier', tagline: 'optimist', bold: 0.4,
    reactions: { good: ['😂', '🎉'], bad: ['😂', 'Oops!'], them: ['😮', 'Nice!'], win: ['🥳', '🎉'], lose: ['😂', '👏'] },
  },
  {
    name: 'Heraldo', tagline: 'cautious', bold: -0.6,
    reactions: { good: ['😮', '👍'], bad: ['🥺', '😬'], them: ['😬', '😮'], win: ['😮', '👏'], lose: ['🥺', '😭'] },
  },
  {
    name: 'Ajax', tagline: 'daredevil', bold: 1,
    reactions: { good: ['🔥', '😎'], bad: ['😱', '🤦'], them: ['🙈', '😱'], win: ['😎', '🔥', '🥳'], lose: ['🤦', '😭'] },
  },
  {
    name: 'Beatrice', tagline: 'sly', bold: -0.2,
    reactions: { good: ['🙃', '😎'], bad: ['🤔', '🙃'], them: ['🤔', 'Nice!'], win: ['🙃', '😎'], lose: ['🤔', 'Good one!'] },
  },
];

export const COMPUTER_NAMES = ROBOTS.map(r => r.name);
export const robotNamed = name => ROBOTS.find(r => r.name === name) ?? null;

/** `count` different robots, in random order (leaving out any already `taken`, by name). */
export function pickRobots(count, { taken = [], rng = Math.random } = {}) {
  const pool = ROBOTS.filter(r => !taken.includes(r.name));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** "Ajax (daredevil)" */
export const introduce = robot => `${robot.name} (${robot.tagline})`;
