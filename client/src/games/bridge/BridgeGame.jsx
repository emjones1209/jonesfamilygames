import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { buildDeck, shuffle, RANK_VALUES, SUITS } from "../../utils/cardEngine";
import { aiBidBridge, aiChooseCard } from "../../utils/aiOpponent";
import { PlayingCard } from "../../components/PlayingCard";
import { Button } from "../../components/Button";
import api from "../../utils/api";

// Simplified Rubber Bridge — South(You)+North(AI) vs East+West
// Bidding: 1-7 levels, 5 denominations (C,D,H,S,NT), Pass, Dbl, Rdbl
const PLAYER_NAMES = ["South (You)", "West", "North (Partner)", "East"];
const AI_PLAYERS = [1, 2, 3];
const DENOMINATIONS = ["C","D","H","S","NT"];
const DENOM_FULL = {C:"Clubs",D:"Diamonds",H:"Hearts",S:"Spades",NT:"No Trump"};
const SUIT_MAP = {C:"clubs",D:"diamonds",H:"hearts",S:"spades"};

function dealHands() {
  const deck = shuffle(buildDeck());
  return [
    deck.slice(0,13).map(c=>({...c,faceUp:true})),
    deck.slice(13,26).map(c=>({...c,faceUp:false})),
    deck.slice(26,39).map(c=>({...c,faceUp:false})), // revealed if this seat becomes dummy
    deck.slice(39,52).map(c=>({...c,faceUp:false})),
  ];
}

function bidLevel(bid) {
  if (bid==="Pass"||bid==="Dbl"||bid==="Rdbl") return 0;
  return parseInt(bid[0]);
}
function bidDenom(bid) {
  if (bid==="Pass"||bid==="Dbl"||bid==="Rdbl") return null;
  return bid.slice(1);
}
function bidHigher(bid, prev) {
  if (!prev||prev==="Pass") return true;
  const pl=bidLevel(prev),pd=bidDenom(prev);
  const bl=bidLevel(bid), bd=bidDenom(bid);
  if (!bd) return false;
  if (bl>pl) return true;
  if (bl===pl) return DENOMINATIONS.indexOf(bd)>DENOMINATIONS.indexOf(pd);
  return false;
}

function trickWinnerBridge(trick, leadSuit, trumpSuit) {
  let best = trick[0];
  for (let i=1;i<trick.length;i++) {
    const card=trick[i].card, bestCard=best.card;
    const bestT=bestCard.suit===trumpSuit, cardT=card.suit===trumpSuit;
    if (cardT&&!bestT) best=trick[i];
    else if (cardT&&bestT&&RANK_VALUES[card.rank]>RANK_VALUES[bestCard.rank]) best=trick[i];
    else if (!cardT&&!bestT&&card.suit===leadSuit&&(bestCard.suit!==leadSuit||RANK_VALUES[card.rank]>RANK_VALUES[bestCard.rank])) best=trick[i];
  }
  return best.playerId;
}

function scoreBridge(contract, tricksWon, vulnerable=false) {
  if (!contract||contract.bid==="Pass") return {ns:0,ew:0};
  const level=bidLevel(contract.bid);
  const denom=bidDenom(contract.bid);
  const declarer=contract.declarer;
  const needed=level+6;
  const made=tricksWon[declarer]+tricksWon[(declarer+2)%4];
  const ns_team=declarer===0||declarer===2;
  const pts = {ns:0,ew:0};
  const isNT=denom==="NT";
  const isMinor=denom==="C"||denom==="D";
  if (made>=needed) {
    // Contract made
    let trick_score = isNT ? (40+30*(level-1)) : (isMinor?20*level:30*level);
    let bonus = trick_score>=100?(vulnerable?500:300):(vulnerable?100:50);
    let overtricks=(made-needed)*(isNT||!isMinor?30:20);
    const total=trick_score+bonus+overtricks;
    if (ns_team) pts.ns=total; else pts.ew=total;
  } else {
    // Contract failed
    const down=needed-made;
    const penalty=vulnerable?100*down:50*down;
    if (ns_team) pts.ew=penalty; else pts.ns=penalty;
  }
  return pts;
}

export default function BridgeGame() {
  const navigate=useNavigate();
  const [difficulty,setDifficulty]=useState(null);
  const [hands,setHands]=useState([]);
  const [bids,setBids]=useState([]);          // [{player,bid}]
  const [contract,setContract]=useState(null); // {bid,declarer,trumpSuit}
  const [dummy,setDummy]=useState(null);       // player idx (partner of declarer)
  const [biddingPlayer,setBiddingPlayer]=useState(0);
  const [passCount,setPassCount]=useState(0);
  const [trick,setTrick]=useState([]);
  const [tricksWon,setTricksWon]=useState([0,0,0,0]);
  const [currentPlayer,setCurrentPlayer]=useState(0);
  const [scores,setScores]=useState({ns:0,ew:0});
  const [phase,setPhase]=useState("setup");
  const [selected,setSelected]=useState(null);
  const [roundMsg,setRoundMsg]=useState("");

  const startGame=(diff)=>{
    setDifficulty(diff);
    const h=dealHands();
    setHands(h);
    setBids([]); setContract(null); setDummy(null);
    setBiddingPlayer(0); setPassCount(0);
    setTrick([]); setTricksWon([0,0,0,0]);
    setCurrentPlayer(0); setSelected(null); setRoundMsg("");
    setPhase("bidding");
  };

  const getCurrentBid=()=>{
    const nonPass=bids.filter(b=>b.bid!=="Pass"&&b.bid!=="Dbl"&&b.bid!=="Rdbl");
    return nonPass.length>0?nonPass[nonPass.length-1].bid:null;
  };

  const placeBid=(bid)=>{
    const nb=[...bids,{player:biddingPlayer,bid}];
    setBids(nb);
    let pc=bid==="Pass"?passCount+1:0;
    setPassCount(pc);
    if (pc>=3&&nb.length>=4) {
      // Bidding over
      const final=nb.filter(b=>b.bid!=="Pass"&&b.bid!=="Dbl"&&b.bid!=="Rdbl").pop();
      if (!final||final.bid==="Pass") {
        setPhase("roundEnd"); setRoundMsg("All passed — redeal!");
        return;
      }
      const denom=bidDenom(final.bid);
      const trump=denom==="NT"?null:SUIT_MAP[denom];
      // Declarer = first player of winner's partnership to bid that denomination
      const winnerTeam=final.player%2;
      const partnershipBids=nb.filter(b=>b.player%2===winnerTeam&&b.bid!=="Pass"&&b.bid!=="Dbl"&&b.bid!=="Rdbl"&&bidDenom(b.bid)===denom);
      const declarerIdx=partnershipBids[0]?.player??final.player;
      const dummyIdx=(declarerIdx+2)%4;
      setContract({bid:final.bid,declarer:declarerIdx,trumpSuit:trump});
      setDummy(dummyIdx);
      // Dummy's hand revealed
      setHands(h=>h.map((hand,i)=>i===dummyIdx?hand.map(c=>({...c,faceUp:true})):hand));
      setCurrentPlayer((declarerIdx+1)%4);
      setPhase("playing");
      return;
    }
    setBiddingPlayer((biddingPlayer+1)%4);
  };

  // AI bidding
  useEffect(()=>{
    if (phase!=="bidding") return;
    if (biddingPlayer===0) return;
    const t=setTimeout(()=>{
      const cb=getCurrentBid();
      const bid=aiBidBridge({hand:hands[biddingPlayer],difficulty,currentBid:cb,position:biddingPlayer});
      const legal=!bid||bid==="Pass"||(bid!=="Pass"&&bidHigher(bid,cb));
      placeBid(legal?bid:"Pass");
    },600);
    return ()=>clearTimeout(t);
  },[phase,biddingPlayer,hands,difficulty]);

  const legalCards=useCallback((pi)=>{
    const hand=hands[pi]||[];
    if (!trick.length) return hand;
    const leadSuit=trick[0].card.suit;
    const follow=hand.filter(c=>c.suit===leadSuit);
    return follow.length>0?follow:hand;
  },[hands,trick]);

  const playCard=useCallback((card,pi)=>{
    const nt=[...trick,{card,playerId:pi}];
    const nh=hands.map((h,i)=>i===pi?h.filter(c=>c.id!==card.id):h);
    if (nt.length===4) {
      const leadSuit=nt[0].card.suit;
      const winnerPi=trickWinnerBridge(nt,leadSuit,contract?.trumpSuit||null);
      const nTW=[...tricksWon]; nTW[winnerPi]++;
      setTimeout(()=>{
        setHands(nh); setTrick([]); setTricksWon(nTW); setSelected(null);
        if (nh[0].length===0) {
          const pts=scoreBridge(contract,nTW);
          const ns={ns:scores.ns+pts.ns,ew:scores.ew+pts.ew};
          setScores(ns); setPhase("roundEnd");
          api.post("/scores",{game:"bridge",score:ns.ns,difficulty}).catch(()=>{});
        } else { setCurrentPlayer(winnerPi); }
      },900);
    } else {
      setHands(nh); setTrick(nt); setSelected(null);
      // Dummy takes its turn in normal rotation; the declarer chooses its card
      setCurrentPlayer((pi+1)%4);
    }
  },[trick,hands,contract,tricksWon,scores,difficulty]);

  // Who chooses the card for the current seat: the declarer plays dummy's hand
  const controller=currentPlayer===dummy?contract?.declarer:currentPlayer;

  // AI plays its own hand, and dummy's hand when an AI is declarer
  useEffect(()=>{
    if (phase!=="playing"||controller===0) return;
    const t=setTimeout(()=>{
      const legal=legalCards(currentPlayer);
      if (!legal.length) return;
      const ls=trick[0]?.card.suit||null;
      const card=aiChooseCard({hand:legal,trick,leadSuit:ls,trumpSuit:contract?.trumpSuit||null,difficulty,gameType:"bridge"});
      playCard(card,currentPlayer);
    },800);
    return ()=>clearTimeout(t);
  },[currentPlayer,controller,phase,trick,difficulty,playCard,legalCards,contract]);

  if (phase==="setup") return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-teal-900 p-5 flex flex-col">
      <button onClick={()=>navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white mb-6"><ArrowLeft size={18}/> Back</button>
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-3">🌉</div>
        <h1 className="game-title text-3xl mb-2">Bridge</h1>
        <p className="text-white/50 mb-2 text-center">Full contract bridge with bidding.</p>
        <p className="text-white/30 text-xs mb-8 text-center">You play South. Partner is North (AI dummy).</p>
        <div className="w-full space-y-3">
          {["easy","medium","hard"].map(d=>(
            <Button key={d} variant="primary" className="w-full text-lg capitalize" onClick={()=>startGame(d)}>
              {d==="easy"?"😊 Easy":d==="medium"?"🤔 Medium":"🔥 Hard"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  if (phase==="bidding") {
    const cb=getCurrentBid();
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-teal-900 p-5 flex flex-col">
        <button onClick={()=>navigate("/")} className="text-white/40 p-1 mb-3"><ArrowLeft size={18}/></button>
        <h2 className="text-xl font-bold text-white mb-1 text-center">Bidding</h2>
        <div className="text-white/50 text-xs text-center mb-4">{cb?`Current: ${cb}`:"No bid yet"}</div>
        {biddingPlayer===0?(
          <>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {[1,2,3,4,5,6,7].map(level=>DENOMINATIONS.map(d=>{
                const bid=`${level}${d}`;
                const legal=bidHigher(bid,cb);
                return (
                  <button key={bid} onClick={()=>legal&&placeBid(bid)} disabled={!legal}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${legal?"bg-white/10 hover:bg-white/20 text-white":"opacity-20 bg-white/5 text-white/40"}`}>
                    {level}{d}
                  </button>
                );
              }))}
            </div>
            <Button variant="ghost" className="w-full max-w-xs mx-auto" onClick={()=>placeBid("Pass")}>Pass</Button>
          </>
        ):(
          <div className="text-center text-white/50">AI bidding... ({PLAYER_NAMES[biddingPlayer]})</div>
        )}
        <div className="mt-4 max-w-xs mx-auto space-y-1">
          {bids.slice(-6).map((b,i)=><div key={i} className="flex justify-between text-xs text-white/40"><span>{PLAYER_NAMES[b.player]}</span><span className="text-white/70">{b.bid}</span></div>)}
        </div>
        <div className="mt-4 text-center text-xs text-white/30">Your hand preview</div>
        <div className="flex flex-wrap justify-center gap-1 mt-2">
          {(hands[0]||[]).map(c=><PlayingCard key={c.id} card={c} size="xs"/>)}
        </div>
      </div>
    );
  }

  const myHand=hands[0]||[];
  const dummyHand=hands[dummy]||[];
  const isMyTurn=controller===0;              // your own seat, or dummy's when you declare
  const iAmDummy=dummy===0;
  const myLegal=currentPlayer===0&&isMyTurn?legalCards(0):[];
  const dummyLegal=currentPlayer===dummy&&isMyTurn?legalCards(dummy):[];
  const contractStr=contract?`${contract.bid} by ${PLAYER_NAMES[contract.declarer]}`:"";
  const tapCard=(card,pi,legal)=>{
    if (!legal.some(c=>c.id===card.id)) return;
    if (selected?.id===card.id) playCard(card,pi); else setSelected(card);
  };
  const cardBacks=(n,vertical)=>Array.from({length:n},(_,i)=>(
    <div key={i} className={`${vertical?"w-8 h-5":"w-5 h-8"} bg-blue-900 border border-blue-700 rounded`}/>
  ));
  // A side seat shows dummy's cards face-up once dummy is revealed
  const sideHand=(pi)=>pi===dummy
    ?<div className="flex flex-col gap-0.5 items-center">
        <p className="text-white/40 text-[10px]">Dummy</p>
        {dummyHand.map(c=><PlayingCard key={c.id} card={c} size="xs"
          selected={selected?.id===c.id}
          disabled={!dummyLegal.some(l=>l.id===c.id)}
          onClick={()=>tapCard(c,pi,dummyLegal)}/>)}
      </div>
    :<div className="flex flex-col gap-0.5">{cardBacks((hands[pi]||[]).length,true)}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-teal-900 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <button onClick={()=>navigate("/")} className="text-white/40 p-1"><ArrowLeft size={18}/></button>
        <div className="text-white/50 text-xs">{contractStr}</div>
        <div className="text-white/40 text-xs">NS:{scores.ns} EW:{scores.ew}</div>
      </div>
      <div className="text-center text-white/40 text-xs mb-2">
        Tricks: NS={tricksWon[0]+tricksWon[2]} EW={tricksWon[1]+tricksWon[3]} | Need: {contract?bidLevel(contract.bid)+6:0}
      </div>
      {/* North: partner's hidden hand, or dummy's cards face-up */}
      <div className="mb-2">
        <p className="text-white/40 text-xs text-center mb-1">
          {dummy===2?"Dummy — North (Partner)":PLAYER_NAMES[2]}
          {dummy===2&&contract?.declarer===0&&" · you play these cards"}
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {dummy===2
            ?dummyHand.map(c=><PlayingCard key={c.id} card={c} size="xs"
                selected={selected?.id===c.id}
                disabled={!dummyLegal.some(l=>l.id===c.id)}
                onClick={()=>tapCard(c,2,dummyLegal)}/>)
            :cardBacks((hands[2]||[]).length,false)}
        </div>
      </div>
      {/* Trick area + side hands */}
      <div className="flex items-center mb-2">
        {sideHand(1)}
        <div className="flex-1 flex flex-col items-center min-h-[100px]">
          <p className="text-white/40 text-xs mb-2">
            {isMyTurn
              ?(currentPlayer===dummy?"🎯 Play from dummy":"🎯 Your turn")
              :PLAYER_NAMES[currentPlayer]+(currentPlayer===dummy?` (played by ${PLAYER_NAMES[controller]})`:"")+"..."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {trick.map(({card,playerId})=>(
              <div key={card.id} className="text-center"><PlayingCard card={card} size="sm"/><div className="text-white/40 text-xs">{PLAYER_NAMES[playerId]}</div></div>
            ))}
          </div>
        </div>
        {sideHand(3)}
      </div>
      {/* My hand */}
      <div className="mt-auto">
        <p className="text-white/40 text-xs text-center mb-1">
          {iAmDummy?"Your Hand (South) — you're dummy, North plays these":"Your Hand (South)"}
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {myHand.map(card=>(
            <PlayingCard key={card.id} card={card} size="sm" selected={selected?.id===card.id}
              disabled={!myLegal.some(c=>c.id===card.id)}
              onClick={()=>tapCard(card,0,myLegal)}/>
          ))}
        </div>
        {selected&&isMyTurn&&<p className="text-center text-white/40 text-xs mt-1">Tap again to play</p>}
      </div>
      <AnimatePresence>
        {phase==="roundEnd"&&(
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" initial={{opacity:0}} animate={{opacity:1}}>
            <div className="card-panel text-center max-w-xs w-full">
              <h2 className="text-xl font-bold text-white mb-2">Round Over</h2>
              <p className="text-white/60 mb-1">{roundMsg||contractStr}</p>
              <div className="text-white/60 mb-4">NS: {scores.ns} | EW: {scores.ew}</div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={()=>navigate("/")}>Home</Button>
                <Button variant="primary" className="flex-1" onClick={()=>startGame(difficulty)}>Next Hand</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
