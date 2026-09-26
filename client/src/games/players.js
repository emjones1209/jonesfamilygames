/**
 * The computer players' names, used by every game (and by robots at
 * play-together tables): Phoebe sits on your left, Xavier across (your partner
 * in the partnership games) and Heraldo on your right. In a two-player game
 * you play Phoebe.
 */
export const COMPUTER_NAMES = ['Phoebe', 'Xavier', 'Heraldo'];

/** Names round a table of `players`, starting with you: e.g. 3 → You, Phoebe, Xavier. */
export const tableNames = players => ['You', ...COMPUTER_NAMES.slice(0, players - 1)];
