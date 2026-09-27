/**
 * DiceTable — the Five Dice screen, drawn from a game view (see diceEngine.js)
 * in which the player looking at it comes first. Used by the single-player
 * game and by play-together tables alike: one scorecard column per player.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import {
  UPPER, LOWER, LABELS, HINTS, UPPER_BONUS_AT, UPPER_BONUS, ROLLS_PER_TURN, options, total, upperTotal, upperBonus,
} from './diceRules';

// Pip positions on a 3×3 grid for each face
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const listNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`);

function Die({ value, held, rollId, onClick, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        key={held ? `held-${value}` : `${rollId}-${value}`}
        initial={held || !value ? false : { rotate: -200, scale: 0.6, opacity: 0.4 }}
        animate={{ rotate: 0, scale: 1, opacity: 1, y: held ? -10 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        onClick={onClick} disabled={disabled}
        className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white shadow-lg grid grid-cols-3 grid-rows-3 p-2 md:p-2.5 gap-0.5
          border-4 ${held ? 'border-game-gold' : 'border-transparent'} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        aria-label={value ? `Die showing ${value}${held ? ', held' : ''}` : 'Die'}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={`rounded-full m-auto w-3 h-3 md:w-3.5 md:h-3.5 ${value && PIPS[value].includes(i) ? 'bg-gray-900' : ''}`} />
        ))}
      </motion.button>
      <span className={`text-xs font-bold h-4 ${held ? 'text-game-gold' : 'text-transparent'}`}>HELD</span>
    </div>
  );
}

/** The latest roll or score in words. */
function describe(last, names) {
  if (!last) return '';
  const you = last.seat === 0, who = names[last.seat];
  if (last.kind === 'score') {
    return `${who} ${you ? 'score' : 'scores'} ${last.points} in ${LABELS[last.box]}.${last.bonus ? ' Bonus Five of a Kind: +100!' : ''}`;
  }
  if (last.first) return `${who} ${you ? 'roll' : 'rolls'}…`;
  return last.keeping.length
    ? `${who} ${you ? 'keep' : 'keeps'} ${[...last.keeping].sort((a, b) => a - b).join(', ')} and ${you ? 'roll' : 'rolls'} again…`
    : `${who} ${you ? 'roll' : 'rolls'} all five again…`;
}

/**
 * @param view        game view with the viewer first (seat 0)
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function DiceTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [pick, setPick] = useState(null);           // { box, rollNo } a box you've tapped once (tap again to score)
  const { cards, dice: turn } = view;
  const over = view.phase === 'gameOver';
  const yourTurn = !over && view.turn === 0;
  const rolled = turn.rollsLeft < ROLLS_PER_TURN;
  const choices = yourTurn && rolled ? options(cards[0], turn.dice) : {};
  const picked = pick && pick.rollNo === view.rollNo && yourTurn ? pick.box : null;
  const act = a => onAction({ ...a, seat: 0 });

  const tapBox = box => {
    if (!(box in choices)) return;
    if (picked === box) { setPick(null); act({ type: 'score', box }); }
    else setPick({ box, rollNo: view.rollNo });
  };

  let message = error || describe(view.last, names);
  if (!error && picked) message = `Score ${choices[picked]} in ${LABELS[picked]}? Tap it again to confirm.`;
  else if (!error && yourTurn && !rolled) message = `${view.last ? `${message} ` : ''}Your turn — tap Roll.`;
  else if (!error && yourTurn && view.last?.seat === 0 && view.last.kind === 'roll') {
    message = turn.rollsLeft ? 'Tap dice to hold them, then roll again — or pick a box to score.' : 'Last roll — now pick a box to score.';
  }

  const seats = cards.map((_, i) => i);
  const nameCell = i => `${names[i]}${reactions[i] ? ` ${reactions[i]}` : ''}`;
  const row = box => {
    const canPick = box in choices;
    return (
      <tr key={box} className={`border-t border-white/10 ${picked === box ? 'bg-game-gold/20' : ''}`}>
        <td className="py-1 pr-2 text-left">
          <div className="text-white text-sm md:text-base">{LABELS[box]}</div>
          <div className="text-white/40 text-[10px] md:text-xs hidden [@media(min-height:900px)]:block">{HINTS[box]}</div>
        </td>
        {seats.map(i => {
          const fresh = view.last?.kind === 'score' && view.last.seat === i && view.last.box === box;
          if (cards[i][box] != null) {
            return (
              <td key={i} className="py-1 text-center">
                <span className={`font-bold ${fresh ? 'text-game-gold bg-game-gold/20 rounded px-2' : i === 0 ? 'text-white' : 'text-white/80'}`}>{cards[i][box]}</span>
              </td>
            );
          }
          return (
            <td key={i} className="py-1 text-center">
              {i === 0 && canPick ? (
                <button onClick={() => tapBox(box)}
                  className={`min-w-[3rem] min-h-[36px] rounded-lg font-bold ${picked === box ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-game-gold/80 hover:bg-white/20'}`}>
                  {choices[box]}
                </button>
              ) : <span className="text-white/20">–</span>}
            </td>
          );
        })}
      </tr>
    );
  };
  const sumRow = (label, values, strong = false) => (
    <tr key={label} className={`border-t border-white/20 ${strong ? 'text-game-gold font-bold text-base md:text-lg' : 'text-white/70 text-sm'}`}>
      <td className="py-1 text-left">{label}</td>
      {values.map((v, i) => <td key={i} className="py-1 text-center">{v}</td>)}
    </tr>
  );
  const winners = view.winners ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-rose-900 p-3 select-none">
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="dice" title="Five Dice" />
        </div>
        <div className="text-white/70 text-sm">Five Dice{subtitle ? ` · ${subtitle}` : ''}</div>
        <div className="text-right text-xs text-white/60">{seats.map(i => `${names[i]} ${total(cards[i])}`).join(' · ')}</div>
      </header>

      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-4 items-center lg:items-start">
        {/* Dice and controls */}
        <div className="flex-1 flex flex-col items-center gap-3 w-full lg:pt-10">
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${yourTurn ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white/70'}`}>
            {over ? 'Game over' : yourTurn ? 'Your turn' : `${names[view.turn]}'s turn`}
          </div>
          <div className="flex gap-2 md:gap-3 mt-2">
            {turn.dice.map((d, i) => (
              <Die key={i} value={d} held={turn.held[i]} rollId={view.rollNo}
                disabled={!yourTurn || !rolled || turn.rollsLeft === 0}
                onClick={() => { act({ type: 'hold', i }); setPick(null); }} />
            ))}
          </div>
          <Button variant="gold" className="text-lg w-56" disabled={!yourTurn || turn.rollsLeft === 0}
            onClick={() => { setPick(null); act({ type: 'roll' }); }}>
            {!rolled ? '🎲 Roll' : turn.rollsLeft ? `🎲 Roll again (${turn.rollsLeft} left)` : 'No rolls left'}
          </Button>
          <p className={`text-center text-sm md:text-base min-h-[3rem] max-w-sm ${error ? 'text-red-300' : 'text-amber-300'}`}>{message}</p>
        </div>

        {/* Scorecard: a column per player */}
        <div className="card-panel p-3 w-full max-w-md">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-xs">
                <th className="text-left font-normal">Box</th>
                {seats.map(i => (
                  <th key={i} className={`font-normal truncate max-w-[4.5rem] ${!over && view.turn === i ? 'text-game-gold font-bold' : ''}`}>{nameCell(i)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UPPER.map(row)}
              {sumRow(`Bonus (${UPPER_BONUS} at ${UPPER_BONUS_AT}+)`,
                cards.map(c => (upperBonus(c) ? `+${UPPER_BONUS}` : `${upperTotal(c)}/${UPPER_BONUS_AT}`)))}
              {LOWER.map(row)}
              {cards.some(c => c.bonus) && sumRow('Five of a Kind bonus', cards.map(c => c.bonus || '–'))}
              {sumRow('Total', cards.map(total), true)}
            </tbody>
          </table>
        </div>
      </div>
      {overlay}

      {over && (
        <ResultPanel>
          <div className="text-5xl mb-2">{winners.includes(0) ? '🏆' : '🎲'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-2">
            {winners.length > 1 ? (winners.includes(0) ? 'You tie for the win!' : `${listNames(winners.map(w => names[w]))} tie!`)
              : winners[0] === 0 ? 'You win!' : `${names[winners[0]]} wins`}
          </h2>
          <div className="text-white/80 mb-4">{seats.map(i => `${names[i]} ${total(cards[i])}`).join(' · ')}</div>
          {gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}
