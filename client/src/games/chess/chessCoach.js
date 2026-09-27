/**
 * The chess coach: plain-English help for someone learning the game.
 *
 * - hanging(pos, colour): pieces that could be taken for free (attacked and
 *   not defended, or attacked by something worth less)
 * - warnMove(pos, move): a warning before a move that gives a piece away or
 *   lets the opponent checkmate
 * - explainMove(pos, move): why a (suggested) move is good
 * - threatsAfter(pos, colour): what the opponent's last move threatens
 */
import {
  K, P, NAMES, legalMoves, afterMove, attackersOf, inCheck, outcome, squareName, typeOf, colourOf, row,
} from './chessRules.js';
import { VALUE } from './chessAI.js';

const name = p => NAMES[typeOf(p)];
const worth = p => (typeOf(p) === K ? 10000 : VALUE[typeOf(p)]);

/**
 * `colour`'s pieces that the other side could take and come out ahead:
 * [{ square, piece, attacker }] (attacker = the cheapest piece that could take it).
 */
export function hanging(pos, colour) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = pos.sq[i];
    if (!p || colourOf(p) !== colour || typeOf(p) === K) continue;
    const attackers = attackersOf(pos.sq, i, -colour);
    if (!attackers.length) continue;
    const cheapest = attackers.reduce((a, b) => (worth(pos.sq[b]) < worth(pos.sq[a]) ? b : a));
    const defended = attackersOf(pos.sq, i, colour).length > 0;
    if (!defended || worth(pos.sq[cheapest]) < worth(p)) out.push({ square: i, piece: p, attacker: cheapest });
  }
  return out;
}

/** Could the side to move checkmate right now? Returns that move, or null. */
export function mateInOne(pos) {
  for (const m of legalMoves(pos)) if (outcome(afterMove(pos, m)) === 'checkmate') return m;
  return null;
}

/**
 * A warning (text) before `move`, or null if it looks safe: it lets the other
 * side checkmate straight away, or leaves a piece to be taken for free.
 */
export function warnMove(pos, move) {
  const me = pos.turn;
  const after = afterMove(pos, move);
  if (outcome(after) === 'checkmate') return null;                 // it wins!
  const mate = mateInOne(after);
  if (mate) return `This lets your opponent checkmate you with their ${name(mate.piece)} on ${squareName(mate.to)}!`;
  const before = new Set(hanging(pos, me).map(h => h.square));
  const gained = move.captured ? worth(move.captured) : 0;
  // A newly loose piece, worth more than whatever this move captures (an even trade is fine)
  const loose = hanging(after, me)
    .filter(h => !before.has(h.square) || h.square === move.to)
    .filter(h => worth(h.piece) > gained && worth(h.piece) >= VALUE[P])
    .sort((a, b) => worth(b.piece) - worth(a.piece))[0];
  if (!loose) return null;
  const moved = loose.square === move.to;
  return `${moved ? 'Your' : 'This leaves your'} ${name(loose.piece)} on ${squareName(loose.square)} ${moved ? 'could be' : 'to be'} taken by their ${name(after.sq[loose.attacker])}.`;
}

const CENTRE = new Set(['d4', 'e4', 'd5', 'e5']);

/** Why a move is good, in a few plain sentences. */
export function explainMove(pos, move) {
  const me = pos.turn;
  const after = afterMove(pos, move);
  const reasons = [];
  const end = outcome(after);
  if (end === 'checkmate') return ['Checkmate! Their king is attacked and has no way out — you win! 🎉'];
  if (move.captured) {
    const theirs = name(move.captured), mine = name(move.piece);
    const safe = !attackersOf(after.sq, move.to, -me).length;
    if (safe) reasons.push(`Takes their ${theirs} for free — it can't be taken back.`);
    else if (worth(move.captured) > worth(move.piece)) reasons.push(`Takes their ${theirs} with your ${mine}: even if they take back, you win more than you lose.`);
    else reasons.push(`Trades your ${mine} for their ${theirs}.`);
  }
  if (move.promo) reasons.push(`Turns your pawn into a ${NAMES[move.promo]}!`);
  if (move.flag === 'castle') reasons.push('Castles: tucks your king away safely and brings your rook into the game.');
  if (inCheck(after)) reasons.push('Puts their king in check — they have to deal with it.');
  const wasLoose = hanging(pos, me).some(h => h.square === move.from);
  if (wasLoose && !hanging(after, me).some(h => h.square === move.to)) reasons.push(`Moves your ${name(move.piece)} out of danger.`);
  const saved = hanging(pos, me).filter(h => h.square !== move.from && !hanging(after, me).some(x => x.square === h.square));
  if (saved.length && !move.captured) reasons.push(`Protects your ${name(saved[0].piece)} on ${squareName(saved[0].square)}.`);
  if (pos.full <= 10 && [2, 3].includes(typeOf(move.piece)) && row(move.from) === (me > 0 ? 7 : 0)) {
    reasons.push(`Gets your ${name(move.piece)} off the back row and into the game.`);
  }
  if (typeOf(move.piece) === P && CENTRE.has(squareName(move.to))) reasons.push('Puts a pawn in the middle of the board, where it controls important squares.');
  const targets = hanging(after, -me).filter(h => after.sq[h.attacker] && h.attacker === move.to);
  if (targets.length && !inCheck(after)) reasons.push(`Attacks their ${name(targets[0].piece)} on ${squareName(targets[0].square)}.`);
  if (!reasons.length) reasons.push('A solid move that keeps your pieces safe.');
  return reasons;
}

/**
 * What the opponent's last move means for `colour` (now to move): check, and
 * pieces of theirs that are now under attack.
 */
export function threatsAfter(pos, colour) {
  const notes = [];
  if (inCheck(pos, colour)) notes.push('Check! Your king is under attack — move it, block the attack, or capture the attacker.');
  const loose = hanging(pos, colour).sort((a, b) => worth(b.piece) - worth(a.piece));
  if (loose.length) {
    const h = loose[0];
    notes.push(`Watch out: your ${name(h.piece)} on ${squareName(h.square)} could be taken by their ${name(pos.sq[h.attacker])}.`);
  }
  return notes;
}
