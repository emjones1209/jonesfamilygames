/**
 * Computer-vs-computer matches used to check the difficulty levels (tests only).
 * Teams play the same deals against each other — each deal twice with the teams
 * swapped, so the luck of the cards cancels out.
 */
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { dealTable, playCard, collectTrick } from './trickTable';
import { trickWinner, followSuit, teamOf, nextSeat } from './tricks';
import { choosePartnershipCard } from './ai';
import { tableMemory } from './memory';
import * as hearts from '../hearts/heartsRules';
import * as spades from '../spades/spadesRules';
import * as bridge from '../bridge/bridgeRules';
import * as rook from '../rook/rookRules';

const DECK = buildDeck();
const ROOK_DECK = rook.makeDeck();
const deal52 = () => {
  const deck = shuffle(buildDeck());
  return [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
};

/** Play a hand out; `choose(t, seat, legal)` picks each card. */
function playOut(hands, leader, { winnerOf, legal, choose }) {
  let t = dealTable(hands, leader);
  while (t.status !== 'done') {
    if (t.status === 'collecting') { t = collectTrick(t); continue; }
    t = playCard(t, t.turn, choose(t, t.turn, legal(t, t.turn)), { winnerOf });
  }
  return t;
}

const played = t => [...t.history.flat(), ...t.trick].map(p => p.card);

// ── One hand of each game; `levels[seat]` is each seat's difficulty ──────────
// Each returns team 0's advantage in points (team 1's for Hearts is the others' average).

function spadesHand(hands, levels, dealer) {
  const bids = [];
  for (let i = 1; i <= 4; i++) {
    const s = (dealer + i) % 4;
    bids[s] = spades.chooseBid(hands[s], levels[s], bids[(s + 2) % 4] ?? null);
  }
  const t = playOut(hands, nextSeat(dealer), {
    winnerOf: trick => trickWinner(trick, { trump: spades.TRUMP }),
    legal: (t, s) => spades.legalPlays(t.hands[s], t.trick, { spadesBroken: played(t).some(c => c.suit === 'spades') }),
    choose: (t, s, legal) => spades.chooseCard({
      legal, trick: t.trick, seat: s, difficulty: levels[s], bids, tricksWon: t.tricksWon,
      memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[s], deck: DECK }),
    }),
  });
  const { delta, detail } = spades.scoreHand(bids, t.tricksWon);
  // Bags cost 100 per 10 in the long run
  const value = team => delta[team] - 10 * detail[team].overtricks;
  return value(0) - value(1);
}

function bridgeHand(hands, levels, dealer) {
  const auction = [];
  let seat = dealer;
  while (!bridge.auctionOver(auction)) {
    auction.push({ seat, bid: bridge.chooseBid({ hand: hands[seat], auction, seat, difficulty: levels[seat] }) });
    seat = nextSeat(seat);
  }
  const contract = bridge.contractOf(auction);
  if (!contract) return 0;
  const controller = s => (s === contract.dummy ? contract.declarer : s);
  const t = playOut(hands, nextSeat(contract.declarer), {
    winnerOf: trick => trickWinner(trick, { trump: contract.trump }),
    legal: (t, s) => followSuit(t.hands[s], t.trick[0]?.card.suit),
    choose: (t, s, legal) => choosePartnershipCard({
      legal, trick: t.trick, seat: s, difficulty: levels[controller(s)], trump: contract.trump,
      trumpTeam: teamOf(contract.declarer),
      memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[s], deck: DECK }),
    }),
  });
  const res = bridge.scoreContract(contract, t.tricksWon[contract.declarer] + t.tricksWon[contract.dummy]);
  return res.ns - res.ew;
}

function rookHand(deck, levels, dealer) {
  const hands = [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
  const nestCards = deck.slice(52);
  // Auction: bid or pass in turn until one bidder is left (last one must bid if all pass)
  const passed = [false, false, false, false];
  let high = { bid: 0, seat: null }, s = nextSeat(dealer);
  for (;;) {
    let bid = rook.chooseBid(hands[s], high.bid, levels[s]);
    if (bid === 'pass' && high.seat == null && passed.filter(Boolean).length === 3) bid = rook.MIN_BID;
    if (bid === 'pass') passed[s] = true; else high = { bid, seat: s };
    const active = [0, 1, 2, 3].filter(x => !passed[x]);
    if ((active.length === 1 && high.seat === active[0]) || high.bid >= rook.MAX_BID) break;
    do s = nextSeat(s); while (passed[s]);
  }
  const bidder = high.seat;
  const { trump, discard } = rook.chooseNestDiscard([...hands[bidder], ...nestCards], levels[bidder]);
  hands[bidder] = [...hands[bidder], ...nestCards].filter(c => !discard.includes(c));
  const t = playOut(hands, bidder, {
    winnerOf: trick => rook.winnerOf(trick, trump),
    legal: (t, x) => rook.legalPlays(t.hands[x], t.trick, trump),
    choose: (t, x, legal) => rook.chooseCard({
      legal, trick: t.trick, seat: x, difficulty: levels[x], trump, trumpTeam: teamOf(bidder),
      memory: tableMemory({
        history: t.history, trick: t.trick, deck: ROOK_DECK, suitOf: rook.suitWith(trump), rankOf: rook.rankOf,
        hand: x === bidder ? [...t.hands[x], ...discard] : t.hands[x],   // the bidder knows the nest
      }),
    }),
  });
  const taken = [0, 1].map(team => t.taken.reduce((sum, cards, x) =>
    sum + (teamOf(x) === team ? cards.reduce((a, c) => a + rook.cardPoints(c), 0) : 0), 0));
  taken[teamOf(t.lastTrick.winner)] += discard.reduce((a, c) => a + rook.cardPoints(c), 0);
  const { delta } = rook.scoreHand(teamOf(bidder), high.bid, taken);
  return delta[0] - delta[1];
}

/** Hearts: the player at `hero` against three others; returns others' average points minus hero's. */
function heartsHand(dealt, levels, hero, handNumber) {
  const dir = hearts.passDirection(handNumber);
  const hands = dir === 'hold' ? dealt
    : hearts.applyPasses(dealt.map(h => [...h]), dealt.map((h, s) => hearts.choosePass(h, levels[s])), dir);
  const leader = hands.findIndex(h => h.some(c => c.id === hearts.TWO_OF_CLUBS));
  const pointsSoFar = t => t.taken.map(cards => cards.reduce((a, c) => a + hearts.cardPoints(c), 0));
  const t = playOut(hands, leader, {
    winnerOf: trick => trickWinner(trick),
    legal: (t, s) => hearts.legalPlays(t.hands[s], t.trick, {
      firstTrick: t.trickNumber === 0, heartsBroken: played(t).some(hearts.isHeart),
    }),
    choose: (t, s, legal) => hearts.chooseCard({
      legal, trick: t.trick, seat: s, difficulty: levels[s], queenPlayed: played(t).some(hearts.isQueenOfSpades),
      pointsTaken: pointsSoFar(t),
      memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[s], deck: DECK }),
    }),
  });
  const { points } = hearts.scoreHand(t.taken);
  const others = points.filter((_, s) => s !== hero);
  return others.reduce((a, b) => a + b, 0) / 3 - points[hero];
}

// ── Duplicate matches ────────────────────────────────────────────────────────
/** Points per hand that level `a` gains over level `b`: { mean, se } (se = standard error). */
export function edge(game, a, b, deals) {
  const samples = [];
  for (let i = 0; i < deals; i++) {
    const dealer = i % 4;
    if (game === 'hearts') {
      const dealt = deal52(), hero = i % 4;
      samples.push(heartsHand(dealt, [0, 1, 2, 3].map(s => (s === hero ? a : b)), hero, i));
      continue;
    }
    const cards = game === 'rook' ? shuffle(rook.makeDeck()) : deal52();
    const run = levels => (game === 'spades' ? spadesHand(cards.map(h => [...h]), levels, dealer)
      : game === 'bridge' ? bridgeHand(cards.map(h => [...h]), levels, dealer)
      : rookHand(cards, levels, dealer));
    samples.push((run([a, b, a, b]) - run([b, a, b, a])) / 2);   // same cards, teams swapped
  }
  const mean = samples.reduce((x, y) => x + y, 0) / deals;
  const sd = Math.sqrt(samples.reduce((x, y) => x + (y - mean) ** 2, 0) / (deals - 1));
  return { mean, se: sd / Math.sqrt(deals) };
}

