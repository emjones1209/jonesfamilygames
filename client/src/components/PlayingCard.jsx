/**
 * Shared PlayingCard component for all card games.
 * Renders a single card with suit/rank display.
 */
import { motion } from 'framer-motion';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../utils/cardEngine';

export function PlayingCard({
  card,
  onClick,
  selected = false,
  disabled = false,
  size = 'md',
  faceDown = false,
  className = '',
}) {
  const sizes = {
    xs: 'w-8 h-12 text-xs rounded-lg',
    sm: 'w-10 h-16 text-sm rounded-xl',
    md: 'w-14 h-20 text-base rounded-2xl',
    lg: 'w-20 h-28 text-lg rounded-2xl',
  };

  if (!card) return null;

  if (faceDown || !card.faceUp) {
    return (
      <motion.div
        className={`${sizes[size]} bg-blue-900 border-2 border-blue-700 flex items-center justify-center cursor-default select-none ${className}`}
        whileTap={onClick && !disabled ? { scale: 0.95 } : {}}
        onClick={disabled ? undefined : onClick}
      >
        <div className="text-blue-500 text-lg">🂠</div>
      </motion.div>
    );
  }

  const { suit, rank } = card;
  const color = SUIT_COLORS[suit];
  const symbol = SUIT_SYMBOLS[suit];

  return (
    <motion.div
      className={`
        ${sizes[size]} bg-white border-2 flex flex-col justify-between p-1 select-none
        ${selected ? 'border-primary-500 shadow-lg shadow-primary-500/50 -translate-y-2' : 'border-gray-300'}
        ${onClick && !disabled ? 'cursor-pointer hover:border-primary-400' : 'cursor-default'}
        ${disabled ? 'opacity-60' : ''}
        ${className}
      `}
      whileTap={onClick && !disabled ? { scale: 0.95 } : {}}
      onClick={disabled ? undefined : onClick}
      layout
    >
      <div className={`${color} font-bold leading-none`}>{rank}</div>
      <div className={`${color} text-center text-lg leading-none`}>{symbol}</div>
      <div className={`${color} font-bold leading-none self-end rotate-180`}>{rank}</div>
    </motion.div>
  );
}

export function EmptyCardSlot({ size = 'md', label = '', onClick, className = '' }) {
  const sizes = {
    xs: 'w-8 h-12 rounded-lg',
    sm: 'w-10 h-16 rounded-xl',
    md: 'w-14 h-20 rounded-2xl',
    lg: 'w-20 h-28 rounded-2xl',
  };
  return (
    <div
      className={`${sizes[size]} border-2 border-dashed border-white/20 flex items-center justify-center ${onClick ? 'cursor-pointer hover:border-white/40' : ''} ${className}`}
      onClick={onClick}
    >
      {label && <span className="text-white/30 text-xs">{label}</span>}
    </div>
  );
}
