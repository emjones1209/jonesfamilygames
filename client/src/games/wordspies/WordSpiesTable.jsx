/**
 * WordSpiesTable — the Word Spies screen, drawn from a game view (see
 * wordSpiesEngine.js) turned round so the player looking at it is seat 0.
 * Only played at play-together tables (it's a game for people, not robots).
 *
 * Guessing takes two taps (pick a word, then Guess) so a stray finger can't
 * end the game on the trap.
 */
import { useState } from 'react';
import { ArrowLeft, Flag } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { clueProblem, guessable, teamLeft, foundCount, TEAMS, TEAM_EMOJI, TOTAL_TOGETHER } from './wordSpiesEngine';

const BG = 'from-game-bg to-slate-900';
const SIDES = ['A', 'B'];
const SIDE_EMOJI = ['🔶', '🔷'];

// What a card looks like once turned over (a solid tile), and — still a card, with a thick
// coloured edge — when it's yet to be found and you can see the key
const LOOKS = {
  a: { solid: 'bg-amber-400 text-amber-950 border-2 border-amber-200', faint: 'bg-[#efe6d2] text-amber-800 border-[5px] border-amber-500', badge: '☀️' },
  b: { solid: 'bg-indigo-500 text-white border-2 border-indigo-200', faint: 'bg-[#efe6d2] text-indigo-800 border-[5px] border-indigo-500', badge: '🌙' },
  n: { solid: 'bg-rose-300 text-rose-950 border-2 border-rose-100', faint: 'bg-[#efe6d2] text-stone-900 border-2 border-[#fff8e8]', badge: '🚶' },
  x: { solid: 'bg-black text-white border-2 border-red-500', faint: 'bg-stone-800 text-red-100 border-[5px] border-red-600', badge: '💣' },
  g: { solid: 'bg-emerald-500 text-emerald-950 border-2 border-emerald-200', faint: 'bg-[#efe6d2] text-emerald-800 border-[5px] border-emerald-500', badge: '✓' },
};
const HIDDEN = 'bg-[#efe6d2] text-stone-900 border-2 border-[#fff8e8]';
// Together: a bystander turned up here on one side's clue, but the card is still in play
const MISSED = 'bg-rose-200 text-rose-950 border-2 border-dashed border-rose-400';

const teamName = (mode, t) => (mode === 'teams' ? `${TEAM_EMOJI[t]} ${TEAMS[t]}` : `${SIDE_EMOJI[t]} Side ${SIDES[t]}`);

function describe(e, names, mode) {
  const who = names[e.seat] ?? 'Someone';
  if (e.kind === 'clue') return `${who} gave the clue ${e.word.toUpperCase()} · ${e.count ?? '∞'}`;
  if (e.kind === 'stop') return `${who} stopped guessing.`;
  if (e.kind === 'takeClues') return `${who} took over the clues for ${teamName(mode, e.side)}.`;
  const what = {
    a: 'a ☀️ Sun word', b: 'a 🌙 Moon word', n: 'a bystander 🚶', x: 'the trap 💣', g: 'a word to find ✓',
  }[e.result];
  return `${who} guessed ${e.word.toUpperCase()}: ${what}${e.result === 'n' && mode === 'together' ? ' (on that clue giver\'s key)' : ''}.`;
}

/**
 * @param view     game view, the viewer as seat 0
 * @param names    each seat's name, 'You' first
 * @param absent   each seat (turned the same way): has that person gone? (lets a guesser take over the clues)
 */
export function WordSpiesTable({ view, names, onAction, onExit, error, reactions = {}, overlay, gameOverActions, absent = [] }) {
  const [picked, setPicked] = useState(null);       // the card you're about to guess
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const v = view;
  const teams = v.mode === 'teams';
  const mySide = v.side[0];
  const over = v.phase === 'gameOver';
  const amCluer = teams && v.cluers[mySide] === 0;
  const myClue = !over && v.phase === 'clue' && (teams ? amCluer && v.turn === mySide : v.turn === mySide);
  const myGuess = !over && v.phase === 'guess' && (teams ? !amCluer && v.turn === mySide : v.turn !== mySide);
  const typed = word.trim();
  const problem = typed ? clueProblem(v, typed) : null;
  const seats = v.side.map((side, seat) => ({ seat, side }));

  const send = action => { setPicked(null); onAction(action); };
  const giveClue = e => {
    e.preventDefault();
    if (!typed || problem) return;
    send({ type: 'clue', word: typed, count: teams && count === '∞' ? null : count });
    setWord('');
    setCount(1);
  };
  const tap = i => {
    if (!myGuess || !guessable(v, i)) return;
    setPicked(p => (p === i ? null : i));
  };

  // Each card: its word, what's known about it, and what your key says (if you can see one)
  const card = i => {
    const shown = v.shown[i];
    const secret = v.mine?.[i];
    const theirs = v.theirs?.[i];
    let look = HIDDEN, badge = null;
    if (shown) { look = LOOKS[shown].solid; badge = LOOKS[shown].badge; } else if (secret && (secret !== 'n' || over)) {
      look = LOOKS[secret].faint; badge = LOOKS[secret].badge;
    }
    const missed = !teams ? [0, 1].filter(t => v.missed[t][i]) : [];
    if (!shown && missed.length > 0 && look === HIDDEN) look = MISSED;
    const can = myGuess && guessable(v, i);
    const w = v.words[i];
    return (
      <button key={i} onClick={() => tap(i)} disabled={!can}
        className={`relative rounded-lg flex items-center justify-center font-bold uppercase leading-none shadow-md transition-transform
          ${look} ${picked === i ? 'ring-4 ring-game-gold scale-105 z-10' : ''} ${can ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
          `}
        style={{ aspectRatio: '1.55', fontSize: `min(${19 / Math.max(w.length, 5)}cqw, 3.4cqw)`, letterSpacing: '0.02em' }}>
        <span className="px-0.5 whitespace-nowrap text-center">{w}</span>
        {badge && <span className="absolute top-0.5 right-1" style={{ fontSize: '2.2cqw' }}>{badge}</span>}
        {/* Together: a bystander already turned up here on a side's clue */}
        {missed.length > 0 && !shown && (
          <span className="absolute bottom-0.5 left-1 font-normal normal-case" style={{ fontSize: '1.9cqw' }}>
            {missed.map(t => `🚶${SIDES[t]}`).join(' ')}
          </span>
        )}
        {/* At the end: what the other side's key said */}
        {over && !teams && theirs && theirs !== 'n' && (
          <span className="absolute bottom-0.5 right-1" style={{ fontSize: '1.9cqw' }}>{SIDES[1 - mySide]}:{LOOKS[theirs].badge}</span>
        )}
      </button>
    );
  };

  // ── The line that says what's happening ────────────────────────────────────
  const cluerName = t => names[v.cluers[t]];
  const sideNames = t => seats.filter(s => s.side === t).map(s => names[s.seat]).join(' & ');
  let status;
  if (over) status = '';
  else if (myClue) status = teams ? 'You\'re the clue giver: give your team a clue.' : 'Your side gives the clue: pick a word that links some of your green words.';
  else if (myGuess) status = picked != null ? `Guess ${v.words[picked].toUpperCase()}? Tap Guess — or another word.` : 'Tap a word to guess it.';
  else if (v.phase === 'clue') status = teams ? `${cluerName(v.turn)} is thinking of a clue for ${teamName('teams', v.turn)}…` : `${sideNames(v.turn)} ${v.side.filter(x => x === v.turn).length > 1 ? 'are' : 'is'} thinking of a clue…`;
  else if (teams) status = `${teamName('teams', v.turn)} is guessing…`;
  else status = `${sideNames(1 - v.turn)} ${v.side.filter(x => x !== v.turn).length > 1 ? 'are' : 'is'} guessing…`;

  const guessesLeft = v.clue && teams && v.clue.count ? v.clue.count + 1 - v.guesses : null;
  const myCluerGone = teams && !over && !amCluer && absent[v.cluers[mySide]];
  const recent = v.log.slice(-4).reverse();

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-3 flex flex-col items-center gap-2 select-none`}>
      <header className="self-stretch flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="wordspies" title="Word Spies" />
        </div>
        <div className="text-white/80 text-sm font-semibold">🕵️ Word Spies</div>
        <div className="text-white/80 text-xs text-right font-semibold">
          {teams ? (
            <>
              <div>☀️ {teamLeft(v, 0)} left · 🌙 {teamLeft(v, 1)} left</div>
              <div className="text-white/50 font-normal">Wins ☀️ {v.wins[0]} · 🌙 {v.wins[1]}</div>
            </>
          ) : (
            <>
              <div>Found {foundCount(v)}/{TOTAL_TOGETHER} · ⏳ {v.turnsLeft} {v.turnsLeft === 1 ? 'turn' : 'turns'}</div>
              <div className="text-white/50 font-normal">Won {v.record.won} · Lost {v.record.lost}</div>
            </>
          )}
        </div>
      </header>

      {/* Who's on which team (or side), and who gives the clues */}
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
        {[0, 1].map(t => (
          <div key={t} className={`flex flex-wrap items-center gap-1 rounded-full px-3 py-1 text-sm
            ${!over && v.turn === t ? 'bg-white/15 ring-1 ring-game-gold' : 'bg-white/5'}`}>
            <span className="text-white/80 font-semibold mr-1">{teamName(v.mode, t)}{t === mySide ? ' (you)' : ''}:</span>
            {seats.filter(s => s.side === t).map(({ seat }) => (
              <span key={seat} className={`text-white/80 ${absent[seat] ? 'opacity-50' : ''}`}>
                {teams && v.cluers[t] === seat ? '🔑 ' : ''}{names[seat]}{reactions[seat] ? ` ${reactions[seat]}` : ''}
              </span>
            )).reduce((list, el, i) => (i ? [...list, <span key={`,${i}`} className="text-white/30">·</span>, el] : [el]), [])}
          </div>
        ))}
      </div>

      {/* The clue */}
      <div className="min-h-[3.5rem] flex flex-col items-center justify-center text-center">
        {v.clue && !over ? (
          <>
            <div className="text-white/50 text-xs">
              {teams ? `${cluerName(v.clue.side)}'s clue for ${teamName('teams', v.clue.side)}` : `${names[v.clue.seat]}'s clue (${teamName('together', v.clue.side)}'s key)`}
            </div>
            <div className="text-2xl font-black tracking-wide text-game-gold">
              {v.clue.word.toUpperCase()} <span className="text-white">· {v.clue.count ?? '∞'}</span>
            </div>
            {guessesLeft != null && <div className="text-white/50 text-xs">{guessesLeft} {guessesLeft === 1 ? 'guess' : 'guesses'} left</div>}
          </>
        ) : !over && (
          <div className="text-white/40 text-sm">
            {teams ? (amCluer ? 'Only clue givers 🔑 can see the colours behind the words.' : 'Your clue giver 🔑 knows which words are your team\'s.')
              : 'You can see your side\'s key: green words are the ones your side wants found; 💣 are traps.'}
          </div>
        )}
      </div>

      {/* The board */}
      <div className="w-full max-w-3xl" style={{ containerType: 'inline-size' }}>
        <div className="grid grid-cols-5 gap-[1.2cqw]">{v.words.map((_, i) => card(i))}</div>
      </div>

      <div className="text-center min-h-[1.5rem] max-w-md">
        <p className={`font-semibold ${error ? 'text-red-300' : myClue || myGuess ? 'text-game-gold' : 'text-white/80'}`}>{error || status}</p>
      </div>

      {/* Giving a clue */}
      {myClue && (
        <form onSubmit={giveClue} className="w-full max-w-md card-panel !p-4 flex flex-col gap-3">
          <input value={word} onChange={e => setWord(e.target.value.replace(/\s/g, ''))} placeholder="One-word clue"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={24}
            className="text-center text-2xl font-bold uppercase rounded-xl bg-white/10 text-white py-2 placeholder:text-white/25 placeholder:normal-case" />
          {problem && <p className="text-red-300 text-sm text-center">{problem}</p>}
          <div>
            <p className="text-white/60 text-xs mb-1">How many words is it for?{teams ? ' (∞: as many as you like)' : ''}</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {(teams ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '∞'] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map(n => (
                <button key={n} type="button" onClick={() => setCount(n)}
                  className={`rounded-lg min-w-[40px] min-h-[40px] text-lg font-bold ${count === n ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white'}`}>{n}</button>
              ))}
            </div>
          </div>
          <Button variant="gold" type="submit" disabled={!typed || !!problem}>
            Give the clue{typed && !problem ? `: ${typed.toUpperCase()} · ${count}` : ''}
          </Button>
        </form>
      )}

      {/* Guessing */}
      {myGuess && (
        <div className="flex gap-2 flex-wrap justify-center">
          {picked != null && (
            <Button variant="gold" onClick={() => send({ type: 'guess', card: picked })}>Guess {v.words[picked].toUpperCase()}</Button>
          )}
          <Button variant="ghost" disabled={!v.guesses} onClick={() => send({ type: 'endTurn' })}>
            {v.guesses ? 'Stop guessing' : 'Stop (after one guess)'}
          </Button>
        </div>
      )}

      {myCluerGone && (
        <div className="max-w-md text-center text-sm text-white/80 bg-amber-500/15 border border-amber-400/40 rounded-2xl px-4 py-2 flex flex-col gap-2">
          <span>{names[v.cluers[mySide]]} has gone. Someone on your team can give the clues instead (and see the key).</span>
          <Button variant="ghost" onClick={() => send({ type: 'takeClues' })}>🔑 I&apos;ll give the clues</Button>
        </div>
      )}

      {/* What's happened lately */}
      {recent.length > 0 && (
        <div className="w-full max-w-md text-xs text-white/60 flex flex-col gap-0.5 text-center">
          {recent.map((e, i) => <div key={v.log.length - i} className={i === 0 ? 'text-white/85' : ''}>{describe(e, names, v.mode)}</div>)}
        </div>
      )}

      {over && (
        <div className="w-full max-w-md card-panel !p-4 text-center">
          <div className="text-4xl mb-1">{teams ? (v.winner === mySide ? '🏆' : '😢') : v.winner ? '🎉' : '😢'}</div>
          <h2 className="text-xl font-bold text-game-gold mb-1">
            {teams ? `${teamName('teams', v.winner)} ${v.winner === mySide ? '(your team) wins!' : 'wins!'}`
              : v.winner ? 'You found them all — well done, spies!' : 'Not this time…'}
          </h2>
          <p className="text-white/70 text-sm mb-3">{
            v.reason === 'trap' ? `${names[v.log.at(-1)?.seat] ?? 'Someone'} found ${teams ? 'the' : 'a'} trap 💣${teams ? `, so ${teamName('teams', 1 - v.winner)} lost` : ''}.`
              : v.reason === 'allFound' ? (teams ? 'They found all their words.' : `All ${TOTAL_TOGETHER} words in ${v.turns - v.turnsLeft + 1} turns.`)
                : v.reason === 'outOfTurns' ? `The turns ran out with ${TOTAL_TOGETHER - foundCount(v)} still to find.`
                  : 'Someone gave up.'
          } The board shows every word now.</p>
          {gameOverActions}
        </div>
      )}

      {!over && (
        <Button variant={confirmGiveUp ? 'danger' : 'ghost'} className="!min-h-[40px] text-sm mt-1" onClick={() => {
          if (!confirmGiveUp) { setConfirmGiveUp(true); setTimeout(() => setConfirmGiveUp(false), 3000); return; }
          setConfirmGiveUp(false); send({ type: 'giveUp' });
        }}>
          <Flag size={14} className="inline -mt-0.5" /> {confirmGiveUp ? 'Tap again to give up' : 'Give up'}
        </Button>
      )}
      {overlay}
    </div>
  );
}

