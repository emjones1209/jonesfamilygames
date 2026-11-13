import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../../components/Button';
import { FLOWERS } from './match3Logic';

// Between levels, the garden's flowers put on a little show. Each level gets
// the next show in turn, so two wins in a row never look the same.

// Flowers grow up out of the ground on stems, then sway in the breeze
function Bloom() {
  const row = FLOWERS;
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-around items-end px-4">
      {row.map((f, i) => {
        const tall = 70 + ((i * 37) % 50);   // a mix of heights
        return (
          <motion.div key={i} className="flex flex-col items-center origin-bottom"
            animate={{ rotate: [0, 6, 0, -6, 0] }}
            transition={{ delay: 1 + i * 0.15, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
            <motion.span className="text-3xl sm:text-4xl leading-none"
              initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 260, damping: 12 }}>
              {f}
            </motion.span>
            <motion.div className="w-1.5 bg-green-500 rounded-full origin-bottom relative"
              style={{ height: tall }}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.15, duration: 0.5, ease: 'easeOut' }}>
              <span className="absolute top-1/2 -left-2.5 text-sm" style={{ transform: 'rotate(-30deg)' }}>🍃</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Flowers flutter down from the sky, spinning as they fall
function Shower() {
  const drops = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    f: FLOWERS[i % FLOWERS.length],
    left: Math.random() * 92,
    delay: Math.random() * 2.5,
    dur: 2.2 + Math.random() * 1.6,
    spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
    drift: (Math.random() - 0.5) * 60,
    size: 1.5 + Math.random() * 1.2,
  })), []);
  return drops.map((d, i) => (
    <motion.span key={i} className="absolute top-0 leading-none"
      style={{ left: `${d.left}%`, fontSize: `${d.size}rem` }}
      initial={{ y: -50, x: 0, rotate: 0, opacity: 0 }}
      animate={{ y: 240, x: [0, d.drift, -d.drift / 2, d.drift], rotate: d.spin, opacity: [0, 1, 1, 0] }}
      transition={{ delay: d.delay, duration: d.dur, repeat: Infinity, ease: 'linear' }}>
      {d.f}
    </motion.span>
  ));
}

// A bouquet bursts open from the middle, then the ring of flowers twirls
function Burst() {
  const ring = [...FLOWERS, ...FLOWERS];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div className="relative w-0 h-0"
        animate={{ rotate: 360 }}
        transition={{ delay: 1, duration: 8, repeat: Infinity, ease: 'linear' }}>
        {ring.map((f, i) => {
          const a = (i / ring.length) * Math.PI * 2;
          return (
            <motion.span key={i} className="absolute text-3xl leading-none -translate-x-1/2 -translate-y-1/2"
              initial={{ x: 0, y: 0, scale: 0 }}
              animate={{ x: Math.cos(a) * 85, y: Math.sin(a) * 85, scale: [0, 1.4, 1] }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.7, ease: 'easeOut' }}>
              {f}
            </motion.span>
          );
        })}
      </motion.div>
      <motion.span className="absolute text-6xl leading-none"
        initial={{ scale: 1.6 }} animate={{ scale: [1.6, 0.6, 1, 1.12, 1] }}
        transition={{ duration: 1.2, times: [0, 0.3, 0.6, 0.8, 1] }}>
        💐
      </motion.span>
    </div>
  );
}

// The flowers march across in a hopping parade, led by a bee
function Parade() {
  const line = ['🐝', ...FLOWERS];
  return (
    <motion.div className="absolute bottom-10 flex gap-3"
      initial={{ x: '-110%', left: 0 }} animate={{ x: '0%', left: '100%' }}
      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
      {line.reverse().map((f, i) => (
        <motion.span key={i} className="text-3xl sm:text-4xl leading-none inline-block"
          animate={{ y: [0, -28, 0], rotate: [0, -12, 0, 12, 0], scaleY: [1, 1.08, 0.85, 1] }}
          transition={{ delay: i * 0.12, duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}>
          {f}
        </motion.span>
      ))}
    </motion.div>
  );
}

// Each flower takes a turn springing up and spinning, like a wave through the crowd
function Wave() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-1">
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="text-3xl sm:text-5xl leading-none inline-block"
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, 0, -50, 0, 0], rotate: [0, 0, 360, 360, 360] }}
          transition={{
            scale: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 14 },
            default: { delay: 0.6 + i * 0.18, duration: 2.2, times: [0, 0.1, 0.35, 0.55, 1], repeat: Infinity, ease: 'easeInOut' },
          }}>
          {f}
        </motion.span>
      ))}
    </div>
  );
}

// A little rain cloud drifts over and waters the garden; flowers spring up behind it
function RainCloud() {
  const drops = useMemo(() => Array.from({ length: 14 }, () => ({
    left: 15 + Math.random() * 70, delay: Math.random() * 1.2, dur: 0.7 + Math.random() * 0.4,
  })), []);
  return (
    <>
      <motion.div className="absolute top-2 left-0 right-0 flex justify-center"
        animate={{ x: [-20, 20, -20] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="text-6xl leading-none">🌧️</span>
      </motion.div>
      {drops.map((d, i) => (
        <motion.span key={i} className="absolute top-14 text-sm leading-none" style={{ left: `${d.left}%` }}
          initial={{ y: 0, opacity: 0 }} animate={{ y: 110, opacity: [0, 1, 1, 0] }}
          transition={{ delay: d.delay, duration: d.dur, repeat: Infinity, ease: 'easeIn' }}>
          💧
        </motion.span>
      ))}
      <div className="absolute inset-x-0 bottom-4 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl sm:text-4xl leading-none origin-bottom inline-block"
            initial={{ scaleY: 0, scaleX: 0.4, opacity: 0 }}
            animate={{ scaleY: 1, scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.8 + i * 0.3, type: 'spring', stiffness: 220, damping: 10 }}>
            {f}
          </motion.span>
        ))}
      </div>
    </>
  );
}

// Butterflies loop and swoop over a row of nodding flowers
function Butterflies() {
  const flights = [
    { x: [-120, -40, 40, 120, 40, -40, -120], y: [-20, -70, -20, -60, -90, -30, -20], dur: 5 },
    { x: [110, 30, -60, -110, -30, 60, 110], y: [-80, -30, -70, -20, -60, -90, -80], dur: 6 },
    { x: [0, 80, 0, -80, 0], y: [-100, -50, -10, -50, -100], dur: 4 },
  ];
  return (
    <>
      <div className="absolute inset-x-0 bottom-4 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl leading-none origin-bottom inline-block"
            animate={{ rotate: [0, 8, 0, -8, 0] }}
            transition={{ delay: i * 0.2, duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            {f}
          </motion.span>
        ))}
      </div>
      {flights.map((fl, i) => (
        <motion.span key={i} className="absolute left-1/2 bottom-12 text-3xl leading-none -ml-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: fl.x, y: fl.y, scaleX: [1, 0.4, 1, 0.4, 1] }}
          transition={{
            opacity: { delay: i * 0.3 },
            scaleX: { duration: 0.35, repeat: Infinity },   // flapping wings
            default: { duration: fl.dur, repeat: Infinity, ease: 'easeInOut' },
          }}>
          🦋
        </motion.span>
      ))}
    </>
  );
}

// The sun comes up, the sky warms, and sleepy flowers lift their heads
function Sunrise() {
  return (
    <>
      <motion.div className="absolute inset-0 bg-gradient-to-b from-orange-300/40 to-yellow-200/10"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }} />
      <motion.div className="absolute left-0 right-0 flex justify-center"
        initial={{ top: 230 }} animate={{ top: 16 }} transition={{ duration: 2, ease: 'easeOut' }}>
        <motion.span className="text-7xl leading-none inline-block"
          animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}>
          ☀️
        </motion.span>
      </motion.div>
      <div className="absolute inset-x-0 bottom-4 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl sm:text-4xl leading-none origin-bottom inline-block"
            initial={{ rotate: i % 2 ? 50 : -50, scale: 0.7, opacity: 0.5 }}
            animate={{ rotate: 0, scale: [0.7, 1.25, 1], opacity: 1 }}
            transition={{ delay: 1.6 + i * 0.15, duration: 0.6 }}>
            {f}
          </motion.span>
        ))}
      </div>
    </>
  );
}

// Flowers shoot up like rockets and burst into rings of petals
function Fireworks() {
  const bursts = [
    { left: 25, top: 30, f: FLOWERS[0], delay: 0 },
    { left: 70, top: 22, f: FLOWERS[2], delay: 0.7 },
    { left: 48, top: 45, f: FLOWERS[1], delay: 1.4 },
    { left: 80, top: 55, f: FLOWERS[5], delay: 2.1 },
    { left: 18, top: 60, f: FLOWERS[3], delay: 2.8 },
  ];
  const CYCLE = 3.5;
  return bursts.map((b, i) => (
    <div key={i} className="absolute w-0 h-0" style={{ left: `${b.left}%`, top: `${b.top}%` }}>
      {/* the rocket */}
      <motion.span className="absolute text-xl leading-none -translate-x-1/2 -translate-y-1/2"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: [200, 0], opacity: [1, 1, 0] }}
        transition={{ delay: b.delay, duration: 0.6, ease: 'easeOut', repeat: Infinity, repeatDelay: CYCLE - 0.6 }}>
        ✨
      </motion.span>
      {/* the burst */}
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return (
          <motion.span key={k} className="absolute text-2xl leading-none -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: Math.cos(a) * 45, y: [0, Math.sin(a) * 45, Math.sin(a) * 45 + 15], opacity: [0, 1, 0], scale: [0, 1, 0.6] }}
            transition={{ delay: b.delay + 0.6, duration: 1.2, ease: 'easeOut', repeat: Infinity, repeatDelay: CYCLE - 1.2 }}>
            {b.f}
          </motion.span>
        );
      })}
    </div>
  ));
}

// Seeds sprout into shoots, then leaves, then flowers, one after another
function Sprouts() {
  const stages = ['🌰', '🌱', '🌿'];
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-around px-4">
      {FLOWERS.map((f, i) => {
        const start = 0.3 + i * 0.25;
        return (
          <div key={i} className="relative flex flex-col items-center">
            <div className="relative w-10 h-10">
              {stages.map((s, k) => (
                <motion.span key={k} className="absolute inset-0 flex items-end justify-center text-3xl leading-none"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8] }}
                  transition={{ delay: start + k * 0.55, duration: 0.6, times: [0, 0.2, 0.85, 1] }}>
                  {s}
                </motion.span>
              ))}
              <motion.span className="absolute inset-0 flex items-end justify-center text-4xl leading-none origin-bottom"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, 0, 6, 0, -6, 0] }}
                transition={{
                  opacity: { delay: start + 1.65, duration: 0.1 },
                  scale: { delay: start + 1.65, type: 'spring', stiffness: 300, damping: 9 },
                  rotate: { delay: start + 2.2, duration: 2, repeat: Infinity },
                }}>
                {f}
              </motion.span>
            </div>
            <div className="w-9 h-2 rounded-full bg-amber-900/70 -mt-0.5" />
          </div>
        );
      })}
    </div>
  );
}

// Flowers float up and away like balloons on strings
function Balloons() {
  const balloons = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    f: FLOWERS[i % FLOWERS.length],
    left: 6 + ((i * 41) % 84),
    delay: (i * 0.45) % 4,
    dur: 4 + (i % 3),
    sway: 10 + (i % 4) * 5,
  })), []);
  return balloons.map((b, i) => (
    <motion.div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${b.left}%` }}
      initial={{ y: 80 }}
      animate={{ y: -300, x: [0, b.sway, -b.sway, b.sway, 0] }}
      transition={{ delay: b.delay, duration: b.dur, repeat: Infinity, ease: 'linear' }}>
      <span className="text-3xl leading-none">{b.f}</span>
      <motion.div className="w-px h-12 bg-white/60 origin-top"
        animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 1.5, repeat: Infinity }} />
    </motion.div>
  ));
}

// A rainbow paints itself across the sky and the flowers slide down it
function Rainbow() {
  const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
  const CX = 130, CY = 140, RIDE = 100;
  // Points along the arc from left to right, for the flowers to follow
  const steps = 16;
  const xs = [], ys = [];
  for (let s = 0; s <= steps; s++) {
    const a = Math.PI - (s / steps) * Math.PI;
    xs.push(Math.cos(a) * RIDE);
    ys.push(-Math.sin(a) * RIDE - 18);
  }
  return (
    <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 20, width: 260, height: 140 }}>
      <svg width="260" height="140" viewBox="0 0 260 140" className="absolute inset-0 overflow-visible">
        {colors.map((c, i) => {
          const r = 124 - i * 8;
          return (
            <motion.path key={c} d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`}
              fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" strokeOpacity="0.85"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ delay: i * 0.1, duration: 1.2, ease: 'easeInOut' }} />
          );
        })}
      </svg>
      <div className="absolute w-0 h-0" style={{ left: CX, top: CY }}>
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="absolute text-3xl leading-none -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, x: xs[0], y: ys[0] }}
            animate={{ x: xs, y: ys, rotate: 360, opacity: [0, 1, 1, 1, 0] }}
            transition={{ delay: 1.4 + i * 0.5, duration: 3, repeat: Infinity, repeatDelay: FLOWERS.length * 0.5 - 3 + 0.5, ease: 'easeInOut' }}>
            {f}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// A busy bee zips from flower to flower, and each one bounces when it's visited
function BusyBee() {
  const n = FLOWERS.length, D = 6;
  const pos = i => `${((i + 0.5) / n) * 100}%`;
  const left = [], y = [];
  for (let i = 0; i < n; i++) { left.push(pos(i), pos(i)); y.push(-40, 0); }
  left.push('110%'); y.push(-60);
  left.unshift('-10%'); y.unshift(-60);
  const steps = left.length - 1;
  return (
    <div className="absolute inset-x-4 bottom-4 top-0">
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="absolute bottom-0 text-3xl sm:text-4xl leading-none -translate-x-1/2 origin-bottom"
          style={{ left: pos(i) }}
          animate={{ scale: [1, 1.35, 0.9, 1], rotate: [0, -10, 10, 0] }}
          transition={{ delay: ((2 * i + 2) / steps) * D - 0.05, duration: 0.5, repeat: Infinity, repeatDelay: D - 0.5 }}>
          {f}
        </motion.span>
      ))}
      <motion.span className="absolute bottom-10 text-3xl leading-none -translate-x-1/2"
        initial={{ left: '-10%' }}
        animate={{ left, y }}
        transition={{ duration: D, repeat: Infinity, ease: 'easeInOut' }}>
        🐝
      </motion.span>
    </div>
  );
}

// The flowers ride a Ferris wheel, staying the right way up as it turns
function FerrisWheel() {
  const R = 66, D = 9;
  return (
    <div className="absolute left-1/2" style={{ top: 108 }}>
      {/* the stand */}
      <div className="absolute w-1.5 h-32 bg-white/40 rounded-full origin-top" style={{ transform: 'rotate(25deg)' }} />
      <div className="absolute w-1.5 h-32 bg-white/40 rounded-full origin-top" style={{ transform: 'rotate(-25deg)' }} />
      <motion.div className="absolute w-0 h-0"
        initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }}
        transition={{ scale: { type: 'spring', stiffness: 200, damping: 14 }, rotate: { duration: D, repeat: Infinity, ease: 'linear' } }}>
        <div className="absolute rounded-full border-4 border-white/40"
          style={{ width: R * 2, height: R * 2, left: -R, top: -R }} />
        {FLOWERS.map((f, i) => {
          const a = (i / FLOWERS.length) * 360;
          return (
            <div key={i} className="absolute w-0 h-0" style={{ transform: `rotate(${a}deg)` }}>
              <div className="absolute h-0.5 bg-white/40 origin-left" style={{ width: R }} />
              <div className="absolute w-0 h-0" style={{ left: R }}>
                {/* undo the wheel's turn (and the spoke's) so each flower stays upright */}
                <motion.span className="absolute text-3xl leading-none w-10 h-10 -ml-5 -mt-5 flex items-center justify-center"
                  initial={{ rotate: -a }} animate={{ rotate: -a - 360 }}
                  transition={{ duration: D, repeat: Infinity, ease: 'linear' }}>
                  <motion.span className="inline-block" animate={{ rotate: [-8, 8, -8] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
                    {f}
                  </motion.span>
                </motion.span>
              </div>
            </div>
          );
        })}
        <span className="absolute text-2xl leading-none w-8 h-8 -ml-4 -mt-4 flex items-center justify-center">⭐</span>
      </motion.div>
    </div>
  );
}

// A disco ball spins, the lights flash, and the flowers dance
function Disco() {
  return (
    <>
      <motion.div className="absolute inset-0"
        animate={{ backgroundColor: ['rgba(236,72,153,0.25)', 'rgba(59,130,246,0.25)', 'rgba(250,204,21,0.25)', 'rgba(34,197,94,0.25)', 'rgba(236,72,153,0.25)'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
      {[-1, 1].map(side => (
        <motion.div key={side} className="absolute top-8 left-1/2 w-24 h-56 -ml-12 origin-top bg-gradient-to-b from-white/40 to-transparent"
          style={{ clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)' }}
          animate={{ rotate: [side * 40, side * -20, side * 40] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
      <div className="absolute top-0 left-1/2 w-px h-4 bg-white/60" />
      <motion.span className="absolute top-3 left-1/2 -ml-5 text-4xl leading-none"
        initial={{ y: -60 }} animate={{ y: 0, rotate: [0, 15, -15, 0] }}
        transition={{ y: { type: 'spring', stiffness: 120, damping: 10 }, rotate: { duration: 1, repeat: Infinity } }}>
        🪩
      </motion.span>
      <div className="absolute inset-x-0 bottom-4 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl sm:text-4xl leading-none origin-bottom inline-block"
            animate={{ y: [0, -24, 0], rotate: i % 2 ? [0, 15, 0, -15, 0] : [0, -15, 0, 15, 0], scaleX: [1, 0.9, 1.1, 1] }}
            transition={{ delay: (i % 2) * 0.25, duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}>
            {f}
          </motion.span>
        ))}
      </div>
    </>
  );
}

// Flowers pop up out of the grass, have a look around, and duck back down
function Peekaboo() {
  const delays = [0.2, 1.1, 0.6, 1.5, 0.9, 0.4];
  return (
    <>
      <div className="absolute inset-x-0 bottom-6 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl sm:text-4xl leading-none inline-block"
            initial={{ y: 60 }}
            animate={{ y: [60, -22, -22, -30, -22, 60], rotate: [0, 0, -15, 15, 0, 0], scale: [1, 1.15, 1, 1, 1, 1] }}
            transition={{ delay: delays[i], duration: 1.8, times: [0, 0.15, 0.4, 0.6, 0.8, 1], repeat: Infinity, repeatDelay: 0.6 }}>
            {f}
          </motion.span>
        ))}
      </div>
      {/* tall grass in front for them to hide behind */}
      <div className="absolute inset-x-0 bottom-0 h-9 bg-green-700 flex justify-around items-start text-xl leading-none -translate-y-0">
        {Array.from({ length: 9 }, (_, i) => <span key={i} className="-mt-3">🌿</span>)}
      </div>
    </>
  );
}

// The flowers topple over one after another like dominoes, then spring back up
function Dominoes() {
  return (
    <div className="absolute inset-x-0 bottom-4 flex justify-around items-end px-2">
      <motion.span className="text-2xl leading-none inline-block"
        animate={{ x: [-6, 6, -6] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.05, 0.3] }}>
        🐞
      </motion.span>
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="text-3xl leading-none origin-bottom-right inline-block"
          animate={{ rotate: [0, 0, 75, 75, -10, 0, 0] }}
          transition={{ delay: 0.15 + i * 0.12, duration: 3, times: [0, 0.05, 0.12, 0.55, 0.62, 0.68, 1], repeat: Infinity }}>
          {f}
        </motion.span>
      ))}
    </div>
  );
}

// Night falls: the moon comes up, stars twinkle, fireflies drift and the flowers glow
function NightGarden() {
  const stars = useMemo(() => Array.from({ length: 14 }, () => ({
    left: Math.random() * 95, top: Math.random() * 50, delay: Math.random() * 2, size: 0.5 + Math.random() * 0.6,
  })), []);
  const flies = useMemo(() => Array.from({ length: 9 }, () => ({
    left: 10 + Math.random() * 80, top: 40 + Math.random() * 35,
    x: [0, 20 - Math.random() * 40, 20 - Math.random() * 40, 0],
    y: [0, 15 - Math.random() * 30, 15 - Math.random() * 30, 0],
    dur: 3 + Math.random() * 2, blink: 0.8 + Math.random(),
  })), []);
  return (
    <>
      <motion.div className="absolute inset-0 bg-indigo-950/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }} />
      <motion.span className="absolute right-6 text-5xl leading-none"
        initial={{ top: 120, opacity: 0 }} animate={{ top: 12, opacity: 1 }} transition={{ duration: 1.8, ease: 'easeOut' }}>
        🌙
      </motion.span>
      {stars.map((st, i) => (
        <motion.span key={i} className="absolute leading-none" style={{ left: `${st.left}%`, top: `${st.top}%`, fontSize: `${st.size}rem` }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.3, 1] }}
          transition={{ delay: 1 + st.delay, duration: 1.6, repeat: Infinity, repeatType: 'reverse' }}>
          ✦
        </motion.span>
      ))}
      {flies.map((f, i) => (
        <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-yellow-200 shadow-[0_0_8px_3px_rgba(253,230,138,0.8)]"
          style={{ left: `${f.left}%`, top: `${f.top}%` }}
          initial={{ opacity: 0 }}
          animate={{ x: f.x, y: f.y, opacity: [0, 1, 0.2, 1] }}
          transition={{ delay: 1.2, default: { duration: f.dur, repeat: Infinity, ease: 'easeInOut' }, opacity: { delay: 1.2, duration: f.blink, repeat: Infinity, repeatType: 'reverse' } }} />
      ))}
      <div className="absolute inset-x-0 bottom-4 flex justify-around px-4">
        {FLOWERS.map((f, i) => (
          <motion.span key={i} className="text-3xl sm:text-4xl leading-none inline-block"
            animate={{ filter: ['drop-shadow(0 0 0px #fde68a)', 'drop-shadow(0 0 10px #fde68a)', 'drop-shadow(0 0 2px #fde68a)'] }}
            transition={{ delay: 1.5 + i * 0.2, duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}>
            {f}
          </motion.span>
        ))}
      </div>
    </>
  );
}

// A frog leapfrogs over the flowers, and each one ducks as it goes over
function FrogHop() {
  const n = FLOWERS.length, D = 5;
  const pos = i => `${((i + 0.5) / n) * 100}%`;
  // Land between flowers, jumping high over each one
  const left = ['-12%'], y = [0], overAt = [];
  for (let k = 0; k <= n; k++) {
    left.push(`${(k / n) * 100}%`, k < n ? pos(k) : '106%'); y.push(0, -75);
    if (k < n) overAt.push(left.length - 1);
  }
  left.push('115%'); y.push(0);
  const steps = left.length - 1;
  return (
    <div className="absolute inset-x-4 bottom-4 top-0">
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="absolute bottom-0 text-3xl leading-none -translate-x-1/2 origin-bottom"
          style={{ left: pos(i) }}
          animate={{ scaleY: [1, 0.55, 1.15, 1] }}
          transition={{ delay: (overAt[i] / steps) * D - 0.15, duration: 0.45, repeat: Infinity, repeatDelay: D - 0.45 }}>
          {f}
        </motion.span>
      ))}
      <motion.span className="absolute bottom-0 text-4xl leading-none -translate-x-1/2"
        initial={{ left: '-12%' }}
        animate={{ left, y }}
        transition={{ duration: D, repeat: Infinity, ease: 'linear' }}>
        🐸
      </motion.span>
    </div>
  );
}

// Flowers drop from the sky and stack up into a wobbly tower
function FlowerTower() {
  return (
    <motion.div className="absolute left-1/2 bottom-6 w-0 h-0 origin-bottom"
      animate={{ rotate: [0, 4, -4, 3, -3, 0] }}
      transition={{ delay: FLOWERS.length * 0.45 + 0.4, duration: 2, repeat: Infinity, repeatDelay: 0.5 }}>
      {FLOWERS.map((f, i) => (
        <motion.span key={i} className="absolute text-3xl leading-none -translate-x-1/2"
          style={{ bottom: i * 30 }}
          initial={{ y: -300, opacity: 0 }}
          animate={{ y: 0, opacity: 1, scaleY: [1, 1, 0.7, 1], scaleX: [1, 1, 1.25, 1] }}
          transition={{
            y: { delay: i * 0.45, type: 'spring', stiffness: 260, damping: 16 },
            opacity: { delay: i * 0.45, duration: 0.1 },
            scaleY: { delay: i * 0.45 + 0.2, duration: 0.3 },
            scaleX: { delay: i * 0.45 + 0.2, duration: 0.3 },
          }}>
          {f}
        </motion.span>
      ))}
    </motion.div>
  );
}

// Flowers fly in from all around to make a big beating heart
function FlowerHeart() {
  const n = 16;
  const points = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return {
      x: 16 * Math.sin(t) ** 3 * 4.2,
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 4.2,
      from: { x: Math.cos(t * 3) * 260, y: Math.sin(t * 3) * 260 },
      f: FLOWERS[i % FLOWERS.length],
    };
  });
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div className="relative w-0 h-0" style={{ top: 6 }}
        animate={{ scale: [1, 1.12, 1, 1.12, 1] }}
        transition={{ delay: 1.6, duration: 1.2, repeat: Infinity, repeatDelay: 0.4 }}>
        {points.map((p, i) => (
          <motion.span key={i} className="absolute text-2xl leading-none -translate-x-1/2 -translate-y-1/2"
            initial={{ x: p.from.x, y: p.from.y, rotate: 360, opacity: 0 }}
            animate={{ x: p.x, y: p.y, rotate: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.9, ease: 'easeOut' }}>
            {p.f}
          </motion.span>
        ))}
        <motion.span className="absolute text-4xl leading-none -translate-x-1/2 -translate-y-1/2"
          initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }}
          transition={{ delay: 1.4, duration: 0.5 }}>
          💖
        </motion.span>
      </motion.div>
    </div>
  );
}

export const SHOWS = [
  { title: 'The garden is in bloom!', Show: Bloom },
  { title: "It's raining flowers!",  Show: Shower },
  { title: 'Bouquet burst!',          Show: Burst },
  { title: 'Flower parade!',          Show: Parade },
  { title: 'Doing the flower wave!',  Show: Wave },
  { title: 'April showers!',          Show: RainCloud },
  { title: 'Butterfly visit!',        Show: Butterflies },
  { title: 'Good morning, garden!',   Show: Sunrise },
  { title: 'Flower fireworks!',       Show: Fireworks },
  { title: 'From little seeds…',      Show: Sprouts },
  { title: 'Up, up and away!',        Show: Balloons },
  { title: 'Over the rainbow!',       Show: Rainbow },
  { title: 'Busy, busy bee!',         Show: BusyBee },
  { title: 'All aboard the Ferris wheel!', Show: FerrisWheel },
  { title: 'Garden disco!',           Show: Disco },
  { title: 'Peekaboo!',               Show: Peekaboo },
  { title: 'Flower dominoes!',        Show: Dominoes },
  { title: 'Goodnight, garden!',      Show: NightGarden },
  { title: 'Leapfrog!',               Show: FrogHop },
  { title: 'Flower tower!',           Show: FlowerTower },
  { title: 'Flowers full of love!',   Show: FlowerHeart },
];

export function FlowerCelebration({ isOpen, levelId, score, onClose }) {
  const reduceMotion = useReducedMotion();
  if (!isOpen) return null;
  const { title, Show } = SHOWS[(levelId - 1) % SHOWS.length];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-full max-w-md bg-gradient-to-br from-green-700/40 to-game-card rounded-3xl shadow-2xl p-6 text-center border border-green-400/30"
        initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      >
        <div className="text-sm font-semibold text-game-gold uppercase tracking-widest mb-1">
          Level {levelId} complete!
        </div>
        <p className="text-white/60 text-sm mb-3">Score: {score.toLocaleString()}</p>

        {/* The stage: a patch of sky over a strip of grass */}
        <div aria-hidden
          className="relative h-56 rounded-2xl overflow-hidden bg-gradient-to-b from-sky-400/30 via-sky-300/10 to-green-600/40 mb-4">
          <div className="absolute inset-x-0 bottom-0 h-6 bg-green-700/60" />
          {reduceMotion
            ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-4xl">{FLOWERS.join(' ')}</div>
            : <Show key={levelId} />}
        </div>

        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <Button variant="primary" className="w-full" onClick={onClose}>
          Next Level 🌱
        </Button>
      </motion.div>
    </motion.div>
  );
}
