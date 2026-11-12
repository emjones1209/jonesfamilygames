/** Garden Match: levels and board rules (no React, so they can be tested and simulated). */

// ── Theme ─────────────────────────────────────────────────────────────────────
export const ROWS = 7, COLS = 7;
export const FLOWERS = ['🌸', '🌻', '🌺', '🌼', '💐', '🌷'];
// Bigger matches make bigger blasts: star 7 squares (a row or a column), sun 9,
// rainbow 13. Both kinds of star wear the same badge; the board shows which way
// each one clears.
export const SPECIAL_ICON = { row: '🌟', col: '🌟', area: '☀️', cross: '🌈' };

// ── Levels ────────────────────────────────────────────────────────────────────
// Blocker layouts for levels 101 on, drawn as the board looks: # is a blocker.
export const LAYOUTS = {
  grid:       ['.......', '.#.#.#.', '.......', '.#.#.#.', '.......', '.#.#.#.', '.......'],
  corners:    ['#.....#', '.......', '.......', '...#...', '.......', '.......', '#.....#'],
  rings:      ['.......', '.#.#.#.', '.......', '#.....#', '.......', '.#.#.#.', '.......'],
  bigPlus:    ['.......', '...#...', '..###..', '.##.##.', '..###..', '...#...', '.......'],
  pairs:      ['.......', '.......', '.##.##.', '.......', '.##.##.', '.......', '.......'],
  posts:      ['.......', '.#...#.', '.#...#.', '.......', '.#...#.', '.#...#.', '.......'],
  bowl:       ['.......', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '.......'],
  ringHole:   ['.......', '.......', '..###..', '..#.#..', '..###..', '.......', '.......'],
  compass:    ['...#...', '.#...#.', '.......', '#..#..#', '.......', '.#...#.', '...#...'],
  wall:       ['.......', '.......', '.......', '###.###', '.......', '.......', '.......'],
  hoop:       ['.......', '..#.#..', '.#...#.', '.......', '.#...#.', '..#.#..', '.......'],
  bars:       ['.......', '.#.#.#.', '.......', '#######', '.......', '.#.#.#.', '.......'],
  gate:       ['.......', '.##.##.', '.......', '#.###.#', '.......', '.##.##.', '.......'],
  rim:        ['#..#..#', '.......', '.......', '#.....#', '.......', '.......', '#..#..#'],
  box:        ['.......', '.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.', '.......'],
  divide:     ['.......', '...#...', '.......', '#######', '.......', '...#...', '.......'],
  bigGate:    ['...#...', '.##.##.', '.......', '#.###.#', '.......', '.##.##.', '...#...'],
  diagonals:  ['#.....#', '.#...#.', '..#.#..', '.......', '..#.#..', '.#...#.', '#.....#'],
  stem:       ['.......', '...#...', '..#.#..', '.#...#.', '...#...', '...#...', '.......'],
  lanes:      ['.......', '..#.#..', '..#.#..', '.......', '..#.#..', '..#.#..', '.......'],
  steps:      ['.......', '.##....', '.##....', '.......', '....##.', '....##.', '.......'],
  arrow:      ['.......', '.##.##.', '...#...', '.#...#.', '..#.#..', '...#...', '.......'],
  cross:      ['.......', '...#...', '...#...', '.#####.', '...#...', '...#...', '.......'],
  block:      ['.......', '.......', '..###..', '..###..', '..###..', '.......', '.......'],
  sides:      ['.......', '#.....#', '#.....#', '.......', '#.....#', '#.....#', '.......'],
  lattice:    ['.......', '..#.#..', '.#.#.#.', '..#.#..', '.#.#.#.', '..#.#..', '.......'],
  zigzag:     ['.......', '.####..', '....#..', '..#.#..', '..#....', '..####.', '.......'],
  pillars2:   ['.#...#.', '.#...#.', '.......', '.......', '.......', '.#...#.', '.#...#.'],
  frame:      ['.......', '.#####.', '.#...#.', '.#...#.', '.#...#.', '.#####.', '.......'],
  hourglass:  ['.......', '.#####.', '..#.#..', '...#...', '..#.#..', '.#####.', '.......'],
  // New for levels 101 on
  diamond:    ['...#...', '..#.#..', '.#...#.', '#.....#', '.#...#.', '..#.#..', '...#...'],
  bigX:       ['#.....#', '.#...#.', '..#.#..', '.......', '..#.#..', '.#...#.', '#.....#'],
  brackets:   ['##...##', '#.....#', '.......', '...#...', '.......', '#.....#', '##...##'],
  columns:    ['.......', '.#.#.#.', '.#.#.#.', '.......', '.#.#.#.', '.#.#.#.', '.......'],
  shelves:    ['.......', '##.#.##', '.......', '.......', '.......', '##.#.##', '.......'],
  quads:      ['.......', '.##.##.', '.##.##.', '.......', '.##.##.', '.##.##.', '.......'],
  tallPosts:  ['.#...#.', '.#...#.', '.#...#.', '.......', '.#...#.', '.#...#.', '.#...#.'],
  hollowPlus: ['...#...', '...#...', '...#...', '###.###', '...#...', '...#...', '...#...'],
  rows:       ['.......', '#.#.#.#', '.......', '.#.#.#.', '.......', '#.#.#.#', '.......'],
  arrows:     ['...#...', '..###..', '.......', '.......', '.......', '..###..', '...#...'],
  blossom:    ['.......', '..#.#..', '.##.##.', '.......', '.##.##.', '..#.#..', '.......'],
  ladders:    ['.#...#.', '.#####.', '.#...#.', '.......', '.#...#.', '.#####.', '.#...#.'],
  crown:      ['#.#.#.#', '.......', '.......', '.......', '.......', '.......', '#.#.#.#'],
  dots:       ['#.#.#.#', '.......', '#.#.#.#', '.......', '#.#.#.#', '.......', '#.#.#.#'],
  combs:      ['.......', '#.....#', '##...##', '#.....#', '##...##', '#.....#', '.......'],
  bowtie:     ['#.....#', '##...##', '#.....#', '.......', '#.....#', '##...##', '#.....#'],
  windows:    ['.......', '.##.##.', '.#...#.', '.......', '.#...#.', '.##.##.', '.......'],
  hook:       ['.......', '.#####.', '.....#.', '.###.#.', '.#...#.', '.#.###.', '.......'],
  islands:    ['.......', '.##..#.', '.##....', '...#...', '....##.', '.#..##.', '.......'],
  chevrons:   ['.......', '#.....#', '.#...#.', '..#.#..', '#..#..#', '.#...#.', '..#.#..'],
};

/** Turn a layout's picture into blocker squares. */
export const layoutObstacles = name => {
  const rows = LAYOUTS[name];
  if (!rows) throw new Error(`Unknown Garden Match layout: ${name}`);
  const spots = [];
  rows.forEach((line, row) => [...line].forEach((ch, col) => { if (ch === '#') spots.push({ row, col }); }));
  return spots;
};

/** Read the level table below: one line per level, `id goal moves layout`,
 *  where the goal is score:N, collect:N:flower or clear (every blocker). */
export function parseLevelTable(text) {
  return text.trim().split('\n').filter(Boolean).map(line => {
    const [id, goal, moves, layout] = line.trim().split(/\s+/);
    const [type, value, flower] = goal.split(':');
    const obstacles = layoutObstacles(layout);
    const target = type === 'clear' ? { type, value: obstacles.length }
      : type === 'collect' ? { type, value: Number(value), flowerType: Number(flower) }
      : { type, value: Number(value) };
    return { id: Number(id), target, moves: Number(moves), obstacles };
  });
}

// Levels 101-500, twenty to a chapter, made by scripts/tuneMatch3Levels.mjs:
// the same simulated player as below wins about 65% of a chapter's first level,
// easing down to about 40% of its last at level 120 and about 30% by level 500.
// Clear-the-blocker levels stay breathers.
const MORE_LEVELS = `
101 score:15800    22 diagonals
102 collect:19:0   22 shelves
103 score:16200    23 corners
104 clear          10 arrow
105 collect:21:3   23 quads
106 score:18100    24 rings
107 collect:21:5   24 lanes
108 clear          24 tallPosts
109 score:18100    25 bigPlus
110 collect:23:2   25 steps
111 score:20200    25 hollowPlus
112 collect:24:4   25 pairs
113 score:20400    26 arrow
114 clear          15 rows
115 collect:26:1   26 posts
116 score:22800    27 cross
117 collect:27:3   27 arrows
118 clear           8 bowl
119 score:23400    28 block
120 collect:28:0   28 blossom
121 score:15000    22 ringHole
122 collect:21:2   22 sides
123 score:16200    23 ladders
124 clear          14 compass
125 collect:19:5   23 lattice
126 score:18200    24 crown
127 collect:22:1   24 wall
128 clear          12 zigzag
129 score:20400    25 dots
130 collect:24:4   25 hoop
131 score:20400    25 pillars2
132 collect:24:0   25 combs
133 score:21800    26 bars
134 clear          13 frame
135 collect:26:3   26 bowtie
136 score:23100    27 gate
137 collect:27:5   27 hourglass
138 clear          11 windows
139 score:25000    28 rim
140 collect:28:2   28 diamond
141 score:15100    22 hook
142 collect:18:4   22 box
143 score:16800    23 bigX
144 clear          14 islands
145 collect:20:1   23 divide
146 score:18200    24 brackets
147 collect:22:3   24 chevrons
148 clear          14 bigGate
149 score:19100    25 columns
150 collect:24:0   25 grid
151 score:20600    25 diagonals
152 collect:24:2   25 shelves
153 score:21900    26 corners
154 clear           8 arrow
155 collect:25:5   26 quads
156 score:22700    27 rings
157 collect:27:1   27 lanes
158 clear          16 tallPosts
159 score:22700    28 bigPlus
160 collect:29:4   28 steps
161 score:14700    22 hollowPlus
162 collect:19:0   22 pairs
163 score:17300    23 arrow
164 clear          19 rows
165 collect:21:3   23 posts
166 score:17700    24 cross
167 collect:22:5   24 arrows
168 clear          10 bowl
169 score:19000    25 block
170 collect:22:2   25 blossom
171 score:19000    25 ringHole
172 collect:25:4   25 sides
173 score:20700    26 ladders
174 clear          11 compass
175 collect:24:1   26 lattice
176 score:22800    27 crown
177 collect:28:3   27 wall
178 clear           9 zigzag
179 score:24600    28 dots
180 collect:30:0   28 hoop
181 score:15800    23 pillars2
182 collect:20:2   23 combs
183 score:17200    24 bars
184 clear          16 frame
185 collect:22:5   24 bowtie
186 score:18700    25 gate
187 collect:22:1   25 hourglass
188 clear          13 windows
189 score:20300    26 rim
190 collect:25:4   26 diamond
191 score:20300    26 hook
192 collect:24:0   26 box
193 score:21800    27 bigX
194 clear          11 islands
195 collect:27:3   27 divide
196 score:23200    28 brackets
197 collect:29:5   28 chevrons
198 clear          11 bigGate
199 score:24600    29 columns
200 collect:31:2   29 grid
201 score:17400    23 diagonals
202 collect:20:4   23 shelves
203 score:18100    24 corners
204 clear           9 arrow
205 collect:21:1   24 quads
206 score:19600    25 rings
207 collect:24:3   25 lanes
208 clear          19 tallPosts
209 score:19600    26 bigPlus
210 collect:25:0   26 steps
211 score:20400    26 hollowPlus
212 collect:26:2   26 pairs
213 score:21800    27 arrow
214 clear          13 rows
215 collect:27:5   27 posts
216 score:23300    28 cross
217 collect:29:1   28 arrows
218 clear           8 bowl
219 score:24900    29 block
220 collect:31:4   29 blossom
221 score:16500    23 ringHole
222 collect:20:0   23 sides
223 score:17100    24 ladders
224 clear          13 compass
225 collect:21:3   24 lattice
226 score:19200    25 crown
227 collect:24:5   25 wall
228 clear          11 zigzag
229 score:20600    26 dots
230 collect:25:2   26 hoop
231 score:21400    26 pillars2
232 collect:25:4   26 combs
233 score:22200    27 bars
234 clear          13 frame
235 collect:28:1   27 bowtie
236 score:24200    28 gate
237 collect:28:3   28 hourglass
238 clear          10 windows
239 score:26200    29 rim
240 collect:31:0   29 diamond
241 score:16500    23 hook
242 collect:19:2   23 box
243 score:17900    24 bigX
244 clear          14 islands
245 collect:22:5   24 divide
246 score:19900    25 brackets
247 collect:23:1   25 chevrons
248 clear          13 bigGate
249 score:20400    26 columns
250 collect:25:4   26 grid
251 score:21700    26 diagonals
252 collect:26:0   26 shelves
253 score:22900    27 corners
254 clear           7 arrow
255 collect:27:3   27 quads
256 score:24800    28 rings
257 collect:29:5   28 lanes
258 clear          15 tallPosts
259 score:25100    29 bigPlus
260 collect:30:2   29 steps
261 score:16800    24 hollowPlus
262 collect:21:4   24 pairs
263 score:18600    25 arrow
264 clear          17 rows
265 collect:23:1   25 posts
266 score:19600    26 cross
267 collect:25:3   26 arrows
268 clear          10 bowl
269 score:20600    27 block
270 collect:25:0   27 blossom
271 score:22300    27 ringHole
272 collect:27:2   27 sides
273 score:23000    28 ladders
274 clear          10 compass
275 collect:28:5   28 lattice
276 score:25700    29 crown
277 collect:30:1   29 wall
278 clear           8 zigzag
279 score:27800    30 dots
280 collect:32:4   30 hoop
281 score:17500    24 pillars2
282 collect:22:0   24 combs
283 score:18400    25 bars
284 clear          16 frame
285 collect:23:3   25 bowtie
286 score:20200    26 gate
287 collect:24:5   26 hourglass
288 clear          12 windows
289 score:22700    27 rim
290 collect:26:2   27 diamond
291 score:22700    27 hook
292 collect:26:4   27 box
293 score:24500    28 bigX
294 clear          11 islands
295 collect:29:1   28 divide
296 score:25400    29 brackets
297 collect:31:3   29 chevrons
298 clear          11 bigGate
299 score:26300    30 columns
300 collect:31:0   30 grid
301 score:18000    24 diagonals
302 collect:22:2   24 shelves
303 score:19000    25 corners
304 clear           9 arrow
305 collect:22:5   25 quads
306 score:21200    26 rings
307 collect:24:1   26 lanes
308 clear          21 tallPosts
309 score:21200    27 bigPlus
310 collect:27:4   27 steps
311 score:21900    27 hollowPlus
312 collect:27:0   27 pairs
313 score:23800    28 arrow
314 clear          13 rows
315 collect:29:3   28 posts
316 score:24500    29 cross
317 collect:30:5   29 arrows
318 clear           7 bowl
319 score:26400    30 block
320 collect:31:2   30 blossom
321 score:16500    24 ringHole
322 collect:21:4   24 sides
323 score:17800    25 ladders
324 clear          14 compass
325 collect:23:1   25 lattice
326 score:21600    26 crown
327 collect:25:3   26 wall
328 clear          11 zigzag
329 score:22100    27 dots
330 collect:27:0   27 hoop
331 score:22200    27 pillars2
332 collect:27:2   27 combs
333 score:23800    28 bars
334 clear          12 frame
335 collect:29:5   28 bowtie
336 score:25000    29 gate
337 collect:29:1   29 hourglass
338 clear          10 windows
339 score:27700    30 rim
340 collect:32:4   30 diamond
341 score:18200    25 hook
342 collect:22:0   25 box
343 score:19700    26 bigX
344 clear          13 islands
345 collect:24:3   26 divide
346 score:21600    27 brackets
347 collect:26:5   27 chevrons
348 clear          13 bigGate
349 score:22100    28 columns
350 collect:27:2   28 grid
351 score:23600    28 diagonals
352 collect:28:4   28 shelves
353 score:24900    29 corners
354 clear           7 arrow
355 collect:29:1   29 quads
356 score:27200    30 rings
357 collect:31:3   30 lanes
358 clear          15 tallPosts
359 score:27600    31 bigPlus
360 collect:33:0   31 steps
361 score:18500    25 hollowPlus
362 collect:23:2   25 pairs
363 score:20700    26 arrow
364 clear          17 rows
365 collect:24:5   26 posts
366 score:22000    27 cross
367 collect:27:1   27 arrows
368 clear          10 bowl
369 score:22000    28 block
370 collect:27:4   28 blossom
371 score:23400    28 ringHole
372 collect:29:0   28 sides
373 score:24500    29 ladders
374 clear           8 compass
375 collect:28:3   29 lattice
376 score:27100    30 crown
377 collect:31:5   30 wall
378 clear           8 zigzag
379 score:28500    31 dots
380 collect:33:2   31 hoop
381 score:19200    25 pillars2
382 collect:22:4   25 combs
383 score:19400    26 bars
384 clear          16 frame
385 collect:24:1   26 bowtie
386 score:21500    27 gate
387 collect:25:3   27 hourglass
388 clear          12 windows
389 score:23100    28 rim
390 collect:28:0   28 diamond
391 score:23100    28 hook
392 collect:27:2   28 box
393 score:25100    29 bigX
394 clear          11 islands
395 collect:29:5   29 divide
396 score:27800    30 brackets
397 collect:33:1   30 chevrons
398 clear          10 bigGate
399 score:28000    31 columns
400 collect:33:4   31 grid
401 score:18700    25 diagonals
402 collect:23:0   25 shelves
403 score:20200    26 corners
404 clear           9 arrow
405 collect:24:3   26 quads
406 score:21700    27 rings
407 collect:26:5   27 lanes
408 clear          17 tallPosts
409 score:21700    28 bigPlus
410 collect:28:2   28 steps
411 score:22500    28 hollowPlus
412 collect:28:4   28 pairs
413 score:25800    29 arrow
414 clear          12 rows
415 collect:30:1   29 posts
416 score:26200    30 cross
417 collect:32:3   30 arrows
418 clear           6 bowl
419 score:28500    31 block
420 collect:33:0   31 blossom
421 score:19200    26 ringHole
422 collect:24:2   26 sides
423 score:20500    27 ladders
424 clear          12 compass
425 collect:25:5   27 lattice
426 score:23000    28 crown
427 collect:26:1   28 wall
428 clear           9 zigzag
429 score:24500    29 dots
430 collect:29:4   29 hoop
431 score:24500    29 pillars2
432 collect:30:0   29 combs
433 score:26700    30 bars
434 clear          11 frame
435 collect:32:3   30 bowtie
436 score:27600    31 gate
437 collect:31:5   31 hourglass
438 clear          10 windows
439 score:29300    32 rim
440 collect:34:2   32 diamond
441 score:18900    26 hook
442 collect:24:4   26 box
443 score:20700    27 bigX
444 clear          13 islands
445 collect:26:1   27 divide
446 score:22400    28 brackets
447 collect:27:3   28 chevrons
448 clear          13 bigGate
449 score:24600    29 columns
450 collect:29:0   29 grid
451 score:25400    29 diagonals
452 collect:30:2   29 shelves
453 score:26000    30 corners
454 clear           7 arrow
455 collect:30:5   30 quads
456 score:28200    31 rings
457 collect:33:1   31 lanes
458 clear          13 tallPosts
459 score:29100    32 bigPlus
460 collect:34:4   32 steps
461 score:19800    26 hollowPlus
462 collect:24:0   26 pairs
463 score:21600    27 arrow
464 clear          18 rows
465 collect:26:3   27 posts
466 score:21700    28 cross
467 collect:27:5   28 arrows
468 clear           9 bowl
469 score:23900    29 block
470 collect:28:2   29 blossom
471 score:25100    29 ringHole
472 collect:30:4   29 sides
473 score:25700    30 ladders
474 clear           9 compass
475 collect:30:1   30 lattice
476 score:28500    31 crown
477 collect:34:3   31 wall
478 clear           8 zigzag
479 score:30800    32 dots
480 collect:35:0   32 hoop
481 score:19900    26 pillars2
482 collect:24:2   26 combs
483 score:21200    27 bars
484 clear          16 frame
485 collect:26:5   27 bowtie
486 score:22300    28 gate
487 collect:27:1   28 hourglass
488 clear          11 windows
489 score:25000    29 rim
490 collect:29:4   29 diamond
491 score:25000    29 hook
492 collect:29:0   29 box
493 score:26100    30 bigX
494 clear           9 islands
495 collect:32:3   30 divide
496 score:28500    31 brackets
497 collect:33:5   31 chevrons
498 clear          10 bigGate
499 score:29100    32 columns
500 collect:36:2   32 grid
`;

// Tuned by simulating a player who makes the biggest match they can see (no
// peeking at which flowers will drop in next). That player wins about 99% of the
// first levels, easing to about half of level 20. After that, each chapter of
// ten starts easier than the last one ended and builds up: about 70% → 40% by
// level 50, then a little harder each chapter, ending at about 35% by level 100.
// Clear-the-blocker levels are a little easier than their neighbours, as a breather.
// When combos, chain bonuses and cascade scoring arrived, the targets (moves, for
// clear levels) were re-tuned with scripts/tuneMatch3Levels.mjs so each level is
// as hard as it was before; that player swaps specials together when it can.
export const LEVELS = [
  // Levels 1-5: Sprouts — short and gentle, almost everyone wins
  { id:   1, target: { type: 'score',   value:  4200 }, moves: 12 },
  { id:   2, target: { type: 'score',   value:  5900 }, moves: 14 },
  { id:   3, target: { type: 'score',   value:  6400 }, moves: 15 },
  { id:   4, target: { type: 'score',   value:  6600 }, moves: 16 },
  { id:   5, target: { type: 'score',   value:  8700 }, moves: 18,
    obstacles: [{ row: 3, col: 3 }] },
  // Levels 6-10: Growing — blockers and new goals arrive
  { id:   6, target: { type: 'collect', value:    12, flowerType: 0 }, moves: 20,
    obstacles: [{ row: 2, col: 2 }, { row: 4, col: 4 }] },
  { id:   7, target: { type: 'score',   value:  9300 }, moves: 18,
    obstacles: [{ row: 3, col: 3 }] },
  { id:   8, target: { type: 'score',   value: 10100 }, moves: 18,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 3 }] },
  { id:   9, target: { type: 'clear',   value:     4 }, moves: 17,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  { id:  10, target: { type: 'score',   value: 10400 }, moves: 18,
    obstacles: [{ row: 3, col: 2 }, { row: 3, col: 4 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  // Levels 11-15: Blooming — a real challenge
  { id:  11, target: { type: 'collect', value:    14, flowerType: 1 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id:  12, target: { type: 'score',   value: 10600 }, moves: 18,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }, { row: 3, col: 3 }] },
  { id:  13, target: { type: 'clear',   value:     9 }, moves: 17,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 3, col: 3 }] },
  { id:  14, target: { type: 'score',   value: 11300 }, moves: 18 },
  { id:  15, target: { type: 'collect', value:    17, flowerType: 2 }, moves: 20,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 4 }] },
  // Levels 16-20: Master gardener
  { id:  16, target: { type: 'score',   value: 12800 }, moves: 20,
    obstacles: [{ row: 0, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 6, col: 3 }, { row: 3, col: 3 }] },
  { id:  17, target: { type: 'clear',   value:    12 }, moves: 18,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 0, col: 3 }, { row: 6, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }] },
  { id:  18, target: { type: 'score',   value: 14800 }, moves: 20 },
  { id:  19, target: { type: 'collect', value:    18, flowerType: 3 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 3, col: 3 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id:  20, target: { type: 'score',   value: 17400 }, moves: 22,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  // Levels 21-30: The Orchard — each new chapter starts a little easier than the last one ended
  { id:  21, target: { type: 'score',   value: 12400 }, moves: 20,
    obstacles: [{ row: 3, col: 3 }] },
  { id:  22, target: { type: 'collect', value:    16, flowerType: 4 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id:  23, target: { type: 'score',   value: 14900 }, moves: 20,
    obstacles: [{ row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 3 }] },
  { id:  24, target: { type: 'clear',   value:    12 }, moves: 12,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }, { row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 3 }] },
  { id:  25, target: { type: 'collect', value:    18, flowerType: 5 }, moves: 20,
    obstacles: [{ row: 2, col: 3 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }] },
  { id:  26, target: { type: 'score',   value: 15800 }, moves: 22,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }] },
  { id:  27, target: { type: 'collect', value:    21, flowerType: 0 }, moves: 22,
    obstacles: [{ row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 3 }] },
  { id:  28, target: { type: 'clear',   value:     8 }, moves: 13,
    obstacles: [{ row: 1, col: 1 }, { row: 2, col: 1 }, { row: 1, col: 5 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 5, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 5 }] },
  { id:  29, target: { type: 'score',   value: 16800 }, moves: 22,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  { id:  30, target: { type: 'collect', value:    20, flowerType: 1 }, moves: 22,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  // Levels 31-40: The Greenhouse
  { id:  31, target: { type: 'score',   value: 13200 }, moves: 20,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 6 }] },
  { id:  32, target: { type: 'collect', value:    19, flowerType: 2 }, moves: 22,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id:  33, target: { type: 'clear',   value:     9 }, moves: 15,
    obstacles: [{ row: 0, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 6, col: 3 }, { row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }, { row: 3, col: 3 }] },
  { id:  34, target: { type: 'score',   value: 16100 }, moves: 22,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }] },
  { id:  35, target: { type: 'collect', value:    19, flowerType: 3 }, moves: 22,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }] },
  { id:  36, target: { type: 'score',   value: 17500 }, moves: 22,
    obstacles: [{ row: 1, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 2 }, { row: 5, col: 4 }] },
  { id:  37, target: { type: 'clear',   value:    13 }, moves: 14,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 1, col: 3 }, { row: 5, col: 3 }, { row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  { id:  38, target: { type: 'collect', value:    23, flowerType: 4 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 2, col: 1 }, { row: 1, col: 5 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 5, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 5 }] },
  { id:  39, target: { type: 'score',   value: 19800 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  40, target: { type: 'collect', value:    23, flowerType: 5 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 5 }] },
  // Levels 41-50: The Royal Garden
  { id:  41, target: { type: 'score',   value: 14800 }, moves: 22,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  { id:  42, target: { type: 'collect', value:    21, flowerType: 0 }, moves: 24,
    obstacles: [{ row: 0, col: 0 }, { row: 0, col: 3 }, { row: 0, col: 6 }, { row: 3, col: 0 }, { row: 3, col: 6 }, { row: 6, col: 0 }, { row: 6, col: 3 }, { row: 6, col: 6 }] },
  { id:  43, target: { type: 'clear',   value:    17 }, moves: 16,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 2 }, { row: 5, col: 4 }] },
  { id:  44, target: { type: 'score',   value: 18300 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id:  45, target: { type: 'collect', value:    19, flowerType: 1 }, moves: 24,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  { id:  46, target: { type: 'clear',   value:    15 }, moves: 15,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }, { row: 0, col: 3 }, { row: 6, col: 3 }] },
  { id:  47, target: { type: 'score',   value: 20100 }, moves: 24,
    obstacles: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }, { row: 0, col: 6 }, { row: 1, col: 5 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 5, col: 1 }, { row: 6, col: 0 }] },
  { id:  48, target: { type: 'collect', value:    25, flowerType: 2 }, moves: 26,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  49, target: { type: 'score',   value: 22400 }, moves: 26,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  { id:  50, target: { type: 'collect', value:    27, flowerType: 3 }, moves: 26,
    obstacles: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }, { row: 0, col: 6 }, { row: 1, col: 5 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 5, col: 1 }, { row: 6, col: 0 }] },
  // Levels 51-60: The Meadow
  { id:  51, target: { type: 'score',   value: 15400 }, moves: 22,
    obstacles: [{ row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 3 }] },
  { id:  52, target: { type: 'collect', value:    20, flowerType: 0 }, moves: 22,
    obstacles: [{ row: 2, col: 3 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }] },
  { id:  53, target: { type: 'score',   value: 17300 }, moves: 22,
    obstacles: [{ row: 1, col: 3 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 3 }, { row: 5, col: 3 }] },
  { id:  54, target: { type: 'clear',   value:    10 }, moves: 12,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 3, col: 3 }, { row: 2, col: 3 }] },
  { id:  55, target: { type: 'collect', value:    21, flowerType: 1 }, moves: 24,
    obstacles: [{ row: 1, col: 2 }, { row: 2, col: 2 }, { row: 4, col: 2 }, { row: 5, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 4, col: 4 }, { row: 5, col: 4 }] },
  { id:  56, target: { type: 'score',   value: 18300 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  57, target: { type: 'collect', value:    21, flowerType: 2 }, moves: 24,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 3 }] },
  { id:  58, target: { type: 'clear',   value:    11 }, moves: 10,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }, { row: 3, col: 3 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  { id:  59, target: { type: 'score',   value: 21400 }, moves: 26,
    obstacles: [{ row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 4, col: 3 }, { row: 5, col: 3 }] },
  { id:  60, target: { type: 'collect', value:    25, flowerType: 3 }, moves: 26,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  // Levels 61-70: The Water Garden
  { id:  61, target: { type: 'score',   value: 16500 }, moves: 23,
    obstacles: [{ row: 1, col: 0 }, { row: 2, col: 0 }, { row: 4, col: 0 }, { row: 5, col: 0 }, { row: 1, col: 6 }, { row: 2, col: 6 }, { row: 4, col: 6 }, { row: 5, col: 6 }] },
  { id:  62, target: { type: 'collect', value:    19, flowerType: 4 }, moves: 23,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  { id:  63, target: { type: 'score',   value: 17500 }, moves: 23,
    obstacles: [{ row: 1, col: 2 }, { row: 2, col: 2 }, { row: 4, col: 2 }, { row: 5, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 4, col: 4 }, { row: 5, col: 4 }] },
  { id:  64, target: { type: 'clear',   value:    12 }, moves: 14,
    obstacles: [{ row: 1, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 1 }, { row: 2, col: 3 }, { row: 2, col: 5 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 1 }, { row: 4, col: 3 }, { row: 4, col: 5 }, { row: 5, col: 2 }, { row: 5, col: 4 }] },
  { id:  65, target: { type: 'collect', value:    24, flowerType: 5 }, moves: 25,
    obstacles: [{ row: 1, col: 2 }, { row: 1, col: 4 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 2 }, { row: 5, col: 4 }] },
  { id:  66, target: { type: 'score',   value: 19800 }, moves: 25,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 3 }] },
  { id:  67, target: { type: 'collect', value:    24, flowerType: 0 }, moves: 25,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  68, target: { type: 'clear',   value:    13 }, moves: 13,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 3 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  69, target: { type: 'score',   value: 23800 }, moves: 27,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 3, col: 4 }, { row: 3, col: 2 }, { row: 4, col: 2 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  70, target: { type: 'collect', value:    27, flowerType: 1 }, moves: 27,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  // Levels 71-80: The Hedge Maze
  { id:  71, target: { type: 'score',   value: 17100 }, moves: 24,
    obstacles: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 5, col: 1 }, { row: 6, col: 1 }, { row: 0, col: 5 }, { row: 1, col: 5 }, { row: 5, col: 5 }, { row: 6, col: 5 }] },
  { id:  72, target: { type: 'collect', value:    22, flowerType: 2 }, moves: 24,
    obstacles: [{ row: 1, col: 3 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 3 }, { row: 5, col: 3 }] },
  { id:  73, target: { type: 'score',   value: 18200 }, moves: 24,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  { id:  74, target: { type: 'clear',   value:    13 }, moves: 12,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id:  75, target: { type: 'collect', value:    24, flowerType: 3 }, moves: 26,
    obstacles: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 5 }] },
  { id:  76, target: { type: 'score',   value: 20900 }, moves: 26,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  77, target: { type: 'collect', value:    24, flowerType: 4 }, moves: 26,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 3, col: 4 }, { row: 3, col: 2 }, { row: 4, col: 2 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  78, target: { type: 'clear',   value:    13 }, moves: 12,
    obstacles: [{ row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }] },
  { id:  79, target: { type: 'score',   value: 22600 }, moves: 28,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  80, target: { type: 'collect', value:    28, flowerType: 5 }, moves: 28,
    obstacles: [{ row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 4, col: 3 }, { row: 5, col: 3 }] },
  // Levels 81-90: The Butterfly Garden
  { id:  81, target: { type: 'score',   value: 16700 }, moves: 25,
    obstacles: [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }] },
  { id:  82, target: { type: 'collect', value:    22, flowerType: 0 }, moves: 25,
    obstacles: [{ row: 1, col: 0 }, { row: 2, col: 0 }, { row: 4, col: 0 }, { row: 5, col: 0 }, { row: 1, col: 6 }, { row: 2, col: 6 }, { row: 4, col: 6 }, { row: 5, col: 6 }] },
  { id:  83, target: { type: 'score',   value: 18900 }, moves: 25,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  { id:  84, target: { type: 'clear',   value:    14 }, moves: 11,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  85, target: { type: 'collect', value:    24, flowerType: 1 }, moves: 27,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 3 }] },
  { id:  86, target: { type: 'score',   value: 19900 }, moves: 27,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  87, target: { type: 'collect', value:    25, flowerType: 2 }, moves: 27,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  88, target: { type: 'clear',   value:    13 }, moves: 12,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 5 }, { row: 3, col: 3 }] },
  { id:  89, target: { type: 'score',   value: 25700 }, moves: 29,
    obstacles: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }, { row: 0, col: 6 }, { row: 1, col: 5 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 5, col: 1 }, { row: 6, col: 0 }] },
  { id:  90, target: { type: 'collect', value:    29, flowerType: 3 }, moves: 29,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  // Levels 91-100: The Enchanted Garden
  { id:  91, target: { type: 'score',   value: 19900 }, moves: 26,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }] },
  { id:  92, target: { type: 'collect', value:    23, flowerType: 4 }, moves: 26,
    obstacles: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 5, col: 1 }, { row: 6, col: 1 }, { row: 0, col: 5 }, { row: 1, col: 5 }, { row: 5, col: 5 }, { row: 6, col: 5 }] },
  { id:  93, target: { type: 'score',   value: 20800 }, moves: 26,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 3, col: 4 }, { row: 3, col: 2 }, { row: 4, col: 2 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  94, target: { type: 'clear',   value:    17 }, moves: 14,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  95, target: { type: 'collect', value:    27, flowerType: 5 }, moves: 28,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  96, target: { type: 'score',   value: 22400 }, moves: 28,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id:  97, target: { type: 'collect', value:    27, flowerType: 0 }, moves: 28,
    obstacles: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }, { row: 0, col: 6 }, { row: 1, col: 5 }, { row: 2, col: 4 }, { row: 4, col: 2 }, { row: 5, col: 1 }, { row: 6, col: 0 }] },
  { id:  98, target: { type: 'clear',   value:    17 }, moves: 15,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 1, col: 5 }, { row: 2, col: 2 }, { row: 2, col: 4 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 5 }, { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 5 }, { row: 2, col: 3 }, { row: 4, col: 3 }, { row: 3, col: 2 }, { row: 3, col: 4 }] },
  { id:  99, target: { type: 'score',   value: 24600 }, moves: 30,
    obstacles: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 2, col: 1 }, { row: 2, col: 5 }, { row: 3, col: 1 }, { row: 3, col: 5 }, { row: 4, col: 1 }, { row: 4, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }] },
  { id: 100, target: { type: 'collect', value:    31, flowerType: 1 }, moves: 30,
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 1, col: 3 }, { row: 5, col: 3 }] },
  ...parseLevelTable(MORE_LEVELS),
];

/** Groups of levels, shown as sections in the level picker */
export const CHAPTERS = [
  { name: 'The Garden',           emoji: '🌱', from:   1, to:  20 },
  { name: 'The Orchard',          emoji: '🍎', from:  21, to:  30 },
  { name: 'The Greenhouse',       emoji: '🪴', from:  31, to:  40 },
  { name: 'The Royal Garden',     emoji: '👑', from:  41, to:  50 },
  { name: 'The Meadow',           emoji: '🌼', from:  51, to:  60 },
  { name: 'The Water Garden',     emoji: '🪷', from:  61, to:  70 },
  { name: 'The Hedge Maze',       emoji: '🌿', from:  71, to:  80 },
  { name: 'The Butterfly Garden', emoji: '🦋', from:  81, to:  90 },
  { name: 'The Enchanted Garden', emoji: '✨', from:  91, to: 100 },
  { name: 'The Rose Garden',       emoji: '🌹', from: 101, to: 120 },
  { name: 'The Vegetable Patch',   emoji: '🥕', from: 121, to: 140 },
  { name: 'The Sunflower Field',   emoji: '🌻', from: 141, to: 160 },
  { name: 'The Cottage Garden',    emoji: '🏡', from: 161, to: 180 },
  { name: 'The Lily Pond',         emoji: '🐸', from: 181, to: 200 },
  { name: 'The Bamboo Grove',      emoji: '🎋', from: 201, to: 220 },
  { name: 'The Cactus Garden',     emoji: '🌵', from: 221, to: 240 },
  { name: 'The Tulip Fields',      emoji: '🌷', from: 241, to: 260 },
  { name: 'The Mushroom Wood',     emoji: '🍄', from: 261, to: 280 },
  { name: 'The Bee Garden',        emoji: '🐝', from: 281, to: 300 },
  { name: 'The Lavender Hills',    emoji: '💜', from: 301, to: 320 },
  { name: 'The Autumn Garden',     emoji: '🍁', from: 321, to: 340 },
  { name: 'The Winter Garden',     emoji: '❄️', from: 341, to: 360 },
  { name: 'The Cherry Blossoms',   emoji: '🌸', from: 361, to: 380 },
  { name: 'The Rainforest',        emoji: '🦜', from: 381, to: 400 },
  { name: 'The Moonlit Garden',    emoji: '🌙', from: 401, to: 420 },
  { name: 'The Seaside Garden',    emoji: '🐚', from: 421, to: 440 },
  { name: 'The Mountain Garden',   emoji: '🏔️', from: 441, to: 460 },
  { name: 'The Fairy Garden',      emoji: '🧚', from: 461, to: 480 },
  { name: 'The Garden of Legends', emoji: '🏆', from: 481, to: 500 },
];

// ── Board logic ───────────────────────────────────────────────────────────────
const rnd  = () => Math.floor(Math.random() * FLOWERS.length);
// Every tile gets a unique id so it can animate as it moves around the board
let tileSeq = 0;
const mkCell = (type, special = null, isBlocker = false) => ({ id: ++tileSeq, type, special, isBlocker });

export function initBoard(level) {
  const b = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => mkCell(rnd())));
  level.obstacles?.forEach(({ row, col }) => { b[row][col] = mkCell(-1, null, true); });
  // Dissolve any matches present at start
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c].isBlocker) continue;
      let tries = 0;
      while (tries++ < 30 && hasInitialMatch(b, r, c)) b[r][c] = mkCell(rnd());
    }
  }
  return b;
}

function hasInitialMatch(b, r, c) {
  const t = b[r][c].type;
  if (t < 0) return false;
  const eq = (nr, nc) =>
    nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !b[nr][nc].isBlocker && b[nr][nc].type === t;
  return (eq(r, c-1) && eq(r, c-2)) || (eq(r, c+1) && eq(r, c+2)) || (eq(r, c-1) && eq(r, c+1))
      || (eq(r-1, c) && eq(r-2, c)) || (eq(r+1, c) && eq(r+2, c)) || (eq(r-1, c) && eq(r+1, c));
}

export function getMatchGroups(b) {
  const groups = [];
  // Horizontal runs
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { c++; continue; }
      let len = 1;
      while (c + len < COLS && !b[r][c+len].isBlocker && b[r][c+len].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r, c: c+i })), len, dir: 'h' });
      c += len;
    }
  }
  // Vertical runs
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (b[r][c].isBlocker || b[r][c].type < 0) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && !b[r+len][c].isBlocker && b[r+len][c].type === b[r][c].type) len++;
      if (len >= 3) groups.push({ cells: Array.from({ length: len }, (_, i) => ({ r: r+i, c })), len, dir: 'v' });
      r += len;
    }
  }
  return groups;
}

const BLAST_POINTS = 60;     // per flower cleared by a special's blast (or a combo)
const CHAIN_POINTS = 200;    // the 2nd special set off in one go earns this, the 3rd twice it, …
const LEFTOVER_POINTS = 500; // per move left over when a level is won

const specialAt = (b, key) => { const [r, c] = key.split(',').map(Number); return b[r][c].special; };
const isStar = kind => kind === 'row' || kind === 'col';

/** Squares a special clears: its row or column (star), 3×3 area (sun) or its
 *  row and column together (rainbow). Never blockers. */
export function blastArea(b, r, c, kind) {
  const cells = [];
  const add = (rr, cc) => {
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && !b[rr][cc].isBlocker) cells.push(`${rr},${cc}`);
  };
  if (kind === 'row' || kind === 'cross') for (let cc = 0; cc < COLS; cc++) add(r, cc);
  if (kind === 'col') for (let rr = 0; rr < ROWS; rr++) add(rr, c);
  if (kind === 'cross') for (let rr = 0; rr < ROWS; rr++) if (rr !== r) add(rr, c);
  if (kind === 'area') for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
  return cells;
}

/** True when two neighbouring tiles are both specials: swapping them sets
 *  off a combo, no match needed. */
export function isComboSwap(b, r1, c1, r2, c2) {
  const a = b[r1]?.[c1], z = b[r2]?.[c2];
  return !!(a && z && !a.isBlocker && !z.isBlocker && a.special && z.special);
}

/** The squares two specials swapped together clear around (r, c), where they
 *  meet:
 *   🌟+🌟 its row and column   🌟+☀️ three rows and three columns
 *   ☀️+☀️ a 5×5 square          🌈+🌟 / 🌈+☀️ three rows, three columns and a 5×5 square
 *   🌈+🌈 the whole board */
export function comboBlast(b, r, c, k1, k2) {
  const kinds = [k1, k2].map(k => (isStar(k) ? 'star' : k === 'area' ? 'sun' : 'rainbow')).sort();
  const pair = kinds.join('+');
  const cells = new Set();
  const add = (rr, cc) => {
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && !b[rr][cc].isBlocker) cells.add(`${rr},${cc}`);
  };
  const bands = width => {
    for (let d = -width; d <= width; d++) {
      for (let cc = 0; cc < COLS; cc++) add(r + d, cc);
      for (let rr = 0; rr < ROWS; rr++) add(rr, c + d);
    }
  };
  const square = size => { for (let dr = -size; dr <= size; dr++) for (let dc = -size; dc <= size; dc++) add(r + dr, c + dc); };
  if (pair === 'rainbow+rainbow') square(Math.max(ROWS, COLS));
  else if (pair.includes('rainbow')) { bands(1); square(2); }
  else if (pair === 'sun+sun') square(2);
  else if (pair === 'star+sun') bands(1);
  else bands(0);
  return [...cells];
}

/** Clear one wave: the matches in `groups`, plus (on the first wave of a move)
 *  a combo of two swapped specials, or specials to set off (`ignite`). Every
 *  special caught in a blast goes off too. Each special after the first to go
 *  off earns a chain bonus, unless `chainBonus` is false. */
export function processMatches(b, groups, targetType = -1, { combo = null, ignite = [], chainBonus = true } = {}) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  const toRemove = new Set();
  let score = 0, collected = 0, blockersRemoved = 0;

  // Matched tiles are removed
  const matched = new Set();
  groups.forEach(g => {
    g.cells.forEach(({ r, c }) => { matched.add(`${r},${c}`); toRemove.add(`${r},${c}`); });
    score += g.len * 100 * (g.len >= 5 ? 3 : g.len >= 4 ? 2 : 1);
  });

  // Set off specials: any in a match, any set off directly, any in a combo's
  // blast, then any caught in another's blast (chain reactions)
  const fired = new Set();
  const queue = [...toRemove].filter(key => specialAt(b, key));
  ignite.forEach(key => { toRemove.add(key); queue.push(key); });
  let specials = 0;
  if (combo) {
    // The two swapped specials are used up by the combo rather than going off alone
    combo.consumed.forEach(key => { toRemove.add(key); fired.add(key); });
    specials += combo.consumed.length;
    combo.cells.forEach(key => {
      if (toRemove.has(key)) return;
      toRemove.add(key);
      if (specialAt(b, key)) queue.push(key);
    });
  }
  while (queue.length) {
    const key = queue.shift();
    if (fired.has(key)) continue;
    fired.add(key);
    specials++;
    const [r, c] = key.split(',').map(Number);
    for (const hit of blastArea(b, r, c, b[r][c].special)) {
      if (toRemove.has(hit)) continue;
      toRemove.add(hit);
      if (specialAt(b, hit)) queue.push(hit);
    }
  }
  // Flowers cleared by a blast (rather than matched) score points too
  score += [...toRemove].filter(key => !matched.has(key)).length * BLAST_POINTS;
  // Chain bonus: 200 for the 2nd special, 400 for the 3rd, …
  if (chainBonus) for (let n = 2; n <= specials; n++) score += CHAIN_POINTS * (n - 1);

  // Damage adjacent blockers
  [...toRemove].forEach(key => {
    const [r, c] = key.split(',').map(Number);
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr, nc]) => {
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && nb[nr][nc].isBlocker) {
        nb[nr][nc] = mkCell(-1);
        blockersRemoved++;
      }
    });
  });

  // Promote long matches to special tiles (before removal). A star from a
  // sideways match clears its column; from an up-and-down match, its row.
  // Each match makes at most one special, so every match clears something
  // (otherwise a 3×3 block of one flower would turn into nine suns and match
  // again forever).
  const used = new Set();   // groups that have made their special
  groups.forEach((g, i) => {
    const mid = g.cells[Math.floor(g.len / 2)];
    const key = `${mid.r},${mid.c}`;
    const origType = b[mid.r][mid.c].type;
    if (g.len >= 4 && toRemove.has(key)) {
      nb[mid.r][mid.c] = mkCell(origType, g.len >= 5 ? 'cross' : g.dir === 'h' ? 'col' : 'row');
      toRemove.delete(key);
      used.add(i);
    }
  });

  // L/T intersections → area special
  const across = new Map(), down = new Map();   // square → its sideways / up-and-down match
  groups.forEach((g, i) => g.cells.forEach(({ r, c }) => (g.dir === 'h' ? across : down).set(`${r},${c}`, i)));
  across.forEach((h, key) => {
    const v = down.get(key);
    if (v === undefined || used.has(h) || used.has(v) || !toRemove.has(key)) return;
    const [r, c] = key.split(',').map(Number);
    nb[r][c] = mkCell(b[r][c].type, 'area');
    toRemove.delete(key);
    used.add(h); used.add(v);
  });

  // Count collected then remove
  toRemove.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (targetType >= 0 && b[r][c].type === targetType) collected++;
    nb[r][c] = mkCell(-1);
  });

  return { board: nb, score, collected, blockersRemoved, specials };
}

export function applyGravity(b) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!nb[r][c].isBlocker && nb[r][c].type >= 0) col.push(nb[r][c]);
    }
    let ci = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (nb[r][c].isBlocker) continue;
      nb[r][c] = ci < col.length ? col[ci++] : mkCell(-1);
    }
  }
  return nb;
}

const fillBoard = b =>
  b.map(row => row.map(cl => (!cl.isBlocker && cl.type < 0 ? mkCell(rnd()) : cl)));

/** Resolve a move. `steps` holds the board after each stage (matches cleared,
 *  then tiles dropped and refilled, repeated) so it can be animated. Each
 *  wave of new matches scores more: the 2nd ×2, the 3rd ×3, … `first` passes a combo (or
 *  specials to set off) to the first wave, as processMatches takes them. */
export function fullCascade(b, targetType = -1, first = null) {
  let cur = b, totalScore = 0, totalCollected = 0, totalBlockers = 0, wave = 0;
  const steps = [];
  let groups = getMatchGroups(cur);
  let opts = first;
  while (groups.length > 0 || opts) {
    wave++;
    const res = processMatches(cur, groups, targetType, opts ?? undefined);
    totalScore    += res.score * wave;
    totalCollected += res.collected;
    totalBlockers  += res.blockersRemoved;
    steps.push(res.board);
    cur = fillBoard(applyGravity(res.board));
    steps.push(cur);
    groups = getMatchGroups(cur);
    opts = null;
  }
  return { board: cur, steps, totalScore, totalCollected, totalBlockers };
}

/** The first-wave options for swapping two specials: the tile moved from
 *  (r1, c1) lands on (r2, c2), where the combo goes off. `b` is the board
 *  after the swap. */
export function comboOpts(b, r1, c1, r2, c2) {
  const cells = comboBlast(b, r2, c2, b[r1][c1].special, b[r2][c2].special);
  return { combo: { cells, consumed: [`${r1},${c1}`, `${r2},${c2}`] } };
}

/** Play out a move: swap the two tiles, then set off any combo and matches.
 *  Null if the swap does nothing (no combo and no match). */
export function playMove(b, r1, c1, r2, c2, targetType = -1) {
  const swapped = trySwapBoard(b, r1, c1, r2, c2);
  if (isComboSwap(b, r1, c1, r2, c2)) return fullCascade(swapped, targetType, comboOpts(swapped, r1, c1, r2, c2));
  if (getMatchGroups(swapped).length === 0) return null;
  return fullCascade(swapped, targetType);
}

/** Bonus for winning with moves to spare: each spare move turns a random
 *  flower into a star, then every special on the board goes off. Adds to the
 *  score only. */
export function leftoverBonus(b, movesLeft) {
  const plain = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!b[r][c].isBlocker && b[r][c].type >= 0 && !b[r][c].special) plain.push([r, c]);
  }
  for (let i = plain.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [plain[i], plain[j]] = [plain[j], plain[i]];
  }
  const starred = b.map(row => row.map(cl => ({ ...cl })));
  plain.slice(0, Math.max(0, movesLeft)).forEach(([r, c]) => {
    starred[r][c] = mkCell(starred[r][c].type, Math.random() < 0.5 ? 'row' : 'col');
  });
  const ignite = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (starred[r][c].special) ignite.push(`${r},${c}`);
  if (!ignite.length) return { board: b, steps: [], totalScore: 0 };
  const res = fullCascade(starred, -1, { ignite, chainBonus: false });
  return {
    ...res,
    steps: [starred, ...res.steps],
    totalScore: res.totalScore + Math.max(0, movesLeft) * LEFTOVER_POINTS,
  };
}

export function trySwapBoard(b, r1, c1, r2, c2) {
  const nb = b.map(row => row.map(cl => ({ ...cl })));
  [nb[r1][c1], nb[r2][c2]] = [nb[r2][c2], nb[r1][c1]];
  return nb;
}

/** True if at least one adjacent swap would create a match (or a combo). */
export function hasValidMove(b) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c].isBlocker) continue;
    for (const [r2, c2] of [[r, c + 1], [r + 1, c]]) {
      if (r2 >= ROWS || c2 >= COLS || b[r2][c2].isBlocker) continue;
      if (isComboSwap(b, r, c, r2, c2)) return true;
      if (getMatchGroups(trySwapBoard(b, r, c, r2, c2)).length > 0) return true;
    }
  }
  return false;
}

/** A move to suggest when the player is stuck: the swap whose own matches (or
 *  combo) do most for the level's goal (collect that flower, break blockers,
 *  or score), judged only by what's on the board, as a player would see it.
 *  Ties go to the first found, top-left. Null if there is no move. */
export function findHint(b, target = { type: 'score' }) {
  const ft = target.type === 'collect' ? target.flowerType : -1;
  let best = null, bestValue = -1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c].isBlocker) continue;
    for (const [r2, c2] of [[r, c + 1], [r + 1, c]]) {
      if (r2 >= ROWS || c2 >= COLS || b[r2][c2].isBlocker) continue;
      const swapped = trySwapBoard(b, r, c, r2, c2);
      const groups = getMatchGroups(swapped);
      const combo = isComboSwap(b, r, c, r2, c2) ? comboOpts(swapped, r, c, r2, c2) : null;
      if (!groups.length && !combo) continue;
      const res = processMatches(swapped, groups, ft, combo ?? undefined);
      const value = target.type === 'collect' ? res.collected * 10000 + res.score
        : target.type === 'clear' ? res.blockersRemoved * 10000 + res.score
        : res.score;
      if (value > bestValue) { bestValue = value; best = { r1: r, c1: c, r2, c2 }; }
    }
  }
  return best;
}

/** Rearrange the existing tiles (blockers stay put) into a layout with no
 *  ready-made matches and at least one valid move. */
export function reshuffleBoard(b) {
  const spots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!b[r][c].isBlocker) spots.push([r, c]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const tiles = spots.map(([r, c]) => b[r][c]);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const nb = b.map(row => row.map(cl => ({ ...cl })));
    spots.forEach(([r, c], i) => { nb[r][c] = tiles[i]; });
    if (getMatchGroups(nb).length === 0 && hasValidMove(nb)) return nb;
  }
  // Extremely unlikely: fall back to fresh random flowers
  const nb = b.map(row => row.map(cl => (cl.isBlocker ? cl : mkCell(rnd()))));
  return getMatchGroups(nb).length === 0 && hasValidMove(nb) ? nb : reshuffleBoard(nb);
}

// ── Progress ──────────────────────────────────────────────────────────────────
// Like the levels on a map: you can play any level up to the furthest one
// you've reached. Kept on this device, and also worked out from the scores saved
// on the server after each win, so it follows you to another device.
const progressKey = user => `match3:progress:${user?.id ?? 'guest'}`;

/** Clamp to a real level number (1 … LEVELS.length + 1, where the +1 means all done). */
const clampLevel = n => Math.min(LEVELS.length + 1, Math.max(1, Math.floor(Number(n)) || 1));

/** The furthest level this player has reached on this device (1 if none). */
export function loadReached(user) {
  try { return clampLevel(JSON.parse(localStorage.getItem(progressKey(user)))?.reached); } catch { return 1; }
}

export function saveReached(user, reached) {
  try { localStorage.setItem(progressKey(user), JSON.stringify({ reached: clampLevel(reached) })); } catch { /* private mode */ }
}

/** The level after the highest one won, from the player's saved match3 scores
 *  (each win is saved with metadata.level). Metadata can arrive as text. */
export function reachedFromScores(rows) {
  let best = 0;
  for (const row of rows ?? []) {
    let meta = row?.metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
    const lv = Number(meta?.level);
    if (Number.isInteger(lv) && lv > best) best = lv;
  }
  return clampLevel(best + 1);
}
