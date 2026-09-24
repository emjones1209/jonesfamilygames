import { describe, it, expect } from 'vitest';
import { buildDeck } from '../../utils/cardEngine';
import { tableMemory } from './memory';
import { choosePartnershipCard } from './ai';

const DECK = buildDeck();
const card = id => DECK.find(c => c.id === id);
const plays = (...list) => list.map(([id, seat]) => ({ card: card(id), seat }));

describe('card memory', () => {
  const history = [plays(['A-hearts', 0], ['3-hearts', 1], ['5-clubs', 2], ['4-hearts', 3])];
  const mem = tableMemory({ history, trick: [], hand: [card('K-hearts'), card('2-spades')], deck: DECK });

  it('knows who has run out of a suit', () => {
    expect(mem.voids[2].has('hearts')).toBe(true);
    expect(mem.voids[1].has('hearts')).toBe(false);
    expect(mem.mayHold(2, 'hearts')).toBe(false);
  });

  it('knows a card is the highest left in its suit', () => {
    expect(mem.isMaster(card('K-hearts'))).toBe(true);     // the ace has gone
    expect(mem.isMaster(card('2-spades'))).toBe(false);
    expect(mem.outOf('hearts')).toHaveLength(13 - 4);       // 13 minus A, 3, 4 and our K
  });
});

describe('hard partnership play', () => {
  it('cashes a card that can no longer be beaten', () => {
    const history = [plays(['A-hearts', 1], ['3-hearts', 2], ['5-hearts', 3], ['4-hearts', 0])];
    const hand = [card('K-hearts'), card('6-clubs'), card('9-diamonds')];
    const memory = tableMemory({ history, trick: [], hand, deck: DECK });
    expect(choosePartnershipCard({ legal: hand, trick: [], seat: 0, difficulty: 'hard', memory }).id).toBe('K-hearts');
  });

  it("doesn't overtake partner's unbeatable card", () => {
    const trick = plays(['A-clubs', 2], ['3-clubs', 3]);
    const hand = [card('K-clubs'), card('4-clubs')];
    const memory = tableMemory({ trick, hand, deck: DECK });
    expect(choosePartnershipCard({ legal: hand, trick, seat: 0, difficulty: 'hard', memory }).id).toBe('4-clubs');
  });
});
