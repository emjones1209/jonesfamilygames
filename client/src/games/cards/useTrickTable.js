/**
 * useTrickTable — runs one hand of a trick-taking game on top of the pure
 * trickTable state machine: AI turns, a pause showing each completed trick,
 * and callbacks when a trick is collected or the hand is over.
 *
 * Options (read fresh on every render, so they may close over game state):
 *   winnerOf(trick)          → winning seat of a complete trick
 *   legalPlays(table, seat)  → cards `seat` may play now
 *   isAi(seat, table)        → true if the computer chooses this seat's card
 *   chooseAiCard(seat, table, legal) → the card to play
 *   onTrickCollected(table)  → after each trick (table.lastTrick is set)
 *   onHandDone(table)        → after the last trick
 *   aiDelay, collectDelay    → pacing in ms
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { dealTable, playCard, collectTrick } from './trickTable';

/** Cards `seat` may play in table `t` (none unless it's that seat's turn). */
const legalIn = (t, seat, legalPlays) =>
  (!t || t.status !== 'playing' || t.turn !== seat ? [] : legalPlays(t, seat));

export function useTrickTable(options) {
  const { aiDelay = 700, collectDelay = 1300 } = options;
  const [table, setTable] = useState(null);

  // Latest options/state for timers and stable callbacks
  const opts = useRef(options);
  const tableRef = useRef(table);
  useEffect(() => { opts.current = options; tableRef.current = table; });

  const deal = useCallback((hands, leader) => setTable(dealTable(hands, leader)), []);
  const clear = useCallback(() => setTable(null), []);

  // The refs above are synced after each render, so they're right for event
  // handlers and timers but one render stale *during* render. Render-time code
  // must use `legalFor`, which reads the current state and options directly.
  const legalFor = seat => legalIn(table, seat, options.legalPlays);

  /** Play a card for `seat` (ignored if it isn't that seat's turn or the card is illegal). */
  const play = useCallback((seat, card) => {
    const legal = legalIn(tableRef.current, seat, opts.current.legalPlays);
    if (!legal.some(c => c.id === card.id)) return;
    setTable(t => playCard(t, seat, card, { winnerOf: opts.current.winnerOf }));
  }, []);

  // Computer turns
  const turn = table?.turn, status = table?.status;
  useEffect(() => {
    if (status !== 'playing' || !opts.current.isAi(turn, tableRef.current)) return;
    const timer = setTimeout(() => {
      const legal = legalIn(tableRef.current, turn, opts.current.legalPlays);
      if (legal.length) play(turn, opts.current.chooseAiCard(turn, tableRef.current, legal));
    }, aiDelay);
    return () => clearTimeout(timer);
  }, [turn, status, table?.trick.length, aiDelay, play]);

  // Leave a completed trick on screen, then hand it to the winner
  useEffect(() => {
    if (status !== 'collecting') return;
    const timer = setTimeout(() => {
      const next = collectTrick(tableRef.current);
      setTable(next);
      opts.current.onTrickCollected?.(next);
      if (next.status === 'done') opts.current.onHandDone?.(next);
    }, collectDelay);
    return () => clearTimeout(timer);
  }, [status, collectDelay]);

  return { table, deal, clear, play, legalFor };
}
