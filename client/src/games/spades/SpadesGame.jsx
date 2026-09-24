import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { TUTORIALS } from '../../components/tutorials';
import { sortHand, trickWinner, nextSeat, teamOf } from '../cards/tricks';
import { useTrickTable } from '../cards/useTrickTable';
import { tableMemory } from '../cards/memory';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import {
  TRUMP, NIL, WINNING_SCORE, BAG_LIMIT, legalPlays, scoreHand, winnerOf, chooseBid, chooseCard,
} from './spadesRules';
import api from '../../utils/api';
import { RulesButton } from '../../components/RulesButton';

const NAMES = ['You', 'Left', 'Partner', 'Right'];
// Your partner always plays at Medium, so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'medium' : difficulty);
const DECK = buildDeck();
const bidLabel = b => (b == null ? '…' : b === NIL ? 'Nil' : b);

function dealHands() {
  const deck = shuffle(buildDeck());
  return [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
}

export default function SpadesGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [phase, setPhase] = useState('setup');     // setup | bidding | playing | handOver | gameOver
  const [dealer, setDealer] = useState(3);
  const [hands, setHands] = useState(null);         // dealt hands (used during bidding)
  const [bids, setBids] = useState([null, null, null, null]);
  const [bidTurn, setBidTurn] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [bags, setBags] = useState([0, 0]);
  const [lastHand, setLastHand] = useState(null);

  const { table, deal, clear, play, legalFor } = useTrickTable({
    winnerOf: trick => trickWinner(trick, { trump: TRUMP }),
    legalPlays: (t, seat) => legalPlays(t.hands[seat], t.trick, {
      spadesBroken: [...t.taken.flat(), ...t.trick.map(p => p.card)].some(c => c.suit === TRUMP),
    }),
    isAi: seat => seat !== 0,
    chooseAiCard: (seat, t, legal) => chooseCard({
      legal, trick: t.trick, seat, difficulty: levelFor(seat, difficulty), bids, tricksWon: t.tricksWon,
      memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[seat], deck: DECK }),
    }),
    onHandDone: t => {
      const result = scoreHand(bids, t.tricksWon, bags);
      const newScores = [scores[0] + result.delta[0], scores[1] + result.delta[1]];
      setScores(newScores);
      setBags(result.bags);
      setLastHand(result);
      if (winnerOf(newScores) != null) {
        setPhase('gameOver');
        api.post('/scores', { game: 'spades', score: Math.max(0, newScores[0]), difficulty }).catch(() => {});
      } else {
        setPhase('handOver');
      }
    },
  });

  const startHand = newDealer => {
    clear();                       // drop the finished hand's table
    setDealer(newDealer);
    setHands(dealHands());
    setBids([null, null, null, null]);
    setBidTurn(nextSeat(newDealer));
    setPhase('bidding');
  };

  const startGame = diff => {
    setDifficulty(diff);
    setScores([0, 0]);
    setBags([0, 0]);
    startHand(3);          // Right deals first, so you bid and lead first
  };

  const placeBid = (seat, bid) => {
    const next = bids.map((b, i) => (i === seat ? bid : b));
    setBids(next);
    if (next.every(b => b != null)) {
      deal(hands, nextSeat(dealer));
      setPhase('playing');
    } else {
      setBidTurn(nextSeat(seat));
    }
  };

  // Computer bids
  useEffect(() => {
    if (phase !== 'bidding' || bidTurn === 0) return;
    const timer = setTimeout(() => {
      placeBid(bidTurn, chooseBid(hands[bidTurn], levelFor(bidTurn, difficulty), bids[(bidTurn + 2) % 4]));
    }, 600);
    return () => clearTimeout(timer);
  });

  const myHand = useMemo(() => sortHand(table?.hands[0] ?? hands?.[0] ?? []), [table, hands]);
  const scoreLine = `Us ${scores[0]} · Them ${scores[1]}`;
  // This hand so far: each team's tricks against its combined bid
  const teamTricks = [0, 1].map(team => [0, 1, 2, 3].reduce((s, seat) => s + (teamOf(seat) === team ? table?.tricksWon[seat] ?? 0 : 0), 0));
  const teamBid = [0, 1].map(team => [0, 1, 2, 3].reduce((s, seat) => s + (teamOf(seat) === team ? bids[seat] ?? 0 : 0), 0));

  if (phase === 'setup') {
    return (
      <GameSetup emoji="♠️" title="Spades" subtitle="Bid carefully — spades are always trump!"
        note={`You and Partner vs Left and Right · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-slate-900" tutorial={TUTORIALS.spades} onStart={startGame} />
    );
  }

  if (phase === 'bidding') {
    const partnerBid = bids[2];
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-5 flex flex-col items-center gap-4">
        <RulesButton game="spades" title="Spades" className="self-end" />
        <div className="text-white/60 text-sm">{scoreLine} · Bags {bags[0]}/{BAG_LIMIT}</div>
        <h2 className="text-2xl font-bold text-white">Bidding</h2>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {NAMES.map((name, seat) => (
            <div key={name} className={`rounded-xl p-2 text-center ${seat === bidTurn ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs">{name}{seat === dealer ? ' (dealer)' : ''}</div>
              <div className="text-white font-bold">{bidLabel(bids[seat])}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(card => <PlayingCard key={card.id} card={{ ...card, faceUp: true }} size="sm" />)}
        </div>
        {bidTurn === 0 ? (
          <>
            <p className="text-white/60 text-sm text-center max-w-sm">
              How many tricks will you win?
              {partnerBid != null && <> Partner bid <b className="text-game-gold">{bidLabel(partnerBid)}</b>.</>}
            </p>
            <div className="grid grid-cols-7 gap-2 max-w-md">
              {Array.from({ length: 14 }, (_, n) => (
                <button key={n} onClick={() => placeBid(0, n)}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl min-w-[44px] active:scale-95">
                  {n === 0 ? 'Nil' : n}
                </button>
              ))}
            </div>
            <p className="text-white/30 text-xs text-center max-w-sm">
              Nil = win no tricks at all: +100 if you do, −100 if you don't.
            </p>
          </>
        ) : (
          <p className="text-white/50 animate-pulse">{NAMES[bidTurn]} is bidding…</p>
        )}
      </div>
    );
  }

  const message = table?.status === 'collecting'
    ? `${NAMES[table.winner]} ${table.winner === 0 ? 'win' : 'wins'} the trick` : '';

  return (
    <>
      <CardTable
        title={`Spades · ${difficulty}`}
        rules={{ game: 'spades', title: 'Spades' }}
        scoreLine={
          <>
            <div className="text-white/90 font-semibold">This hand: Us {teamTricks[0]}/{teamBid[0]} · Them {teamTricks[1]}/{teamBid[1]} tricks</div>
            <div className="text-white/50">Game: {scoreLine}</div>
          </>
        }
        names={NAMES}
        table={table}
        seatDetail={seat => `${table?.tricksWon[seat] ?? 0}/${bidLabel(bids[seat])}`}
        message={message}
        bgClass="from-game-bg to-slate-900"
      >
        <CardHand cards={myHand} legal={legalFor(0)} onPlay={card => play(0, card)} />
      </CardTable>

      {(phase === 'handOver' || phase === 'gameOver') && lastHand && (
        <ResultPanel>
          {phase === 'gameOver' && (
            <>
              <div className="text-5xl mb-2">{winnerOf(scores) === 0 ? '🏆' : '😢'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">
                {winnerOf(scores) === 0 ? 'Your team wins!' : 'They win!'}
              </h2>
            </>
          )}
          {phase === 'handOver' && <h2 className="text-xl font-bold text-white mb-3">Hand over</h2>}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Bid</th><th>Won</th><th>Points</th><th>Total</th></tr></thead>
            <tbody>
              {['Us', 'Them'].map((label, team) => {
                const d = lastHand.detail[team];
                return (
                  <tr key={label}>
                    <td className="text-left">{label}</td>
                    <td>{d.contract}</td>
                    <td>{d.won}</td>
                    <td className={lastHand.delta[team] < 0 ? 'text-game-red' : 'text-green-400'}>
                      {lastHand.delta[team] > 0 ? '+' : ''}{lastHand.delta[team]}
                    </td>
                    <td className="font-bold">{scores[team]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lastHand.detail.some(d => d.bagPenalty) && (
            <p className="text-amber-400 text-xs mb-3">10 bags reached: −100 penalty!</p>
          )}
          {phase === 'handOver' ? (
            <Button variant="primary" className="w-full" onClick={() => startHand(nextSeat(dealer))}>Next Hand</Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
              <Button variant="primary" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
            </div>
          )}
        </ResultPanel>
      )}
    </>
  );
}
