/**
 * The win animations for Spider, FreeCell, Pyramid and TriPeaks, drawn by Finale.jsx (which
 * explains what a scene is given). Klondike keeps the classic bouncing cards (CardCascade.jsx).
 */
import { GOLD, part, easeOut, easeInOut, lerp, rand, clamp01, drawCardAt, drawGlyph } from './canvasCards';

const TAU = Math.PI * 2;
const centre = box => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/** Time since the last frame (ms), kept small after a pause (a tab in the background, say). */
function clock() {
  let last = null;
  return t => { const dt = last == null ? 16 : Math.min(50, t - last); last = t; return dt; };
}

/* ───────────────────────── Spider: the web ───────────────────────── */

/**
 * The eight Kings fly to a ring in the middle of the screen. Gold threads spin out from the centre
 * to each King, then round and round between them, and a spider drops down its thread into the
 * middle. The web glows and pulses outward, then fades.
 */
export function spiderWeb({ ctx, width, height, piles, spot, launch }) {
  const cx = width / 2, cy = height * 0.46;
  const R = Math.min(width, height) * 0.36;
  const n = Math.max(1, piles.length);
  const first = spot[piles[0]?.key] ?? { width: 40, height: 56 };
  const cw = Math.max(first.width, Math.min(90, Math.min(width, height) * 0.13));
  const ch = cw * 1.4;
  const kings = piles.map((p, i) => {
    const a = -Math.PI / 2 + (i * TAU) / n;
    return { key: p.key, card: p.cards.at(-1), from: centre(spot[p.key]), w0: spot[p.key].width, a,
      to: { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }, at: i * 90, gone: false };
  });
  const FLY = 700, SPOKES = 1250, RINGS = 1650, DROP = 2700, PULSE = 3500, FADE = 4500, END = 5100;
  const rings = 6;
  // A point on spoke i, `f` of the way out (threads sag a little towards the middle between spokes)
  const on = (i, f) => ({ x: cx + Math.cos(kings[i % n].a) * R * f, y: cy + Math.sin(kings[i % n].a) * R * f });

  const threads = (t, glow) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(253, 230, 138, ${0.55 + glow * 0.45})`;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 6 + glow * 14;
    ctx.lineWidth = 1.4 + glow * 1.2;
    // Spokes, out from the middle
    const s = easeOut(part(t, SPOKES, 500));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const end = on(i, 0.92 * s);
      ctx.moveTo(cx, cy);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    // The spiral, a strand at a time, from the inside out
    const strands = rings * n;
    const done = part(t, RINGS, 1200) * strands;
    ctx.beginPath();
    for (let k = 0; k < Math.ceil(done); k++) {
      const ring = Math.floor(k / n), i = k % n;
      const f = 0.2 + (ring / rings) * 0.72 + (i / n) * (0.72 / rings);     // (creeping outward: a spiral)
      const f2 = f + 0.72 / rings / n;
      const a = on(i, f), b = on(i + 1, f2);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ctrl = { x: lerp(mid.x, cx, 0.12), y: lerp(mid.y, cy, 0.12) };
      const x = Math.min(1, done - k);
      // (the last strand is drawn part of the way)
      const qx = (tt) => (1 - tt) ** 2 * a.x + 2 * (1 - tt) * tt * ctrl.x + tt * tt * b.x;
      const qy = (tt) => (1 - tt) ** 2 * a.y + 2 * (1 - tt) * tt * ctrl.y + tt * tt * b.y;
      ctx.moveTo(a.x, a.y);
      for (let st = 1; st <= 8; st++) { const tt = (st / 8) * x; ctx.lineTo(qx(tt), qy(tt)); }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const spider = (t, x, y, size) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    ctx.lineCap = 'round';
    // Eight legs, each bent at the knee, waggling
    for (const side of [-1, 1]) {
      for (let l = 0; l < 4; l++) {
        const base = (-0.9 + l * 0.6) + Math.sin(t / 90 + l * 1.7 + side) * 0.15;
        const kx = side * Math.cos(base) * size * 0.9, ky = Math.sin(base) * size * 0.7 - size * 0.25;
        const fx = side * Math.cos(base) * size * 1.5, fy = Math.sin(base) * size * 0.9 + size * 0.45;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(kx, ky);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#111';
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -size * 0.35, size * 0.5, size * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();   // body
    ctx.beginPath(); ctx.arc(0, size * 0.35, size * 0.32, 0, TAU); ctx.fill(); ctx.stroke();                      // head
    ctx.fillStyle = '#f87171';
    for (const ex of [-1, 1]) { ctx.beginPath(); ctx.arc(ex * size * 0.12, size * 0.45, size * 0.07, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  return t => {
    const fade = 1 - part(t, FADE, END - FADE);
    ctx.globalAlpha = fade;
    const pulse = t > PULSE ? 0.5 + 0.5 * Math.sin((t - PULSE) / 140) : part(t, DROP, 800) * 0.5;
    if (t > SPOKES) threads(t, pulse);

    // Rings of light rolling outward from the middle
    for (let k = 0; k < 3; k++) {
      const p = part(t, PULSE + k * 330, 1000);
      if (p <= 0 || p >= 1) continue;
      ctx.strokeStyle = `rgba(250, 204, 21, ${(1 - p) * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.2 + p * 1.1), 0, TAU);
      ctx.stroke();
    }

    // The spider, down its thread
    if (t > DROP) {
      const p = easeOut(part(t, DROP, 900));
      const sy = lerp(-40, cy, p) + (p >= 1 ? Math.sin((t - DROP) / 260) * 4 : 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, sy - R * 0.08); ctx.stroke();
      spider(t, cx, sy, R * 0.09);
    }

    // The Kings, where the threads are tied
    for (const k of kings) {
      if (t >= k.at && !k.gone) {
        k.gone = true;
        for (let c = 0; c < 13; c++) launch(k.key);      // (the whole run goes with it)
      }
      const p = easeInOut(part(t, k.at, FLY));
      const x = lerp(k.from.x, k.to.x, p), y = lerp(k.from.y, k.to.y, p) - Math.sin(p * Math.PI) * 60;
      const bob = p >= 1 ? Math.sin(t / 300 + k.a * 3) * 3 : 0;
      drawCardAt(ctx, k.card, x, y + bob, cw, ch, { scale: lerp(k.w0 / cw, 1, p), angle: (1 - p) * TAU * 0.5, glow: 8 + pulse * 16 });
    }
    return t < END;
  };
}

/* ───────────────────────── FreeCell: fireworks ───────────────────────── */

const SPARK = { hearts: '#ff4d6d', diamonds: '#ff9f43', clubs: '#7dd3fc', spades: '#f1f5f9' };

/**
 * Each foundation's King launches like a rocket, with a trail of sparks, and bursts into a
 * firework of its own suit. The four suits go up one at a time; then the rest of the cards go up
 * together in volleys for the grand finale.
 */
export function fireworks({ ctx, width, height, piles, spot, launch }) {
  const tick = clock();
  const unit = Math.min(width, height);
  const rockets = [], sparks = [], flashes = [];
  const left = Object.fromEntries(piles.map(p => [p.key, p.cards.length]));
  // When each card goes up: the Kings one by one, then volleys of one from every pile
  const plan = [];
  piles.forEach((p, i) => { if (left[p.key]) plan.push({ at: i * 650, key: p.key, big: true, x: (i + 1) / (piles.length + 1) }); });
  let at = piles.length * 650 + 600, more = true;
  const queued = { ...left };
  piles.forEach(p => { if (queued[p.key]) queued[p.key] -= 1; });
  while (more) {
    more = false;
    for (const p of piles) {
      if (queued[p.key] > 0) { queued[p.key] -= 1; plan.push({ at: at + rand(0, 120), key: p.key, big: false, x: rand(0.1, 0.9) }); more = true; }
    }
    at += 240;
  }
  plan.sort((a, b) => a.at - b.at);

  const burst = (x, y, suit, big) => {
    const count = big ? 64 : 22;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + rand(-0.1, 0.1);
      const v = (big ? rand(0.18, 0.34) : rand(0.1, 0.22)) * (unit / 700);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: big ? rand(1200, 1700) : rand(800, 1100),
        suit, size: big ? unit * 0.03 : unit * 0.022, glyph: true });
    }
    flashes.push({ x, y, age: 0, size: big ? unit * 0.22 : unit * 0.1 });
  };

  return t => {
    const dt = tick(t);
    while (plan.length && plan[0].at <= t) {
      const p = plan.shift();
      const box = spot[p.key];
      const card = piles.find(pl => pl.key === p.key).cards[left[p.key] - 1];
      left[p.key] -= 1;
      launch(p.key);
      if (!card) continue;
      const from = centre(box);
      rockets.push({ card, from, to: { x: width * p.x, y: height * (p.big ? rand(0.16, 0.3) : rand(0.08, 0.38)) },
        age: 0, dur: p.big ? 800 : 600, big: p.big, w: box.width, h: box.height, spin: rand(-1, 1) });
    }

    // Sparks and smoke first, then the rockets over them
    ctx.globalCompositeOperation = 'lighter';
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dt;
      const p = f.age / 350;
      if (p >= 1) { flashes.splice(i, 1); continue; }
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * (0.5 + p));
      g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - p)})`);
      g.addColorStop(0.4, `rgba(250,204,21,${0.5 * (1 - p)})`);
      g.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.5 + p), 0, TAU); ctx.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      const drag = 0.9985 ** dt;
      s.vx *= drag; s.vy = s.vy * drag + 0.00022 * dt * (unit / 700);
      s.x += s.vx * dt; s.y += s.vy * dt;
      const life = 1 - s.age / s.life;
      ctx.globalAlpha = life < 0.3 ? life / 0.3 * (0.6 + 0.4 * Math.random()) : 1;
      if (s.glyph) drawGlyph(ctx, s.suit, SPARK[s.suit], s.size, s.x, s.y);
      else { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.age += dt;
      const p = clamp01(r.age / r.dur);
      const e = easeOut(p);
      const x = lerp(r.from.x, r.to.x, e) + Math.sin(p * 9) * 3;
      const y = lerp(r.from.y, r.to.y, e);
      // A trail of sparks behind it
      for (let k = 0; k < (r.big ? 3 : 1); k++) {
        sparks.push({ x: x + rand(-3, 3), y: y + r.h * 0.3 * (1 - p), vx: rand(-0.03, 0.03), vy: rand(0.02, 0.08), age: 0,
          life: rand(250, 500), size: rand(1, 2.4), color: Math.random() < 0.5 ? GOLD : '#fff7d6' });
      }
      if (p >= 1) { burst(r.to.x, r.to.y, r.card.suit, r.big); rockets.splice(i, 1); continue; }
      drawCardAt(ctx, r.card, x, y, r.w, r.h, { scale: lerp(1, 0.55, e), angle: r.spin * p, glow: 10 });
    }
    return plan.length > 0 || rockets.length > 0 || sparks.length > 0 || flashes.length > 0;
  };
}

/* ───────────────────────── Pyramid: rebuilt in gold ───────────────────────── */

/**
 * The cards taken away fly back and build the pyramid again, from the bottom row up. The
 * capstone lights up, a beam of light shoots up from it to the sky, and a shimmer of gold runs
 * across the whole pyramid.
 *
 * layout: { spots: [{ x, y, row }] — each place in the pyramid (its top left, from the top left of
 * the pyramid, marked data-finale on the page), capstone first — and w, h: the size of a card }.
 */
export function pyramidLight({ ctx, width, height, piles, spot, layout, launch }) {
  const { spots, w, h, anchor } = layout;
  const pile = piles[0];
  const from = centre(spot[pile.key]);
  // Build from the bottom row up, left to right
  const order = spots.map((s, i) => ({ ...s, i })).sort((a, b) => b.row - a.row || a.x - b.x);
  const cards = pile.cards.slice(-order.length).reverse();       // (the top of the pile first)
  const EVERY = 55, FLY = 520;
  const built = (order.length - 1) * EVERY + FLY;
  const GLOW = built + 100, BEAM = built + 400, SHINE = built + 600, FADE = built + 2900, END = FADE + 700;
  const placed = order.map((s, k) => ({ card: cards[k], at: k * EVERY, gone: false,
    x: anchor.left + s.x + w / 2, y: anchor.top + s.y + h / 2, row: s.row, i: s.i }));
  const cap = placed.find(p => p.i === 0) ?? placed.at(-1);
  const spread = Math.max(w * 3, anchor.width);

  return t => {
    ctx.globalAlpha = 1 - part(t, FADE, END - FADE);

    // The beam, behind the pyramid: narrow at the capstone, spreading as it climbs
    const beam = easeOut(part(t, BEAM, 600));
    if (beam > 0 && cap) {
      const flicker = 0.85 + 0.15 * Math.sin(t / 60) * Math.sin(t / 37);
      const top = -20, bottom = cap.y - h / 2;
      const nb = w * 0.25 * beam, wt = w * 1.6 * beam;
      const g = ctx.createLinearGradient(0, bottom, 0, top);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * flicker})`);
      g.addColorStop(0.15, `rgba(253,224,71,${0.75 * flicker})`);
      g.addColorStop(1, 'rgba(250,204,21,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cap.x - nb, bottom);
      ctx.lineTo(cap.x - wt, lerp(bottom, top, beam));
      ctx.lineTo(cap.x + wt, lerp(bottom, top, beam));
      ctx.lineTo(cap.x + nb, bottom);
      ctx.closePath();
      ctx.fill();
      // A sunburst round the capstone
      const halo = ctx.createRadialGradient(cap.x, bottom, 0, cap.x, bottom, w * 2.2);
      halo.addColorStop(0, `rgba(255,255,255,${0.8 * beam})`);
      halo.addColorStop(0.4, `rgba(250,204,21,${0.35 * beam})`);
      halo.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cap.x, bottom, w * 2.2, 0, TAU); ctx.fill();
    }

    // The cards, flying home (as in the game, each row overlaps the one above it; cards in the air go over them all)
    const home = [], air = [];
    for (const p of placed) {
      if (t < p.at) continue;
      if (!p.gone) { p.gone = true; launch(pile.key); }
      (t >= p.at + FLY ? home : air).push(p);
    }
    home.sort((a, b) => a.row - b.row);
    for (const p of [...home, ...air]) {
      const q = part(t, p.at, FLY);
      const e = easeInOut(q);
      const x = lerp(from.x, p.x, e), y = lerp(from.y, p.y, e) - Math.sin(q * Math.PI) * h * 0.8;
      const isCap = p === cap;
      const glow = isCap ? 30 * part(t, GLOW, 400) + 8 * Math.sin(t / 120) * part(t, GLOW, 400) : 0;
      drawCardAt(ctx, p.card, x, y, w, h, { angle: (1 - e) * (p.i % 2 ? -0.6 : 0.6), glow });
    }

    // A band of gold light sweeping across the cards (and only the cards: source-atop)
    for (const [start, dir] of [[SHINE, 1], [SHINE + 1100, -1]]) {
      const p = part(t, start, 900);
      if (p <= 0 || p >= 1) continue;
      const mid = anchor.left + anchor.width / 2;
      const bx = mid + dir * lerp(-spread, spread, p);
      const g = ctx.createLinearGradient(bx - w * 1.5, anchor.top, bx + w * 1.5, anchor.top + anchor.height);
      g.addColorStop(0, 'rgba(250,204,21,0)');
      g.addColorStop(0.5, 'rgba(250,204,21,0.6)');
      g.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    return t < END;
  };
}

/* ───────────────────────── TriPeaks: three volcanoes ───────────────────────── */

/**
 * The three peaks come back as volcanoes and erupt, one after another: cards burst out of each
 * crater with the lava, tumble through the air and pile up along the bottom of the screen.
 *
 * layout: { peaks: [x] — the middle of each peak, from the left of the peaks (marked
 * data-finale on the page) — half: half a peak's width, w: the size of a card }.
 */
export function volcanoes({ ctx, width, height, piles, layout, launch }) {
  const tick = clock();
  const { peaks, half, w, anchor } = layout;
  const h = w * 1.4;
  const pile = piles[0];
  const base = anchor.top + anchor.height;
  const tall = anchor.height * 0.95;
  const vents = peaks.map(x => ({ x: anchor.left + x, y: base - tall }));
  const RISE = 700, FIRST = 900, EACH = 1000, POUR = 1100;
  const cards = pile.cards.slice().reverse();          // (the top of the pile first)
  const per = Math.ceil(cards.length / vents.length);
  const plan = cards.map((card, k) => {
    const v = Math.min(vents.length - 1, Math.floor(k / per)), j = k % per;
    return { card, v, at: FIRST + v * EACH + 250 + (j / per) * POUR };
  });
  const flying = [], landed = [], lava = [];
  const bins = new Array(Math.ceil(width / (w * 0.5)) + 1).fill(0);
  const floorAt = x => height - bins[Math.max(0, Math.min(bins.length - 1, Math.floor(x / (w * 0.5))))];
  const g = 0.0016 * (height / 800);
  let calm = null;                                       // when the last card landed

  const mountains = rise => {
    for (const [i, v] of vents.entries()) {
      const shake = erupting(i) ? rand(-1.5, 1.5) : 0;
      const top = lerp(base, v.y, rise);
      const grad = ctx.createLinearGradient(0, top, 0, base);
      grad.addColorStop(0, '#5b3a29');
      grad.addColorStop(1, '#1f1510');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(v.x - half * 1.2 + shake, base);
      ctx.lineTo(v.x - w * 0.35 + shake, top);
      ctx.lineTo(v.x + w * 0.35 + shake, top);
      ctx.lineTo(v.x + half * 1.2 + shake, base);
      ctx.closePath();
      ctx.fill();
      // Lava glowing in the crater (and running down the side while it erupts)
      const hot = rise * (erupting(i) ? 1 : 0.5);
      const glow = ctx.createRadialGradient(v.x, top, 0, v.x, top, w * 1.2);
      glow.addColorStop(0, `rgba(255,200,60,${0.9 * hot})`);
      glow.addColorStop(0.5, `rgba(255,90,20,${0.5 * hot})`);
      glow.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(v.x, top, w * 1.2, 0, TAU); ctx.fill();
    }
  };
  let now = 0;
  const erupting = i => now > FIRST + i * EACH && now < FIRST + i * EACH + POUR + 450;

  return t => {
    now = t;
    const dt = tick(t);
    const rise = easeOut(part(t, 0, RISE));
    const fade = calm != null ? part(t, calm + 1300, 700) : 0;
    ctx.globalAlpha = 1 - fade;

    // Lava spits out of whichever volcano is going
    vents.forEach((v, i) => {
      if (!erupting(i)) return;
      for (let k = 0; k < 4; k++) {
        lava.push({ x: v.x + rand(-w * 0.25, w * 0.25), y: v.y, vx: rand(-0.12, 0.12), vy: -rand(0.35, 0.8) * Math.sqrt(height / 800),
          age: 0, life: rand(600, 1100), r: rand(2, 5) * (w / 50) });
      }
    });
    while (plan.length && plan[0].at <= t) {
      const p = plan.shift();
      launch(pile.key);
      const v = vents[p.v];
      flying.push({ card: p.card, x: v.x, y: v.y, vx: rand(-0.28, 0.28) * (width / 800), vy: -rand(0.75, 1.05) * Math.sqrt(height / 800),
        angle: 0, spin: rand(-0.012, 0.012) });
    }

    mountains(rise);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = lava.length - 1; i >= 0; i--) {
      const b = lava[i];
      b.age += dt;
      if (b.age >= b.life) { lava.splice(i, 1); continue; }
      b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const p = b.age / b.life;
      ctx.fillStyle = p < 0.3 ? `rgba(255,230,120,${1 - p})` : p < 0.7 ? `rgba(255,120,30,${1 - p})` : `rgba(200,40,10,${1 - p})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - p * 0.5), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const c of landed) drawCardAt(ctx, c.card, c.x, c.y, w, h, { angle: c.angle });
    for (let i = flying.length - 1; i >= 0; i--) {
      const c = flying[i];
      c.vy += g * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.angle += c.spin * dt;
      if (c.x < w / 2 || c.x > width - w / 2) { c.vx = -c.vx * 0.6; c.x = Math.max(w / 2, Math.min(width - w / 2, c.x)); }
      const floor = floorAt(c.x);
      if (c.vy > 0 && c.y + h * 0.35 >= floor) {
        c.y = floor - h * 0.35;
        c.angle = (c.angle % Math.PI) * 0.3 + rand(-0.25, 0.25);       // (settling at a slant)
        const bin = Math.max(0, Math.min(bins.length - 1, Math.floor(c.x / (w * 0.5))));
        bins[bin] += h * 0.12;
        if (bin > 0) bins[bin - 1] += h * 0.05;
        if (bin < bins.length - 1) bins[bin + 1] += h * 0.05;
        landed.push(c);
        flying.splice(i, 1);
        continue;
      }
      drawCardAt(ctx, c.card, c.x, c.y, w, h, { angle: c.angle });
    }
    if (calm == null && !plan.length && !flying.length) calm = t;
    return fade < 1;
  };
}
