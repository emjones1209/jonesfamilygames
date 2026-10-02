/**
 * Responsive text for crowded phone screens: `Wide` is only shown from iPad
 * size up (e.g. the difficulty after a game's name, or "cards" after a count),
 * `Narrow` only on phones (a shorter wording in its place).
 */
export const Wide = ({ children }) => <span className="hidden md:inline">{children}</span>;
export const Narrow = ({ children }) => <span className="md:hidden">{children}</span>;
