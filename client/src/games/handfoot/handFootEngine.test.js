import { describe, it, expect } from 'vitest';
import { newGame, act, waitingFor, robotAction, viewFor, rotate } from './handFootEngine';
import { act as rulesAct, dealRound, makeDeck, isBook, isClean, scoreHand, canGoOut, booksToGo, MINIMUMS } from './handFootRules';

function autoplay(s, levels = ['hard', 'medium', 'medium', 'easy'], until = () => false) {
  for (let step = 0; step < 100000 && !until(s); step++) {
    if (s.phase === 'gameOver') return s;
    if (s.phase === 'handOver') { s = act(s, { type: 'nextHand' }); continue; }
    const seat = waitingFor(s);
    s = act(s, robotAction(s, seat, levels[seat]));
  }
  return s;
}

const count = x => x.hands.flat().length + x.feet.flat().length + x.stock.length + x.discard.length
  + x.melds.flat().reduce((n, m) => n + m.cards.length, 0);

const card = (rank, suit = 'hearts', n = 1) => ({ id: `${rank}-${suit}-${n}`, rank, suit });

describe('Hand and Foot rules', () => {
  it('deals a hand and a foot of 11 to everyone from 270 cards', () => {
    const s = dealRound();
    expect(makeDeck()).toHaveLength(270);
    expect(count(s)).toBe(270);
    for (const seat of [0, 1, 2, 3]) {
      expect(s.hands[seat]).toHaveLength(11);
      expect(s.feet[seat]).toHaveLength(11);
    }
  });

  it('draws two cards, and checks melds', () => {
    let s = dealRound({ dealer: 3 });
    s.hands[0] = [card('9'), card('9', 'spades'), card('9', 'clubs'), card('JK', 'joker'), card('2', 'clubs'), card('2', 'hearts'), card('5')];
    s = rulesAct(s, { type: 'draw' });
    expect(s.hands[0]).toHaveLength(9);
    const nines = s.hands[0].filter(c => c.rank === '9').slice(0, 2).map(c => c.id);
    expect(() => rulesAct(s, { type: 'meld', ids: nines })).toThrow(/at least 3/);
    const wilds = ['JK-joker-1', '2-clubs-1', '2-hearts-1'];
    expect(() => rulesAct(s, { type: 'meld', ids: [...nines, ...wilds] })).toThrow(/more natural cards than wild/);
    // Jones family rules: as many wild cards as natural ones isn't allowed either
    expect(() => rulesAct(s, { type: 'meld', ids: [...nines, 'JK-joker-1', '2-clubs-1'] })).toThrow(/more natural cards than wild/);
    s = rulesAct(s, { type: 'meld', ids: [...nines, 'JK-joker-1'] });
    expect(s.melds[0]).toHaveLength(1);
    // 9s + joker = 70, enough for round 1's 50, so the turn can end
    s = rulesAct(s, { type: 'discard', id: '5-hearts-1' });
    expect(s.initialDone[0]).toBe(true);
    expect(s.turn).toBe(1);
  });

  it('insists on the first-meld minimum', () => {
    let s = dealRound({ dealer: 3, round: 2 });                 // 120 needed
    s.hands[0] = [card('4'), card('4', 'spades'), card('4', 'clubs'), card('K')];
    s = rulesAct(s, { type: 'draw' });
    s = rulesAct(s, { type: 'meld', ids: ['4-hearts-1', '4-spades-1', '4-clubs-1'] });
    expect(() => rulesAct(s, { type: 'discard', id: 'K-hearts-1' })).toThrow(new RegExp(`${MINIMUMS[2]}`));
    s = rulesAct(s, { type: 'undo' });
    expect(s.melds[0]).toHaveLength(0);
    expect(rulesAct(s, { type: 'discard', id: 'K-hearts-1' }).turn).toBe(1);
  });

  it('lets books keep growing, but keeps wild cards off clean books', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    const clean = { rank: 'K', cards: Array.from({ length: 7 }, (_, i) => card('K', 'spades', i + 1)) };
    const dirty = { rank: 'Q', cards: [...Array.from({ length: 5 }, (_, i) => card('Q', 'clubs', i + 1)), card('2', 'clubs'), card('JK', 'joker')] };
    s.melds[0] = [clean, dirty];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('K'), card('JK', 'joker', 2), card('2', 'spades'), card('Q'), card('5'), card('6')];
    // A single natural card goes on the book of its rank, even without tapping it
    s = rulesAct(s, { type: 'meld', ids: ['K-hearts-1'] });
    expect(s.melds[0][0].cards).toHaveLength(8);
    expect(isClean(s.melds[0][0])).toBe(true);
    // No wild cards on a clean book…
    expect(() => rulesAct(s, { type: 'meld', ids: ['JK-joker-2'], target: 0 })).toThrow(/pure book/);
    // …but a dirty book takes one (up to 3 wild, never more wild than natural)
    s = rulesAct(s, { type: 'meld', ids: ['2-spades-1'], target: 1 });
    expect(s.melds[0][1].cards).toHaveLength(8);
    expect(() => rulesAct(s, { type: 'meld', ids: ['JK-joker-2'], target: 1 })).toThrow(/at most 3 wild/);
    // Cards must match the book they're put on
    expect(() => rulesAct(s, { type: 'meld', ids: ['Q-hearts-1'], target: 0 })).toThrow(/don't go on the Ks/);
    s = rulesAct(s, { type: 'meld', ids: ['Q-hearts-1'], target: 1 });
    expect(s.melds[0][1].cards).toHaveLength(9);
  });

  it('lets you take the pile before your first meld, and Undo puts it back', () => {
    let s = dealRound({ dealer: 3, round: 1 });                 // 90 needed
    const pile = [card('6', 'clubs'), card('7', 'clubs'), card('5', 'clubs'), card('K', 'clubs'), card('9', 'spades')];
    s.discard = [...pile];
    s.hands[0] = [card('9'), card('9', 'clubs'), card('4'), card('4', 'spades'), card('4', 'clubs')];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-clubs-1'] });
    expect(s.phase).toBe('play');
    expect(s.melds[0][0].cards).toHaveLength(3);                 // 9s: 30 — short of 90
    expect(s.hands[0].map(c => c.id)).toEqual(expect.arrayContaining(['5-clubs-1', 'K-clubs-1']));
    s = rulesAct(s, { type: 'meld', ids: ['4-hearts-1', '4-spades-1', '4-clubs-1'] });   // +15 = 45
    expect(() => rulesAct(s, { type: 'discard', id: '5-clubs-1' })).toThrow(/at least 90/);
    s = rulesAct(s, { type: 'undo' });
    expect(s.phase).toBe('draw');                                // back to drawing, pile restored
    expect(s.discard).toEqual(pile);
    expect(s.melds[0]).toHaveLength(0);
    expect(s.hands[0]).toHaveLength(5);
    expect(rulesAct(s, { type: 'draw' }).hands[0]).toHaveLength(7);
  });

  it('won\'t let anyone take a pile of fewer than 5 cards (Jones family rules)', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.hands[0] = [card('9'), card('9', 'clubs'), card('K')];
    s.discard = [card('4', 'clubs'), card('5', 'clubs'), card('6', 'clubs'), card('9', 'spades')];
    expect(() => rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-clubs-1'] })).toThrow(/at least 5 cards.*\(it has 4\)/);
    s.discard = [card('7', 'clubs'), ...s.discard];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-clubs-1'] });
    expect(s.phase).toBe('play');
    expect(s.melds[0][0].cards).toHaveLength(3);
    expect(s.hands[0].map(c => c.rank).sort()).toEqual(['4', '5', '6', '7', 'K']);
  });

  it('picks up your foot when your hand is used up, and only goes out with a clean and a dirty book', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: 'K', cards: Array.from({ length: 7 }, (_, i) => card('K', 'spades', i + 1)) }];
    s = rulesAct(s, { type: 'draw' });
    // Discard your last hand card: your foot comes up, ready for your next turn
    s = { ...s, hands: s.hands.map((h, i) => (i === 0 ? [card('Q')] : h)) };
    const foot = s.feet[0];
    s = rulesAct(s, { type: 'discard', id: 'Q-hearts-1' });
    expect(s.turn).toBe(1);
    expect(s.inFoot[0]).toBe(true);
    expect(s.feet[0]).toHaveLength(0);
    expect(s.hands[0]).toHaveLength(11);
    expect(s.hands[0].filter(c => foot.includes(c)).length).toBe(foot.length);     // red 3s and all
    // In the foot with 2 clean books and 2 dirty ones: can't go out (Jones family rules: 2 clean + 3 dirty)
    const dirty = (rank, n = 1) => ({ rank, cards: [...Array.from({ length: 5 }, (_, i) => card(rank, 'clubs', 10 * n + i)), card('2', 'clubs', 10 * n), card('JK', 'joker', 10 * n)] });
    s.melds[0].push({ rank: 'J', cards: Array.from({ length: 7 }, (_, i) => card('J', 'spades', i + 1)) }, dirty('A'), dirty('Q'));
    s = { ...s, turn: 0, phase: 'play', hands: s.hands.map((h, i) => (i === 0 ? [card('7')] : h)) };
    expect(booksToGo(s, 0)).toEqual({ clean: 0, dirty: 1 });
    expect(() => rulesAct(s, { type: 'discard', id: '7-hearts-1' })).toThrow(/2 pure books and 3 impure books/);
    // With a third dirty book — and your partner's permission (Jones family rules) — discarding the last card goes out
    s.melds[0].push(dirty('10'));
    s = rulesAct(rulesAct(s, { type: 'askOut' }), { type: 'answerOut', yes: true });
    const out = rulesAct(s, { type: 'discard', id: '7-hearts-1' });
    expect(out.phase).toBe('over');
    expect(out.outBy).toBe(0);
    expect(out.melds[0].filter(isBook).map(isClean)).toEqual([true, true, false, false, false]);
    const [us] = scoreHand(out);
    expect(us).toMatchObject({ clean: 2, dirty: 3, goingOut: 100 });
  });
});

describe('Jones family rules', () => {
  const clean = (rank, n = 1) => ({ rank, cards: Array.from({ length: 7 }, (_, i) => card(rank, 'spades', 10 * n + i)) });
  const dirty = (rank, n = 1) => ({ rank, cards: [...Array.from({ length: 5 }, (_, i) => card(rank, 'clubs', 10 * n + i)), card('2', 'clubs', 10 * n), card('JK', 'joker', 10 * n)] });
  /** Seat 0 to play, in their foot, with the books to go out and `hand` left. */
  const readyToGoOut = (hand, players = 4) => {
    const s = newGame({ players, dealer: players - 1 });
    s.initialDone[0] = true;
    s.melds[0] = [clean('K'), clean('J'), dirty('A'), dirty('Q'), dirty('10')];
    s.inFoot[0] = true;
    s.feet[0] = [];
    s.hands[0] = hand;
    return { ...s, phase: 'play', turn: 0 };
  };

  it('partners need permission to go out: ask, and your partner answers', () => {
    let s = readyToGoOut([card('7'), card('5')]);
    expect(() => act(s, { type: 'meld', seat: 0, ids: ['7-hearts-1'], rank: '7' })).toThrow();
    expect(() => act({ ...s, hands: [[card('7')], ...s.hands.slice(1)] }, { type: 'discard', seat: 0, id: '7-hearts-1' }))
      .toThrow(/Ask your partner/);
    s = act(s, { type: 'askOut', seat: 0 });
    expect(waitingFor(s)).toBe(2);                                  // now it's the partner's move
    expect(() => act(s, { type: 'discard', seat: 0, id: '7-hearts-1' })).toThrow(/Waiting for your partner/);
    expect(() => act(s, { type: 'answerOut', seat: 1, yes: true })).toThrow(/Only their partner/);
    s = act(s, { type: 'answerOut', seat: 2, yes: true });
    expect(s.moves[0]).toMatchObject({ kind: 'answerOut', seat: 2, yes: true, asker: 0 });
    expect(waitingFor(s)).toBe(0);
    s = act(s, { type: 'discard', seat: 0, id: '5-hearts-1' });
    s = act({ ...s, turn: 0, phase: 'play', outAsk: 'yes' }, { type: 'discard', seat: 0, id: '7-hearts-1' });
    expect(s.result.outBy).toBe(0);
  });

  it('a "no" holds for the rest of that turn (and melding your last cards needs a yes too)', () => {
    let s = readyToGoOut([card('7'), card('7', 'spades'), card('7', 'clubs'), card('5')]);
    s = act(act(s, { type: 'askOut', seat: 0 }), { type: 'answerOut', seat: 2, yes: false });
    expect(() => act(s, { type: 'askOut', seat: 0 })).toThrow(/already asked/);
    // Melding the 7s would leave one card, which you couldn't discard without going out
    expect(() => act(s, { type: 'meld', seat: 0, ids: ['7-hearts-1', '7-spades-1', '7-clubs-1'] })).toThrow(/not yet.*keep at least 2/);
    s = act(s, { type: 'discard', seat: 0, id: '5-hearts-1' });
    expect(s.turn).toBe(1);
    expect(s.outAsk).toBe(null);                                    // next turn, ask again
  });

  it('you can only ask to go out once your side has all its books', () => {
    const s = readyToGoOut([card('7'), card('5')]);
    s.melds[0] = s.melds[0].slice(0, 4);                          // one impure book short
    expect(() => act(s, { type: 'askOut', seat: 0 })).toThrow(/can't ask to go out until/);
  });

  it('three players (each for themselves) go out without asking', () => {
    const s = readyToGoOut([card('7')], 3);
    expect(() => act(s, { type: 'askOut', seat: 0 })).toThrow(/Only partners/);
    expect(act(s, { type: 'discard', seat: 0, id: '7-hearts-1' }).result.outBy).toBe(0);
  });

  /** Let the computer player in seat 0 play out its turn (it has drawn); returns the state after. */
  const robotTurn = s => {
    for (let i = 0; i < 40 && s.turn === 0 && s.phase === 'play'; i++) s = act(s, robotAction(s, 0, 'hard'));
    return s;
  };
  const sixAces = () => ({ rank: 'A', cards: Array.from({ length: 6 }, (_, i) => card('A', 'clubs', 30 + i)) });
  const phoebesTurn = melds => {
    const s = newGame({ players: 4, dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = melds;
    s.hands[0] = [card('2', 'clubs', 9), card('9'), card('6', 'spades'), card('4', 'diamonds')];
    return { ...s, phase: 'play', turn: 0 };
  };

  it('a computer partner won\'t spoil a pure meld with a wild card while the side still needs pure books', () => {
    // Phoebe has a wild card and the side's 6 pure aces want one more card — but a wild would make them impure
    const after = robotTurn(phoebesTurn([sixAces()]));
    const aces = after.melds[0].find(m => m.rank === 'A');
    expect(aces.cards).toHaveLength(6);
    expect(isClean(aces)).toBe(true);
  });

  it('…but once the side has its 2 pure books, a wild card can finish a book', () => {
    const after = robotTurn(phoebesTurn([sixAces(), clean('K', 5), clean('J', 6)]));
    const aces = after.melds[0].find(m => m.rank === 'A');
    expect(aces.cards).toHaveLength(7);
    expect(isClean(aces)).toBe(false);
  });

  it('a computer player asks before going out, and a computer partner answers', () => {
    // Seat 0 (a robot here) could go out by discarding its last card: it asks first
    let s = readyToGoOut([card('7')]);
    expect(robotAction(s, 0, 'hard')).toMatchObject({ type: 'askOut', seat: 0 });
    s = act(s, { type: 'askOut', seat: 0 });
    // The partner says no while it's still on its hand (its foot would count against the side)…
    s = { ...s, inFoot: [true, false, false, false] };
    expect(robotAction(s, 2, 'hard')).toEqual({ type: 'answerOut', seat: 2, yes: false });
    // …and yes once it's in its foot with little left in its hand
    s = { ...s, inFoot: [true, false, true, false], hands: s.hands.map((h, i) => (i === 2 ? [card('4'), card('5')] : h)) };
    expect(robotAction(s, 2, 'hard')).toEqual({ type: 'answerOut', seat: 2, yes: true });
  });

  it('an extra clean book counts as a dirty one for going out', () => {
    const s = dealRound();
    s.melds[0] = [clean('K'), clean('Q'), clean('J'), dirty('A'), dirty('10')];
    expect(canGoOut(s, 0)).toBe(true);
    s.melds[0] = [clean('K'), dirty('Q'), dirty('J'), dirty('A'), dirty('10')];
    expect(canGoOut(s, 0)).toBe(false);                          // only one clean book
    expect(booksToGo(s, 0)).toEqual({ clean: 1, dirty: 0 });
  });

  it('red 3s stay in your hand: they can\'t be melded, but can be discarded (and block the pile)', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.hands[0] = [card('K'), card('5')];
    s.stock.push(card('3', 'diamonds', 2), card('3', 'hearts', 2));
    s = rulesAct(s, { type: 'draw' });
    expect(s.hands[0].filter(c => c.rank === '3' && c.suit !== 'spades' && c.suit !== 'clubs')).toHaveLength(2);
    expect(() => rulesAct(s, { type: 'meld', ids: ['3-hearts-2', '3-diamonds-2', 'JK-joker-9'] })).toThrow(/3s can't be melded/);
    s = rulesAct(s, { type: 'discard', id: '3-hearts-2' });
    expect(s.discard.at(-1).id).toBe('3-hearts-2');
    s.discard = [card('4', 'clubs'), card('5', 'clubs'), card('6', 'clubs'), card('7', 'clubs'), ...s.discard];   // (enough to be taken)
    s.hands[1] = [card('3', 'spades'), card('3', 'clubs')];
    expect(() => rulesAct(s, { type: 'takePile', ids: ['3-spades-1', '3-clubs-1'] })).toThrow(/a 3 is on top/);
  });

  it('each red 3 left in a hand or foot costs 300', () => {
    let s = dealRound();
    s.hands = [[card('3', 'hearts'), card('5')], [], [], []];
    s.feet = [[], [], [card('3', 'diamonds')], []];
    s.melds = [[], []];
    const [us, them] = scoreHand({ ...s, outBy: 1 });
    expect(us.redThrees).toBe(-600);
    expect(us.left).toBe(5);
    expect(us.total).toBe(-605);
    expect(them.redThrees).toBe(-0);
  });

  it('takes only the top 5 cards of the pile', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    const pile = ['4', '5', '6', '7', '8', 'K', 'Q', '9'].map((r, i) => card(r, 'clubs', 20 + i));
    s.discard = [...pile];
    s.hands[0] = [card('9'), card('9', 'spades'), card('A')];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-spades-1'] });
    expect(s.discard.map(c => c.id)).toEqual(pile.slice(0, 3).map(c => c.id));
    expect(s.hands[0].map(c => c.rank).sort()).toEqual(['7', '8', 'A', 'K', 'Q'].sort());
  });

  it('takes the pile with one matching card and a wild card', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.discard = [card('4', 'clubs'), card('6', 'clubs'), card('7', 'clubs'), card('5', 'clubs'), card('9', 'spades')];
    s.hands[0] = [card('9'), card('2', 'clubs'), card('K'), card('K', 'clubs')];
    expect(() => rulesAct(s, { type: 'takePile', ids: ['K-hearts-1', '2-clubs-1'] })).toThrow(/one 9 and a wild card/);
    expect(() => rulesAct(s, { type: 'takePile', ids: ['9-hearts-1'] })).toThrow(/two 9s/);
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '2-clubs-1'] });
    expect(s.melds[0][0].cards.map(c => c.rank).sort()).toEqual(['2', '9', '9']);
    expect(s.hands[0].map(c => c.id)).toContain('5-clubs-1');
  });

  it('taking the pile with a wild card joins the meld you already have', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: '9', cards: [card('9', 'clubs', 5), card('9', 'clubs', 6), card('9', 'clubs', 7), card('JK', 'joker', 5), card('2', 'hearts', 5)] }];
    s.discard = [card('4', 'clubs'), card('5', 'clubs'), card('6', 'clubs'), card('7', 'clubs'), card('9', 'spades')];
    s.hands[0] = [card('9'), card('2', 'clubs'), card('K')];
    // 9s so far: 3 natural + 2 wild; adding 9, 9, 2 makes 5 natural + 3 wild — allowed, so they join it
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '2-clubs-1'] });
    expect(s.melds[0].map(m => m.cards.length)).toEqual([8]);
  });

  it('starts a new meld only when the cards can\'t join the one you have (too many wild cards)', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    // 8s so far: 3 natural + 2 wild. Adding three 8s and two 2s would make 4 wild cards — over the limit of 3
    s.melds[0] = [{ rank: '8', cards: [card('8', 'clubs', 5), card('8', 'clubs', 6), card('8', 'clubs', 7), card('JK', 'joker', 5), card('2', 'hearts', 5)] }];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('8'), card('8', 'spades'), card('8', 'diamonds'), card('2', 'clubs'), card('2', 'spades'), card('5')];
    s = rulesAct(s, { type: 'meld', ids: ['8-hearts-1', '8-spades-1', '8-diamonds-1', '2-clubs-1', '2-spades-1'] });
    expect(s.melds[0].map(m => m.cards.length)).toEqual([5, 5]);    // on their own: 3 natural + 2 wild
  });

  it('taking the pile adds to the meld you already have of that rank', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: '9', cards: Array.from({ length: 5 }, (_, i) => card('9', 'clubs', 5 + i)) }];
    s.discard = [card('4', 'clubs'), card('5', 'clubs'), card('6', 'clubs'), card('7', 'clubs'), card('9', 'spades')];
    s.hands[0] = [card('9'), card('9', 'diamonds'), card('K')];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-diamonds-1'] });
    expect(s.melds[0]).toHaveLength(1);
    expect(s.melds[0][0].cards).toHaveLength(8);                  // 5 + the 9 on the pile + your two: a book
    expect(isBook(s.melds[0][0])).toBe(true);
  });

  it('taking the pile adds to the book you already have of that rank (Jones family rules)', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: '9', cards: Array.from({ length: 7 }, (_, i) => card('9', 'clubs', 5 + i)) }];
    s.discard = [card('4', 'clubs'), card('5', 'clubs'), card('6', 'clubs'), card('7', 'clubs'), card('9', 'spades')];
    s.hands[0] = [card('9'), card('9', 'diamonds'), card('K')];
    s = rulesAct(s, { type: 'takePile', ids: ['9-hearts-1', '9-diamonds-1'] });
    expect(s.melds[0]).toHaveLength(1);                           // no second meld of 9s
    expect(s.melds[0][0].cards).toHaveLength(10);                 // the book of 7 + the 9 on the pile + your two
    expect(isClean(s.melds[0][0])).toBe(true);
  });

  it('melding three of a rank you have a book of adds them to the book', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: 'K', cards: Array.from({ length: 7 }, (_, i) => card('K', 'clubs', 5 + i)) }];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('K'), card('K', 'spades'), card('K', 'diamonds'), card('5')];
    s = rulesAct(s, { type: 'meld', ids: ['K-hearts-1', 'K-spades-1', 'K-diamonds-1'] });
    expect(s.melds[0].map(m => m.cards.length)).toEqual([10]);
  });

  it('cards with a wild card start their own meld rather than spoil a clean book', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: 'K', cards: Array.from({ length: 7 }, (_, i) => card('K', 'clubs', 5 + i)) }];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('K'), card('K', 'spades'), card('2', 'clubs'), card('2', 'spades'), card('5')];
    s = rulesAct(s, { type: 'meld', ids: ['K-hearts-1', 'K-spades-1', '2-clubs-1'] });
    expect(s.melds[0].map(m => m.cards.length)).toEqual([7, 3]);
    expect(isClean(s.melds[0][0])).toBe(true);
    // A lone wild card still can't go on the clean book
    expect(() => rulesAct(s, { type: 'meld', ids: ['2-spades-1'], target: 0 })).toThrow(/pure book/);
  });

  it('melding cards of a rank you already have a meld of adds them to it', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: 'Q', cards: Array.from({ length: 5 }, (_, i) => card('Q', 'clubs', 5 + i)) }];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('Q'), card('Q', 'spades'), card('Q', 'diamonds'), card('5')];
    s = rulesAct(s, { type: 'meld', ids: ['Q-hearts-1', 'Q-spades-1', 'Q-diamonds-1'] });
    expect(s.melds[0].map(m => m.cards.length)).toEqual([8]);
  });

  it('won\'t let wild cards catch up with the natural ones on a meld', () => {
    let s = dealRound({ dealer: 3 });
    s.initialDone[0] = true;
    s.melds[0] = [{ rank: '8', cards: [card('8', 'clubs', 5), card('8', 'clubs', 6), card('8', 'clubs', 7)] }];
    s = rulesAct(s, { type: 'draw' });
    s.hands[0] = [card('2', 'clubs'), card('2', 'spades'), card('JK', 'joker'), card('5')];
    expect(() => rulesAct(s, { type: 'meld', ids: ['2-clubs-1', '2-spades-1', 'JK-joker-1'], target: 0 })).toThrow(/more natural cards than wild/);
    s = rulesAct(s, { type: 'meld', ids: ['2-clubs-1', '2-spades-1'], target: 0 });
    expect(s.melds[0][0].cards).toHaveLength(5);
    expect(() => rulesAct(s, { type: 'meld', ids: ['JK-joker-1'], target: 0 })).toThrow(/more natural cards than wild/);
  });
});

describe('Hand and Foot game engine', () => {
  it('plays whole games of four rounds, a step at a time', () => {
    for (let g = 0; g < 2; g++) {
      const s = autoplay(newGame());
      expect(s.phase).toBe('gameOver');
      expect(s.history).toHaveLength(4);
      expect(s.scores).toEqual(s.history.reduce((t, h) => [t[0] + h[0], t[1] + h[1]], [0, 0]));
      expect(s.winners.length).toBeGreaterThan(0);
    }
  });

  it('keeps all 270 cards in play through a hand', () => {
    let s = newGame();
    for (let step = 0; step < 3000 && s.phase !== 'handOver' && s.phase !== 'gameOver'; step++) {
      expect(count(s)).toBe(270);
      s = act(s, robotAction(s, waitingFor(s), 'hard'));
    }
  });

  it('books get made and players reach their feet', () => {
    let feet = 0, books = 0;
    for (let g = 0; g < 3; g++) {
      const s = autoplay(newGame(), undefined, x => x.phase === 'handOver');
      feet += s.inFoot.filter(Boolean).length;
      books += s.melds.flat().filter(isBook).length;
    }
    expect(feet).toBeGreaterThan(0);
    expect(books).toBeGreaterThan(0);
  });

  it('never sends anyone another hand, any foot, the stock or a computer player\'s plans', () => {
    const s = autoplay(newGame(), undefined, x => x.robotPlan != null);
    for (const seat of [0, 1, 2, 3]) {
      const v = JSON.parse(JSON.stringify(viewFor(s, seat)));
      expect(v.robotPlan).toBeUndefined();
      expect(v.turnStart).toBeUndefined();
      const json = JSON.stringify(v);
      const secret = [...s.stock, ...s.feet.flat(), ...[0, 1, 2, 3].filter(o => o !== seat).flatMap(o => s.hands[o])];
      for (const c of secret) expect(json).not.toContain(`"${c.id}"`);
    }
  });

  it('plays three-player games, everyone for themselves', () => {
    const start = newGame({ players: 3 });
    expect(start.hands).toHaveLength(3);
    expect(start.melds).toHaveLength(3);
    expect(count(start)).toBe(216);                              // four decks
    const s = autoplay(start, ['hard', 'medium', 'easy']);
    expect(s.phase).toBe('gameOver');
    expect(s.scores).toHaveLength(3);
    expect(s.history.every(h => h.length === 3)).toBe(true);
    expect(s.winners.every(w => s.scores[w] === Math.max(...s.scores))).toBe(true);
  });

  it('turns a three-player table round, each player bringing their side', () => {
    const s = autoplay(newGame({ players: 3 }), ['hard', 'medium', 'easy'], x => x.round === 1 && x.melds.every(m => m.length));
    for (const seat of [1, 2]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.melds[0]).toEqual(s.melds[seat]);
      expect(r.scores[0]).toBe(s.scores[seat]);
      expect(rotate(r, 3 - seat)).toEqual(s);
    }
  });

  it('turns the table round, swapping the teams for odd seats', () => {
    const s = autoplay(newGame(), undefined, x => x.round === 1 && x.melds[0].length && x.melds[1].length);
    for (const seat of [1, 2, 3]) {
      const r = rotate(s, seat);
      expect(r.hands[0]).toEqual(s.hands[seat]);
      expect(r.melds[0]).toEqual(s.melds[seat % 2]);
      expect(r.scores).toEqual(seat % 2 ? [s.scores[1], s.scores[0]] : s.scores);
      expect(rotate(r, (4 - seat) % 4)).toEqual(s);
    }
  });
});
