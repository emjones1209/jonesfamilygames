import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import api from '../../utils/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const SUITS = ['♣', '♥', '♦', '♠'];
const SUIT_LABEL = { '♣': 'Black', '♥': 'Green', '♦': 'Red', '♠': 'Yellow' };
const SUIT_CLR = { '♣': '#94a3b8', '♥': '#4ade80', '♦': '#f87171', '♠': '#facc15' };
const PNAME = ['You', 'Left', 'Partner', 'Right'];

// ── Deck & Game Logic ─────────────────────────────────────────────────────────
function mkDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (let v = 1; v <= 14; v++) deck.push({ suit, value: v, id: `${suit}${v}` });
  deck.push({ suit: null, value: 20, id: 'ROOK', isRook: true });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardPts(c) {
  if (c.isRook) return 20;
  if (c.value === 5) return 5;
  if (c.value === 10 || c.value === 14) return 10;
  return 0;
}

// Rook card's effective suit = trump; all others keep their own suit
function eff(c, trump) { return c.isRook ? trump : c.suit; }

function whoWins(trick, trump) {
  let w = 0;
  for (let i = 1; i < trick.length; i++) {
    const [best, cur] = [trick[w].card, trick[i].card];
    if (cur.isRook) { w = i; continue; }
    if (best.isRook) continue;
    const [bS, cS] = [eff(best, trump), eff(cur, trump)];
    if (cS === trump && bS !== trump) { w = i; continue; }
    if (cS === bS && cur.value > best.value) w = i;
  }
  return trick[w].player;
}

function legalCards(hand, trick, trump) {
  if (!trick.length) return hand;
  const led = eff(trick[0].card, trump);
  const suited = hand.filter(c => eff(c, trump) === led);
  return suited.length ? suited : hand;
}

// ── AI ────────────────────────────────────────────────────────────────────────
function aiBid(hand, high, diff) {
  // Forced-bid guard: if high is still 65 (opening) always return a bid
  if (diff === 'easy') return high >= 90 || Math.random() > 0.5 ? 'pass' : high + 5;
  let str = 65;
  for (const c of hand) {
    if (c.isRook) str += 15;
    else if (c.value === 14) str += 6;
    else if (c.value === 13) str += 3;
    else if (c.value === 10) str += 2;
  }
  const max = Math.min(Math.floor(str / 5) * 5, 120);
  return high >= max ? 'pass' : Math.min(high + 5, max);
}

function aiPlay(hand, trick, trump, diff) {
  const leg = legalCards(hand, trick, trump);
  if (diff === 'easy') return leg[Math.floor(Math.random() * leg.length)];
  // Find the current best card in the trick
  const top = trick.reduce((b, t) => {
    if (!b) return t;
    if (t.card.isRook) return t;
    if (b.card.isRook) return b;
    const [bS, tS] = [eff(b.card, trump), eff(t.card, trump)];
    return (tS === trump && bS !== trump) || (tS === bS && t.card.value > b.card.value) ? t : b;
  }, null);
  const wins = leg.filter(c => {
    if (c.isRook) return true;
    if (!top) return true;
    if (top.card.isRook) return false;
    const [bS, cS] = [eff(top.card, trump), eff(c, trump)];
    return (cS === trump && bS !== trump) || (cS === bS && c.value > top.card.value);
  });
  // Win with highest value card; if can't win, dump lowest-point card
  if (wins.length) return wins.sort((a, b) => cardPts(b) - cardPts(a) || b.value - a.value)[0];
  return leg.sort((a, b) => cardPts(a) - cardPts(b) || a.value - b.value)[0];
}

function aiPickTrump(hand) {
  const cnt = Object.fromEntries(SUITS.map(s => [s, 0]));
  hand.forEach(c => { if (!c.isRook) cnt[c.suit]++; });
  return SUITS.reduce((a, b) => cnt[a] >= cnt[b] ? a : b);
}

// ── Card UI ───────────────────────────────────────────────────────────────────
function CardBack() {
  return (
    <div className="w-10 h-14 rounded-lg bg-blue-900 border border-blue-600
                    flex items-center justify-center text-xs text-blue-400 select-none shrink-0">
      🂠
    </div>
  );
}

function CardFace({ card, selected, dim, onClick }) {
  const color = card.isRook ? '#f97316' : SUIT_CLR[card.suit];
  return (
    <motion.div
      onClick={!dim ? onClick : undefined}
      className={`w-10 h-14 rounded-lg bg-white border-2 flex flex-col items-center
        justify-center select-none shrink-0 transition-transform
        ${selected ? 'border-yellow-400 -translate-y-3 shadow-lg shadow-yellow-400/40' : 'border-transparent'}
        ${dim ? 'opacity-40' : onClick ? 'cursor-pointer' : ''}`}
      style={{ color }}
      whileHover={!dim && onClick ? { y: -4 } : {}}
    >
      <span className="font-bold text-sm leading-none">{card.isRook ? '🐦' : card.value}</span>
      <span className="text-xs leading-none">{card.isRook ? 'ROOK' : card.suit}</span>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RookGame() {
  const navigate = useNavigate();

  // phase: setup | bidding | nest | nestTrump | playing | roundEnd | gameOver
  const [phase, setPhase] = useState('setup');
  const [diff, setDiff] = useState('medium');
  const [hands, setHands] = useState([[], [], [], []]);
  const [nestCards, setNestCards] = useState([]);   // discarded 5; last-trick winner claims pts
  const [scores, setScores] = useState([0, 0]);     // [team0(0,2), team1(1,3)]

  // Bidding
  const [bids, setBids] = useState([null, null, null, null]);
  const [passed, setPassed] = useState([false, false, false, false]);
  const [highBid, setHighBid] = useState(65);       // 65 means first valid bid is 70
  const [bidder, setBidder] = useState(0);           // who won the bid
  const [curBidder, setCurBidder] = useState(0);

  // Play
  const [trump, setTrump] = useState(null);
  const [trick, setTrick] = useState([]);
  const [curPlayer, setCurPlayer] = useState(0);
  const [trickNum, setTrickNum] = useState(0);
  const [roundPts, setRoundPts] = useState([0, 0]);
  const [nestSel, setNestSel] = useState([]);
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  // ── New Round ──────────────────────────────────────────────────────────────
  function startGame() {
    const d = shuffle(mkDeck());
    setHands([d.slice(0, 13), d.slice(13, 26), d.slice(26, 39), d.slice(39, 52)]);
    setNestCards(d.slice(52));
    setBids([null, null, null, null]);
    setPassed([false, false, false, false]);
    setHighBid(65);
    setBidder(0);
    setCurBidder(0);
    setTrump(null);
    setTrick([]);
    setCurPlayer(0);
    setTrickNum(0);
    setRoundPts([0, 0]);
    setNestSel([]);
    setProcessing(false);
    setMsg('Place your bid or pass!');
    setPhase('bidding');
  }

  // ── Bidding (AI auto-bids) ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'bidding' || curBidder === 0) return;
    const t = setTimeout(() => doBid(curBidder, aiBid(hands[curBidder], highBid, diff)), 700);
    return () => clearTimeout(t);
  }, [phase, curBidder]); // eslint-disable-line react-hooks/exhaustive-deps

  function doBid(player, action) {
    const newPassed = [...passed];
    const newBids = [...bids];
    let newHigh = highBid;

    // Last active player cannot pass — force a bid
    const otherActive = [0, 1, 2, 3].filter(i => i !== player && !newPassed[i]);
    if (action === 'pass' && otherActive.length === 0) action = Math.max(70, newHigh + 5);

    if (action === 'pass') { newPassed[player] = true; newBids[player] = 'pass'; }
    else { newBids[player] = action; newHigh = action; }

    const active = [0, 1, 2, 3].filter(i => !newPassed[i]);
    setBids(newBids);
    setPassed(newPassed);
    setHighBid(newHigh);

    // Bidding ends when exactly one player remains
    if (active.length <= 1) {
      const winner = active.length === 1 ? active[0] : player;
      const finalBid = newHigh <= 65 ? 70 : newHigh;
      setBidder(winner);
      setHighBid(finalBid);

      if (winner === 0) {
        // Human wins bid: merge nest into hand, go to nest management
        setHands(h => h.map((a, i) => i === 0 ? [...a, ...nestCards] : a));
        setNestSel([]);
        setMsg(`You won the bid at ${finalBid}! Discard 5 cards.`);
        setPhase('nest');
      } else {
        // AI wins bid: keep 13 best cards, pick trump from longest suit
        const merged = [...hands[winner], ...nestCards];
        const sorted = [...merged].sort((a, b) => cardPts(a) - cardPts(b) || a.value - b.value);
        const kept = sorted.slice(5);
        const discarded = sorted.slice(0, 5);
        const t = aiPickTrump(kept);
        setHands(h => h.map((a, i) => i === winner ? kept : a));
        setNestCards(discarded);
        setTrump(t);
        setCurPlayer(winner);
        setMsg(`${PNAME[winner]} won bid at ${finalBid}! Trump: ${t}`);
        setPhase('playing');
      }
      return;
    }

    // Advance to next non-passed player
    let next = (player + 1) % 4;
    while (newPassed[next]) next = (next + 1) % 4;
    setCurBidder(next);
    setMsg(next === 0 ? `Your turn! Bid ${newHigh + 5} or pass.` : `${PNAME[next]} is thinking…`);
  }

  // ── Nest Management (human bid winner) ────────────────────────────────────
  function toggleNestSel(card) {
    setNestSel(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : prev.length < 5 ? [...prev, card] : prev
    );
  }

  function confirmDiscard() {
    if (nestSel.length !== 5) return;
    setHands(h => h.map((a, i) => i === 0 ? a.filter(c => !nestSel.find(d => d.id === c.id)) : a));
    setNestCards(nestSel);
    setNestSel([]);
    setPhase('nestTrump');
  }

  function pickTrump(suit) {
    setTrump(suit);
    setCurPlayer(bidder);
    setMsg(bidder === 0 ? 'You lead the first trick!' : `${PNAME[bidder]} leads.`);
    setPhase('playing');
  }

  // ── AI Card Play ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || curPlayer === 0 || processing) return;
    const t = setTimeout(
      () => doPlay(curPlayer, aiPlay(hands[curPlayer], trick, trump, diff)),
      700
    );
    return () => clearTimeout(t);
  }, [phase, curPlayer, processing]); // eslint-disable-line react-hooks/exhaustive-deps

  function doPlay(player, card) {
    const newTrick = [...trick, { player, card }];
    setHands(h => h.map((a, i) => i === player ? a.filter(c => c.id !== card.id) : a));
    setTrick(newTrick);

    if (newTrick.length < 4) {
      setCurPlayer((player + 1) % 4);
      return;
    }

    // All 4 played — resolve after a short viewing delay
    setProcessing(true);
    setTimeout(() => {
      const winner = whoWins(newTrick, trump);
      const tPts = newTrick.reduce((s, t) => s + cardPts(t.card), 0);
      const newNum = trickNum + 1;
      const winTeam = (winner === 0 || winner === 2) ? 0 : 1;
      // Nest points go to winner of last trick
      const nestPts = newNum === 13 ? nestCards.reduce((s, c) => s + cardPts(c), 0) : 0;
      const newRound = [...roundPts];
      newRound[winTeam] += tPts + nestPts;

      setRoundPts(newRound);
      setTrick([]);
      setTrickNum(newNum);
      setProcessing(false);

      if (newNum === 13) endRound(newRound);
      else { setCurPlayer(winner); setMsg(`${PNAME[winner]} won the trick!`); }
    }, 1200);
  }

  function endRound(pts) {
    const bidTeam = (bidder === 0 || bidder === 2) ? 0 : 1;
    const ns = [...scores];
    if (pts[bidTeam] >= highBid) ns[bidTeam] += pts[bidTeam];
    else ns[bidTeam] -= highBid;
    ns[1 - bidTeam] += pts[1 - bidTeam];
    setScores(ns);
    if (ns[0] >= 300 || ns[1] >= 300) {
      if (ns[0] >= 300)
        api.post('/scores', { game: 'rook', score: ns[0], difficulty: diff }).catch(() => {});
      setPhase('gameOver');
    } else {
      setPhase('roundEnd');
    }
  }

  // ── Render Helpers ─────────────────────────────────────────────────────────
  const Header = ({ title }) => (
    <div className="flex items-center justify-between px-4 py-2 bg-black/40 shrink-0">
      <button
        onClick={() => navigate('/')}
        className="p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <ArrowLeft size={20} />
      </button>
      <span className="text-game-gold font-bold text-sm">{title}</span>
      <span className="text-white/60 text-xs">Us {scores[0]} · Them {scores[1]}</span>
    </div>
  );

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex flex-col items-center justify-center p-6">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center"
      >
        <ArrowLeft size={24} />
      </button>
      <div className="text-6xl mb-4">🐦</div>
      <h1 className="text-3xl font-bold text-game-gold mb-2">Rook</h1>
      <p className="text-white/50 text-sm mb-8 text-center max-w-xs">
        Trick-taking for 4 · You &amp; Partner (across) vs Left &amp; Right · First team to 300 wins
      </p>
      <div className="flex gap-3 mb-8">
        {['easy', 'medium', 'hard'].map(d => (
          <button
            key={d}
            onClick={() => setDiff(d)}
            className={`px-5 py-3 rounded-xl font-semibold capitalize min-h-[44px] transition-colors
              ${diff === d ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {d === 'easy' ? '😊' : d === 'medium' ? '🤔' : '🔥'} {d}
          </button>
        ))}
      </div>
      <Button variant="gold" onClick={startGame}>Deal Cards</Button>
    </div>
  );

  // ── Bidding ────────────────────────────────────────────────────────────────
  if (phase === 'bidding') {
    const canPass = [0, 1, 2, 3].filter(i => i !== 0 && !passed[i]).length > 0;
    return (
      <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex flex-col">
        <Header title="Bidding" />
        <div className="flex-1 flex flex-col items-center p-4 gap-4 overflow-y-auto max-w-lg mx-auto w-full">
          <div className="grid grid-cols-4 gap-2 w-full">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`rounded-xl p-2 text-center ${i === curBidder
                  ? 'bg-game-gold/20 border border-game-gold'
                  : 'bg-white/5'}`}
              >
                <div className="text-white/60 text-xs">{PNAME[i]}</div>
                <div className="text-white font-bold text-sm">
                  {bids[i] == null ? '—' : bids[i] === 'pass' ? 'Pass' : bids[i]}
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/70 text-sm text-center">{msg}</p>
          <div className="flex gap-1 flex-wrap justify-center">
            {hands[0].map(c => <CardFace key={c.id} card={c} />)}
          </div>
          {curBidder === 0 && (
            <div className="flex gap-3 mt-2">
              <Button variant="ghost" disabled={!canPass} onClick={() => doBid(0, 'pass')}>
                Pass
              </Button>
              <Button variant="gold" onClick={() => doBid(0, highBid + 5)}>
                Bid {highBid + 5}
              </Button>
            </div>
          )}
          {curBidder !== 0 && (
            <p className="text-white/40 text-sm animate-pulse">{PNAME[curBidder]} is thinking…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Nest Discard ───────────────────────────────────────────────────────────
  if (phase === 'nest') return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex flex-col">
      <Header title={`Nest · Bid ${highBid}`} />
      <div className="flex-1 flex flex-col items-center p-4 gap-4 overflow-y-auto max-w-lg mx-auto w-full">
        <p className="text-white/80 text-center text-sm">
          Select 5 cards to discard into the nest
          <span className="text-game-gold font-bold ml-1">({nestSel.length}/5 selected)</span>
        </p>
        <div className="flex gap-1 flex-wrap justify-center">
          {hands[0].map(c => (
            <CardFace
              key={c.id}
              card={c}
              selected={!!nestSel.find(x => x.id === c.id)}
              onClick={() => toggleNestSel(c)}
            />
          ))}
        </div>
        <Button variant="gold" disabled={nestSel.length !== 5} onClick={confirmDiscard}>
          Confirm Discard
        </Button>
      </div>
    </div>
  );

  // ── Trump Picker ───────────────────────────────────────────────────────────
  if (phase === 'nestTrump') return (
    <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex flex-col items-center justify-center p-6">
      <h2 className="text-2xl font-bold text-game-gold mb-8">Choose Trump Suit</h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {SUITS.map(suit => (
          <button
            key={suit}
            onClick={() => pickTrump(suit)}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20
                       rounded-xl px-5 py-4 font-bold min-h-[52px] transition-colors"
            style={{ color: SUIT_CLR[suit] }}
          >
            <span className="text-2xl">{suit}</span>
            <span className="text-white">{SUIT_LABEL[suit]}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Playing ────────────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const leg = legalCards(hands[0], trick, trump);
    const myTurn = curPlayer === 0 && !processing;
    return (
      <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/40 shrink-0">
          <button onClick={() => navigate('/')}
            className="p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: trump ? SUIT_CLR[trump] : 'white' }}>
              Trump: {trump ?? '?'}
            </div>
            <div className="text-white/50 text-xs">Trick {trickNum + 1} / 13 · Bid {highBid}</div>
          </div>
          <span className="text-white/60 text-xs">Us {scores[0]} · Them {scores[1]}</span>
        </div>

        <div className="flex-1 flex flex-col p-2 gap-2 min-h-0">
          {/* Partner (top) */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-white/40 text-xs">
              Partner{curPlayer === 2 ? ' 🟡' : ''} ({hands[2].length})
            </span>
            <div className="flex gap-0.5 flex-wrap justify-center">
              {hands[2].map((_, i) => <CardBack key={i} />)}
            </div>
          </div>

          {/* Middle row: Left | Trick area | Right */}
          <div className="flex flex-1 items-center gap-2 min-h-0">
            {/* Left */}
            <div className="flex flex-col items-center gap-0.5 w-16 shrink-0">
              <span className="text-white/40 text-xs">
                Left{curPlayer === 1 ? ' 🟡' : ''}
              </span>
              <span className="text-white/50 text-xs">{hands[1].length} cards</span>
              <div className="flex flex-col gap-0.5">
                {hands[1].slice(0, 4).map((_, i) => <CardBack key={i} />)}
              </div>
            </div>

            {/* Trick area */}
            <div className="flex-1 bg-green-900/30 border border-green-800/40 rounded-2xl p-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {[2, 1, 0, 3].map(p => {
                  const played = trick.find(t => t.player === p);
                  return (
                    <div key={p} className="flex flex-col items-center gap-0.5">
                      <span className="text-white/40 text-xs">{PNAME[p]}</span>
                      {played
                        ? <CardFace card={played.card} />
                        : <div className="w-10 h-14 rounded-lg border border-dashed border-white/10" />}
                    </div>
                  );
                })}
              </div>
              <p className="text-white/50 text-xs text-center leading-tight">{msg}</p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-center gap-0.5 w-16 shrink-0">
              <span className="text-white/40 text-xs">
                Right{curPlayer === 3 ? ' 🟡' : ''}
              </span>
              <span className="text-white/50 text-xs">{hands[3].length} cards</span>
              <div className="flex flex-col gap-0.5">
                {hands[3].slice(0, 4).map((_, i) => <CardBack key={i} />)}
              </div>
            </div>
          </div>

          {/* Human hand (bottom) */}
          <div className="flex flex-col items-center gap-2 shrink-0 pb-1">
            <span className="text-white/50 text-xs">
              {myTurn ? '← Tap a card to play →' : 'Your hand'}
            </span>
            <div className="flex gap-1 flex-wrap justify-center">
              {hands[0].map(card => {
                const isLegal = leg.find(c => c.id === card.id);
                return (
                  <CardFace
                    key={card.id}
                    card={card}
                    dim={myTurn && !isLegal}
                    onClick={myTurn && isLegal ? () => doPlay(0, card) : undefined}
                  />
                );
              })}
            </div>
            <div className="flex gap-4 text-white/40 text-xs">
              <span>Round · Us {roundPts[0]}</span>
              <span>Them {roundPts[1]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Round End ──────────────────────────────────────────────────────────────
  if (phase === 'roundEnd') {
    const bidTeam = (bidder === 0 || bidder === 2) ? 0 : 1;
    const bidMet = roundPts[bidTeam] >= highBid;
    return (
      <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-game-card rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl"
        >
          <h2 className="text-2xl font-bold text-game-gold mb-3">Round Over</h2>
          <div className={`text-lg font-semibold mb-4 ${bidMet ? 'text-green-400' : 'text-red-400'}`}>
            {bidMet ? `✓ Bid made! (${highBid})` : `✗ Bid failed (${highBid})`}
          </div>
          <div className="space-y-1 text-white/80 text-sm mb-6">
            <div>Your team round points: <span className="text-white font-bold">{roundPts[0]}</span></div>
            <div>Opponents round points: <span className="text-white font-bold">{roundPts[1]}</span></div>
            <div className="border-t border-white/20 pt-2 mt-2 font-semibold">
              Total — Us: {scores[0]} · Them: {scores[1]}
            </div>
          </div>
          <Button variant="gold" onClick={startGame}>Next Round</Button>
        </motion.div>
      </div>
    );
  }

  // ── Game Over ──────────────────────────────────────────────────────────────
  if (phase === 'gameOver') {
    const won = scores[0] >= 300 && scores[0] >= scores[1];
    return (
      <div className="min-h-screen bg-gradient-to-b from-game-bg to-orange-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-game-card rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl"
        >
          <div className="text-5xl mb-4">{won ? '🏆' : '😞'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-2">
            {won ? 'You Win!' : 'Game Over'}
          </h2>
          <div className="text-white/80 mb-6 space-y-1 text-sm">
            <div>Your team: <span className="text-white font-bold">{scores[0]}</span></div>
            <div>Opponents: <span className="text-white font-bold">{scores[1]}</span></div>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
            <Button variant="gold" onClick={() => { setScores([0, 0]); startGame(); }}>
              Play Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
