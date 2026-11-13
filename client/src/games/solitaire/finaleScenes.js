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

/** A spider `size` px across, its legs waggling, at (x, y). */
function drawSpider(ctx, t, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.lineCap = 'round';
  // Eight legs, each bent at the knee
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
}

/**
 * The eight Kings fly to a ring in the middle of the screen and gold threads spin out between
 * them. Then every other card swirls in from the cleared runs and settles across its King's
 * thread, Aces in the middle, and a spider drops down into the centre. The web glows, starts to
 * turn, spins faster and faster — and flings all 104 cards out across the screen.
 */
export function spiderWeb({ ctx, width, height, piles, spot, launch }) {
  const cx = width / 2, cy = height * 0.46;
  const R = Math.min(width, height) * 0.38;
  const n = Math.max(1, piles.length);
  const first = spot[piles[0]?.key] ?? { width: 40, height: 56 };
  const cw = Math.max(first.width, Math.min(90, Math.min(width, height) * 0.13));
  const ch = cw * 1.4;
  const big = Math.max(width, height) / 800;
  const FLY = 700, SPOKES = 1000, RINGS = 1300, STREAM = 1100, EVERY = 22;
  const DROP = STREAM + n * 12 * EVERY + 500, PULSE = DROP + 700, SPIN = PULSE + 300, FLING = SPIN + 1700;
  const rings = 6;
  // How far the web has turned: slowly at first, then faster and faster
  const rot = t => (t < SPIN ? 0 : (((t - SPIN) / 1000) ** 2) * 2.4);
  const spinRate = t => (t < SPIN ? 0 : (2 * 2.4 * (t - SPIN)) / 1e6);    // (radians a ms)

  // Every card: the King at the end of its spoke, the rest of its run along it, the Ace nearest the middle
  const cards = [];
  piles.forEach((p, i) => {
    const a = -Math.PI / 2 + (i * TAU) / n;
    const from = centre(spot[p.key]), w0 = spot[p.key].width;
    cards.push({ key: p.key, card: p.cards.at(-1), a, f: 1, w: cw, w0, from, at: i * 90, fly: FLY, turn: -a, king: true });   // (Kings upright)
    p.cards.slice(0, -1).forEach((card, c) => {
      cards.push({ key: p.key, card, a, f: 0.22 + (c / 11) * 0.6, w: cw * 0.55, w0, from, turn: Math.PI / 2,      // (along the spoke)
        at: STREAM + (c * n + i) * EVERY, fly: 800, swirl: (i % 2 ? 1 : -1) * 1.3 });
    });
  });
  cards.sort((x, y) => x.king - y.king);              // (the Kings drawn over the rest)
  // When each one is flung off the web, and how hard: the middle first, rippling out
  for (const c of cards) {
    c.flingAt = FLING + c.f * 350 + rand(0, 120);
    c.out = rand(0.45, 0.85) * big;
    c.spinV = rand(-0.012, 0.012);
  }
  const homeAt = (c, t) => {
    const a = c.a + rot(t);
    return { x: cx + Math.cos(a) * R * c.f, y: cy + Math.sin(a) * R * c.f, angle: a + c.turn };
  };
  const g = 0.0012 * (height / 800);

  // A point on spoke i, `f` of the way out
  const on = (i, f, r) => {
    const a = -Math.PI / 2 + (i * TAU) / n + r;
    return { x: cx + Math.cos(a) * R * f, y: cy + Math.sin(a) * R * f };
  };
  const threads = (t, glow, alpha) => {
    const r = rot(t);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(253, 230, 138, ${0.55 + glow * 0.45})`;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 6 + glow * 14;
    ctx.lineWidth = 1.4 + glow * 1.2;
    const s = easeOut(part(t, SPOKES, 500));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const end = on(i, 0.95 * s, r);
      ctx.moveTo(cx, cy);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    // The spiral, a strand at a time, from the inside out
    const strands = rings * n;
    const done = part(t, RINGS, 1300) * strands;
    ctx.beginPath();
    for (let k = 0; k < Math.ceil(done); k++) {
      const ring = Math.floor(k / n), i = k % n;
      const f = 0.2 + (ring / rings) * 0.72 + (i / n) * (0.72 / rings);
      const a = on(i, f, r), b = on(i + 1, f + 0.72 / rings / n, r);
      const ctrl = { x: lerp((a.x + b.x) / 2, cx, 0.12), y: lerp((a.y + b.y) / 2, cy, 0.12) };
      const x = Math.min(1, done - k);                  // (the last strand is drawn part of the way)
      ctx.moveTo(a.x, a.y);
      for (let st = 1; st <= 8; st++) {
        const tt = (st / 8) * x;
        ctx.lineTo((1 - tt) ** 2 * a.x + 2 * (1 - tt) * tt * ctrl.x + tt * tt * b.x, (1 - tt) ** 2 * a.y + 2 * (1 - tt) * tt * ctrl.y + tt * tt * b.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  return t => {
    const pulse = t > PULSE ? 0.5 + 0.5 * Math.sin((t - PULSE) / 140) : part(t, DROP, 700) * 0.5;
    if (t > SPOKES) threads(t, pulse, 1 - part(t, FLING, 500));

    // Rings of light rolling outward as the web starts to turn
    for (let k = 0; k < 3; k++) {
      const p = part(t, PULSE + k * 330, 1000);
      if (p <= 0 || p >= 1) continue;
      ctx.strokeStyle = `rgba(250, 204, 21, ${(1 - p) * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.2 + p * 1.1), 0, TAU);
      ctx.stroke();
    }

    let showing = 0;
    for (const c of cards) {
      if (t < c.at) continue;
      if (!c.gone) { c.gone = true; launch(c.key); }
      let x, y, angle, scale = 1;
      if (t < c.flingAt) {
        const home = homeAt(c, t);
        const p = easeInOut(part(t, c.at, c.fly));
        if (p < 1) {
          // Swooping in on a curve (the runs swirl round the web as they come)
          const sw = c.king ? 0 : c.swirl;
          const ctrl = c.king ? { x: (c.from.x + home.x) / 2, y: Math.min(c.from.y, home.y) - 60 }
            : { x: cx + Math.cos(c.a + sw) * R * 1.35, y: cy + Math.sin(c.a + sw) * R * 1.35 };
          x = (1 - p) ** 2 * c.from.x + 2 * (1 - p) * p * ctrl.x + p * p * home.x;
          y = (1 - p) ** 2 * c.from.y + 2 * (1 - p) * p * ctrl.y + p * p * home.y;
          angle = home.angle * p + (1 - p) * TAU * (c.king ? 0.5 : 1);
          scale = lerp(c.w0 / c.w, 1, p);
        } else {
          ({ x, y, angle } = home);
          if (c.king) y += Math.sin(t / 300 + c.a * 3) * 3;
        }
      } else {
        // Flung off: out along the spoke, plus the speed the web was turning at
        const home = homeAt(c, c.flingAt);
        const a = c.a + rot(c.flingAt), dt = t - c.flingAt;
        const tang = spinRate(c.flingAt) * R * c.f;
        const vx = Math.cos(a) * c.out - Math.sin(a) * tang;
        const vy = Math.sin(a) * c.out + Math.cos(a) * tang;
        x = home.x + vx * dt;
        y = home.y + vy * dt + 0.5 * g * dt * dt;
        angle = home.angle + c.spinV * dt * 3;
        if (x < -cw * 2 || x > width + cw * 2 || y > height + ch * 2 || y < -height) continue;
      }
      showing++;
      drawCardAt(ctx, c.card, x, y, c.w, c.w * 1.4, { angle, scale, glow: c.king ? 8 + pulse * 16 : 0 });
    }

    // The spider, down its thread (and back up when the web goes)
    if (t > DROP) {
      const down = easeOut(part(t, DROP, 900)), up = easeInOut(part(t, FLING, 700));
      const sy = lerp(-40, cy, down * (1 - up)) + (down >= 1 && !up ? Math.sin((t - DROP) / 260) * 4 : 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, sy - R * 0.08); ctx.stroke();
      drawSpider(ctx, t, cx, sy, R * 0.09);
    }
    return t < FLING + 800 || showing > 0;
  };
}

/* ───────────────────────── FreeCell: fireworks ───────────────────────── */

const SPARK = { hearts: '#ff4d6d', diamonds: '#ff9f43', clubs: '#7dd3fc', spades: '#f1f5f9' };

/**
 * Each foundation's King drops to the bottom of the screen and launches like a rocket, with a
 * trail of sparks, bursting into a firework of its own suit. The four suits go up one at a time;
 * then the rest of the cards go up in volleys for the grand finale, all over the screen.
 */
export function fireworks({ ctx, width, height, piles, spot, launch }) {
  const tick = clock();
  const unit = Math.min(width, height);
  const reach = Math.max(width, height) / 800;          // (bursts fill the screen, whichever way up it is)
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
    const count = big ? 90 : 34;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + rand(-0.1, 0.1);
      const v = (big ? rand(0.3, 0.5) : rand(0.16, 0.3)) * reach;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: big ? rand(1500, 2100) : rand(1000, 1400),
        suit, size: big ? unit * 0.04 : unit * 0.03, glyph: true });
    }
    flashes.push({ x, y, age: 0, size: (big ? 0.3 : 0.14) * Math.max(width, height) * 0.6 });
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
      // It drops to the bottom of the screen, then goes up anywhere from near the top to well down it
      const x = width * p.x;
      rockets.push({ card, from, ground: { x: x + rand(-width * 0.08, width * 0.08), y: height - box.height * 0.4 },
        to: { x, y: height * (p.big ? rand(0.18, 0.5) : rand(0.08, 0.72)) },
        age: 0, drop: 420, dur: p.big ? 900 : 700, big: p.big, w: box.width, h: box.height, spin: rand(-1, 1) });
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
      s.vx *= drag; s.vy = s.vy * drag + 0.00022 * dt * reach;
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
      if (r.age < r.drop) {
        // Falling to the launch spot, tumbling
        const q = r.age / r.drop, e = q * q;
        drawCardAt(ctx, r.card, lerp(r.from.x, r.ground.x, q), lerp(r.from.y, r.ground.y, e), r.w, r.h, { angle: r.spin * q * TAU });
        continue;
      }
      const p = clamp01((r.age - r.drop) / r.dur);
      const e = easeOut(p);
      const x = lerp(r.ground.x, r.to.x, e) + Math.sin(p * 9) * 3;
      const y = lerp(r.ground.y, r.to.y, e);
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
 * The cards taken away fly back, spinning, and build the pyramid again from the bottom row up,
 * with a spray of sparks as each one lands. The capstone lights up, a beam of light shoots up from
 * it, and a shimmer of gold runs across the pyramid. Then the cards lift off one by one, from the
 * top down, and spiral up the beam into the sky — and the rest of the pile follows them.
 *
 * layout: { spots: [{ x, y, row }] — each place in the pyramid (its top left, from the top left of
 * the pyramid, marked data-finale on the page), capstone first — and w, h: the size of a card }.
 */
export function pyramidLight({ ctx, width, height, piles, spot, layout, launch }) {
  const tick = clock();
  const { spots, w, h, anchor } = layout;
  const pile = piles[0];
  const from = centre(spot[pile.key]);
  // Build from the bottom row up, left to right
  const order = spots.map((s, i) => ({ ...s, i })).sort((a, b) => b.row - a.row || a.x - b.x);
  const top = pile.cards.slice().reverse();                      // (the top of the pile first)
  const EVERY = 55, FLY = 560, RISE_EVERY = 70, RIDE = 1900;
  const built = (order.length - 1) * EVERY + FLY;
  const GLOW = built + 100, BEAM = built + 300, SHINE = built + 500, ASCEND = built + 2300;
  const placed = order.map((s, k) => ({ card: top[k], at: k * EVERY, x: anchor.left + s.x + w / 2, y: anchor.top + s.y + h / 2,
    row: s.row, i: s.i, dir: s.i % 2 ? -1 : 1 }));
  const cap = placed.find(p => p.i === 0) ?? placed.at(-1);
  // Lifting off from the top down; then the cards still in the pile, straight from it
  const lifting = [...placed].sort((a, b) => a.row - b.row || a.x - b.x);
  lifting.forEach((p, k) => { p.up = ASCEND + k * RISE_EVERY; });
  const extra = top.slice(placed.length).map((card, j) => ({ card, extra: true, x: from.x, y: from.y, row: 99,
    up: ASCEND + (placed.length + j) * RISE_EVERY * 0.7, i: j, dir: j % 2 ? -1 : 1 }));
  const END = Math.max(ASCEND, ...[...lifting, ...extra].map(p => p.up)) + RIDE + 400;
  const spread = Math.max(w * 3, anchor.width);
  const sparks = [];
  const capTop = cap ? cap.y - h / 2 : height / 3;
  const beamX = cap ? cap.x : width / 2;

  // Where a card is while it rides the beam: round and round it, climbing faster and faster
  const ride = (p, t) => {
    const u = part(t, p.up, RIDE);
    const swing = u * TAU * 1.6 + p.i * 0.9;
    const r = w * lerp(0.7, 1.6, u);
    const into = easeOut(clamp01(u * 3));                       // (moving into the beam first)
    return {
      x: lerp(p.x, beamX + Math.sin(swing) * r, into),
      y: lerp(p.y, -h * 2, u ** 1.7),
      scale: 1 + 0.25 * Math.cos(swing) * into,                 // (nearer, then further away, as it goes round)
      angle: Math.sin(swing) * 0.5 * into + u * p.dir * TAU,
      behind: Math.cos(swing) < 0 && into > 0.5,
      u,
    };
  };

  return t => {
    const dt = tick(t);
    ctx.globalAlpha = 1 - part(t, END - 500, 500);

    // The beam: narrow at the capstone, spreading as it climbs, brighter while the cards ride it
    const beam = easeOut(part(t, BEAM, 600)) * (1 - part(t, END - 900, 900));
    const riding = part(t, ASCEND, 600);
    if (beam > 0) {
      const flicker = 0.85 + 0.15 * Math.sin(t / 60) * Math.sin(t / 37);
      const nb = w * (0.25 + riding * 0.4) * beam, wt = w * (1.6 + riding * 1.2) * beam;
      const g = ctx.createLinearGradient(0, capTop, 0, -20);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * flicker})`);
      g.addColorStop(0.15, `rgba(253,224,71,${0.75 * flicker})`);
      g.addColorStop(1, 'rgba(250,204,21,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(beamX - nb, capTop);
      ctx.lineTo(beamX - wt, lerp(capTop, -20, beam));
      ctx.lineTo(beamX + wt, lerp(capTop, -20, beam));
      ctx.lineTo(beamX + nb, capTop);
      ctx.closePath();
      ctx.fill();
      const halo = ctx.createRadialGradient(beamX, capTop, 0, beamX, capTop, w * 2.2);
      halo.addColorStop(0, `rgba(255,255,255,${0.8 * beam})`);
      halo.addColorStop(0.4, `rgba(250,204,21,${0.35 * beam})`);
      halo.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(beamX, capTop, w * 2.2, 0, TAU); ctx.fill();
    }

    // The pyramid's cards: flying home, sitting in place (each row over the one above), then riding up
    const home = [], air = [], behind = [], front = [];
    for (const p of placed) {
      if (t < p.at) continue;
      if (!p.gone) { p.gone = true; launch(pile.key); }
      if (t >= p.up) {
        const r = ride(p, t);
        if (r.u < 1) (r.behind ? behind : front).push({ p, r });
      } else if (t >= p.at + FLY) {
        if (!p.landed) {
          p.landed = true;
          for (let k = 0; k < 10; k++) {
            const a = rand(Math.PI, TAU);
            sparks.push({ x: p.x + rand(-w / 2, w / 2), y: p.y + h / 2, vx: Math.cos(a) * rand(0.05, 0.2), vy: Math.sin(a) * rand(0.05, 0.25), age: 0, life: rand(300, 600) });
          }
        }
        home.push(p);
      } else air.push(p);
    }
    for (const p of extra) {
      if (t < p.up) continue;
      if (!p.gone) { p.gone = true; launch(pile.key); }
      const r = ride(p, t);
      if (r.u < 1) (r.behind ? behind : front).push({ p, r });
    }
    for (const { p, r } of behind) drawCardAt(ctx, p.card, r.x, r.y, w, h, { scale: r.scale, angle: r.angle, alpha: 0.85 });
    home.sort((a, b) => a.row - b.row);
    for (const p of home) drawCardAt(ctx, p.card, p.x, p.y, w, h, { glow: p === cap ? 30 * part(t, GLOW, 400) + 8 * Math.sin(t / 120) * part(t, GLOW, 400) : 0 });
    for (const p of air) {
      const q = part(t, p.at, FLY), e = easeInOut(q);
      const x = lerp(from.x, p.x, e), y = lerp(from.y, p.y, e) - Math.sin(q * Math.PI) * h * 1.2;
      drawCardAt(ctx, p.card, x, y, w, h, { angle: (1 - e) * p.dir * TAU, scale: 1 + Math.sin(q * Math.PI) * 0.3 });
    }

    // A band of gold light sweeping across the cards (and only the cards: source-atop)
    for (const [start, dir] of [[SHINE, 1], [SHINE + 1000, -1]]) {
      const p = part(t, start, 850);
      if (p <= 0 || p >= 1) continue;
      const bx = anchor.left + anchor.width / 2 + dir * lerp(-spread, spread, p);
      const g = ctx.createLinearGradient(bx - w * 1.5, anchor.top, bx + w * 1.5, anchor.top + anchor.height);
      g.addColorStop(0, 'rgba(250,204,21,0)');
      g.addColorStop(0.5, 'rgba(250,204,21,0.6)');
      g.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const { p, r } of front) drawCardAt(ctx, p.card, r.x, r.y, w, h, { scale: r.scale, angle: r.angle, glow: 6 });

    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      s.vy += 0.0006 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      ctx.fillStyle = `rgba(253,224,71,${1 - s.age / s.life})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    return t < END;
  };
}

/* ───────────────────────── TriPeaks: three volcanoes ───────────────────────── */

/**
 * The three peaks come back as volcanoes and erupt, one after another: cards burst out of each
 * crater with the lava, tumble through the air and pile up along the bottom of the screen. Once
 * the last card is out (`settled()`, so the game can show its "You win" box over it) they keep on
 * erupting, throwing the fallen cards back up, every so often all three at once — until the
 * animation is taken away.
 *
 * layout: { peaks: [x] — the middle of each peak, from the left of the peaks (marked
 * data-finale on the page) — half: half a peak's width, w: the size of a card }.
 */
export function volcanoes({ ctx, width, height, piles, layout, launch, settled }) {
  const tick = clock();
  const { peaks, half, w, anchor } = layout;
  const h = w * 1.4;
  const pile = piles[0];
  const base = anchor.top + anchor.height;
  const tall = anchor.height * 0.95;
  const vents = peaks.map(x => ({ x: anchor.left + x, y: base - tall }));
  const RISE = 700, FIRST = 900, EACH = 1000, POUR = 1000;
  const waiting = pile.cards.slice().reverse();          // (the top of the pile first)
  const flying = [], landed = [], lava = [], shots = [];
  const bins = new Array(Math.ceil(width / (w * 0.5)) + 1).fill(0);
  const binOf = x => Math.max(0, Math.min(bins.length - 1, Math.floor(x / (w * 0.5))));
  const g = 0.0016 * (height / 800);
  const up = Math.sqrt(height / 800);
  let eruptions = 0, calm = false, lastFromPile = 0;
  const active = [];                                     // [{ vent, from, until }]

  // The next eruption: one volcano in turn, and every sixth time all three together
  const erupt = t => {
    const all = eruptions > 2 && eruptions % 6 === 5;
    const which = all ? vents.map((_, i) => i) : [eruptions % vents.length];
    for (const v of which) {
      active.push({ v, from: t, until: t + POUR + 450 });
      const count = waiting.length ? Math.min(waiting.length, Math.max(6, Math.ceil(waiting.length / 4))) : all ? 6 : 4;
      for (let k = 0; k < count; k++) shots.push({ v, at: t + 250 + (k / count) * POUR, big: all });
    }
    eruptions++;
  };
  const next = () => FIRST + eruptions * EACH;
  const erupting = (i, t) => active.some(a => a.v === i && t > a.from && t < a.until);

  const mountains = (rise, t) => {
    for (const [i, v] of vents.entries()) {
      const going = erupting(i, t);
      const shake = going ? rand(-1.5, 1.5) : 0;
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
      // Lava glowing in the crater, brighter while it erupts
      const hot = rise * (going ? 1 : 0.45 + 0.1 * Math.sin(t / 300 + i));
      const glow = ctx.createRadialGradient(v.x, top, 0, v.x, top, w * (going ? 1.5 : 1));
      glow.addColorStop(0, `rgba(255,200,60,${0.9 * hot})`);
      glow.addColorStop(0.5, `rgba(255,90,20,${0.55 * hot})`);
      glow.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(v.x, top, w * 1.5, 0, TAU); ctx.fill();
    }
  };

  return t => {
    const dt = tick(t);
    const rise = easeOut(part(t, 0, RISE));
    while (next() <= t) erupt(next());
    for (let i = active.length - 1; i >= 0; i--) if (active[i].until < t) active.splice(i, 1);

    // Lava spits out of whichever volcanoes are going
    vents.forEach((v, i) => {
      if (!erupting(i, t)) return;
      for (let k = 0; k < 4; k++) {
        lava.push({ x: v.x + rand(-w * 0.25, w * 0.25), y: v.y, vx: rand(-0.12, 0.12), vy: -rand(0.35, 0.8) * up,
          age: 0, life: rand(600, 1100), r: rand(2, 5) * (w / 50) });
      }
    });
    // Out come the cards: first the ones from the pile, then the fallen ones, thrown back up
    shots.sort((a, b) => a.at - b.at);
    while (shots.length && shots[0].at <= t) {
      const s = shots.shift();
      let card;
      if (waiting.length) { card = waiting.shift(); launch(pile.key); lastFromPile = t; }
      else if (landed.length) {
        const old = landed.shift();                      // (the oldest, from the bottom of the heap)
        for (const [b, amount] of old.bins) bins[b] -= amount;
        card = old.card;
      } else continue;
      const v = vents[s.v];
      flying.push({ card, x: v.x, y: v.y, vx: rand(-0.28, 0.28) * (width / 800) * (s.big ? 1.3 : 1),
        vy: -rand(0.75, 1.05) * up * (s.big ? 1.15 : 1), angle: 0, spin: rand(-0.012, 0.012) });
    }

    mountains(rise, t);

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
      const floor = height - bins[binOf(c.x)];
      if (c.vy > 0 && c.y + h * 0.35 >= floor) {
        c.y = floor - h * 0.35;
        c.angle = (c.angle % Math.PI) * 0.3 + rand(-0.25, 0.25);       // (settling at a slant)
        const b = binOf(c.x);
        c.bins = [[b, h * 0.12], ...(b > 0 ? [[b - 1, h * 0.05]] : []), ...(b < bins.length - 1 ? [[b + 1, h * 0.05]] : [])];
        for (const [k, amount] of c.bins) bins[k] += amount;
        landed.push(c);
        flying.splice(i, 1);
        continue;
      }
      drawCardAt(ctx, c.card, c.x, c.y, w, h, { angle: c.angle });
    }
    // (once the last card from the pile has had time to land)
    if (!calm && !waiting.length && t > lastFromPile + 2200) { calm = true; settled?.(); }
    return true;
  };
}
