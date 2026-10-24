import { describe, it, expect } from 'vitest';
import { moments, reactionsFor, QUIET_MS } from './chatter';
import { ROBOTS, pickRobots, robotNamed } from './players';
import { chooseBid } from './spades/spadesRules';
import { chooseBid as rookBid } from './rook/rookRules';
import { buildDeck } from '../utils/cardEngine';

const ajax = robotNamed('Ajax'), heraldo = robotNamed('Heraldo');
const always = () => 0;          // a "random" number that makes every robot speak up

describe('the robots', () => {
  it('are five, each with a tagline and reactions for every moment', () => {
    expect(ROBOTS.map(r => r.name)).toEqual(['Phoebe', 'Xavier', 'Heraldo', 'Ajax', 'Beatrice']);
    for (const r of ROBOTS) {
      expect(r.tagline).toBeTruthy();
      for (const kind of ['good', 'bad', 'them', 'win', 'lose']) expect(r.reactions[kind].length).toBeGreaterThan(0);
    }
  });

  it('are picked at random, never the same one twice', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const three = pickRobots(3);
      expect(new Set(three.map(r => r.name)).size).toBe(3);
      three.forEach(r => seen.add(r.name));
    }
    expect(seen.size).toBe(5);
    expect(pickRobots(2, { taken: ['Ajax', 'Phoebe', 'Xavier'] }).map(r => r.name).sort()).toEqual(['Beatrice', 'Heraldo']);
  });

  it('bid by personality: a daredevil higher than a careful player with the same hand', () => {
    const deck = buildDeck();
    let higher = 0;
    for (let i = 0; i < 40; i++) {
      const hand = deck.slice((i * 13) % 39, (i * 13) % 39 + 13);
      const bold = chooseBid(hand, 'medium', null, ajax.bold), careful = chooseBid(hand, 'medium', null, heraldo.bold);
      if (bold !== 0) expect(bold).toBeGreaterThanOrEqual(careful);       // (0 is Nil: a daredevil's gamble)
      if (bold > careful) higher++;
    }
    expect(higher).toBeGreaterThan(10);
  });

  it('push Rook bids further when bold', () => {
    const hand = buildDeck().slice(0, 13);
    const highestBid = bold => { let high = null, bid; while ((bid = rookBid(hand, high, 'medium', bold)) !== 'pass') high = bid; return high ?? 0; };
    expect(highestBid(1)).toBeGreaterThanOrEqual(highestBid(-0.6));
  });
});

describe('robot reactions', () => {
  const spades = (scores, phase = 'handOver') => ({ phase, scores });
  const seats = { 1: ajax, 2: robotNamed('Phoebe'), 3: heraldo };
  const robots = seat => seats[seat] ?? null;
  const isPerson = seat => seat === 0;

  it('notices which side did best and worst in a hand', () => {
    const found = moments('spades', spades([100, 50]), spades([170, 0]));
    expect(found.find(m => m.seat === 1).kind).toBe('bad');
    expect(found.find(m => m.seat === 2).kind).toBe('good');
    expect(found.find(m => m.seat === 1).best).toEqual([0, 2]);
  });

  it('counts lower as better in Hearts, and ignores small changes in Cribbage', () => {
    const found = moments('hearts', { totals: [10, 10, 10, 10] }, { totals: [36, 10, 10, 10] });
    expect(found.find(m => m.seat === 0).kind).toBe('bad');
    expect(moments('cribbage', { scores: [10, 10] }, { scores: [12, 10] })).toEqual([]);
    expect(moments('cribbage', { scores: [10, 10] }, { scores: [10, 22] }).find(m => m.seat === 1).kind).toBe('good');
  });

  it('knows who won at the end, and keeps quiet when a new game starts', () => {
    const end = moments('chess', { phase: 'playing', winner: null }, { phase: 'gameOver', winner: 1 });
    expect(end).toEqual([{ seat: 0, kind: 'lose', best: [1] }, { seat: 1, kind: 'win', best: [1] }]);
    expect(moments('chess', { phase: 'playing' }, { phase: 'gameOver', winner: null })).toEqual([]);   // a draw
    expect(moments('spades', spades([520, 300], 'gameOver'), spades([0, 0], 'bidding'))).toEqual([]);
  });

  it('lets one robot speak per hand, each at most once a minute', () => {
    const lastSaid = new Map();
    const found = moments('spades', spades([100, 50]), spades([170, 0]));
    const first = reactionsFor(found, { robots, isPerson, lastSaid, now: 1000, rng: always });
    expect(first).toHaveLength(1);
    const speaker = robots(first[0].seat);
    expect([...speaker.reactions.good, ...speaker.reactions.bad, ...speaker.reactions.them]).toContain(first[0].emoji);
    // A minute later, but the same robot only once in a while
    const again = reactionsFor(found, { robots, isPerson, lastSaid, now: 2000, rng: always });
    expect(again.every(r => r.seat !== first[0].seat)).toBe(true);
    const later = reactionsFor(found, { robots, isPerson, lastSaid, now: 1000 + QUIET_MS * 2, rng: always });
    expect(later).toHaveLength(1);
  });

  it('admires a person\'s good hand when it cost the robot nothing', () => {
    const found = moments('dice', { cards: null }, { cards: null });    // (no cards: nothing to compare)
    expect(found).toEqual([]);
    const said = reactionsFor([{ seat: 1, kind: 'bad', best: [0], delta: 0 }], { robots, isPerson, lastSaid: new Map(), rng: always });
    expect(ajax.reactions.them).toContain(said[0].emoji);
  });

  it('all react when the game ends, whatever the time since they last spoke', () => {
    const lastSaid = new Map(ROBOTS.map(r => [r.name, 999]));
    const found = moments('spades', spades([450, 300], 'handOver'), spades([520, 300], 'gameOver'));
    const said = reactionsFor(found, { robots, isPerson, lastSaid, now: 1000, rng: always });
    expect(said.map(r => r.seat).sort()).toEqual([1, 2, 3]);
    expect(heraldo.reactions.lose).toContain(said.find(r => r.seat === 3).emoji);
    expect(robotNamed('Phoebe').reactions.win).toContain(said.find(r => r.seat === 2).emoji);
  });
});
