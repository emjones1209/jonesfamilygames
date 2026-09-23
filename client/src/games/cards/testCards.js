// Test helper: terse card builder. c('QS') → queen of spades, c('10H') → ten of hearts
const SUIT = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

export const c = code => {
  const rank = code.slice(0, -1), suit = SUIT[code.slice(-1)];
  return { id: `${rank}-${suit}`, rank, suit, faceUp: true };
};

export const cards = codes => codes.split(' ').map(c);
