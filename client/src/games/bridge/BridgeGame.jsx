import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDeck, shuffle } from '../../utils/cardEngine';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { TUTORIALS } from '../../components/tutorials';
import { sortHand, trickWinner, followSuit, nextSeat, teamOf } from '../cards/tricks';
import { tableMemory } from '../cards/memory';
import { useTrickTable } from '../cards/useTrickTable';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import { choosePartnershipCard } from '../cards/ai';
import {
  DENOMINATIONS, PASS, bidHigher, bidLevel, bidDenom, currentBid, auctionOver, contractOf, scoreContract,
  chooseBid, BRIDGE_SUIT_ORDER,
} from './bridgeRules';
import api from '../../utils/api';
import { RulesButton } from '../../components/RulesButton';

const NAMES = ['South (You)', 'West', 'North', 'East'];
const SHORT = ['You', 'West', 'North', 'East'];
const DENOM_SYMBOL = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
const DENOM_COLOR = { C: 'text-white', D: 'text-red-400', H: 'text-red-400', S: 'text-white', NT: 'text-game-gold' };
const bidText = bid => (bid === PASS ? 'Pass' : `${bidLevel(bid)}${DENOM_SYMBOL[bidDenom(bid)]}`);

function dealHands() {
  const deck = shuffle(buildDeck());
  return [0, 1, 2, 3].map(s => deck.slice(s * 13, s * 13 + 13));
}

// Your partner always plays at Medium, so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'medium' : difficulty);
const DECK = buildDeck();

const sortBridge = hand => sortHand(hand, { suitOrder: BRIDGE_SUIT_ORDER });

export default function BridgeGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [phase, setPhase] = useState('setup');    // setup | bidding | playing | handOver
  const [dealer, setDealer] = useState(0);
  const [hands, setHands] = useState(null);
  const [auction, setAuction] = useState([]);     // [{ seat, bid }]
  const [contract, setContract] = useState(null);
  const [scores, setScores] = useState({ ns: 0, ew: 0 });
  const [result, setResult] = useState(null);

  const bidTurn = (dealer + auction.length) % 4;
  // The declarer chooses dummy's cards
  const controllerOf = seat => (contract && seat === contract.dummy ? contract.declarer : seat);

  const { table, deal, clear, play, legalFor } = useTrickTable({
    winnerOf: trick => trickWinner(trick, { trump: contract?.trump }),
    legalPlays: (t, seat) => followSuit(t.hands[seat], t.trick[0]?.card.suit),
    isAi: seat => controllerOf(seat) !== 0,
    chooseAiCard: (seat, t, legal) =>
      choosePartnershipCard({
        legal, trick: t.trick, seat, difficulty: levelFor(controllerOf(seat), difficulty), trump: contract?.trump,
        trumpTeam: contract ? teamOf(contract.declarer) : null,
        memory: tableMemory({ history: t.history, trick: t.trick, hand: t.hands[seat], deck: DECK }),
      }),
    onHandDone: t => {
      const declarerTricks = t.tricksWon[contract.declarer] + t.tricksWon[contract.dummy];
      const res = scoreContract(contract, declarerTricks);
      const newScores = { ns: scores.ns + res.ns, ew: scores.ew + res.ew };
      setScores(newScores);
      setResult({ ...res, declarerTricks });
      setPhase('handOver');
      api.post('/scores', { game: 'bridge', score: newScores.ns, difficulty }).catch(() => {});
    },
  });

  const startHand = newDealer => {
    clear();                       // drop the finished hand's table
    setDealer(newDealer);
    setHands(dealHands());
    setAuction([]);
    setContract(null);
    setResult(null);
    setPhase('bidding');
  };

  const startGame = diff => {
    setDifficulty(diff);
    setScores({ ns: 0, ew: 0 });
    startHand(0);
  };

  const placeBid = bid => {
    const next = [...auction, { seat: bidTurn, bid }];
    setAuction(next);
    if (!auctionOver(next)) return;
    const c = contractOf(next);
    if (!c) { setResult({ passedOut: true }); setPhase('handOver'); return; }
    setContract(c);
    deal(hands, nextSeat(c.declarer));   // the player on declarer's left leads
    setPhase('playing');
  };

  // Computer bids
  useEffect(() => {
    if (phase !== 'bidding' || bidTurn === 0) return;
    const timer = setTimeout(() => placeBid(chooseBid({ hand: hands[bidTurn], auction, seat: bidTurn, difficulty: levelFor(bidTurn, difficulty) })), 700);
    return () => clearTimeout(timer);
  });

  const myHand = useMemo(() => sortBridge(table?.hands[0] ?? hands?.[0] ?? []), [table, hands]);

  if (phase === 'setup') {
    return (
      <GameSetup emoji="🌉" title="Bridge" subtitle="Contract bridge with bidding."
        note="You play South with North as your partner. The deal rotates each hand."
        bgClass="from-game-bg to-teal-900" tutorial={TUTORIALS.bridge} onStart={startGame} />
    );
  }

  if (phase === 'bidding') {
    const high = currentBid(auction);
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-teal-900 p-4 flex flex-col items-center gap-3">
        <RulesButton game="bridge" title="Bridge" className="self-end" />
        <div className="text-white/60 text-sm">NS {scores.ns} · EW {scores.ew} · {SHORT[dealer]} dealt</div>
        <h2 className="text-2xl font-bold text-white">Bidding</h2>
        <AuctionGrid auction={auction} dealer={dealer} />
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(card => <PlayingCard key={card.id} card={{ ...card, faceUp: true }} size="sm" />)}
        </div>
        {bidTurn === 0 ? (
          <div className="w-full max-w-md">
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].flatMap(level => DENOMINATIONS.map(d => {
                const bid = `${level}${d}`;
                const ok = bidHigher(bid, high);
                return (
                  <button key={bid} disabled={!ok} onClick={() => placeBid(bid)}
                    className={`py-2 rounded-lg text-sm font-bold min-h-[40px] ${ok ? `bg-white/10 hover:bg-white/20 ${DENOM_COLOR[d]}` : 'bg-white/5 text-white/15'}`}>
                    {level}{DENOM_SYMBOL[d]}
                  </button>
                );
              }))}
            </div>
            <Button variant="ghost" className="w-full mt-2" onClick={() => placeBid(PASS)}>Pass</Button>
          </div>
        ) : (
          <p className="text-white/50 animate-pulse">{NAMES[bidTurn]} is bidding…</p>
        )}
      </div>
    );
  }

  // ── Play ───────────────────────────────────────────────────────────────────
  const dummy = contract?.dummy;
  const dummyShown = table && (table.trickNumber > 0 || table.trick.length > 0);
  const declarerTricks = table && contract ? table.tricksWon[contract.declarer] + table.tricksWon[dummy] : 0;
  const iAmDeclarer = contract?.declarer === 0;
  const dummyCards = dummy != null && table ? sortBridge(table.hands[dummy]) : [];

  // Dummy's cards face-up after the opening lead; you tap them when you declare
  const dummyView = (
    <div className={dummy === 2 ? '' : 'max-w-[7.5rem] md:max-w-[11rem] lg:max-w-[12.5rem]'}>
      <CardHand cards={dummyCards} size="xs" wrap={dummy !== 2}
        legal={iAmDeclarer && table?.turn === dummy ? legalFor(dummy) : []}
        onPlay={card => play(dummy, card)} />
    </div>
  );
  const sides = dummyShown && dummy !== 0 ? { [dummy]: dummyView } : {};

  let message = '';
  if (table?.status === 'collecting') message = `${SHORT[table.winner]} ${table.winner === 0 ? 'win' : 'wins'} the trick`;
  else if (table?.status === 'playing' && table.turn === dummy && iAmDeclarer) message = `Play a card from dummy (${SHORT[dummy]})`;
  else if (contract && !dummyShown) message = `${SHORT[nextSeat(contract.declarer)]} makes the opening lead`;

  return (
    <>
      <CardTable
        title={contract ? `${bidText(contract.bid)} by ${SHORT[contract.declarer]}` : 'Bridge'}
        scoreLine={`${declarerTricks}/${contract ? contract.level + 6 : 0} tricks · NS ${scores.ns} EW ${scores.ew}`}
        names={NAMES.map((n, s) => (s === dummy ? `${SHORT[s]} (dummy)` : n))}
        table={table}
        seatDetail={seat => table?.tricksWon[seat] || null}
        sides={sides}
        rules={{ game: 'bridge', title: 'Bridge' }}
        message={message}
        bgClass="from-game-bg to-teal-900"
      >
        <CardHand
          cards={myHand}
          label={dummy === 0 ? "You're dummy — North plays your cards" : undefined}
          legal={dummy === 0 ? [] : legalFor(0)}
          onPlay={card => play(0, card)}
        />
      </CardTable>

      {phase === 'handOver' && result && (
        <ResultPanel>
          {result.passedOut ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">All four players passed</h2>
              <p className="text-white/60 mb-4">The hand is thrown in and redealt.</p>
            </>
          ) : (
            <>
              <h2 className={`text-xl font-bold mb-1 ${result.made ? 'text-green-400' : 'text-game-red'}`}>
                {bidText(contract.bid)} by {SHORT[contract.declarer]}: {result.made
                  ? (result.overtricks ? `made +${result.overtricks}` : 'made')
                  : `down ${result.down}`}
              </h2>
              <p className="text-white/60 text-sm mb-3">Declarer took {result.declarerTricks} tricks (needed {contract.level + 6})</p>
              <p className="text-white mb-4">NS {scores.ns} · EW {scores.ew}</p>
            </>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
            <Button variant="primary" className="flex-1" onClick={() => startHand(nextSeat(dealer))}>Next Hand</Button>
          </div>
        </ResultPanel>
      )}
    </>
  );
}

/** The auction so far, one column per player starting with the dealer. */
function AuctionGrid({ auction, dealer }) {
  const order = [0, 1, 2, 3].map(i => (dealer + i) % 4);
  const rows = [];
  for (let i = 0; i < auction.length; i += 4) rows.push(auction.slice(i, i + 4));
  return (
    <table className="text-sm text-white/80 w-full max-w-xs">
      <thead>
        <tr>{order.map(s => <th key={s} className="text-white/40 text-xs font-normal">{SHORT[s]}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {order.map((_, j) => <td key={j} className="text-center">{row[j] ? bidText(row[j].bid) : ''}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
