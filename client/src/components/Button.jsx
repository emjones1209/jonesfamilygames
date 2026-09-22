import { motion } from 'framer-motion';

export function Button({ children, variant = 'primary', className = '', disabled, onClick, type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-150 active:scale-95 min-h-[52px] px-6 text-base cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:   'bg-primary-600 hover:bg-primary-500 text-white',
    secondary: 'bg-game-accent hover:bg-opacity-80 text-white',
    danger:    'bg-game-red hover:bg-opacity-80 text-white',
    ghost:     'bg-white/10 hover:bg-white/20 text-white',
    gold:      'bg-game-gold hover:opacity-90 text-game-bg font-bold',
  };
  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.button>
  );
}
