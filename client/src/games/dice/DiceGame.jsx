import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import {
  UPPER, LOWER, LABELS, HINTS, UPPER_BONUS_AT, UPPER_BONUS, ROLLS_PER_TURN,
  options, score, total, upperTotal, upperBonus, emptyCard, newTurn, roll, toggleHold, cardFull,
} from './diceRules';
import { robotStep } from './diceAI';
import api from '../../utils/api';

const ROBOT_MS = 1600;       // a computer step (roll, keep, score) — slow enough to follow

// Pip positions on a 3×3 grid for each face
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

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

export default function DiceGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [cards, setCards] = useState([emptyCard(), emptyCard()]);
  const [player, setPlayer] = useState(0);            // whose turn: 0 = you, 1 = computer
  const [turn, setTurn] = useState(newTurn());
  const [rollId, setRollId] = useState(0);            // changes on every roll (for the tumble)
  const [picked, setPicked] = useState(null);         // box you've tapped once (tap again to score)
  const [msg, setMsg] = useState('');
  const [lastScored, setLastScored] = useState(null); // { player, box } — shown highlighted
  const posted = useRef(false);

  const startGame = diff => {
    setDifficulty(diff);
    setCards([emptyCard(), emptyCard()]);
    setPlayer(0); setTurn(newTurn()); setPicked(null); setLastScored(null);
    setMsg('Your turn — tap Roll.');
    posted.current = false;
  };

  const over = cards.every(cardFull);
  const doRoll = t => { setTurn(roll(t)); setRollId(n => n + 1); };
  const finishTurn = (who, box) => {
    const next = cards.map((c, i) => (i === who ? score(c, box, turn.dice) : c));
    setCards(next);
    setLastScored({ player: who, box });
    setPicked(null);
    setTurn(newTurn());
    setPlayer(1 - who);
    const pts = next[who][box];
    setMsg(`${who === 0 ? 'You score' : 'Computer scores'} ${pts} in ${LABELS[box]}.${next[who].bonus > cards[who].bonus ? ' Bonus Five of a Kind: +100!' : ''}`);
  };

  // ── Computer turns, one visible step at a time ──────────────────────────
  useEffect(() => {
    if (!difficulty || player !== 1 || over) return;
    const timer = setTimeout(() => {
      const move = robotStep(cards[1], turn, difficulty);
      if (move.type === 'roll') {
        const keeping = turn.dice.filter((_, i) => move.held[i]);
        if (turn.rollsLeft < ROLLS_PER_TURN) {
          setMsg(keeping.length ? `Computer keeps ${keeping.sort((a, b) => a - b).join(', ')} and rolls again…` : 'Computer rolls all five again…');
        } else setMsg('Computer rolls…');
        doRoll({ ...turn, held: move.held });
      } else {
        finishTurn(1, move.box);
      }
    }, ROBOT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, turn, difficulty, over]);

  useEffect(() => {
    if (!over || !difficulty || posted.current) return;
    posted.current = true;
    api.post('/scores', { game: 'dice', score: total(cards[0]), difficulty }).catch(() => {});
  }, [over, difficulty, cards]);

  if (!difficulty) {
    return (
      <GameSetup emoji="🎲" title="Five Dice" subtitle="Roll, hold and fill your scorecard — beat the computer!"
        note="Three rolls a turn · 13 turns each" bgClass="from-game-bg to-rose-900" tutorial={TUTORIALS.dice} onStart={startGame} />
    );
  }

  // ── Your moves ───────────────────────────────────────────────────────────
  const yourTurn = player === 0 && !over;
  const rolled = turn.rollsLeft < ROLLS_PER_TURN;
  const choices = yourTurn && rolled ? options(cards[0], turn.dice) : {};
  const tapBox = box => {
    if (!(box in choices)) return;
    if (picked === box) finishTurn(0, box);
    else { setPicked(box); setMsg(`Score ${choices[box]} in ${LABELS[box]}? Tap it again to confirm.`); }
  };
  const rollNow = () => {
    if (!yourTurn || turn.rollsLeft === 0) return;
    setPicked(null);
    doRoll(turn);
    setMsg(turn.rollsLeft === 1 ? 'Last roll — now pick a box to score.' : 'Tap dice to hold them, then roll again — or pick a box to score.');
  };

  const Row = ({ box }) => {
    const canPick = box in choices;
    return (
      <tr className={`border-t border-white/10 ${picked === box ? 'bg-game-gold/20' : ''}`}>
        <td className="py-1 pr-2 text-left">
          <div className="text-white text-sm md:text-base">{LABELS[box]}</div>
          <div className="text-white/40 text-[10px] md:text-xs hidden [@media(min-height:900px)]:block">{HINTS[box]}</div>
        </td>
        <td className="py-1 text-center w-20">
          {cards[0][box] != null ? (
            <span className={`font-bold ${lastScored?.player === 0 && lastScored.box === box ? 'text-game-gold' : 'text-white'}`}>{cards[0][box]}</span>
          ) : canPick ? (
            <button onClick={() => tapBox(box)}
              className={`min-w-[3rem] min-h-[36px] rounded-lg font-bold ${picked === box ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-game-gold/80 hover:bg-white/20'}`}>
              {choices[box]}
            </button>
          ) : <span className="text-white/20">–</span>}
        </td>
        <td className="py-1 text-center w-20">
          {cards[1][box] != null
            ? <span className={`font-bold ${lastScored?.player === 1 && lastScored.box === box ? 'text-game-gold bg-game-gold/20 rounded px-2' : 'text-white/80'}`}>{cards[1][box]}</span>
            : <span className="text-white/20">–</span>}
        </td>
      </tr>
    );
  };
  const SumRow = ({ label, values, strong }) => (
    <tr className={`border-t border-white/20 ${strong ? 'text-game-gold font-bold text-base md:text-lg' : 'text-white/70 text-sm'}`}>
      <td className="py-1 text-left">{label}</td>
      {values.map((v, i) => <td key={i} className="py-1 text-center">{v}</td>)}
    </tr>
  );

  const winner = over ? (total(cards[0]) > total(cards[1]) ? 0 : total(cards[0]) < total(cards[1]) ? 1 : null) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-rose-900 p-3 select-none">
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="dice" title="Five Dice" />
        </div>
        <div className="text-white/70 text-sm">Five Dice · {difficulty}</div>
        <div className="text-right text-xs text-white/60">You {total(cards[0])} · Computer {total(cards[1])}</div>
      </header>

      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-4 items-center lg:items-start">
        {/* Dice and controls */}
        <div className="flex-1 flex flex-col items-center gap-3 w-full lg:pt-10">
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${yourTurn ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white/70'}`}>
            {over ? 'Game over' : yourTurn ? 'Your turn' : 'Computer\'s turn'}
          </div>
          <div className="flex gap-2 md:gap-3 mt-2">
            {turn.dice.map((d, i) => (
              <Die key={i} value={d} held={turn.held[i]} rollId={rollId}
                disabled={!yourTurn || !rolled || turn.rollsLeft === 0}
                onClick={() => { setTurn(t => toggleHold(t, i)); setPicked(null); }} />
            ))}
          </div>
          <Button variant="gold" className="text-lg w-56" disabled={!yourTurn || turn.rollsLeft === 0} onClick={rollNow}>
            {!rolled ? '🎲 Roll' : turn.rollsLeft ? `🎲 Roll again (${turn.rollsLeft} left)` : 'No rolls left'}
          </Button>
          <p className="text-amber-300 text-center text-sm md:text-base min-h-[3rem] max-w-sm">{msg}</p>
        </div>

        {/* Scorecard */}
        <div className="card-panel p-3 w-full max-w-md">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-xs">
                <th className="text-left font-normal">Box</th><th className="font-normal">You</th><th className="font-normal">Computer</th>
              </tr>
            </thead>
            <tbody>
              {UPPER.map(b => <Row key={b} box={b} />)}
              <SumRow label={`Bonus (${UPPER_BONUS} at ${UPPER_BONUS_AT}+)`}
                values={cards.map(c => (upperBonus(c) ? `+${UPPER_BONUS}` : `${upperTotal(c)} / ${UPPER_BONUS_AT}`))} />
              {LOWER.map(b => <Row key={b} box={b} />)}
              {cards.some(c => c.bonus) && <SumRow label="Five of a Kind bonus" values={cards.map(c => c.bonus || '–')} />}
              <SumRow label="Total" values={cards.map(total)} strong />
            </tbody>
          </table>
        </div>
      </div>

      {over && (
        <ResultPanel>
          <div className="text-5xl mb-2">{winner === 0 ? '🏆' : winner === 1 ? '🎲' : '🤝'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-2">
            {winner === 0 ? 'You win!' : winner === 1 ? 'The computer wins' : 'It\'s a tie!'}
          </h2>
          <div className="text-white/80 mb-4">You {total(cards[0])} · Computer {total(cards[1])}</div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
            <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
          </div>
        </ResultPanel>
      )}
    </div>
  );
}

