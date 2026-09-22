import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { buildDeck, shuffle, RANK_VALUES } from '../../utils/cardEngine';
import { aiChooseCard } from '../../utils/aiOpponent';
import { PlayingCard } from '../../components/PlayingCard';
import { Button } from '../../components/Button';
import { TutorialModal, TUTORIALS } from '../../components/TutorialModal';
import api from '../../utils/api';

const PLAYERS = ['You', 'Left', 'Opponent', 'Right'];
const AI_PLAYERS = [1, 2, 3];

function dealHands() {
  const deck = shuffle(buildDeck());
  return [
    deck.slice(0, 13).map(c => ({ ...c, faceUp: true })),
    deck.slice(13, 26).map(c => ({ ...c, faceUp: false })),
    deck.slice(26, 39).map(c => ({ ...c, faceUp: false })),
    deck.slice(39, 52).map(c => ({ ...c, faceUp: false })),
  ];
}

function cardPoints(card) {
  if (card.suit === 'hearts') return 1;
  if (card.suit === 'spades' && card.rank === 'Q') return 13;
  return 0;
}

export default function HeartsGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [hands, setHands] = useState([]);
  const [trick, setTrick] = useState([]);   // [{card, playerId}]
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [roundScores, setRoundScores] = useState([0, 0, 0, 0]);
  const [tricks, setTricks] = useState([[], [], [], []]); // cards won per player
  const [leadPlayer, setLeadPlayer] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [heartsBroken, setHeartsBroken] = useState(false);
  const [phase, setPhase] = useState('setup');     // setup | playing | roundEnd | gameOver
  const [selected, setSelected] = useState(null);
  const [lastTrick, setLastTrick] = useState(null);
  const [winner, setWinner] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const startGame = (diff) => {
    setDifficulty(diff);
    const h = dealHands();
    setHands(h);
    // Player with 2♣ leads
    let startPlayer = 0;
    for (let i = 0; i < 4; i++) {
      if (h[i].find(c => c.rank === '2' && c.suit === 'clubs')) { startPlayer = i; break; }
    }
    setCurrentPlayer(startPlayer);
    setLeadPlayer(startPlayer);
    setTrick([]);
    setRoundScores([0,0,0,0]);
    setTricks([[],[],[],[]]);
    setHeartsBroken(false);
    setPhase('playing');
  };

  const legalCards = useCallback((playerIdx) => {
    const hand = hands[playerIdx];
    if (!hand) return [];
    if (trick.length === 0) {
      // Leading: can't lead hearts until broken (unless only hearts left)
      const nonHearts = hand.filter(c => c.suit !== 'hearts');
      if (!heartsBroken && nonHearts.length > 0) return nonHearts;
      return hand;
    }
    const leadSuit = trick[0].card.suit;
    const followSuit = hand.filter(c => c.suit === leadSuit);
    if (followSuit.length > 0) return followSuit;
    return hand;
  }, [hands, trick, heartsBroken]);

  const playCard = useCallback((card, playerIdx) => {
    const newTrick = [...trick, { card, playerId: playerIdx }];
    const newHands = hands.map((h, i) =>
      i === playerIdx ? h.filter(c => c.id !== card.id) : h
    );
    let newBroken = heartsBroken || card.suit === 'hearts' || (card.suit === 'spades' && card.rank === 'Q');

    if (newTrick.length === 4) {
      // Resolve trick
      const leadSuit = newTrick[0].card.suit;
      const trickCards = newTrick.map(t => t.card);
      let bestIdx = 0;
      for (let i = 1; i < 4; i++) {
        const best = trickCards[bestIdx];
        const curr = trickCards[i];
        if (curr.suit === leadSuit && best.suit === leadSuit && RANK_VALUES[curr.rank] > RANK_VALUES[best.rank]) bestIdx = i;
        else if (curr.suit === leadSuit && best.suit !== leadSuit) bestIdx = i;
      }
      const winnerId = newTrick[bestIdx].playerId;
      const pts = trickCards.reduce((s, c) => s + cardPoints(c), 0);
      const newRoundScores = [...roundScores];
      newRoundScores[winnerId] += pts;
      const newTricks = tricks.map((t, i) => i === winnerId ? [...t, ...trickCards] : t);

      setLastTrick({ cards: newTrick, winner: PLAYERS[winnerId] });
      setTimeout(() => {
        setTrick([]);
        setLastTrick(null);
        setHands(newHands);
        setHeartsBroken(newBroken);
        setRoundScores(newRoundScores);
        setTricks(newTricks);

        if (newHands[0].length === 0) {
          // End of round
          const finalScores = newRoundScores.map((s, i) => {
            // Shoot the moon check
            if (s === 26) return 0;
            return s;
          });
          // If someone shot the moon, add 26 to everyone else
          const shooter = newRoundScores.findIndex(s => s === 26);
          const adjustedScores = scores.map((s, i) => s + (shooter >= 0 ? (i === shooter ? 0 : 26) : newRoundScores[i]));
          setScores(adjustedScores);
          if (adjustedScores.some(s => s >= 100)) {
            const minScore = Math.min(...adjustedScores);
            const winnerIdx = adjustedScores.findIndex(s => s === minScore);
            setWinner(PLAYERS[winnerIdx]);
            setPhase('gameOver');
            api.post('/scores', { game: 'hearts', score: Math.max(0, 100 - adjustedScores[0]), difficulty }).catch(() => {});
          } else {
            setPhase('roundEnd');
          }
        } else {
          setCurrentPlayer(winnerId);
          setLeadPlayer(winnerId);
          setSelected(null);
        }
      }, 2000);
    } else {
      setHands(newHands);
      setTrick(newTrick);
      setHeartsBroken(newBroken);
      setSelected(null);
      const next = (playerIdx + 1) % 4;
      setCurrentPlayer(next);
    }
  }, [trick, hands, roundScores, tricks, scores, heartsBroken, difficulty]);

  // AI plays
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!AI_PLAYERS.includes(currentPlayer)) return;
    if (lastTrick) return;

    const timeout = setTimeout(() => {
      const legal = legalCards(currentPlayer);
      if (legal.length === 0) return;
      const leadSuit = trick.length > 0 ? trick[0].card.suit : null;
      const card = aiChooseCard({ hand: legal, trick, leadSuit, trumpSuit: null, difficulty, gameType: 'hearts' });
      playCard(card, currentPlayer);
    }, 700);
    return () => clearTimeout(timeout);
  }, [currentPlayer, phase, trick, difficulty, playCard, legalCards, lastTrick]);

  const newRound = () => {
    const h = dealHands();
    setHands(h);
    let startPlayer = 0;
    for (let i = 0; i < 4; i++) {
      if (h[i].find(c => c.rank === '2' && c.suit === 'clubs')) { startPlayer = i; break; }
    }
    setCurrentPlayer(startPlayer);
    setLeadPlayer(startPlayer);
    setTrick([]);
    setRoundScores([0,0,0,0]);
    setTricks([[],[],[],[]]);
    setHeartsBroken(false);
    setPhase('playing');
  };

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-red-900 p-5 flex flex-col">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <div className="text-6xl mb-3">♥️</div>
          <h1 className="game-title text-3xl mb-2">Hearts</h1>
          <p className="text-white/50 mb-6 text-center">Avoid taking hearts and the Queen of Spades!</p>
          <div className="w-full space-y-3 mb-4">
            {['easy','medium','hard'].map(d => (
              <Button key={d} variant="primary" className="w-full capitalize text-lg" onClick={() => startGame(d)}>
                {d === 'easy' ? '😊 Easy' : d === 'medium' ? '🤔 Medium' : '🔥 Hard'}
              </Button>
            ))}
          </div>
          <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm">
            <HelpCircle size={16} /> How to play
          </button>
        </div>
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title="Hearts" slides={TUTORIALS.hearts} />
      </div>
    );
  }

  const myHand = hands[0] || [];
  const myLegal = legalCards(0);
  const isMyTurn = currentPlayer === 0 && !lastTrick;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-red-950 p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate('/')} className="text-white/40 hover:text-white p-1"><ArrowLeft size={18} /></button>
        <div className="text-white/60 text-sm">Hearts · {difficulty}</div>
        <div className="flex gap-4 text-xs text-white/50">
          {PLAYERS.map((p, i) => <span key={i}>{p}: {scores[i]}</span>)}
        </div>
      </div>

      {/* AI hands (back of cards) */}
      <div className="flex justify-center mb-2">
        {/* Opponent (top) */}
        <div className="flex gap-1">
          {(hands[2] || []).map((_, i) => (
            <div key={i} className="w-6 h-9 bg-blue-900 border border-blue-700 rounded-md" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 px-2">
        {/* Left */}
        <div className="flex flex-col gap-0.5">
          {(hands[1] || []).map((_, i) => (
            <div key={i} className="w-9 h-6 bg-blue-900 border border-blue-700 rounded-md" />
          ))}
        </div>

        {/* Trick area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px]">
          <div className="text-white/50 text-xs mb-2">
            {isMyTurn ? '🎯 Your turn' : lastTrick ? `${lastTrick.winner} won the trick` : `Waiting for ${PLAYERS[currentPlayer]}...`}
          </div>
          {/* Show current trick or last trick */}
          <div className="grid grid-cols-2 gap-2">
            {(lastTrick ? lastTrick.cards : trick).map(({ card, playerId }) => (
              <div key={card.id} className="text-center">
                <PlayingCard card={card} size="sm" />
                <div className="text-white/50 text-xs mt-1">{PLAYERS[playerId]}</div>
              </div>
            ))}
          </div>
          {lastTrick && (
            <div className="text-amber-400 text-xs font-semibold mt-2 animate-pulse">
              🏆 {lastTrick.winner} takes the trick
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex flex-col gap-0.5">
          {(hands[3] || []).map((_, i) => (
            <div key={i} className="w-9 h-6 bg-blue-900 border border-blue-700 rounded-md" />
          ))}
        </div>
      </div>

      {/* Score bar */}
      <div className="flex justify-center gap-4 text-xs text-white/50 mb-2">
        {PLAYERS.map((p, i) => <span key={i}>{p}: {roundScores[i]}pt</span>)}
      </div>

      {/* Player hand */}
      <div className="mt-auto">
        <p className="text-white/40 text-xs text-center mb-2">Your hand</p>
        <div className="flex flex-wrap justify-center gap-1">
          {myHand.map(card => {
            const isLegal = myLegal.some(c => c.id === card.id);
            return (
              <PlayingCard
                key={card.id}
                card={card}
                size="sm"
                selected={selected?.id === card.id}
                disabled={!isMyTurn || !isLegal}
                onClick={() => {
                  if (!isMyTurn || !isLegal) return;
                  if (selected?.id === card.id) {
                    playCard(card, 0);
                  } else {
                    setSelected(card);
                  }
                }}
              />
            );
          })}
        </div>
        {selected && isMyTurn && (
          <p className="text-center text-white/60 text-xs mt-1">Tap again to play</p>
        )}
      </div>

      {/* Round end / game over modals */}
      <AnimatePresence>
        {phase === 'roundEnd' && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="card-panel text-center max-w-sm w-full">
              <h2 className="text-xl font-bold text-white mb-3">Round Over!</h2>
              <div className="space-y-1 mb-4">
                {PLAYERS.map((p, i) => <div key={i} className="flex justify-between text-white/80"><span>{p}</span><span>{scores[i]} pts</span></div>)}
              </div>
              <Button variant="primary" className="w-full" onClick={newRound}>Next Round</Button>
            </div>
          </motion.div>
        )}
        {phase === 'gameOver' && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="card-panel text-center max-w-sm w-full">
              <div className="text-5xl mb-3">{winner === 'You' ? '🏆' : '😢'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{winner === 'You' ? 'You Win!' : `${winner} Wins!`}</h2>
              <div className="space-y-1 mb-4">
                {PLAYERS.map((p, i) => <div key={i} className="flex justify-between text-white/80"><span>{p}</span><span>{scores[i]} pts</span></div>)}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
                <Button variant="primary" className="flex-1" onClick={() => { setScores([0,0,0,0]); startGame(difficulty); }}>Play Again</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
