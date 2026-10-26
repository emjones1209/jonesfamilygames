/**
 * The step-by-step replay of what the computer just did: each step of a move
 * (see `beat` in mtgEngine.js) acted out by the cards involved — a spell flies
 * in and takes aim, creatures crash into each other in combat and damage pops
 * off them, the loser tumbles to the graveyard — with one short sentence each.
 *
 * It plays by itself (pause, back and next to go at your own speed), and waits
 * at the end until you tap Got it. "More detail" shows the full explanation of
 * the rules behind the step.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/Button';
import { MiniCard, RulesText } from './CardFace';
import { beatText, describeLog, explainLog } from './mtgEngine';

// How long each kind of step stays on screen when playing by itself (ms)
const HOLD = { clash: 2900, damage: 2300, dies: 2300, attack: 2200, block: 2300 };
const DEFAULT_HOLD = 2100;

/** The steps to play: every unseen entry's beats (or, for an entry without any, its line of the log). */
function replaySteps(entries, names) {
  const steps = [];
  for (const e of entries) {
    if (e.beats?.length) for (const b of e.beats) steps.push({ ...b, entry: e });
    else if (!e.minor) steps.push({ k: 'note', card: e.card, text: describeLog(e, names), entry: e, plain: true });
  }
  return steps;
}

export function MtgReplay({ entries, names, width = 84, onDone, onStop, onCard }) {
  const steps = useMemo(() => replaySteps(entries, names), [entries, names]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [detail, setDetail] = useState(false);
  const step = steps[Math.min(at, steps.length - 1)];
  const last = at >= steps.length - 1;

  // Play by itself, one step after another, stopping at the end
  useEffect(() => {
    if (!playing || last) return undefined;
    const timer = setTimeout(() => setAt(i => i + 1), HOLD[step?.k] ?? DEFAULT_HOLD);
    return () => clearTimeout(timer);
  }, [playing, last, at, step]);

  if (!step) return null;
  const text = step.plain ? step.text : beatText(step, names);
  const why = explainLog(step.entry, names);

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed z-40 inset-x-2 bottom-2 max-h-[70vh] md:inset-x-auto md:right-3 md:top-16 md:bottom-auto md:w-[28rem] md:max-h-[85vh]
        flex flex-col rounded-3xl bg-game-card/95 border border-game-gold/40 shadow-2xl backdrop-blur overflow-hidden">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
          <h2 className="text-game-gold font-bold">What {names[1]} did</h2>
          <span className="text-white/40 text-xs">Step {at + 1} of {steps.length}</span>
        </div>
        {/* Progress */}
        <div className="flex gap-1 px-4 pb-2">
          {steps.map((_, i) => (
            <button key={i} type="button" aria-label={`Step ${i + 1}`} onClick={() => { setAt(i); setPlaying(false); }}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < at ? 'bg-game-gold/60' : i === at ? 'bg-game-gold' : 'bg-white/15'}`} />
          ))}
        </div>

        {/* The stage: the cards act it out */}
        <div className="relative mx-3 rounded-2xl bg-black/30 overflow-hidden" style={{ height: width * 1.36 + 64 }}>
          <AnimatePresence mode="wait">
            <motion.div key={at} className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Stage step={step} names={names} width={width} onCard={onCard} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* What's happening, in a sentence */}
        <AnimatePresence mode="wait">
          <motion.div key={at} data-replay-text className="px-4 pt-3 text-white font-semibold text-base leading-snug min-h-[3.5rem]"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <RulesText text={text} size={14} />
          </motion.div>
        </AnimatePresence>
        {detail && why.length > 0 && (
          <ul className="mx-4 mb-1 max-h-32 overflow-y-auto space-y-1 text-white/70 text-[13px] leading-snug list-disc pl-4">
            {why.map((line, i) => <li key={i}><RulesText text={line} size={12} /></li>)}
          </ul>
        )}

        <div className="px-3 py-2 flex items-center gap-2">
          <button type="button" aria-label="Back a step" disabled={at === 0} onClick={() => { setAt(at - 1); setPlaying(false); }}
            className="w-11 h-11 rounded-full bg-white/10 disabled:opacity-30 flex items-center justify-center"><ChevronLeft size={20} /></button>
          {!last && (
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          )}
          {last
            ? <Button variant="gold" className="flex-1" onClick={onDone}>Got it</Button>
            : <Button variant="ghost" className="flex-1 flex items-center justify-center gap-1" onClick={() => { setAt(at + 1); setPlaying(false); }}>Next <ChevronRight size={18} /></Button>}
        </div>
        <div className="px-4 pb-3 flex items-center justify-between">
          <button type="button" className="text-white/50 text-xs underline" onClick={() => setDetail(!detail)} disabled={!why.length}>
            {detail ? 'Less detail' : why.length ? 'More detail (the rules)' : ''}
          </button>
          <div className="flex gap-3">
            {!last && <button type="button" className="text-white/40 text-xs underline" onClick={onDone}>Skip</button>}
            <button type="button" className="text-white/40 text-xs underline" onClick={onStop}>Stop explaining</button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

// ── The stage ───────────────────────────────────────────────────────────────
const isPlayer = x => x && x.player != null;

/** A card as it was at that moment (with its power/toughness then). */
function Card({ c, width, onCard, glow = null }) {
  if (!c) return null;
  return <MiniCard card={{ name: c.name, token: c.token }} width={width} pt={c.pt} glow={glow} onClick={() => onCard?.(c)} />;
}

/** A player: name and a heart. */
function PlayerBadge({ seat, names, life = null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 border border-white/20 px-3 py-2 min-w-[5.5rem]">
      <span className="text-3xl">{seat === 0 ? '🙂' : '🤖'}</span>
      <span className="text-white text-sm font-bold">{seat === 0 ? 'You' : names[seat]}</span>
      {life != null && <span className="text-red-300 font-bold">❤️ {life}</span>}
    </div>
  );
}

/** A number (damage, life) that pops up and floats away. */
function Pop({ children, color = '#f87171', delay = 0, className = '' }) {
  return (
    <motion.span className={`absolute left-1/2 top-1/3 -translate-x-1/2 font-black text-3xl pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,.8)] ${className}`}
      style={{ color }} initial={{ opacity: 0, y: 10, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: [10, -10, -24, -40], scale: [0.5, 1.3, 1, 1] }}
      transition={{ delay, duration: 1.4, times: [0, 0.2, 0.7, 1] }}>
      {children}
    </motion.span>
  );
}

/** Something that shakes when it's hit. */
const shake = delay => ({ x: [0, -8, 8, -6, 6, -3, 0], transition: { delay, duration: 0.5 } });

function Stage({ step, names, width, onCard }) {
  const w = width;
  const card = (c, props = {}) => <Card c={c} width={w} onCard={onCard} {...props} />;
  const target = (t, delay) => (isPlayer(t)
    ? <motion.div animate={shake(delay)}><PlayerBadge seat={t.player} names={names} /></motion.div>
    : <motion.div animate={shake(delay)}>{card(t)}</motion.div>);

  switch (step.k) {
    case 'cast': case 'ability': {
      const from = step.card?.controller === 0 ? 120 : -120;
      return (
        <motion.div className="relative" initial={{ y: from, scale: 0.6, rotate: -8 }} animate={{ y: 0, scale: 1.1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}>
          {card(step.card, { glow: 'selected' })}
          {step.k === 'ability' && <span className="absolute -top-3 -right-3 text-2xl">✋</span>}
        </motion.div>
      );
    }
    case 'trigger':
      return (
        <motion.div className="relative" animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.08, 1] }} transition={{ duration: 0.9 }}>
          {card(step.card, { glow: 'selected' })}
          <motion.span className="absolute -top-4 -right-4 text-3xl" animate={{ rotate: [0, -25, 25, -20, 20, 0] }} transition={{ duration: 0.9, repeat: 1 }}>🔔</motion.span>
        </motion.div>
      );
    case 'aim':
      return (
        <div className="flex items-center gap-3">
          {card(step.card)}
          <motion.span className="text-3xl" animate={{ x: [-10, 10, -10], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>🎯</motion.span>
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1, repeat: Infinity }}>
            {isPlayer(step.to) ? <PlayerBadge seat={step.to.player} names={names} /> : card(step.to, { glow: 'target' })}
          </motion.div>
        </div>
      );
    case 'attack': {
      const dir = step.cards[0]?.controller === 1 ? 1 : -1;      // towards the defender
      return (
        <div className="flex gap-2">
          {step.cards.map((c, i) => (
            <motion.div key={c.id ?? i} className="relative" initial={{ y: -dir * 30, rotate: 0 }} animate={{ y: dir * 18, rotate: [0, 0, 90] }}
              transition={{ delay: i * 0.15, duration: 0.8, times: [0, 0.7, 1] }}>
              {card(c, { glow: 'attacking' })}
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">⚔️</span>
            </motion.div>
          ))}
        </div>
      );
    }
    case 'block':
      return (
        <div className="flex items-center gap-2">
          {card(step.attacker, { glow: 'attacking' })}
          {step.blockers.map((b, i) => (
            <motion.div key={b.id ?? i} className="relative" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.2, type: 'spring', stiffness: 180, damping: 15 }}>
              {card(b, { glow: 'blocking' })}
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">🛡️</span>
            </motion.div>
          ))}
        </div>
      );
    case 'unblocked':
      return (
        <div className="flex items-center gap-3">
          {card(step.card, { glow: 'attacking' })}
          <motion.span className="text-3xl" animate={{ x: [0, 12, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>➡️</motion.span>
          <PlayerBadge seat={1 - (step.card?.controller ?? 1)} names={names} />
        </div>
      );
    case 'clash': {
      // The two creatures rush at each other, collide, and bounce apart with the damage showing
      const gap = w * 0.66;
      const centred = { left: '50%', marginLeft: -w / 2 };
      return (
        <div className="relative flex items-center justify-center" style={{ width: w * 3, height: w * 1.4 }}>
          <motion.div className="absolute" style={centred} initial={{ x: -w * 1.15, rotate: 0 }}
            animate={{ x: [-w * 1.15, -w * 0.48, -gap], rotate: [0, 8, -4] }} transition={{ duration: 0.9, times: [0, 0.45, 1], ease: 'easeIn' }}>
            {card(step.a, { glow: 'attacking' })}
            {step.toA > 0 && <Pop delay={0.45}>-{step.toA}</Pop>}
          </motion.div>
          <motion.div className="absolute" style={centred} initial={{ x: w * 1.15, rotate: 0 }}
            animate={{ x: [w * 1.15, w * 0.48, gap], rotate: [0, -8, 4] }} transition={{ duration: 0.9, times: [0, 0.45, 1], ease: 'easeIn' }}>
            {card(step.b, { glow: 'blocking' })}
            {step.toB > 0 && <Pop delay={0.45}>-{step.toB}</Pop>}
          </motion.div>
          <motion.span className="absolute text-5xl" initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.6, 1.2, 0], opacity: [0, 1, 1, 0] }} transition={{ delay: 0.38, duration: 0.8 }}>💥</motion.span>
        </div>
      );
    }
    case 'damage': {
      if (step.to?.all) {
        return (
          <div className="flex flex-col items-center gap-2">
            <motion.span className="text-4xl" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.6 }}>🔥</motion.span>
            <div className="flex gap-1.5 flex-wrap justify-center max-w-[22rem]">
              {step.cards.map((c, i) => (
                <motion.div key={c.id ?? i} className="relative" animate={shake(0.3)}>
                  <Card c={c} width={w * 0.62} onCard={onCard} />
                  <Pop delay={0.3}>-{step.n}</Pop>
                </motion.div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-4">
          <motion.div animate={{ x: [0, 46, 0], rotate: [0, 6, 0] }} transition={{ duration: 0.6, times: [0, 0.5, 1] }}>{card(step.from)}</motion.div>
          <div className="relative">
            {target(step.to, 0.3)}
            <Pop delay={0.3}>-{step.n}</Pop>
          </div>
        </div>
      );
    }
    case 'dies': case 'destroy': case 'sacrifice':
      return (
        <div className="relative flex flex-col items-center">
          <motion.div initial={{ rotate: 0, y: 0, opacity: 1, filter: 'grayscale(0)' }}
            animate={{ rotate: [0, -6, 14], y: [0, -6, 40], opacity: [1, 1, 0.25], filter: ['grayscale(0)', 'grayscale(0.6)', 'grayscale(1)'] }}
            transition={{ delay: 0.3, duration: 1.2, times: [0, 0.3, 1] }}>
            {card(step.card)}
          </motion.div>
          <motion.span className="absolute bottom-0 text-4xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            {step.k === 'destroy' ? '💀' : step.k === 'sacrifice' ? '🔥' : '🪦'}
          </motion.span>
        </div>
      );
    case 'exile':
      return (
        <motion.div animate={{ scale: [1, 1.1, 0.2], opacity: [1, 1, 0], rotate: [0, 0, 180], filter: ['drop-shadow(0 0 0 #a855f7)', 'drop-shadow(0 0 18px #a855f7)', 'drop-shadow(0 0 30px #a855f7)'] }}
          transition={{ delay: 0.3, duration: 1.4 }}>
          {card(step.card)}
        </motion.div>
      );
    case 'bounce':
      return (
        <div className="relative flex flex-col items-center">
          <motion.div animate={{ y: [0, 10, -140], opacity: [1, 1, 0], scale: [1, 1, 0.6] }} transition={{ delay: 0.3, duration: 1.1, times: [0, 0.2, 1] }}>
            {card(step.card)}
          </motion.div>
          <motion.span className="absolute top-0 text-4xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>✋</motion.span>
        </div>
      );
    case 'counter':
      return (
        <div className="relative">
          {card(step.card)}
          <motion.span className="absolute inset-0 flex items-center justify-center text-6xl" initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 14 }}>🚫</motion.span>
        </div>
      );
    case 'enter': case 'token':
      return (
        <div className="flex gap-2">
          {step.cards.map((c, i) => (
            <motion.div key={c.id ?? i} initial={step.k === 'token' ? { scale: 0 } : { y: -110, scale: 1.15, opacity: 0 }}
              animate={step.k === 'token' ? { scale: 1 } : { y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.2, type: 'spring', stiffness: 220, damping: 12 }}>
              {card(c, { glow: 'play' })}
            </motion.div>
          ))}
        </div>
      );
    case 'pump':
      return (
        <div className="flex gap-2 flex-wrap justify-center max-w-[22rem]">
          {step.cards.map((c, i) => (
            <motion.div key={c.id ?? i} className="relative" animate={{ scale: step.grow ? [1, 1.2, 1.08] : [1, 0.85, 0.92] }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.7 }}>
              <Card c={c} width={step.cards.length > 3 ? w * 0.7 : w} onCard={onCard} glow={step.grow ? 'play' : 'attacking'} />
              <motion.span className="absolute -top-3 -right-2 text-2xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                {step.grow ? '⬆️' : '⬇️'}
              </motion.span>
            </motion.div>
          ))}
        </div>
      );
    case 'attach':
      return (
        <div className="relative flex items-center" style={{ width: w * 2.2 }}>
          <div className="absolute right-0">{card(step.to)}</div>
          <motion.div className="absolute left-0" initial={{ x: 0, rotate: 0 }} animate={{ x: w * 0.75, rotate: -14, scale: 0.8 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 140, damping: 13 }}>
            {card(step.card)}
          </motion.div>
        </div>
      );
    case 'life': {
      const up = step.to > step.from;
      return (
        <div className="relative flex items-center gap-4">
          <PlayerBadge seat={step.seat} names={names} />
          <div className="flex items-center gap-2 text-3xl font-black">
            <span className="text-white/50 line-through">{step.from}</span>
            <span>→</span>
            <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.4, 1], opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
              style={{ color: up ? '#4ade80' : '#f87171' }}>{step.to}</motion.span>
          </div>
          <motion.span className="text-4xl" animate={{ scale: [1, 1.3, 1, 1.3, 1] }} transition={{ duration: 1.2 }}>{up ? '💚' : '💔'}</motion.span>
        </div>
      );
    }
    case 'draw':
      return (
        <div className="flex gap-2">
          {Array.from({ length: step.n }, (_, i) => (
            <motion.div key={i} className="rounded-lg bg-gradient-to-br from-amber-700 to-amber-950 border-2 border-amber-500/60"
              style={{ width: w * 0.7, height: w * 0.95 }} initial={{ x: -120, y: step.seat === 0 ? -20 : 20, rotate: -20, opacity: 0 }}
              animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.25, type: 'spring', stiffness: 160, damping: 15 }} />
          ))}
          <span className="self-center text-3xl ml-2">✋</span>
        </div>
      );
    case 'discard':
      return (
        <div className="flex gap-2">
          {step.cards.map((c, i) => (
            <motion.div key={c.id ?? i} animate={{ y: [0, 50], rotate: [0, 20], opacity: [1, 0.3] }} transition={{ delay: 0.4 + i * 0.15, duration: 0.9 }}>
              {card(c)}
            </motion.div>
          ))}
        </div>
      );
    default:            // 'note'
      return step.card
        ? <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>{card(step.card)}</motion.div>
        : <motion.span className="text-5xl" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>💡</motion.span>;
  }
}
