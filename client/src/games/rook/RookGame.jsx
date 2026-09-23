import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { shuffle } from '../../utils/cardEngine';
import { Button } from '../../components/Button';
import { TUTORIALS } from '../../components/TutorialModal';
import { nextSeat, teamOf } from '../cards/tricks';
import { useTrickTable } from '../cards/useTrickTable';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import {
  makeDeck, cardPoints, legalPlays, winnerOf, sortHand, scoreHand, gameWinner, chooseBid,
  chooseNestDiscard, chooseCard, COLOURS, COLOUR_STYLE, MIN_BID, MAX_BID, BID_STEP, NEST_SIZE, WINNING_SCORE,
} from './rookRules';
import api from '../../utils/api';

const NAMES = ['You', 'Left', 'Partner', 'Right'];

// ── Card face ─────────────────────────────────────────────────────────────────
const SIZES = { xs: 'w-8 h-11 text-xs', sm: 'w-10 h-14 text-sm', md: 'w-12 h-16 text-base' };

function RookCard({ card, size = 'sm', selected, disabled, onClick }) {
  const color = card.isRook ? '#f97316' : COLOUR_STYLE[card.colour].color;
  return (
    <motion.div
      onClick={onClick}
      whileTap={onClick ? { scale: 0.95 } : {}}
      className={`${SIZES[size]} rounded-lg bg-white border-2 flex flex-col items-center justify-center select-none shrink-0
        ${selected ? 'border-yellow-400 -translate-y-2 shadow-lg shadow-yellow-400/40' : 'border-transparent'}
        ${disabled ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      style={{ color, backgroundColor: '#1f2937' }}
    >
      <span className="font-bold leading-none">{card.isRook ? '🐦' : card.value}</span>
      <span className="text-[9px] leading-none mt-0.5 uppercase">{card.isRook ? 'Rook' : COLOUR_STYLE[card.colour].label}</span>
      {cardPoints(card) > 0 && !card.isRook && <span className="text-[8px] text-white/50 leading-none">{cardPoints(card)}pt</span>}
    </motion.div>
  );
}
const renderRook = (card, props) => <RookCard card={card} {...props} />;

function dealRound() {
  const deck = shuffle(makeDeck());
  return { hands: [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13)), nest: deck.slice(52) };
}

export default function RookGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [phase, setPhase] = useState('setup');   // setup | bidding | nest | playing | handOver | gameOver
  const [dealer, setDealer] = useState(3);
  const [deal0, setDeal0] = useState(null);      // { hands, nest } as dealt
  const [bids, setBids] = useState([null, null, null, null]);   // number | 'pass' | null
  const [high, setHigh] = useState({ bid: 0, seat: null });
  const [bidTurn, setBidTurn] = useState(0);
  const [bidWinner, setBidWinner] = useState(null);
  const [trump, setTrump] = useState(null);
  const [nest, setNest] = useState([]);          // the 5 discarded cards
  const [nestSel, setNestSel] = useState([]);
  const [scores, setScores] = useState([0, 0]);
  const [lastHand, setLastHand] = useState(null);

  const { table, deal, clear, play, legalFor } = useTrickTable({
    winnerOf: trick => winnerOf(trick, trump),
    legalPlays: (t, seat) => legalPlays(t.hands[seat], t.trick, trump),
    isAi: seat => seat !== 0,
    chooseAiCard: (seat, t, legal) => chooseCard({ legal, trick: t.trick, seat, difficulty, trump }),
    onHandDone: t => {
      const taken = [0, 1].map(team =>
        t.taken.reduce((s, cards, seat) => s + (teamOf(seat) === team ? cards.reduce((a, c) => a + cardPoints(c), 0) : 0), 0));
      const nestPoints = nest.reduce((s, c) => s + cardPoints(c), 0);
      taken[teamOf(t.lastTrick.winner)] += nestPoints;          // last trick takes the nest
      const res = scoreHand(teamOf(bidWinner), high.bid, taken);
      const newScores = [scores[0] + res.delta[0], scores[1] + res.delta[1]];
      setScores(newScores);
      setLastHand({ ...res, taken, nestPoints, nestTo: teamOf(t.lastTrick.winner) });
      if (gameWinner(newScores) != null) {
        setPhase('gameOver');
        if (gameWinner(newScores) === 0) api.post('/scores', { game: 'rook', score: newScores[0], difficulty }).catch(() => {});
      } else {
        setPhase('handOver');
      }
    },
  });

  const startHand = newDealer => {
    clear();
    setDealer(newDealer);
    setDeal0(dealRound());
    setBids([null, null, null, null]);
    setHigh({ bid: 0, seat: null });
    setBidTurn(nextSeat(newDealer));
    setBidWinner(null);
    setTrump(null);
    setNest([]);
    setNestSel([]);
    setPhase('bidding');
  };

  const startGame = diff => {
    setDifficulty(diff);
    setScores([0, 0]);
    startHand(3);
  };

  const beginPlay = (hands, trumpColour, discards, winner) => {
    setTrump(trumpColour);
    setNest(discards);
    deal(hands, winner);        // the bid winner leads
    setPhase('playing');
  };

  const finishBidding = (winner, bid) => {
    setBidWinner(winner);
    setHigh({ bid, seat: winner });
    const merged = [...deal0.hands[winner], ...deal0.nest];
    if (winner === 0) {
      setNestSel([]);
      setPhase('nest');
      return;
    }
    const { trump: t, discard } = chooseNestDiscard(merged);
    const hands = deal0.hands.map((h, s) => (s === winner ? merged.filter(c => !discard.includes(c)) : h));
    beginPlay(hands, t, discard, winner);
  };

  const placeBid = (seat, action) => {
    const newBids = bids.map((b, i) => (i === seat ? action : b));
    const passed = newBids.map(b => b === 'pass');
    // If everyone else has passed without a bid, the last player must take it at the minimum
    if (action === 'pass' && high.seat == null && passed.filter(Boolean).length === 4) {
      newBids[seat] = MIN_BID;
      passed[seat] = false;
    }
    const newHigh = typeof newBids[seat] === 'number' ? { bid: newBids[seat], seat } : high;
    setBids(newBids);
    setHigh(newHigh);
    const active = [0, 1, 2, 3].filter(s => !passed[s]);
    if (active.length === 1 && newHigh.seat === active[0]) { finishBidding(active[0], newHigh.bid); return; }
    if (newHigh.bid >= MAX_BID) { finishBidding(newHigh.seat, newHigh.bid); return; }
    let next = nextSeat(seat);
    while (passed[next]) next = nextSeat(next);
    setBidTurn(next);
  };

  // Computer bids
  useEffect(() => {
    if (phase !== 'bidding' || bidTurn === 0) return;
    const timer = setTimeout(() => placeBid(bidTurn, chooseBid(deal0.hands[bidTurn], high.bid, difficulty)), 700);
    return () => clearTimeout(timer);
  });

  const confirmNest = colour => {
    const merged = [...deal0.hands[0], ...deal0.nest];
    const hands = deal0.hands.map((h, s) => (s === 0 ? merged.filter(c => !nestSel.includes(c)) : h));
    beginPlay(hands, colour, nestSel, 0);
  };

  const myHand = useMemo(() => sortHand(table?.hands[0] ?? deal0?.hands[0] ?? [], trump), [table, deal0, trump]);
  const scoreLine = `Us ${scores[0]} · Them ${scores[1]}`;

  if (phase === 'setup') {
    return (
      <GameSetup emoji="🐦" title="Rook" subtitle="Bid, name trump, and capture the counters!"
        note={`You and Partner vs Left and Right · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-orange-900" tutorial={TUTORIALS.rook} onStart={startGame} />
    );
  }

  if (phase === 'bidding') {
    const nextBid = high.bid ? high.bid + BID_STEP : MIN_BID;
    const mustBid = high.seat == null && bids.filter(b => b === 'pass').length === 3;
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-orange-900 p-5 flex flex-col items-center gap-4">
        <div className="text-white/60 text-sm">{scoreLine}</div>
        <h2 className="text-2xl font-bold text-white">Bidding</h2>
        <p className="text-white/50 text-sm text-center max-w-sm">
          Bid how many points your team will capture (counters: 5s, 10s and 14s, the Rook = 20, plus the nest).
        </p>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {NAMES.map((name, seat) => (
            <div key={name} className={`rounded-xl p-2 text-center ${seat === bidTurn ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs">{name}{seat === dealer ? ' (dealer)' : ''}</div>
              <div className="text-white font-bold">{bids[seat] == null ? '—' : bids[seat] === 'pass' ? 'Pass' : bids[seat]}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(c => <RookCard key={c.id} card={c} />)}
        </div>
        {bidTurn === 0 ? (
          <div className="flex gap-3">
            <Button variant="ghost" disabled={mustBid} onClick={() => placeBid(0, 'pass')}>Pass</Button>
            <Button variant="gold" disabled={nextBid > MAX_BID} onClick={() => placeBid(0, nextBid)}>Bid {nextBid}</Button>
          </div>
        ) : (
          <p className="text-white/50 animate-pulse">{NAMES[bidTurn]} is thinking…</p>
        )}
        {mustBid && bidTurn === 0 && <p className="text-amber-400 text-xs">Everyone else passed — you must take the bid.</p>}
      </div>
    );
  }

  if (phase === 'nest') {
    const merged = sortHand([...deal0.hands[0], ...deal0.nest]);
    const nestIds = deal0.nest.map(c => c.id);
    const toggle = card => setNestSel(sel =>
      sel.includes(card) ? sel.filter(c => c !== card) : sel.length < NEST_SIZE ? [...sel, card] : sel);
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-orange-900 p-5 flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold text-game-gold">You won the bid at {high.bid}!</h2>
        <p className="text-white/70 text-sm text-center max-w-sm">
          The nest's 5 cards (outlined) are now in your hand. Choose <b>5 cards to put back</b> in the nest,
          then pick trump. Points left in the nest go to whoever wins the last trick.
        </p>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {merged.map(c => (
            <div key={c.id} className={nestIds.includes(c.id) ? 'rounded-lg ring-2 ring-sky-400' : ''}>
              <RookCard card={c} selected={nestSel.includes(c)} onClick={() => toggle(c)} />
            </div>
          ))}
        </div>
        <p className="text-white/60 text-sm">{nestSel.length}/{NEST_SIZE} selected</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {COLOURS.map(colour => (
            <button key={colour} disabled={nestSel.length !== NEST_SIZE} onClick={() => confirmNest(colour)}
              className="rounded-xl px-4 py-3 font-bold bg-white/10 hover:bg-white/20 disabled:opacity-30 min-h-[52px]"
              style={{ color: COLOUR_STYLE[colour].color }}>
              {COLOUR_STYLE[colour].label} trump
            </button>
          ))}
        </div>
      </div>
    );
  }

  const trumpStyle = trump ? COLOUR_STYLE[trump] : null;
  const message = table?.status === 'collecting'
    ? `${NAMES[table.winner]} ${table.winner === 0 ? 'take' : 'takes'} the trick`
    : table?.trickNumber === 0 && table.trick.length === 0 ? `${NAMES[bidWinner]} won the bid at ${high.bid} and ${bidWinner === 0 ? 'lead' : 'leads'}` : '';

  return (
    <>
      <CardTable
        title={<span>Trump: <b style={{ color: trumpStyle?.color }}>{trumpStyle?.label}</b> · Bid {high.bid} ({NAMES[bidWinner]})</span>}
        scoreLine={scoreLine}
        names={NAMES}
        table={table}
        seatDetail={seat => (seat === bidWinner ? 'bidder' : null)}
        message={message}
        renderTrickCard={card => <RookCard card={card} />}
        bgClass="from-game-bg to-orange-900"
      >
        <CardHand cards={myHand} legal={legalFor(0)} onPlay={card => play(0, card)} renderCard={renderRook} />
      </CardTable>

      {(phase === 'handOver' || phase === 'gameOver') && lastHand && (
        <ResultPanel>
          {phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{gameWinner(scores) === 0 ? '🏆' : '😞'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{gameWinner(scores) === 0 ? 'Your team wins!' : 'They win!'}</h2>
            </>
          ) : (
            <h2 className={`text-xl font-bold mb-2 ${lastHand.made ? 'text-green-400' : 'text-game-red'}`}>
              {teamOf(bidWinner) === 0 ? 'Your team' : 'They'} {lastHand.made ? 'made' : 'missed'} the bid of {high.bid}
            </h2>
          )}
          <div className="space-y-1 text-white/80 text-sm mb-4">
            <div>Points captured — Us {lastHand.taken[0]} · Them {lastHand.taken[1]}</div>
            <div className="text-white/50 text-xs">Nest ({lastHand.nestPoints} pts) went to {lastHand.nestTo === 0 ? 'us' : 'them'}</div>
            <div className="font-semibold pt-2 border-t border-white/10">Total — Us {scores[0]} · Them {scores[1]}</div>
          </div>
          {phase === 'handOver' ? (
            <Button variant="gold" className="w-full" onClick={() => startHand(nextSeat(dealer))}>Next Hand</Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
              <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
            </div>
          )}
        </ResultPanel>
      )}
    </>
  );
}
