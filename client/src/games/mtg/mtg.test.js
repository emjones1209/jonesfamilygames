import { describe, it, expect } from 'vitest';
import { CARDS } from './cardPool';
import { DECKS, deckList } from './decks';
import { parseCost, payment, stats, combatDamage, legalTargets, perm, manaValue } from './mtgRules';
import { newGame, act, waitingFor, canCast, viewFor, describeLog, explainLog } from './mtgEngine';
import { robotAction, duel } from './mtgAI';

// A game in progress from a description: battlefield [[seat, name, { tapped, sick }]], hands, whose turn
function setup({ bf = [], hand0 = [], hand1 = [], active = 0, life = [20, 20], step = 'main1', library = 20 } = {}) {
  const s = newGame({ decks: ['white', 'red'], first: active, seed: 1 });
  let n = 1000;
  const card = (name, owner) => ({ id: `t${n++}`, name, owner });
  s.phase = 'playing';
  s.pending = null;
  s.active = active;
  s.turnNo = 3;
  s.step = step;
  s.priority = active;
  s.passes = 0;
  s.seats.forEach((p, seat) => {
    p.life = life[seat];
    p.hand = (seat ? hand1 : hand0).map(name => card(name, seat));
    p.library = Array.from({ length: library }, () => card(seat ? 'Mountain' : 'Plains', seat));
  });
  s.battlefield = bf.map(([seat, name, o = {}]) => ({
    id: o.id ?? `t${n++}`, name, owner: seat, controller: seat, tapped: !!o.tapped, sick: !!o.sick,
    damage: 0, deathtouched: false, counters: 0, boosts: [], attachedTo: o.attachedTo ?? null, token: null,
  }));
  return s;
}
const lands = (seat, name, k) => Array.from({ length: k }, () => [seat, name]);
const idOf = (s, name, seat) => s.battlefield.find(p => p.name === name && (seat == null || p.controller === seat)).id;
const handId = (s, seat, name) => s.seats[seat].hand.find(c => c.name === name).id;

describe('cards and decks', () => {
  it('every deck has 40 real cards from the pool, at most 4 of each spell', () => {
    expect(DECKS).toHaveLength(10);
    for (const deck of DECKS) {
      const list = deckList(deck);
      expect(list, deck.name).toHaveLength(40);
      for (const [name, k] of Object.entries(deck.cards)) {
        expect(CARDS[name], name).toBeDefined();
        if (CARDS[name].type !== 'Basic Land') expect(k, name).toBeLessThanOrEqual(4);
      }
    }
  });

  it('has five one-color decks and five two-color decks, each only using its colors', () => {
    expect(DECKS.filter(d => d.colors.length === 1)).toHaveLength(5);
    expect(DECKS.filter(d => d.colors.length === 2)).toHaveLength(5);
    for (const deck of DECKS) {
      for (const name of Object.keys(deck.cards)) {
        const cost = parseCost(CARDS[name].cost);
        for (const c of ['W', 'U', 'B', 'R', 'G']) if (cost[c]) expect(deck.colors, `${name} in ${deck.name}`).toContain(c);
      }
    }
  });

  it('reads mana costs', () => {
    expect(parseCost('{3}{W}{W}')).toMatchObject({ generic: 3, W: 2 });
    expect(manaValue(CARDS.Gigantosaurus)).toBe(5);
    expect(manaValue(CARDS.Forest)).toBe(0);
  });
});

describe('starting a game', () => {
  it('deals seven cards each and asks the first player about a mulligan', () => {
    const s = newGame({ decks: ['green', 'blue'], first: 1, seed: 7 });
    expect(s.seats.map(p => p.hand.length)).toEqual([7, 7]);
    expect(s.seats.map(p => p.library.length)).toEqual([33, 33]);
    expect(waitingFor(s)).toBe(1);
  });

  it('uses the London mulligan: draw seven, then put one on the bottom for each mulligan', () => {
    let s = newGame({ decks: ['green', 'blue'], first: 0, seed: 7 });
    s = act(s, { type: 'mulligan', seat: 0 });
    expect(s.seats[0].hand).toHaveLength(7);
    s = act(s, { type: 'keep', seat: 0 });
    expect(s.pending).toMatchObject({ type: 'bottom', seat: 0, count: 1 });
    expect(() => act(s, { type: 'choose', seat: 0, cards: [] })).toThrow(/Choose 1 card/);
    const bottom = s.seats[0].hand[0].id;
    s = act(s, { type: 'choose', seat: 0, cards: [bottom] });
    expect(s.seats[0].hand).toHaveLength(6);
    expect(s.seats[0].library[s.seats[0].library.length - 1].id).toBe(bottom);
    expect(waitingFor(s)).toBe(1);
    s = act(s, { type: 'keep', seat: 1 });
    expect(s.phase).toBe('playing');
    expect(s.step).toBe('main1');
    expect(s.seats[0].hand).toHaveLength(6);          // the first player doesn't draw on turn 1
  });
});

describe('mana', () => {
  it('pays colored costs from the right lands and generic from the rest', () => {
    const s = setup({ bf: [...lands(0, 'Plains', 2), ...lands(0, 'Island', 2)] });
    expect(payment(s, 0, '{1}{W}{U}')).toHaveLength(3);
    expect(payment(s, 0, '{W}{W}{W}')).toBeNull();
    expect(payment(s, 0, '{4}{U}')).toBeNull();
  });

  it('taps mana creatures, but not on the turn they arrive', () => {
    const s = setup({ bf: [[0, 'Forest'], [0, 'Llanowar Elves', { sick: true }]] });
    expect(payment(s, 0, '{1}{G}')).toBeNull();
    s.battlefield[1].sick = false;
    expect(payment(s, 0, '{1}{G}')).toHaveLength(2);
  });

  it('only lets you play one land a turn, in your main phase', () => {
    let s = setup({ hand0: ['Plains', 'Plains'] });
    s = act(s, { type: 'play', seat: 0, card: s.seats[0].hand[0].id });
    expect(() => act(s, { type: 'play', seat: 0, card: s.seats[0].hand[0].id })).toThrow(/one land/);
  });
});

describe('spells and the stack', () => {
  it('Lightning Bolt destroys a creature (when the opponent can\'t respond)', () => {
    let s = setup({ bf: [[0, 'Mountain'], [1, 'Hill Giant']], hand0: ['Lightning Bolt'] });
    s.seats[0].deck = 'red';
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Lightning Bolt'), targets: [{ type: 'perm', id: idOf(s, 'Hill Giant') }] });
    expect(s.battlefield.some(p => p.name === 'Hill Giant')).toBe(false);
    expect(s.seats[1].graveyard.map(c => c.name)).toContain('Hill Giant');
    expect(s.seats[0].graveyard.map(c => c.name)).toContain('Lightning Bolt');
    expect(waitingFor(s)).toBe(0);
  });

  it('lets the opponent respond: Counterspell counters the spell', () => {
    let s = setup({ bf: [...lands(0, 'Forest', 2), ...lands(1, 'Island', 2)], hand0: ['Grizzly Bears'], hand1: ['Counterspell'] });
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Grizzly Bears'), targets: [] });
    expect(waitingFor(s)).toBe(1);
    const spell = s.stack[0].id;
    s = act(s, { type: 'cast', seat: 1, card: handId(s, 1, 'Counterspell'), targets: [{ type: 'stack', id: spell }] });
    expect(s.stack).toHaveLength(0);                   // you had no response, so it all resolved
    expect(s.battlefield.some(p => p.name === 'Grizzly Bears')).toBe(false);
    expect(s.seats[0].graveyard.map(c => c.name)).toEqual(['Grizzly Bears']);
  });

  it('a spell whose target has gone does nothing', () => {
    let s = setup({
      bf: [[0, 'Mountain'], [0, 'Grizzly Bears'], ...lands(1, 'Island', 1)],
      hand0: ['Shock'], hand1: ['Unsummon'],
    });
    const bears = idOf(s, 'Grizzly Bears');
    s.seats[0].hand.push({ id: 'x', name: 'Giant Growth', owner: 0 });
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Shock'), targets: [{ type: 'perm', id: bears }] });
    // Shock at my own bears; the opponent bounces them in response
    s = act(s, { type: 'cast', seat: 1, card: handId(s, 1, 'Unsummon'), targets: [{ type: 'perm', id: bears }] });
    expect(s.seats[0].hand.map(c => c.name)).toContain('Grizzly Bears');
    expect(s.log.some(e => /Shock has no legal target/.test(e.text ?? ''))).toBe(true);
  });

  it('only lets sorcery-speed spells be cast in your own main phase with an empty stack', () => {
    const s = setup({ bf: [...lands(1, 'Forest', 2)], hand1: ['Grizzly Bears'], active: 0 });
    expect(canCast(s, 1, s.seats[1].hand[0])).toBe(false);
    expect(() => act(s, { type: 'cast', seat: 1, card: s.seats[1].hand[0].id })).toThrow(/turn to act/);
  });

  it('Man-o\'-War must target a creature when there is one', () => {
    let s = setup({ bf: [...lands(0, 'Island', 3), [1, 'Hill Giant']], hand0: ["Man-o'-War"] });
    expect(() => act(s, { type: 'cast', seat: 0, card: s.seats[0].hand[0].id, targets: [] })).toThrow(/target/);
    s = act(s, { type: 'cast', seat: 0, card: s.seats[0].hand[0].id, targets: [{ type: 'perm', id: idOf(s, 'Hill Giant') }] });
    expect(s.seats[1].hand.map(c => c.name)).toContain('Hill Giant');
  });

  it('Pacifism stops a creature attacking; Glorious Anthem pumps your team', () => {
    let s = setup({ bf: [...lands(0, 'Plains', 5), [0, 'Grizzly Bears'], [1, 'Hill Giant']], hand0: ['Pacifism', 'Glorious Anthem'] });
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Pacifism'), targets: [{ type: 'perm', id: idOf(s, 'Hill Giant') }] });
    expect(stats(s, perm(s, idOf(s, 'Hill Giant'))).cantAttack).toBe(true);
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Glorious Anthem'), targets: [] });
    const bears = stats(s, perm(s, idOf(s, 'Grizzly Bears')));
    expect([bears.power, bears.toughness]).toEqual([3, 3]);
  });

  it('shroud creatures can\'t be targeted', () => {
    const s = setup({ bf: [[1, 'Wall of Denial'], [1, 'Hill Giant']] });
    const ids = legalTargets(s, 0, { kind: 'creature' }).map(r => r.id);
    expect(ids).toEqual([idOf(s, 'Hill Giant')]);
  });

  it('Mind Rot makes the opponent choose two cards to discard', () => {
    let s = setup({ bf: lands(0, 'Swamp', 3), hand0: ['Mind Rot'], hand1: ['Shock', 'Hill Giant', 'Mountain'] });
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Mind Rot'), targets: [{ type: 'player', seat: 1 }] });
    expect(s.pending).toMatchObject({ type: 'discard', seat: 1, count: 2 });
    s = act(s, { type: 'choose', seat: 1, cards: [handId(s, 1, 'Mountain'), handId(s, 1, 'Hill Giant')] });
    expect(s.seats[1].hand.map(c => c.name)).toEqual(['Shock']);
    expect(waitingFor(s)).toBe(0);
  });
});

describe('combat', () => {
  const fight = (bf, attackers, blocks) => {
    let s = setup({ bf });
    s = act(s, { type: 'attack', seat: 0, attackers: attackers.map(n => idOf(s, n, 0)) });
    if (waitingFor(s) === 1 && s.step === 'declareBlockers') {
      s = act(s, { type: 'block', seat: 1, blocks: blocks.map(([b, a]) => ({ blocker: idOf(s, b, 1), attacker: idOf(s, a, 0) })) });
    }
    return s;
  };
  const alive = (s, name) => s.battlefield.some(p => p.name === name);

  it('an unblocked attacker hits the player, and attacking taps it', () => {
    const s = fight([[0, 'Hill Giant']], ['Hill Giant'], []);
    expect(s.seats[1].life).toBe(17);
    expect(s.step).toBe('main2');
    expect(perm(s, idOf(s, 'Hill Giant')).tapped).toBe(true);
  });

  it('vigilance doesn\'t tap; creatures that just arrived can\'t attack (haste can)', () => {
    let s = fight([[0, 'Serra Angel']], ['Serra Angel'], []);
    expect(perm(s, idOf(s, 'Serra Angel')).tapped).toBe(false);
    s = setup({ bf: [[0, 'Hill Giant', { sick: true }], [0, 'Raging Goblin', { sick: true }]] });
    expect(() => act(s, { type: 'attack', seat: 0, attackers: [idOf(s, 'Hill Giant')] })).toThrow(/just arrived/);
    s = act(s, { type: 'attack', seat: 0, attackers: [idOf(s, 'Raging Goblin')] });
    expect(s.seats[1].life).toBe(19);
  });

  it('blocked creatures fight each other', () => {
    const s = fight([[0, 'Hill Giant'], [1, 'Grizzly Bears']], ['Hill Giant'], [['Grizzly Bears', 'Hill Giant']]);
    expect(alive(s, 'Grizzly Bears')).toBe(false);
    expect(alive(s, 'Hill Giant')).toBe(true);
    expect(s.seats[1].life).toBe(20);
  });

  it('first strike kills before the blocker can hit back', () => {
    const s = fight([[0, 'Youthful Knight'], [1, 'Savannah Lions']], ['Youthful Knight'], [['Savannah Lions', 'Youthful Knight']]);
    expect(alive(s, 'Youthful Knight')).toBe(true);
    expect(alive(s, 'Savannah Lions')).toBe(false);
  });

  it('deathtouch destroys with any damage; lifelink gains life', () => {
    const s = fight([[0, 'Vampire Nighthawk'], [1, 'Giant Spider']], ['Vampire Nighthawk'], [['Giant Spider', 'Vampire Nighthawk']]);
    expect(alive(s, 'Giant Spider')).toBe(false);
    expect(alive(s, 'Vampire Nighthawk')).toBe(true);
    expect(s.seats[0].life).toBe(22);
  });

  it('trample sends extra damage through to the player', () => {
    const s = fight([[0, 'Colossal Dreadmaw'], [1, 'Grizzly Bears']], ['Colossal Dreadmaw'], [['Grizzly Bears', 'Colossal Dreadmaw']]);
    expect(s.seats[1].life).toBe(16);
  });

  it('flying creatures can only be blocked by flying or reach', () => {
    let s = setup({ bf: [[0, 'Wind Drake'], [1, 'Grizzly Bears'], [1, 'Giant Spider']] });
    s = act(s, { type: 'attack', seat: 0, attackers: [idOf(s, 'Wind Drake')] });
    expect(() => act(s, { type: 'block', seat: 1, blocks: [{ blocker: idOf(s, 'Grizzly Bears'), attacker: idOf(s, 'Wind Drake') }] })).toThrow(/flying/);
    s = act(s, { type: 'block', seat: 1, blocks: [{ blocker: idOf(s, 'Giant Spider'), attacker: idOf(s, 'Wind Drake') }] });
    expect(alive(s, 'Wind Drake')).toBe(false);          // a 2/4 spider stops a 2/2 drake
    expect(alive(s, 'Giant Spider')).toBe(true);
    expect(s.seats[1].life).toBe(20);
  });

  it('skips blocks when the defender has nothing that can block', () => {
    const s = fight([[0, 'Phantom Warrior'], [1, 'Grizzly Bears']], ['Phantom Warrior'], []);
    expect(s.seats[1].life).toBe(18);
  });

  it('two blockers can gang up on one attacker', () => {
    const s = fight([[0, 'Rumbling Baloth'], [1, 'Grizzly Bears'], [1, 'Kalonian Tusker']], ['Rumbling Baloth'],
      [['Grizzly Bears', 'Rumbling Baloth'], ['Kalonian Tusker', 'Rumbling Baloth']]);
    expect(alive(s, 'Rumbling Baloth')).toBe(false);
    // The 4 damage destroys the bears first (easiest), the rest goes on the tusker
    expect(alive(s, 'Grizzly Bears')).toBe(false);
    expect(alive(s, 'Kalonian Tusker')).toBe(true);
  });

  it('gives the attacker a chance for a combat trick after blocks', () => {
    let s = setup({ bf: [[0, 'Grizzly Bears'], [0, 'Forest'], [1, 'Hill Giant']], hand0: ['Giant Growth'] });
    s = act(s, { type: 'attack', seat: 0, attackers: [idOf(s, 'Grizzly Bears')] });
    s = act(s, { type: 'block', seat: 1, blocks: [{ blocker: idOf(s, 'Hill Giant'), attacker: idOf(s, 'Grizzly Bears') }] });
    expect(s.step).toBe('blocks');
    expect(waitingFor(s)).toBe(0);
    s = act(s, { type: 'cast', seat: 0, card: handId(s, 0, 'Giant Growth'), targets: [{ type: 'perm', id: idOf(s, 'Grizzly Bears') }] });
    expect(s.step).toBe('main2');
    expect(alive(s, 'Grizzly Bears')).toBe(true);
    expect(alive(s, 'Hill Giant')).toBe(false);
  });

  it('works out combat damage assignments', () => {
    const s = setup({ bf: [[0, 'Craw Wurm'], [1, 'Grizzly Bears']] });
    s.combat = { attackers: [{ id: idOf(s, 'Craw Wurm'), blockers: [idOf(s, 'Grizzly Bears')], blocked: true }] };
    expect(combatDamage(s, null)).toEqual([
      { source: idOf(s, 'Craw Wurm'), to: { type: 'perm', id: idOf(s, 'Grizzly Bears') }, n: 6 },
      { source: idOf(s, 'Grizzly Bears'), to: { type: 'perm', id: idOf(s, 'Craw Wurm') }, n: 2 },
    ]);
  });
});

describe('winning and losing', () => {
  it('a player at 0 life loses', () => {
    const s = (() => { let g = setup({ bf: [[0, 'Hill Giant']], life: [20, 3] }); return act(g, { type: 'attack', seat: 0, attackers: [idOf(g, 'Hill Giant')] }); })();
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(0);
    expect(s.reason).toBe('life');
    expect(s.wins).toEqual([1, 0]);
  });

  it('a player who must draw from an empty library loses', () => {
    let s = setup({ library: 0, active: 0 });
    s = act(s, { type: 'endTurn', seat: 0 });
    // The opponent's turn: they draw from an empty library
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(0);
    expect(s.reason).toBe('deck');
  });

  it('discards down to seven at the end of your turn', () => {
    let s = setup({ hand0: Array(9).fill('Hill Giant') });
    s = act(s, { type: 'endTurn', seat: 0 });
    expect(s.pending).toMatchObject({ type: 'discard', seat: 0, count: 2 });
    s = act(s, { type: 'choose', seat: 0, cards: s.seats[0].hand.slice(0, 2).map(c => c.id) });
    expect(s.seats[0].hand).toHaveLength(7);
    expect(s.active).toBe(1);
  });
});

describe('what you can see', () => {
  it('hides the opponent\'s hand and both libraries', () => {
    const s = newGame({ decks: ['green', 'blue'], first: 0, seed: 3 });
    const v = viewFor(s, 0);
    expect(v.seats[1].hand.every(c => c.hidden && !c.name)).toBe(true);
    expect(v.seats[0].hand.every(c => c.name)).toBe(true);
    expect(v.seats[0].library).toBe(33);
  });

  it('describes the log for you', () => {
    expect(describeLog({ seat: 0, v: ['cast', 'casts'], rest: 'Shock targeting @1.' }, ['You', 'Ajax'])).toBe('You cast Shock targeting Ajax.');
    expect(describeLog({ seat: 1, v: ['cast', 'casts'], rest: 'Shock targeting @0.' }, ['You', 'Ajax'])).toBe('Ajax casts Shock targeting you.');
    expect(describeLog({ text: '@0 take 3 combat damage.' }, ['You', 'Ajax'])).toBe('You take 3 combat damage.');
  });
});

describe('explanations', () => {
  const names = ['You', 'Ajax'];
  const lines = (s, re) => s.log.filter(e => re.test(describeLog(e, names))).flatMap(e => explainLog(e, names));

  it('explains a spell when it\'s cast and when it resolves', () => {
    let s = setup({ bf: [[1, 'Mountain'], [0, 'Grizzly Bears']], hand1: ['Lightning Bolt'], active: 1 });
    s = act(s, { type: 'cast', seat: 1, card: s.seats[1].hand[0].id, targets: [{ type: 'perm', id: idOf(s, 'Grizzly Bears') }] });
    const cast = s.log.find(e => /casts Lightning Bolt/.test(describeLog(e, names)));
    expect(cast.about).toBe(1);
    expect(explainLog(cast, names).join(' ')).toMatch(/instant.*any time/);
    const resolved = lines(s, /Lightning Bolt resolves/).join(' ');
    expect(resolved).toMatch(/deals 3 damage to Grizzly Bears \(2\/2\)/);
    expect(resolved).toMatch(/Grizzly Bears dies: it has 3 damage and its toughness is 2/);
  });

  it('explains combat: blocks, trample, lifelink and life totals', () => {
    let s = setup({ bf: [[1, 'Colossal Dreadmaw'], [1, 'Vampire Nighthawk'], [0, 'Grizzly Bears']], active: 1 });
    s = act(s, { type: 'attack', seat: 1, attackers: [idOf(s, 'Colossal Dreadmaw'), idOf(s, 'Vampire Nighthawk')] });
    expect(lines(s, /Ajax attacks/).join(' ')).toMatch(/Vampire Nighthawk has flying/);
    s = act(s, { type: 'block', seat: 0, blocks: [{ blocker: idOf(s, 'Grizzly Bears'), attacker: idOf(s, 'Colossal Dreadmaw') }] });
    const combat = s.log.find(e => /combat damage/.test(describeLog(e, names)));
    expect(combat.about).toBe(1);
    const text = explainLog(combat, names).join(' ');
    expect(text).toMatch(/trample.*the other 4 goes through to you/);
    expect(text).toMatch(/lifelink.*Ajax gains 2 life/);
    expect(text).toMatch(/You: 20 → 14 life/);
  });
});

describe('the computer player', () => {
  it('knows who wins a fight', () => {
    const s = setup({ bf: [[0, 'Youthful Knight'], [1, 'Savannah Lions'], [1, 'Typhoid Rats'], [1, 'Hill Giant']] });
    const knight = perm(s, idOf(s, 'Youthful Knight'));
    expect(duel(s, knight, perm(s, idOf(s, 'Savannah Lions')))).toEqual({ attDies: false, blkDies: true });
    expect(duel(s, knight, perm(s, idOf(s, 'Typhoid Rats')))).toEqual({ attDies: false, blkDies: true });
    expect(duel(s, knight, perm(s, idOf(s, 'Hill Giant')))).toEqual({ attDies: true, blkDies: false });
  });

  it('bolts the opponent for the win', () => {
    const s = setup({ bf: [[1, 'Mountain'], [0, 'Grizzly Bears']], hand1: ['Lightning Bolt'], life: [3, 20], active: 1 });
    expect(robotAction(s, 1, 'medium')).toMatchObject({ type: 'cast', targets: [{ type: 'player', seat: 0 }] });
  });

  it('uses removal on the biggest threat', () => {
    const s = setup({ bf: [...lands(1, 'Swamp', 2), [0, 'Grizzly Bears'], [0, 'Serra Angel']], hand1: ['Doom Blade'], active: 1 });
    expect(robotAction(s, 1, 'medium')).toMatchObject({ type: 'cast', targets: [{ type: 'perm', id: idOf(s, 'Serra Angel') }] });
  });

  it('chump-blocks rather than die', () => {
    let s = setup({ bf: [[0, 'Craw Wurm'], [1, 'Savannah Lions']], life: [20, 5] });
    s = act(s, { type: 'attack', seat: 0, attackers: [idOf(s, 'Craw Wurm')] });
    expect(robotAction(s, 1, 'medium')).toEqual({ type: 'block', seat: 1, blocks: [{ blocker: idOf(s, 'Savannah Lions'), attacker: idOf(s, 'Craw Wurm') }] });
  });

  it('doesn\'t attack into a blocker that would destroy its creature for free', () => {
    const s = setup({ bf: [[1, 'Grizzly Bears'], [0, 'Giant Spider']], active: 1 });
    expect(robotAction(s, 1, 'medium')).toEqual({ type: 'attack', seat: 1, attackers: [] });
  });
});

describe('whole games between computer players', () => {
  const play = (d0, d1, level, seed) => {
    let s = newGame({ decks: [d0, d1], seed });
    for (let i = 0; i < 3000 && s.phase !== 'gameOver'; i++) {
      const seat = waitingFor(s);
      s = act(s, robotAction(s, seat, level, { bold: (seed % 5) / 2 - 1 }));
    }
    return s;
  };

  it('finishes every pairing of decks without a rules error', () => {
    let finished = 0;
    for (const [i, a] of DECKS.entries()) {
      for (const [j, b] of DECKS.entries()) {
        const s = play(a.id, b.id, ['easy', 'medium', 'hard'][(i + j) % 3], i * 10 + j + 1);
        expect(s.phase, `${a.name} v ${b.name}`).toBe('gameOver');
        finished++;
      }
    }
    expect(finished).toBe(100);
  }, 120000);

  it('hard beats easy more often than not', () => {
    let hard = 0;
    const games = 30;
    for (let g = 0; g < games; g++) {
      const deck = DECKS[g % DECKS.length].id;
      let s = newGame({ decks: [deck, deck], seed: 500 + g });
      for (let i = 0; i < 3000 && s.phase !== 'gameOver'; i++) {
        const seat = waitingFor(s);
        s = act(s, robotAction(s, seat, seat === 0 ? 'hard' : 'easy'));
      }
      if (s.winner === 0) hard++;
    }
    expect(hard).toBeGreaterThan(games / 2);
  }, 120000);
});
