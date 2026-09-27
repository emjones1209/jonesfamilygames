/**
 * BoardGrid — a square board of squares (8×8 by default) for Checkers and
 * Chess. The squares take the taps; pieces are drawn on top, each sliding to
 * its new square when it moves (so a piece keeps the same `id` as it moves).
 *
 * `marks` puts hints on squares, by "row,col" key — a list of any of:
 *   'selected'  the piece you picked up          'target'   a square it can move to (a dot)
 *   'capture'   a move that captures (a ring)    'last'     the last move's squares (tinted)
 *   'danger'    your piece that can be taken     'hint'     the suggested move (green)
 *   'movable'   a piece that can move now (when you must choose, e.g. a forced jump)
 *   'check'     a king in check (a red glow)
 */
import { motion, AnimatePresence } from 'framer-motion';

const pct = (i, size) => `${(100 * i) / size}%`;

export function BoardGrid({
  size = 8,
  isDark = (r, c) => (r + c) % 2 === 1,
  marks = {},
  onSquare,
  pieces = [],                    // [{ id, row, col, node }]
  colors = { light: '#f0d9b5', dark: '#b58863' },
  label,                          // optional (r, c) => small text in the corner (e.g. chess files and ranks)
}) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl select-none"
      style={{
        width: 'min(calc(100vw - 24px), calc(100dvh - 250px), 640px)', aspectRatio: '1',
        containerType: 'inline-size', touchAction: 'manipulation',
      }}>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }, (_, i) => {
          const r = Math.floor(i / size), c = i % size;
          const m = marks[`${r},${c}`] ?? [];
          const has = k => m.includes(k);
          const dark = isDark(r, c);
          return (
            <button key={i} type="button" onClick={onSquare ? () => onSquare(r, c) : undefined}
              aria-label={`row ${r + 1}, column ${c + 1}`}
              className="relative flex items-center justify-center"
              style={{ background: dark ? colors.dark : colors.light, cursor: onSquare ? 'pointer' : 'default' }}>
              {has('last') && <span className="absolute inset-0" style={{ background: 'rgba(250, 204, 21, 0.35)' }} />}
              {has('hint') && <span className="absolute inset-0" style={{ background: 'rgba(74, 222, 128, 0.45)' }} />}
              {has('check') && <span className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(239, 68, 68, 0.9) 20%, rgba(239, 68, 68, 0) 75%)' }} />}
              {has('selected') && <span className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 4px #facc15' }} />}
              {has('movable') && <span className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 3px rgba(250, 204, 21, 0.8)' }} />}
              {has('target') && <span className="absolute rounded-full" style={{ width: '30%', height: '30%', background: 'rgba(0, 0, 0, 0.35)' }} />}
              {has('capture') && <span className="absolute rounded-full" style={{ inset: '6%', boxShadow: 'inset 0 0 0 5px rgba(0, 0, 0, 0.35)' }} />}
              {label && (
                <span className="absolute left-0.5 top-0 font-semibold" style={{ fontSize: '2.2cqw', color: dark ? colors.light : colors.dark }}>
                  {label(r, c)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pieces: they don't take taps (the square under them does) */}
      <AnimatePresence>
        {pieces.map(p => {
          const danger = (marks[`${p.row},${p.col}`] ?? []).includes('danger');
          return (
            <motion.div key={p.id} className="absolute pointer-events-none flex items-center justify-center"
              style={{ width: pct(1, size), height: pct(1, size) }}
              initial={false}
              animate={{ left: pct(p.col, size), top: pct(p.row, size), opacity: 1 }}
              exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.35 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
              {p.node}
              {danger && <span className="absolute rounded-full animate-pulse" style={{ inset: '4%', boxShadow: '0 0 0 4px #ef4444' }} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
