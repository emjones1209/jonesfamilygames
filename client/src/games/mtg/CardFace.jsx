/**
 * Drawing Magic cards (no official art): mana symbols, rules text, a full card
 * face, the smaller cards on the battlefield, and land tiles.
 */
import { defOf, colorsOf, stats, isCreature, isLand } from './mtgRules';

const SYMBOL_STYLE = {
  W: { bg: '#f8f1c8', fg: '#5b4a12' },
  U: { bg: '#4f9fe0', fg: '#fff' },
  B: { bg: '#4a3f48', fg: '#f3e8f0' },
  R: { bg: '#e2563b', fg: '#fff' },
  G: { bg: '#3f9b55', fg: '#fff' },
  C: { bg: '#b8b2a7', fg: '#2b2620' },
  T: { bg: '#b8b2a7', fg: '#2b2620' },
};

// Card frames by color: background, border, text
const FRAMES = {
  W: ['#f7f2df', '#cfc29a', '#2a2418'],
  U: ['#d5e6f7', '#5f97cf', '#14243a'],
  B: ['#d6cfd4', '#5a4c58', '#1f171d'],
  R: ['#f6d3c6', '#d0644a', '#3a160c'],
  G: ['#d3e8cf', '#4f9a5c', '#132c17'],
  gold: ['#f2e2a6', '#c79a2c', '#3a2a05'],
  land: ['#e6dccb', '#9b8a6c', '#2b2418'],
  none: ['#e3e3e3', '#999', '#222'],
};

function frameOf(def) {
  if (isLand(def)) return { land: true, colors: [def.mana], frame: FRAMES.land };
  const colors = colorsOf(def);
  return { colors, frame: colors.length > 1 ? FRAMES.gold : FRAMES[colors[0]] ?? FRAMES.none };
}

export function Symbol({ sym, size = 16 }) {
  const st = SYMBOL_STYLE[sym] ?? SYMBOL_STYLE.C;
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold align-middle shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.62, background: st.bg, color: st.fg, boxShadow: '0 1px 1px rgba(0,0,0,.35)' }}>
      {sym === 'T' ? '↷' : sym}
    </span>
  );
}

export function ManaCost({ cost, size = 16 }) {
  if (!cost) return null;
  const syms = [...cost.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  return <span className="inline-flex gap-0.5 items-center">{syms.map((s, i) => <Symbol key={i} sym={s} size={size} />)}</span>;
}

/** Rules text with {W}, {T} etc. drawn as symbols. */
export function RulesText({ text, size = 13 }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          {line.split(/(\{[^}]+\})/g).map((part, j) => {
            const m = part.match(/^\{([^}]+)\}$/);
            return m ? <Symbol key={j} sym={m[1]} size={size + 1} /> : <span key={j}>{part}</span>;
          })}
        </p>
      ))}
    </>
  );
}

const KW_LABEL = {
  flying: 'Flying', reach: 'Reach', firstStrike: 'First strike', doubleStrike: 'Double strike', trample: 'Trample',
  haste: 'Haste', vigilance: 'Vigilance', lifelink: 'Lifelink', deathtouch: 'Deathtouch', defender: 'Defender',
  menace: 'Menace', shroud: 'Shroud',
};
const KW_ICON = {
  flying: '🪽', reach: '🕸️', firstStrike: '⚔️', doubleStrike: '⚔️⚔️', trample: '🦶', haste: '⚡', vigilance: '👁️',
  lifelink: '❤️', deathtouch: '☠️', defender: '🧱', menace: '😠', shroud: '🛡️', unblockable: '👻', cantBlock: '🚫',
};

/** A whole card, big enough to read. `p` (a permanent) and `s` (the game) show its current power/toughness. */
export function CardFace({ card, s = null, p = null, width = 240 }) {
  const def = defOf(card);
  const { frame } = frameOf(def);
  const [bg, border, ink] = frame;
  const st = p && s ? stats(s, p) : null;
  const pt = def.pt && (st ? [st.power, st.toughness - (p.damage ?? 0)] : def.pt);
  const boosted = st && (st.power !== def.pt?.[0] || st.toughness !== def.pt?.[1]);
  const extraKw = st ? [...st.kw].filter(k => !(def.kw ?? []).includes(k) && KW_LABEL[k]) : [];
  const f = width / 240;
  return (
    <div className="rounded-xl shadow-2xl flex flex-col select-none"
      style={{ width, height: width * 1.4, background: '#171310', padding: 8 * f }}>
      <div className="flex-1 rounded-lg flex flex-col overflow-hidden" style={{ background: bg, border: `${2 * f}px solid ${border}`, color: ink }}>
        <div className="flex items-center justify-between gap-1 px-2 py-1 font-bold" style={{ fontSize: 15 * f, borderBottom: `1px solid ${border}` }}>
          <span className="truncate">{card.name}</span>
          <ManaCost cost={def.cost} size={16 * f} />
        </div>
        {/* In place of art: a band in the card's colors with its type's emoji */}
        <div className="flex items-center justify-center" style={{ height: 70 * f, background: `linear-gradient(135deg, ${border}55, ${bg})`, fontSize: 34 * f }}>
          {artEmoji(def)}
        </div>
        <div className="px-2 py-0.5 font-semibold" style={{ fontSize: 12 * f, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
          {def.type}{def.sub ? ` — ${def.sub}` : ''}
        </div>
        <div className="flex-1 px-2 py-1 leading-snug overflow-y-auto" style={{ fontSize: 12.5 * f }}>
          {def.text ? <RulesText text={def.text} size={12 * f} /> : <span className="italic opacity-60">No abilities</span>}
          {extraKw.length > 0 && <p className="font-semibold text-green-800">Until end of turn: {extraKw.map(k => KW_LABEL[k]).join(', ')}</p>}
          {p?.counters > 0 && <p className="font-semibold">+1/+1 counter{p.counters > 1 ? `s: ${p.counters}` : ''}</p>}
        </div>
        {pt && (
          <div className="self-end m-1 px-2 rounded-md font-bold"
            style={{ fontSize: 16 * f, background: bg, border: `1px solid ${border}`, color: boosted ? (st.power > def.pt[0] || st.toughness > def.pt[1] ? '#15803d' : '#b91c1c') : ink }}>
            {pt[0]}/{pt[1]}
          </div>
        )}
      </div>
    </div>
  );
}

function artEmoji(def) {
  const sub = def.sub ?? '';
  const table = [
    [/Angel/, '👼'], [/Dragon|Drake|Whelp/, '🐉'], [/Goblin/, '👺'], [/Elf/, '🧝'], [/Vampire/, '🧛'], [/Zombie/, '🧟'],
    [/Knight/, '🛡️'], [/Soldier/, '💂'], [/Bird/, '🦅'], [/Cat/, '🦁'], [/Unicorn/, '🦄'], [/Ox/, '🐂'], [/Merfolk/, '🧜'],
    [/Wall/, '🧱'], [/Djinn/, '🧞'], [/Elemental/, '🌪️'], [/Rat/, '🐀'], [/Beast/, '🐗'], [/Wurm/, '🐛'], [/Dinosaur/, '🦖'],
    [/Spider/, '🕷️'], [/Bear/, '🐻'], [/Centaur/, '🏹'], [/Wolf/, '🐺'], [/Giant|Ogre/, '🗿'], [/Jellyfish/, '🪼'],
    [/Shade|Illusion/, '👻'], [/Wizard|Shaman/, '🧙'], [/Kavu/, '🦎'], [/Faerie/, '🧚'],
  ];
  for (const [re, e] of table) if (re.test(sub)) return e;
  if (isLand(def)) return { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' }[def.mana];
  if (def.aura) return '✨';
  if (def.type === 'Enchantment') return '🌟';
  const fx = (def.effect ?? []).map(e => e.do);
  if (fx.includes('counter')) return '🚫';
  if (fx.includes('damage')) return '🔥';
  if (fx.includes('destroy') || fx.includes('exile')) return '💀';
  if (fx.includes('draw')) return '📜';
  if (fx.includes('pump') || fx.includes('pumpAll')) return '💪';
  if (fx.includes('token')) return '🎺';
  return '✨';
}

/**
 * A small card: in your hand (no game state) or on the battlefield (with `p`
 * and `s`: tapped, damage, current power/toughness, keywords).
 */
export function MiniCard({ card, s = null, p = null, width = 84, glow = null, dim = false, label = null, onClick }) {
  const def = defOf(card);
  const { frame } = frameOf(def);
  const [bg, border, ink] = frame;
  const st = p && s ? stats(s, p) : null;
  const pt = def.pt && (st ? [st.power, st.toughness - p.damage] : def.pt);
  const kw = st ? [...st.kw] : def.kw ?? [];
  const h = width * 1.36, f = width / 84;
  const tapped = p?.tapped;
  const ring = glow === 'target' ? '0 0 0 3px #facc15, 0 0 14px #facc15'
    : glow === 'play' ? '0 0 0 3px #4ade80, 0 0 12px #4ade80'
      : glow === 'selected' ? '0 0 0 3px #f97316, 0 0 14px #f97316'
        : glow === 'attacking' ? '0 0 0 3px #ef4444, 0 0 12px #ef4444'
          : glow === 'blocking' ? '0 0 0 3px #38bdf8, 0 0 12px #38bdf8' : '0 2px 6px rgba(0,0,0,.5)';
  return (
    <button type="button" onClick={onClick} className="relative shrink-0 transition-all duration-200"
      style={{ width: tapped ? h : width, height: tapped ? width : h }}>
      <div className="absolute rounded-lg overflow-hidden flex flex-col text-left"
        style={{
          width, height: h, left: tapped ? (h - width) / 2 : 0, top: tapped ? (width - h) / 2 : 0,
          transform: tapped ? 'rotate(90deg)' : 'none', transition: 'transform .25s', background: bg,
          border: `${2 * f}px solid ${border}`, color: ink, boxShadow: ring, opacity: dim ? 0.55 : 1,
        }}>
        <div className="flex items-start justify-between gap-0.5 px-1 pt-0.5">
          <span className="font-bold leading-tight" style={{ fontSize: 10 * f }}>{card.name}</span>
        </div>
        <div className="px-1"><ManaCost cost={def.cost} size={11 * f} /></div>
        <div className="flex-1 flex items-center justify-center" style={{ fontSize: 24 * f }}>{artEmoji(def)}</div>
        <div className="flex flex-wrap gap-0.5 px-1 leading-none" style={{ fontSize: 10 * f }}>
          {kw.filter(k => KW_ICON[k]).map(k => <span key={k} title={KW_LABEL[k] ?? k}>{KW_ICON[k]}</span>)}
          {def.abilities && <span title="Has an ability you can use">✋</span>}
          {def.mana && isCreature(def) && <Symbol sym={def.mana} size={11 * f} />}
        </div>
        {pt && (
          <div className="self-end m-0.5 px-1 rounded font-bold leading-tight"
            style={{
              fontSize: 13 * f, background: '#fffc', border: `1px solid ${border}`,
              color: st && (st.power > def.pt[0] || st.toughness > def.pt[1]) ? '#15803d' : st && (st.power < def.pt[0] || st.toughness < def.pt[1] || p.damage) ? '#b91c1c' : ink,
            }}>
            {pt[0]}/{pt[1]}
          </div>
        )}
        {p?.sick && p.controller === s?.active && isCreature(def) && !st?.kw.has('haste') &&<span className="absolute top-0.5 right-0.5" style={{ fontSize: 11 * f }} title="Just arrived: can't attack or tap this turn">💤</span>}
      </div>
      {label && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 text-white px-1.5 py-0.5 z-10"
          style={{ fontSize: 9 * f }}>{label}</span>
      )}
    </button>
  );
}

/** A land on the battlefield, small. */
export function LandTile({ p, glow, onClick, size = 40 }) {
  const def = defOf(p);
  const st = SYMBOL_STYLE[def.mana];
  return (
    <button type="button" onClick={onClick} title={`${p.name}${p.tapped ? ' (tapped)' : ''}`}
      className="relative shrink-0 rounded-md flex flex-col items-center justify-center transition-all duration-200"
      style={{
        width: size, height: size * 1.2, background: st.bg, color: st.fg, opacity: p.tapped ? 0.45 : 1,
        transform: p.tapped ? 'rotate(20deg) scale(.92)' : 'none', fontSize: size * 0.42,
        boxShadow: glow ? '0 0 0 3px #facc15' : '0 1px 4px rgba(0,0,0,.5)',
      }}>
      <span>{{ W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌳' }[def.mana]}</span>
    </button>
  );
}
