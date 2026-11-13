/**
 * Drawing cards (and suit symbols) straight onto a canvas, for the solitaire win animations
 * (CardCascade.jsx, Finale.jsx and finaleScenes.js), and a few small helpers for timing them.
 */
import { SUIT_SYMBOLS } from '../../utils/cardEngine';

/** A card face, drawn straight onto the canvas: white, rounded, rank and suit in its colour. */
export function drawCard(ctx, card, x, y, w, h) {
  const r = Math.max(4, w * 0.1);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#9ca3af';
  ctx.stroke();
  ctx.fillStyle = card.suit === 'hearts' || card.suit === 'diamonds' ? '#dc2626' : '#111827';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.round(w * 0.3)}px system-ui, sans-serif`;
  ctx.fillText(card.rank, x + w * 0.1, y + w * 0.08);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(w * 0.5)}px system-ui, sans-serif`;
  ctx.fillText(SUIT_SYMBOLS[card.suit], x + w / 2, y + h * 0.58);
}

export const GOLD = '#facc15';
export const clamp01 = x => Math.max(0, Math.min(1, x));
/** How far through a stretch of time `t` is: 0 before `start`, 1 after `start + length`. */
export const part = (t, start, length) => clamp01((t - start) / length);
export const easeOut = x => 1 - (1 - x) ** 3;
export const easeInOut = x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export const lerp = (a, b, x) => a + (b - a) * x;
export const rand = (a, b) => a + Math.random() * (b - a);

/** A card drawn around its middle (cx, cy), turned by `angle` and sized by `scale`, with an optional gold glow. */
export function drawCardAt(ctx, card, cx, cy, w, h, { angle = 0, scale = 1, alpha = 1, glow = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  if (angle) ctx.rotate(angle);
  if (scale !== 1) ctx.scale(scale, scale);
  if (glow > 0) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.max(4, w * 0.1));
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  drawCard(ctx, card, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Suit symbols drawn once each (per colour and size), as fillText for hundreds of sparks is slow
const glyphs = new Map();
function glyph(suit, color, size) {
  const k = `${suit}${color}${size}`;
  if (!glyphs.has(k)) {
    const c = document.createElement('canvas');
    const px = Math.ceil(size * 1.4) * 2;
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${size}px system-ui, sans-serif`;
    g.fillText(SUIT_SYMBOLS[suit], px / 4, px / 4);
    glyphs.set(k, c);
  }
  return glyphs.get(k);
}
/** A suit symbol `size` px high, centred on (x, y). */
export function drawGlyph(ctx, suit, color, size, x, y) {
  const g = glyph(suit, color, Math.round(size));
  const s = g.width / 2;
  ctx.drawImage(g, x - s / 2, y - s / 2, s, s);
}

