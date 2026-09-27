/**
 * Learn to Play: short lessons, one idea each, for someone who has never
 * played chess. You always play White (at the bottom); the black pieces never
 * move unless the lesson says so.
 *
 * goal:
 *   'capture'    take every black piece (the black pieces stay put; you move again and again)
 *   'check'      make a move that gives check
 *   'escape'     your king is in check — make any move that gets it out
 *   'mate'       deliver checkmate in one move
 *   'castle'     castle (either side)
 *   'promote'    promote a pawn
 *   'enpassant'  capture en passant
 */
export const LESSONS = [
  {
    id: 'rook', emoji: '🏰', title: 'The Rook',
    intro: 'The rook moves in straight lines — up, down, left or right — as far as it likes, but it can\'t jump over pieces. It captures by landing on an enemy piece.',
    goal: 'capture', task: 'Capture all 4 black pawns with your rook.',
    fen: 'p3p3/8/8/p3p3/8/8/8/R7 w - - 0 1',
  },
  {
    id: 'bishop', emoji: '⛪', title: 'The Bishop',
    intro: 'The bishop moves diagonally, as far as it likes. Each bishop stays on the same colour of square the whole game.',
    goal: 'capture', task: 'Capture all 3 black pawns with your bishop.',
    fen: '8/4p3/8/6p1/8/4p3/8/2B5 w - - 0 1',
  },
  {
    id: 'queen', emoji: '👸', title: 'The Queen',
    intro: 'The queen is the strongest piece: she moves like a rook and a bishop together — any straight line or diagonal, as far as she likes.',
    goal: 'capture', task: 'Capture all 3 black pawns with your queen.',
    fen: '3p4/8/8/8/p6p/8/8/3Q4 w - - 0 1',
  },
  {
    id: 'knight', emoji: '🐴', title: 'The Knight',
    intro: 'The knight moves in an "L": two squares one way, then one square to the side. It\'s the only piece that can jump over others!',
    goal: 'capture', task: 'Capture all 3 black pawns with your knight.',
    fen: '8/8/5p2/3p4/8/2p5/8/1N6 w - - 0 1',
  },
  {
    id: 'king', emoji: '🤴', title: 'The King',
    intro: 'The king moves one square in any direction. He\'s the most important piece — but never move him onto a square an enemy piece attacks. (Black pawns capture diagonally downwards.)',
    goal: 'capture', task: 'Walk your king to capture both black pawns, without stepping onto an attacked square.',
    fen: '8/8/6p1/8/4p3/8/8/4K3 w - - 0 1',
  },
  {
    id: 'pawn', emoji: '♟️', title: 'The Pawn',
    intro: 'Pawns move straight forward one square (or two on their very first move), but they capture diagonally forward. They can never move backwards.',
    goal: 'capture', task: 'Capture both black pawns with your pawn. (Tip: start with a two-square move.)',
    fen: '8/2p5/8/3p4/8/8/4P3/8 w - - 0 1',
  },
  {
    id: 'check', emoji: '⚠️', title: 'Check',
    intro: 'When a piece attacks the enemy king, that\'s "check". The other player must deal with it straight away.',
    goal: 'check', task: 'Move your rook to put the black king in check.',
    fen: '4k3/8/8/8/8/8/8/K6R w - - 0 1',
  },
  {
    id: 'escape', emoji: '🏃', title: 'Getting out of Check',
    intro: 'When your king is in check you must get out of it. There are three ways: move the king to a safe square, block the attack with another piece, or capture the attacker.',
    goal: 'escape', task: 'Your king is in check from the black rook. Get out of check! (Only moves that do are allowed.)',
    fen: '4r2k/8/8/8/8/8/R7/4K3 w - - 0 1',
  },
  {
    id: 'mate1', emoji: '🏆', title: 'Checkmate',
    intro: 'Checkmate is check with no way out — the king can\'t move, the attack can\'t be blocked, and the attacker can\'t be captured. Checkmate wins the game!',
    goal: 'mate', task: 'Checkmate in one move. Look at the black king: its own pawns box it in…',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
  },
  {
    id: 'mate2', emoji: '👑', title: 'Checkmate with the Queen',
    intro: 'Your king can help! A square next to your king is one the enemy king can never step onto.',
    goal: 'mate', task: 'Checkmate in one move with your queen.',
    fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
  },
  {
    id: 'mate3', emoji: '🎯', title: 'Scholar\'s Mate',
    intro: 'The f7 square next to Black\'s king is only guarded by the king at the start. Here your queen and bishop both aim at it.',
    goal: 'mate', task: 'Checkmate in one move.',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  },
  {
    id: 'castle', emoji: '🏯', title: 'Castling',
    intro: 'Once per game, if your king and a rook haven\'t moved and the squares between them are empty (and your king isn\'t in check or crossing an attacked square), you can castle: the king moves two squares towards the rook, and the rook jumps to the other side of it.',
    goal: 'castle', task: 'Castle! Tap your king, then the square two to the left or right of it.',
    fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
  },
  {
    id: 'promote', emoji: '✨', title: 'Promotion',
    intro: 'A pawn that reaches the far side of the board turns into any piece you like — almost always a queen!',
    goal: 'promote', task: 'Move your pawn to the end of the board and promote it.',
    fen: '8/4P3/8/8/8/8/k7/7K w - - 0 1',
  },
  {
    id: 'enpassant', emoji: '🥖', title: 'En Passant',
    intro: 'A special pawn capture: if an enemy pawn moves two squares and lands right beside your pawn, on your very next move you can capture it as if it had only moved one — your pawn moves diagonally behind it.',
    goal: 'enpassant', task: 'Black just moved the pawn from d7 to d5. Capture it en passant with your e5 pawn!',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',
  },
];

export const lessonsKey = user => `chessLessons:${user?.id ?? 'guest'}`;
export function loadDone(user) {
  try { return JSON.parse(localStorage.getItem(lessonsKey(user))) ?? []; } catch { return []; }
}
export function saveDone(user, done) {
  try { localStorage.setItem(lessonsKey(user), JSON.stringify(done)); } catch { /* private mode */ }
}
