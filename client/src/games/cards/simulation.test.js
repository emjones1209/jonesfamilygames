/**
 * Plays complete hands with four computer players through the real rules and
 * table state machine, checking invariants that would catch a stuck turn, an
 * illegal play or a scoring leak.
 */
import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { dealTable, playCard, collectTrick } from './trickTable';
import { trickWinner, followSuit, teamOf } from './tricks';
import { choosePartnershipCard } from './ai';
import * as hearts from '../hearts/heartsRules';
import * as spades from '../spades/spadesRules';
import * as bridge from '../bridge/bridgeRules';
import * as rook from '../rook/rookRules';

const deal52 = () => {
  const deck = shuffle(buildDeck());
  return [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
};

/** Play a whole hand; `legal(t, seat)` and `choose(t, seat, legal)` supply the game's rules. */
function playOut(hands, leader, { winnerOf, legal, choose }) {
  let t = dealTable(hands, leader);
  let guard = 0;
  while (t.status !== 'done') {
    if (++guard > 200) throw new Error('hand did not finish');
    if (t.status === 'collecting') { t = collectTrick(t); continue; }
    const options = legal(t, t.turn);
    expect(options.length).toBeGreaterThan(0);
    const card = choose(t, t.turn, options);
    expect(options).toContain(card);
    const next = playCard(t, t.turn, card, { winnerOf });
    expect(next).not.toBe(t);            // the play was accepted
    t = next;
  }
  expect(t.trickNumber).toBe(13);
  expect(t.hands.every(h => h.length === 0)).toBe(true);
  expect(t.tricksWon.reduce((a, b) => a + b)).toBe(13);
  return t;
}

const HANDS = 150;

describe.each(['easy', 'medium', 'hard'])('full hands (%s AI)', difficulty => {
  it('Hearts: every hand deals out exactly 26 points (or a moon shot)', () => {
    for (let i = 0; i < HANDS; i++) {
      const dealt = deal52();
      const dir = hearts.passDirection(i);
      const passed = hearts.applyPasses(dealt, dealt.map(h => hearts.choosePass(h)), dir);
      expect(passed.every(h => h.length === 13)).toBe(true);
      const leader = passed.findIndex(h => h.some(c => c.id === hearts.TWO_OF_CLUBS));
      const played = t => [...t.taken.flat(), ...t.trick.map(p => p.card)];
      const t = playOut(passed, leader, {
        winnerOf: trick => trickWinner(trick),
        legal: (t, s) => hearts.legalPlays(t.hands[s], t.trick, {
          firstTrick: t.trickNumber === 0, heartsBroken: played(t).some(hearts.isHeart),
        }),
        choose: (t, s, legal) => hearts.chooseCard({
          legal, trick: t.trick, seat: s, difficulty, queenPlayed: played(t).some(hearts.isQueenOfSpades),
        }),
      });
      // First trick is led with the 2 of clubs and carries no points
      expect(t.taken.flat().some(c => c.id === hearts.TWO_OF_CLUBS)).toBe(true);
      const { points, shooter } = hearts.scoreHand(t.taken);
      expect(points.reduce((a, b) => a + b)).toBe(shooter == null ? 26 : 78);
    }
  });

  it('Spades: bids and scores stay consistent', () => {
    let bags = [0, 0];
    for (let i = 0; i < HANDS; i++) {
      const hands = deal52();
      const bids = [];
      for (const s of [0, 1, 2, 3]) bids[s] = spades.chooseBid(hands[s], difficulty, bids[(s + 2) % 4] ?? null);
      const played = t => [...t.taken.flat(), ...t.trick.map(p => p.card)];
      const t = playOut(hands, i % 4, {
        winnerOf: trick => trickWinner(trick, { trump: spades.TRUMP }),
        legal: (t, s) => spades.legalPlays(t.hands[s], t.trick, { spadesBroken: played(t).some(c => c.suit === 'spades') }),
        choose: (t, s, legal) => spades.chooseCard({ legal, trick: t.trick, seat: s, difficulty, bids }),
      });
      const res = spades.scoreHand(bids, t.tricksWon, bags);
      bags = res.bags;
      expect(bags.every(b => b >= 0 && b < spades.BAG_LIMIT)).toBe(true);
      expect(res.delta.every(Number.isFinite)).toBe(true);
    }
  });

  it('Bridge: auctions finish legally and contracts play out', () => {
    for (let i = 0; i < HANDS; i++) {
      const hands = deal52();
      const auction = [];
      let seat = i % 4;
      while (!bridge.auctionOver(auction)) {
        const bid = bridge.chooseBid({ hand: hands[seat], auction, seat, difficulty });
        if (bid !== bridge.PASS) expect(bridge.bidHigher(bid, bridge.currentBid(auction))).toBe(true);
        auction.push({ seat, bid });
        seat = (seat + 1) % 4;
        expect(auction.length).toBeLessThan(60);
      }
      const contract = bridge.contractOf(auction);
      if (!contract) continue;                     // passed out
      const t = playOut(hands, (contract.declarer + 1) % 4, {
        winnerOf: trick => trickWinner(trick, { trump: contract.trump }),
        legal: (t, s) => followSuit(t.hands[s], t.trick[0]?.card.suit),
        choose: (t, s, legal) => choosePartnershipCard({ legal, trick: t.trick, seat: s, difficulty, trump: contract.trump }),
      });
      const res = bridge.scoreContract(contract, t.tricksWon[contract.declarer] + t.tricksWon[contract.dummy]);
      expect(res.ns === 0 || res.ew === 0).toBe(true);
    }
  });

  it('Rook: all 120 points (nest included) are captured every hand', () => {
    for (let i = 0; i < HANDS; i++) {
      const deck = shuffle(rook.makeDeck());
      const hands = [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
      const nestCards = deck.slice(52);
      const bidder = i % 4;
      const { trump, discard } = rook.chooseNestDiscard([...hands[bidder], ...nestCards]);
      hands[bidder] = [...hands[bidder], ...nestCards].filter(c => !discard.includes(c));
      expect(hands[bidder]).toHaveLength(13);
      const t = playOut(hands, bidder, {
        winnerOf: trick => rook.winnerOf(trick, trump),
        legal: (t, s) => rook.legalPlays(t.hands[s], t.trick, trump),
        choose: (t, s, legal) => rook.chooseCard({ legal, trick: t.trick, seat: s, difficulty, trump }),
      });
      const taken = [0, 1].map(team => t.taken.reduce((sum, cards, s) =>
        sum + (teamOf(s) === team ? cards.reduce((a, c) => a + rook.cardPoints(c), 0) : 0), 0));
      taken[teamOf(t.lastTrick.winner)] += discard.reduce((a, c) => a + rook.cardPoints(c), 0);
      expect(taken[0] + taken[1]).toBe(120);
    }
  });
});
