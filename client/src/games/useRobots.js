/**
 * The computer players in a single-player game: which robots you're up
 * against (picked at random — `recast` picks again, e.g. for Play Again),
 * their names round the table, and the reactions they send now and then.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { pickRobots, introduce } from './players';
import { moments, reactionsFor } from './chatter';
import { REACTION_MS } from '../components/Reactions';

const SAY_AFTER_MS = 700;        // a moment to take in what happened before anyone reacts

/** `players` seats round the table: you (seat 0) and robots in the rest. */
export function useRobots(players) {
  const [cast, setCast] = useState(() => pickRobots(players - 1));
  // (Mexican Train and Golf choose how many play: pick again when that changes)
  if (cast.length !== players - 1) setCast(pickRobots(players - 1));
  // (The same object until the robots change, so it's safe to depend on)
  return useMemo(() => {
    const names = ['You', ...cast.map(r => r.name)];
    return {
      cast, names,
      recast: (n = players) => setCast(pickRobots(n - 1)),
      styleOf: seat => cast[seat - 1],
      /** "Ajax (daredevil)", for the robot in a seat */
      who: seat => (cast[seat - 1] ? introduce(cast[seat - 1]) : names[seat]),
    };
  }, [cast, players]);
}

/** The robots' reactions as `state` changes: [{ id, seat, emoji }], for <ReactionBursts>. */
export function useRobotChatter(game, state, cast) {
  const [reactions, setReactions] = useState([]);
  const before = useRef(state);
  const lastSaid = useRef(new Map());
  const timers = useRef([]);

  useEffect(() => {
    const prev = before.current;
    before.current = state;
    if (!prev || !state) return;
    const said = reactionsFor(moments(game, prev, state), {
      robots: seat => (seat > 0 ? cast[seat - 1] : null),
      isPerson: seat => seat === 0,
      lastSaid: lastSaid.current,
    });
    said.forEach((r, i) => {
      const id = Math.random();
      timers.current.push(setTimeout(() => {
        setReactions(list => [...list, { ...r, id }]);
        timers.current.push(setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), REACTION_MS));
      }, SAY_AFTER_MS + i * 900));
    });
  }, [game, state, cast]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return reactions;
}
