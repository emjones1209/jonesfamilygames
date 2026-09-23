// Card dimensions shared by every card game (standard cards, Rook cards, Golf's
// jokers and empty card slots), so they all line up. Cards grow on iPad-sized
// screens (md, ≥768px) and again on larger ones (lg, ≥1024px); phones keep the
// compact sizes. Class names are written out in full so Tailwind can find them.

export const CARD_BOX = {
  xs: 'w-8 h-12 md:w-12 md:h-[4.5rem] lg:w-14 lg:h-20',
  sm: 'w-10 h-16 md:w-16 md:h-24 lg:w-20 lg:h-[7.5rem]',
  md: 'w-14 h-20 md:w-20 md:h-[7.5rem] lg:w-24 lg:h-36',
  lg: 'w-20 h-28 md:w-28 md:h-40',
};

export const CARD_TEXT = {
  xs: 'text-xs md:text-base lg:text-lg',
  sm: 'text-sm md:text-lg lg:text-xl',
  md: 'text-base md:text-xl lg:text-2xl',
  lg: 'text-lg md:text-2xl',
};

export const CARD_ROUND = { xs: 'rounded-lg', sm: 'rounded-xl', md: 'rounded-2xl', lg: 'rounded-2xl' };

/** Box, text size and corner rounding for a card of the given size. */
export const cardClasses = size => `${CARD_BOX[size]} ${CARD_TEXT[size]} ${CARD_ROUND[size]}`;
