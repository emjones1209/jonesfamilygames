import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { buildDeck, shuffle, RANK_VALUES } from "../../utils/cardEngine";
import { aiChooseCard, aiBidSpades } from "../../utils/aiOpponent";
import { PlayingCard } from "../../components/PlayingCard";
import { Button } from "../../components/Button";
import { TutorialModal, TUTORIALS } from "../../components/TutorialModal";
import api from "../../utils/api";

const PLAYERS = ["You", "Left", "Partner", "Right"];
const AI = [1, 2, 3];
const TRUMP = "spades";

function dealHands() {
  const deck = shuffle(buildDeck());
  return [
    deck.slice(0, 13).map(c => ({ ...c, faceUp: true })),
    deck.slice(13, 26).map(c => ({ ...c, faceUp: false })),
    deck.slice(26, 39).map(c => ({ ...c, faceUp: false })),
    deck.slice(39, 52).map(c => ({ ...c, faceUp: false })),
  ];
}

function calcScore(bids, tricks) {
  const scores = [0, 0];
  for (let team = 0; team < 2; team++) {
    const p1 = team, p2 = team + 2;
    const teamBid = bids[p1] + bids[p2];
    const teamTricks = tricks[p1] + tricks[p2];
    const nilP1 = bids[p1] === 0 ? (tricks[p1] === 0 ? 100 : -100) : 0;
    const nilP2 = bids[p2] === 0 ? (tricks[p2] === 0 ? 100 : -100) : 0;
    const nonNilBid = (bids[p1] > 0 ? bids[p1] : 0) + (bids[p2] > 0 ? bids[p2] : 0);
    const nonNilTricks = teamTricks - (bids[p1] === 0 ? tricks[p1] : 0) - (bids[p2] === 0 ? tricks[p2] : 0);
    if (nonNilTricks >= nonNilBid) {
      scores[team] = nonNilBid * 10 + (nonNilTricks - nonNilBid) + nilP1 + nilP2;
    } else {
      scores[team] = -(nonNilBid * 10) + nilP1 + nilP2;
    }
  }
  return scores;
}

export default function SpadesGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [hands, setHands] = useState([]);
  const [bids, setBids] = useState([null, null, null, null]);
  const [biddingPlayer, setBiddingPlayer] = useState(0);
  const [trick, setTrick] = useState([]);
  const [scores, setScores] = useState([0, 0]);
  const [tricksWon, setTricksWon] = useState([0, 0, 0, 0]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [spadesBroken, setSpadesBroken] = useState(false);
  const [phase, setPhase] = useState("setup");
  const [selected, setSelected] = useState(null);
  const [roundBids, setRoundBids] = useState([null, null, null, null]);
  const [showTutorial, setShowTutorial] = useState(false);

  const startGame = (diff) => {
    setDifficulty(diff);
    const h = dealHands();
    setHands(h);
    setBids([null, null, null, null]);
    setRoundBids([null, null, null, null]);
    setBiddingPlayer(0);
    setTrick([]);
    setTricksWon([0, 0, 0, 0]);
    setSpadesBroken(false);
    setCurrentPlayer(0);
    setPhase("viewHand"); // Show hand before bidding starts
  };

  // AI auto-bid
  useEffect(() => {
    if (phase !== "bidding") return;
    if (biddingPlayer === 0) return;
    const timer = setTimeout(() => {
      const bid = aiBidSpades({ hand: hands[biddingPlayer], difficulty });
      const newBids = [...roundBids];
      newBids[biddingPlayer] = bid;
      setRoundBids(newBids);
      if (biddingPlayer === 3) {
        setBids(newBids);
        setPhase("playing");
        setCurrentPlayer(0);
      } else {
        setBiddingPlayer(b => b + 1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [phase, biddingPlayer, hands, difficulty, roundBids]);

  const legalCards = useCallback((pi) => {
    const hand = hands[pi] || [];
    if (trick.length === 0) {
      const nonSpades = hand.filter(c => c.suit !== TRUMP);
      if (!spadesBroken && nonSpades.length > 0) return nonSpades;
      return hand;
    }
    const leadSuit = trick[0].card.suit;
    const follow = hand.filter(c => c.suit === leadSuit);
    return follow.length > 0 ? follow : hand;
  }, [hands, trick, spadesBroken]);

  const playCard = useCallback((card, pi) => {
    const newTrick = [...trick, { card, playerId: pi }];
    const newHands = hands.map((h, i) => i === pi ? h.filter(c => c.id !== card.id) : h);
    const broken = spadesBroken || card.suit === TRUMP;
    if (newTrick.length === 4) {
      const leadSuit = newTrick[0].card.suit;
      let bestIdx = 0;
      for (let i = 1; i < 4; i++) {
        const best = newTrick[bestIdx].card, curr = newTrick[i].card;
        const bestT = best.suit === TRUMP, currT = curr.suit === TRUMP;
        if (currT && !bestT) bestIdx = i;
        else if (currT && bestT && RANK_VALUES[curr.rank] > RANK_VALUES[best.rank]) bestIdx = i;
        else if (!currT && !bestT && curr.suit === leadSuit && (best.suit !== leadSuit || RANK_VALUES[curr.rank] > RANK_VALUES[best.rank])) bestIdx = i;
      }
      const winner = newTrick[bestIdx].playerId;
      const newTW = [...tricksWon];
      newTW[winner]++;
      setTimeout(() => {
        setHands(newHands);
        setTrick([]);
        setSpadesBroken(broken);
        setTricksWon(newTW);
        setSelected(null);
        if (newHands[0].length === 0) {
          const rs = calcScore(bids, newTW);
          const ns = [scores[0] + rs[0], scores[1] + rs[1]];
          setScores(ns);
          if (ns[0] >= 500 || ns[1] >= 500) {
            setPhase("gameOver");
            api.post("/scores", { game: "spades", score: ns[0], difficulty }).catch(() => {});
          } else { setPhase("roundEnd"); }
        } else { setCurrentPlayer(winner); }
      }, 800);
    } else {
      setHands(newHands);
      setTrick(newTrick);
      setSpadesBroken(broken);
      setSelected(null);
      setCurrentPlayer((pi + 1) % 4);
    }
  }, [trick, hands, spadesBroken, tricksWon, bids, scores, difficulty]);

  useEffect(() => {
    if (phase !== "playing" || !AI.includes(currentPlayer)) return;
    const t = setTimeout(() => {
      const legal = legalCards(currentPlayer);
      if (!legal.length) return;
      const card = aiChooseCard({ hand: legal, trick, leadSuit: trick[0]?.card.suit || null, trumpSuit: TRUMP, difficulty, gameType: "spades" });
      playCard(card, currentPlayer);
    }, 700);
    return () => clearTimeout(t);
  }, [currentPlayer, phase, trick, difficulty, playCard, legalCards]);

  if (phase === "setup") return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-5 flex flex-col">
      <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white mb-6"><ArrowLeft size={18}/> Back</button>
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-3">♠️</div>
        <h1 className="game-title text-3xl mb-2">Spades</h1>
        <p className="text-white/50 mb-8 text-center">Bid carefully — spades are always trump!</p>
        <div className="w-full space-y-3">
          {["easy","medium","hard"].map(d => (
            <Button key={d} variant="primary" className="w-full text-lg" onClick={() => startGame(d)}>
              {d === "easy" ? "😊 Easy" : d === "medium" ? "🤔 Medium" : "🔥 Hard"}
            </Button>
          ))}
        </div>
        <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mt-4 mx-auto">
          <HelpCircle size={16} /> How to play
        </button>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Spades" slides={TUTORIALS.spades} />
    </div>
  );

  if (phase === "viewHand") {
    const sortedHand = [...(hands[0] || [])].sort((a, b) => {
      const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
      if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
      return (RANK_VALUES[b.rank] || 0) - (RANK_VALUES[a.rank] || 0);
    });
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-5 flex flex-col">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white mb-4"><ArrowLeft size={18}/> Back</button>
        <h2 className="text-xl font-bold text-white text-center mb-1">Your Hand</h2>
        <p className="text-white/50 text-sm text-center mb-4">Study your cards, then bid how many tricks you can win.</p>
        <div className="flex flex-wrap justify-center gap-1 mb-6">
          {sortedHand.map(card => <PlayingCard key={card.id} card={card} size="sm" />)}
        </div>
        <div className="max-w-xs mx-auto w-full space-y-3">
          <div className="card-panel text-white/60 text-xs space-y-1">
            <p>♠ Spades are always trump.</p>
            <p>Bid "Nil" to win 0 tricks (+100 if successful, -100 if not).</p>
            <p>Making your bid = 10× bid points. Each over-trick = 1 point (watch those bags!).</p>
          </div>
          <Button variant="primary" className="w-full text-lg" onClick={() => setPhase("bidding")}>
            Ready to Bid →
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "bidding") {
    const myBid = roundBids[0];
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-5 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-white mb-2">Bidding Phase</h2>
        <p className="text-white/50 mb-6 text-center">How many tricks will you win?</p>
        {myBid === null ? (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => (
              <button key={n} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl text-lg transition-all active:scale-95"
                onClick={() => {
                  const nb = [...roundBids]; nb[0] = n;
                  setRoundBids(nb);
                  setBiddingPlayer(1);
                }}>
                {n === 0 ? "Nil" : n}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-white/60 text-center">You bid <span className="text-game-gold font-bold text-xl">{myBid === 0 ? "Nil" : myBid}</span> — waiting for AI...</div>
        )}
        <div className="mt-6 space-y-1 text-sm text-white/40 text-center">
          {PLAYERS.map((p, i) => roundBids[i] !== null && <div key={i}>{p}: {roundBids[i] === 0 ? "Nil" : roundBids[i]}</div>)}
        </div>
      </div>
    );
  }

  const myHand = hands[0] || [];
  const myLegal = legalCards(0);
  const isMyTurn = currentPlayer === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-slate-900 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate("/")} className="text-white/40 p-1"><ArrowLeft size={18}/></button>
        <div className="text-white/50 text-xs">Us: {scores[0]} | Them: {scores[1]}</div>
        <div className="text-white/40 text-xs">Tricks: {tricksWon[0]}+{tricksWon[2]}/{bids[0]+bids[2]}</div>
      </div>
      <div className="flex justify-center mb-2">
        <div className="flex gap-1">{(hands[2]||[]).map((_,i)=><div key={i} className="w-6 h-9 bg-blue-900 border border-blue-700 rounded"/>)}</div>
      </div>
      <div className="flex items-center mb-2 px-2">
        <div className="flex flex-col gap-0.5">{(hands[1]||[]).map((_,i)=><div key={i} className="w-9 h-6 bg-blue-900 border border-blue-700 rounded"/>)}</div>
        <div className="flex-1 flex flex-col items-center min-h-[100px]">
          <div className="text-white/40 text-xs mb-2">{isMyTurn ? "🎯 Your turn" : `${PLAYERS[currentPlayer]}...`}</div>
          <div className="grid grid-cols-2 gap-2">
            {trick.map(({card,playerId}) => (
              <div key={card.id} className="text-center"><PlayingCard card={card} size="sm"/><div className="text-white/40 text-xs">{PLAYERS[playerId]}</div></div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">{(hands[3]||[]).map((_,i)=><div key={i} className="w-9 h-6 bg-blue-900 border border-blue-700 rounded"/>)}</div>
      </div>
      <div className="flex justify-center gap-3 text-xs text-white/40 mb-2">
        {PLAYERS.map((p,i)=><span key={i}>{p}:{bids[i]}</span>)}
      </div>
      <div className="mt-auto">
        <div className="flex flex-wrap justify-center gap-1">
          {myHand.map(card => {
            const isLegal = myLegal.some(c=>c.id===card.id);
            return <PlayingCard key={card.id} card={card} size="sm" selected={selected?.id===card.id}
              disabled={!isMyTurn||!isLegal}
              onClick={() => { if(!isMyTurn||!isLegal) return; if(selected?.id===card.id) playCard(card,0); else setSelected(card); }}/>;
          })}
        </div>
        {selected&&isMyTurn&&<p className="text-center text-white/40 text-xs mt-1">Tap again to play</p>}
      </div>
      <AnimatePresence>
        {phase==="roundEnd"&&(
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" initial={{opacity:0}} animate={{opacity:1}}>
            <div className="card-panel text-center max-w-xs w-full">
              <h2 className="text-xl font-bold text-white mb-3">Round Over</h2>
              <div className="text-white/60 mb-4">Us: {scores[0]} | Them: {scores[1]}</div>
              <Button variant="primary" className="w-full" onClick={() => { const h=dealHands(); setHands(h); setBids([null,null,null,null]); setRoundBids([null,null,null,null]); setBiddingPlayer(0); setTrick([]); setTricksWon([0,0,0,0]); setSpadesBroken(false); setCurrentPlayer(0); setPhase("viewHand"); }}>Next Round</Button>
            </div>
          </motion.div>
        )}
        {phase==="gameOver"&&(
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" initial={{opacity:0}} animate={{opacity:1}}>
            <div className="card-panel text-center max-w-xs w-full">
              <div className="text-5xl mb-3">{scores[0]>scores[1]?"🏆":"😢"}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{scores[0]>scores[1]?"Your team wins!":"They win!"}</h2>
              <div className="text-white/60 mb-4">Us: {scores[0]} | Them: {scores[1]}</div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={()=>navigate("/")}>Home</Button>
                <Button variant="primary" className="flex-1" onClick={()=>startGame(difficulty)}>Again</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
