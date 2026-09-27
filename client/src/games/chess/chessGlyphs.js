// The solid chess symbols, used for both sides (coloured white or black when drawn),
// each followed by U+FE0E so iPads draw them as text rather than as emoji
const GLYPHS = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
export const glyph = type => `${GLYPHS[type]}︎`;
