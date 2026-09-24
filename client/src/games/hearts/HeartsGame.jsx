import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/tutorials';
import { PlayingCard } from '../../components/PlayingCard';
import { sortHand, trickWinner } from '../cards/tricks';
import { useTrickTable } from '../cards/useTrickTable';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import {
  legalPlays, chooseCard, choosePass, applyPasses, passDirection, scoreHand, isGameOver, leaders,
  isHeart, isQueenOfSpades, TWO_OF_CLUBS, cardPoints,
} from './heartsRules';
import api from '../../utils/api';
import { RulesButton } from '../../components/RulesButton';

const NAMES = ['You', 'Left', 'Across', 'Right'];
const PASS_LABEL = { left: 'to Left', right: 'to Right', across: 'Across' };

function dealHands() {
  const deck = shuffle(buildDeck());
  return [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
}

const playedCards = table => [...table.taken.flat(), ...table.trick.map(p => p.card)];

export default function HeartsGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [phase, setPhase] = useState('setup');   // setup | passing | playing | handOver | gameOver
  const [handNumber, setHandNumber] = useState(0);
  const [totals, setTotals] = useState([0, 0, 0, 0]);
  const [lastHand, setLastHand] = useState(null); // { points, shooter }
  const [dealt, setDealt] = useState(null);      // hands before passing
  const [passSel, setPassSel] = useState([]);
  const [received, setReceived] = useState([]);

  const { table, deal, play, legalFor } = useTrickTable({
    winnerOf: trick => trickWinner(trick),
    legalPlays: (t, seat) => legalPlays(t.hands[seat], t.trick, {
      firstTrick: t.trickNumber === 0,
      heartsBroken: playedCards(t).some(isHeart),
    }),
    isAi: seat => seat !== 0,
    chooseAiCard: (seat, t, legal) => chooseCard({
      legal, trick: t.trick, seat, difficulty, queenPlayed: playedCards(t).some(isQueenOfSpades),
    }),
    onHandDone: t => {
      const result = scoreHand(t.taken);
      const newTotals = totals.map((s, i) => s + result.points[i]);
      setTotals(newTotals);
      setLastHand(result);
      if (isGameOver(newTotals)) {
        setPhase('gameOver');
        api.post('/scores', { game: 'hearts', score: Math.max(0, 100 - newTotals[0]), difficulty }).catch(() => {});
      } else {
        setPhase('handOver');
      }
    },
  });

  const startPlay = hands => {
    const leader = hands.findIndex(h => h.some(c => c.id === TWO_OF_CLUBS));
    deal(hands, leader);
    setPhase('playing');
  };

  const startHand = (n) => {
    const hands = dealHands();
    setHandNumber(n);
    setReceived([]);
    if (passDirection(n) === 'hold') { startPlay(hands); return; }
    setDealt(hands);
    setPassSel([]);
    setPhase('passing');
  };

  const startGame = diff => {
    setDifficulty(diff);
    setTotals([0, 0, 0, 0]);
    startHand(0);
  };

  const confirmPass = () => {
    const direction = passDirection(handNumber);
    const passes = dealt.map((h, seat) => (seat === 0 ? passSel : choosePass(h)));
    const after = applyPasses(dealt.map(h => [...h]), passes, direction);
    setReceived(after[0].filter(c => !dealt[0].some(d => d.id === c.id)).map(c => c.id));
    startPlay(after);
  };

  const myHand = useMemo(() => sortHand(table?.hands[0] ?? []), [table]);

  if (phase === 'setup') {
    return (
      <GameSetup emoji="♥️" title="Hearts" subtitle="Avoid taking hearts and the Queen of Spades!"
        bgClass="from-game-bg to-red-900" tutorial={TUTORIALS.hearts} onStart={startGame} />
    );
  }

  if (phase === 'passing') {
    const direction = passDirection(handNumber);
    const toggle = card => setPassSel(sel =>
      sel.some(c => c.id === card.id) ? sel.filter(c => c.id !== card.id) : sel.length < 3 ? [...sel, card] : sel);
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-red-950 p-5 flex flex-col items-center justify-center gap-4">
        <RulesButton game="hearts" title="Hearts" className="self-end" />
        <h2 className="text-2xl font-bold text-white">Pass 3 cards {PASS_LABEL[direction]}</h2>
        <p className="text-white/50 text-sm text-center max-w-xs">
          Tip: pass high hearts, and the Queen of Spades if you don't have many low spades to protect it.
        </p>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {sortHand(dealt[0]).map(card => (
            <CardFace key={card.id} card={card} size="sm"
              selected={passSel.some(c => c.id === card.id)} onClick={() => toggle(card)} />
          ))}
        </div>
        <Button variant="primary" disabled={passSel.length !== 3} onClick={confirmPass}>
          Pass {passSel.length}/3 {PASS_LABEL[direction]}
        </Button>
      </div>
    );
  }

  let message = '';
  if (table?.status === 'collecting') message = `${NAMES[table.winner]} ${table.winner === 0 ? 'take' : 'takes'} the trick`;
  else if (table?.trickNumber === 0 && table.trick.length === 0) message = `${NAMES[table.turn]} ${table.turn === 0 ? 'lead' : 'leads'} the 2♣`;
  else if (received.length && table?.trickNumber === 0) message = 'Cards you received are outlined';

  const winners = leaders(totals);

  return (
    <>
      <CardTable
        title={`Hearts · ${difficulty}`}
        rules={{ game: 'hearts', title: 'Hearts' }}
        scoreLine={<><div>Hand {handNumber + 1}</div><div className="text-white/40">Totals · +this hand</div></>}
        names={NAMES}
        table={table}
        seatDetail={seat => {
          // Game total, plus points taken so far this hand
          const now = (table?.taken[seat] ?? []).reduce((s, c) => s + cardPoints(c), 0);
          return now ? `${totals[seat]} +${now}` : `${totals[seat]}`;
        }}
        message={message}
        bgClass="from-game-bg to-red-950"
      >
        <CardHand
          cards={myHand}
          legal={legalFor(0)}
          onPlay={card => play(0, card)}
          renderCard={(card, props) => (
            <CardFace card={card} {...props} highlight={table?.trickNumber === 0 && received.includes(card.id)} />
          )}
        />
      </CardTable>

      {phase === 'handOver' && lastHand && (
        <ResultPanel>
          <h2 className="text-xl font-bold text-white mb-1">Hand over</h2>
          {lastHand.shooter != null && (
            <p className="text-game-gold text-sm mb-2">🌙 {NAMES[lastHand.shooter]} shot the moon!</p>
          )}
          <ScoreRows totals={totals} lastHand={lastHand} />
          <Button variant="primary" className="w-full" onClick={() => startHand(handNumber + 1)}>Next Hand</Button>
        </ResultPanel>
      )}

      {phase === 'gameOver' && (
        <ResultPanel>
          <div className="text-5xl mb-3">{winners.includes(0) ? '🏆' : '😢'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-2">
            {winners.includes(0) ? (winners.length > 1 ? 'You tie for the win!' : 'You Win!') : `${NAMES[winners[0]]} Wins!`}
          </h2>
          <ScoreRows totals={totals} lastHand={lastHand} />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
            <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
          </div>
        </ResultPanel>
      )}
    </>
  );
}

function ScoreRows({ totals, lastHand }) {
  return (
    <div className="space-y-1 mb-4">
      {NAMES.map((name, i) => (
        <div key={name} className="flex justify-between text-white/80 text-sm">
          <span>{name}</span>
          <span>
            {lastHand && <span className="text-white/40 mr-2">+{lastHand.points[i]}</span>}
            {totals[i]} pts
          </span>
        </div>
      ))}
    </div>
  );
}

function CardFace({ card, size, selected, disabled, onClick, highlight }) {
  return (
    <div className={highlight ? 'rounded-xl ring-2 ring-sky-400' : ''}>
      <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} disabled={disabled} onClick={onClick} />
    </div>
  );
}
