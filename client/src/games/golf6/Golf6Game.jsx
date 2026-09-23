import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { buildDeck, shuffle } from "../../utils/cardEngine";
import { PlayingCard } from "../../components/PlayingCard";
import { CARD_BOX } from "../../components/cardSizes";
import { Button } from "../../components/Button";
import { TutorialModal } from "../../components/TutorialModal";
import { TUTORIALS } from "../../components/tutorials";
import api from "../../utils/api";

const PLAYER_NAMES = ["You","CPU 1","CPU 2","CPU 3"];
// Pacing of a computer turn (ms): pause before drawing, time showing the drawn
// card, and time showing where it went before the next player's turn
const AI_THINK_MS = 700, AI_SHOW_MS = 1300, AI_AFTER_MS = 1000;
const SUIT_SYMBOL = { spades:"♠", hearts:"♥", diamonds:"♦", clubs:"♣" };
const cardLabel = c => (c.suit==="joker" ? "Joker" : `${c.rank}${SUIT_SYMBOL[c.suit]}`);

function cardValue(card) {
  if (!card) return 0;
  if (card.suit==="joker") return -4;
  if (card.rank==="2") return -2;
  if (card.rank==="K") return 0;
  if (card.rank==="A") return 1;
  if (card.rank==="J") return 11;
  if (card.rank==="Q") return 12;
  return parseInt(card.rank,10)||10;
}

function buildGolfDeck() {
  const base = buildDeck();
  base.push({ suit:"joker", rank:"Jo", id:"joker-1", faceUp:false });
  base.push({ suit:"joker", rank:"Jo", id:"joker-2", faceUp:false });
  return shuffle(base);
}

function JokerCard({ size="md", faceDown=false, selected=false, onClick, disabled=false }) {
  const sz = CARD_BOX[size];
  if (faceDown) return (
    <div className={`${sz} bg-blue-900 border-2 border-blue-700 rounded-xl flex items-center justify-center ${disabled?"opacity-50":""} ${onClick?"cursor-pointer":""}`}
      onClick={disabled?undefined:onClick}>
      <span className="text-blue-400">&#x1F0A0;</span>
    </div>
  );
  return (
    <motion.div className={`${sz} bg-purple-700 border-2 rounded-xl flex flex-col items-center justify-center ${selected?"border-yellow-400 -translate-y-1":"border-purple-400"} ${onClick&&!disabled?"cursor-pointer":"cursor-default"} ${disabled?"opacity-50":""}`}
      whileTap={onClick&&!disabled?{scale:0.95}:{}} onClick={disabled?undefined:onClick}>
      <span className="text-xl">&#x1F0CF;</span>
      <span className="text-white text-xs font-bold">-4</span>
    </motion.div>
  );
}

function gridScore(grid) {
  if (!grid) return 0;
  let total=0;
  for (let col=0;col<3;col++) {
    const top=grid[0][col], bot=grid[1][col];
    if (top && bot && top.faceUp && bot.faceUp && top.rank===bot.rank) continue;
    if (top && top.faceUp) total+=cardValue(top);
    if (bot && bot.faceUp) total+=cardValue(bot);
  }
  return total;
}

function allFaceUp(grid) {
  return grid && grid.every(row=>row.every(c=>c && c.faceUp));
}

function dealGame(numPlayers) {
  const deck=buildGolfDeck(); // 54 cards: 52 standard + 2 jokers
  const grids=[];
  let idx=0;
  for (let p=0;p<numPlayers;p++) {
    grids.push([
      [0,1,2].map(()=>({...deck[idx++],faceUp:false})),
      [0,1,2].map(()=>({...deck[idx++],faceUp:false}))
    ]);
  }
  const stockArr=deck.slice(idx).map(c=>({...c,faceUp:false}));
  const discardArr=[{...stockArr.shift(),faceUp:true}];
  return {grids, stock:stockArr, discard:discardArr};
}

/** If the stock is empty, shuffle the discard pile (keeping its top card) back into it. */
function refillStock(stock, discard) {
  if (stock.length || discard.length < 2) return { stock, discard };
  return { stock: shuffle(discard.slice(1)).map(c=>({...c,faceUp:false})), discard: [discard[0]] };
}

function PlayerGrid({grid, onCardClick, interactive, highlight}) {
  if (!grid||!grid[0]) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0,1,2].map(col=>(
        <div key={col} className="flex flex-col gap-2">
          {[0,1].map(row=>{
            const card=grid[row]?.[col];
            if (!card) return <div key={row} className={`${CARD_BOX.md} rounded-2xl bg-white/5`}/>;
            const clickFn=interactive?()=>onCardClick(row,col):undefined;
            if (card.suit==="joker") return (
              <JokerCard key={row} size="md" faceDown={!card.faceUp}
                selected={highlight&&card.faceUp}
                onClick={clickFn} disabled={!interactive} />
            );
            return (
              <div key={row} onClick={clickFn} className={interactive?"cursor-pointer":""}>
                <PlayingCard card={card} size="md" faceDown={!card.faceUp}
                  className={highlight&&card.faceUp?"ring-2 ring-yellow-400 rounded-2xl":""}/>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Golf6Game() {
  const navigate=useNavigate();
  const [difficulty,setDifficulty]=useState(null);
  const [numPlayers,setNumPlayers]=useState(4);
  const [grids,setGrids]=useState([]);
  const [stock,setStock]=useState([]);
  const [discard,setDiscard]=useState([]);
  const [phase,setPhase]=useState("setup");
  const [currentPlayer,setCurrentPlayer]=useState(0);
  const [drawn,setDrawn]=useState(null);
  const [peeksLeft,setPeeksLeft]=useState(2);
  const [finalRound,setFinalRound]=useState(false);
  const [finalTurnsLeft,setFinalTurnsLeft]=useState(0);
  const [winner,setWinner]=useState(null);
  const [totalScores,setTotalScores]=useState([0,0,0,0]);
  const [msg,setMsg]=useState("");
  const [aiMove,setAiMove]=useState(null);   // { pi, card } while a computer shows what it drew
  const [flash,setFlash]=useState(null);     // { pi, row, col } spot a computer just changed
  const [showTutorial,setShowTutorial]=useState(false);
  const numPlayersRef = useRef(numPlayers);

  const startGame=(diff,np=numPlayers)=>{
    numPlayersRef.current = np;
    setDifficulty(diff); setNumPlayers(np);
    const {grids:g,stock:s,discard:d}=dealGame(np);
    setGrids(g); setStock(s); setDiscard(d);
    setTotalScores(Array(np).fill(0));
    setCurrentPlayer(0); setDrawn(null); setPeeksLeft(2);
    setFinalRound(false); setFinalTurnsLeft(0); setWinner(null);
    setAiMove(null); setFlash(null);
    setMsg("Peek at 2 of your face-down cards to start!"); setPhase("peek");
  };

  const handlePeek=(row,col)=>{
    if (phase!=="peek"||peeksLeft<=0||grids[0][row][col].faceUp) return;
    const ng=grids.map((g,pi)=>pi!==0?g:g.map((r,ri)=>r.map((c,ci)=>ri===row&&ci===col?{...c,faceUp:true}:c)));
    setGrids(ng);
    const left=peeksLeft-1;
    setPeeksLeft(left);
    if (left===0) {
      const g2=ng.map((grid,pi)=>{
        if (pi===0) return grid;
        const picks=shuffle([[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]]).slice(0,2);
        return grid.map((r,ri)=>r.map((c,ci)=>picks.some(([pr,pc])=>pr===ri&&pc===ci)?{...c,faceUp:true}:c));
      });
      setGrids(g2); setMsg(""); setPhase("playing");
    }
  };

  const endGame=useCallback((g,ts)=>{
    const finalG=g.map(grid=>grid.map(row=>row.map(c=>({...c,faceUp:true}))));
    const rs=finalG.map(grid=>gridScore(grid));
    const nt=ts.map((s,i)=>s+rs[i]);
    setGrids(finalG); setTotalScores(nt);
    const minS=Math.min(...nt);
    setWinner(nt[0]===minS?0:nt.findIndex(s=>s===minS));
    setPhase("gameOver");
    api.post("/scores",{game:"golf6",score:-nt[0],difficulty}).catch(()=>{});   // negated: low golf scores rank high
  },[difficulty]);

  const checkAndAdvance=useCallback((ng,pi)=>{
    const np = numPlayersRef.current;
    let fr=finalRound, ftl=finalTurnsLeft;
    const next=(pi+1)%np;
    if (!fr&&allFaceUp(ng[pi])) {
      // Everyone else gets one more turn; the finishing turn itself doesn't count
      ftl=np-1;
      setFinalRound(true); setFinalTurnsLeft(ftl);
      setMsg(`${PLAYER_NAMES[pi]} finished! ${ftl} more turn${ftl!==1?"s":""}.`);
      setCurrentPlayer(next);
      return;
    }
    if (fr) {
      const left=ftl-1;
      if (left<=0) { endGame(ng,totalScores); return; }
      setFinalTurnsLeft(left);
    }
    setCurrentPlayer(next);
  },[finalRound,finalTurnsLeft,totalScores,endGame]);

  const drawFromStock=()=>{
    if (phase!=="playing"||currentPlayer!==0||drawn) return;
    const {stock:s,discard:d}=refillStock(stock,discard);
    if (!s.length) return;
    setDrawn({...s[0],faceUp:true}); setStock(s.slice(1)); setDiscard(d);
  };

  const takeDiscard=()=>{
    if (phase!=="playing"||currentPlayer!==0||drawn||!discard.length) return;
    setDrawn({...discard[0],faceUp:true}); setDiscard(d=>d.slice(1));
  };

  const discardDrawn=()=>{
    if (!drawn||currentPlayer!==0) return;
    setDiscard(d=>[drawn,...d]); setDrawn(null);
    checkAndAdvance(grids,0);
  };

  const swapWithGrid=(row,col)=>{
    if (!drawn||currentPlayer!==0) return;
    const old=grids[0][row][col];
    const ng=grids.map((g,pi)=>pi!==0?g:g.map((r,ri)=>r.map((c,ci)=>ri===row&&ci===col?{...drawn,faceUp:true}:c)));
    setDiscard(d=>[{...old,faceUp:true},...d]); setDrawn(null); setGrids(ng);
    checkAndAdvance(ng,0);
  };

  const flipCard=(row,col)=>{
    if (drawn||currentPlayer!==0||grids[0][row][col].faceUp) return;
    const ng=grids.map((g,pi)=>pi!==0?g:g.map((r,ri)=>r.map((c,ci)=>ri===row&&ci===col?{...c,faceUp:true}:c)));
    setGrids(ng); checkAndAdvance(ng,0);
  };

  // Latest state for the computer's turn, which runs over several timed steps
  const latest = useRef({});
  useEffect(()=>{ latest.current = { grids, stock, discard, difficulty, checkAndAdvance }; });

  // Computer turns play out slowly enough to follow: think, show the card it
  // drew (and where from), place or discard it with the spot highlighted, then pass.
  useEffect(()=>{
    const aiPlayers = Array.from({length:numPlayersRef.current-1},(_,i)=>i+1);
    if (phase!=="playing"||!aiPlayers.includes(currentPlayer)) return;
    const pi=currentPlayer, name=PLAYER_NAMES[pi];
    const timers=[];
    const later=(fn,ms)=>timers.push(setTimeout(fn,ms));

    later(()=>{
      const { grids, stock, discard, difficulty } = latest.current;
      const ng=grids.map(g=>g.map(r=>[...r]));
      const refilled=refillStock(stock,discard);
      const nd=[...refilled.discard]; const ns=[...refilled.stock];
      const topD=nd[0];
      let drawnCard;
      const useD=topD&&(difficulty==="easy"?Math.random()<0.4:ng[pi].flat().filter(c=>c.faceUp).some(c=>cardValue(c)-cardValue(topD)>2));
      const fromDiscard=useD||!ns.length;
      if (fromDiscard) { drawnCard=nd.shift(); } else { drawnCard={...ns.shift(),faceUp:true}; }
      let bestRow=-1,bestCol=-1,bestGain=difficulty==="easy"?3:1;
      const dv=cardValue(drawnCard);
      for (let row=0;row<2;row++) for (let col=0;col<3;col++) {
        const cell=ng[pi][row][col];
        if (!cell.faceUp) { if (dv<=-2&&bestGain>0) { bestGain=0;bestRow=row;bestCol=col; } }
        else { const gain=cardValue(cell)-dv; if (gain>bestGain) { bestGain=gain;bestRow=row;bestCol=col; } }
      }
      // No good swap: place a low card over a face-down one so the AI makes progress
      // towards finishing (otherwise it can keep drawing forever)
      if (bestRow<0&&dv<=(difficulty==="easy"?6:4)) {
        const hidden=[];
        for (let row=0;row<2;row++) for (let col=0;col<3;col++) if (!ng[pi][row][col].faceUp) hidden.push([row,col]);
        if (hidden.length) [bestRow,bestCol]=hidden[Math.floor(Math.random()*hidden.length)];
      }
      // A card taken from the discard pile is always kept (throwing it straight
      // back looks silly): replace the worst higher face-up card, else a face-down one
      if (bestRow<0&&fromDiscard) {
        let worst=null;
        for (let row=0;row<2;row++) for (let col=0;col<3;col++) {
          const cell=ng[pi][row][col];
          if (cell.faceUp&&cardValue(cell)>dv&&(!worst||cardValue(cell)>worst.v)) worst={row,col,v:cardValue(cell)};
        }
        const hidden=[];
        for (let row=0;row<2;row++) for (let col=0;col<3;col++) if (!ng[pi][row][col].faceUp) hidden.push([row,col]);
        if (worst) [bestRow,bestCol]=[worst.row,worst.col];
        else if (hidden.length) [bestRow,bestCol]=hidden[Math.floor(Math.random()*hidden.length)];
      }
      let finalDiscard, placedMsg;
      if (bestRow>=0) {
        const old=ng[pi][bestRow][bestCol];
        ng[pi][bestRow][bestCol]={...drawnCard,faceUp:true};
        finalDiscard={...old,faceUp:true};
        placedMsg=old.faceUp?`${name} swaps it for their ${cardLabel(old)}`:`${name} swaps it for a face-down card (a ${cardLabel(old)})`;
      } else {
        finalDiscard=drawnCard;
        placedMsg=`${name} discards it`;
      }

      // Step 1: show the drawn card
      setStock(ns); setDiscard(nd);
      setAiMove({ pi, card: drawnCard });
      setMsg(fromDiscard?`${name} takes the ${cardLabel(drawnCard)} from the discard pile…`:`${name} draws the ${cardLabel(drawnCard)} from the deck…`);

      // Step 2: place it (or discard it), highlighting the spot
      later(()=>{
        setAiMove(null);
        setGrids(ng); setDiscard([finalDiscard,...nd]);
        setFlash(bestRow>=0?{ pi, row:bestRow, col:bestCol }:null);
        setMsg(placedMsg);
        // Step 3: pass to the next player
        later(()=>{ setFlash(null); latest.current.checkAndAdvance(ng,pi); }, AI_AFTER_MS);
      }, AI_SHOW_MS);
    }, AI_THINK_MS);

    return ()=>timers.forEach(clearTimeout);
  },[currentPlayer,phase]);

  if (phase==="setup") return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-lime-900 p-5 flex flex-col">
      <button onClick={()=>navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white mb-6">
        <ArrowLeft size={18}/> Back
      </button>
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-3">&#9971;</div>
        <h1 className="game-title text-3xl mb-2">6-Card Golf</h1>
        <p className="text-white/50 mb-1 text-center">Lowest score wins! Same-column pairs cancel to 0.</p>
        <p className="text-white/30 text-xs mb-5 text-center">Joker=-4, 2=-2, K=0, A=1, J=11, Q=12</p>
        <div className="w-full mb-5">
          <p className="text-white/60 text-sm text-center mb-2">Number of players (total):</p>
          <div className="flex gap-3 justify-center">
            {[2,3,4].map(n=>(
              <button key={n} onClick={()=>setNumPlayers(n)}
                className={`w-14 h-14 rounded-2xl font-bold text-xl border-2 transition-all ${numPlayers===n?"border-game-gold bg-white/20 text-white":"border-white/20 bg-white/5 text-white/60"}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-white/30 text-xs text-center mt-1">{numPlayers-1} AI opponent{numPlayers>2?"s":""}</p>
        </div>
        <div className="w-full space-y-3">
          {[["easy","😊 Easy"],["medium","🤔 Medium"],["hard","🔥 Hard"]].map(([d,l])=>(
            <Button key={d} variant="primary" className="w-full text-lg" onClick={()=>startGame(d,numPlayers)}>{l}</Button>
          ))}
        </div>
        <button onClick={()=>setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mt-4 min-h-[44px]">
          <HelpCircle size={16}/> How to play
        </button>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={()=>setShowTutorial(false)} title="6-Card Golf" slides={TUTORIALS.golf6}/>
    </div>
  );

  if (phase==="gameOver") return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-lime-900 p-5 flex flex-col items-center justify-center">
      <motion.div className="card-panel text-center max-w-sm w-full" initial={{scale:0.8}} animate={{scale:1}}>
        <div className="text-5xl mb-3">{winner===0?"🏆":"⛳"}</div>
        <h2 className="text-2xl font-bold text-game-gold mb-4">{winner===0?"You Win!":PLAYER_NAMES[winner]+" Wins!"}</h2>
        <div className="space-y-1 mb-6">
          {PLAYER_NAMES.slice(0,numPlayers).map((p,i)=>(
            <div key={i} className="flex justify-between text-white/80 text-sm">
              <span>{p}</span>
              <span className={i===winner?"text-game-gold font-bold":""}>{totalScores[i]} pts</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={()=>navigate("/")}>Home</Button>
          <Button variant="primary" className="flex-1" onClick={()=>startGame(difficulty,numPlayers)}>Again</Button>
        </div>
      </motion.div>
    </div>
  );

  if (phase==="peek") return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-lime-900 p-5 flex flex-col items-center justify-center">
      <div className="text-center mb-6">
        <p className="text-white font-semibold text-lg">Peek at {peeksLeft} card{peeksLeft!==1?"s":""}</p>
        <p className="text-white/40 text-xs mt-1">Tap face-down cards to peek</p>
      </div>
      <PlayerGrid grid={grids[0]} onCardClick={handlePeek} interactive/>
    </div>
  );

  const myScore=grids[0]?gridScore(grids[0]):0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-lime-900 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>navigate("/")} className="text-white/40 p-1"><ArrowLeft size={18}/></button>
        <div className="text-white/60 text-xs">{difficulty} {finalRound?"- Final Round!":""}</div>
        <div className="text-game-gold font-bold text-sm">You: {myScore}</div>
      </div>
      {/* Always present (fixed height) so the board doesn't move when it changes */}
      <p className="text-center text-amber-400 text-sm mb-2 min-h-[1.25rem]">{msg}</p>
      <div className="flex justify-center gap-2 mb-3">
        {Array.from({length:numPlayers-1},(_,i)=>i+1).map(pi=>(
          <div key={pi} className={`card-panel p-2 text-center flex-1 max-w-[14rem] transition-shadow ${currentPlayer===pi?"ring-2 ring-game-gold":""}`}>
            <div className={`text-xs mb-1 ${currentPlayer===pi?"text-game-gold font-bold":"text-white/50"}`}>{PLAYER_NAMES[pi]}</div>
            {/* 2 rows × 3 columns, laid out like your own grid */}
            <div className="grid grid-cols-3 gap-1 justify-items-center w-fit mx-auto">
              {[0,1].flatMap(row=>[0,1,2].map(col=>{
                const c=grids[pi]?.[row]?.[col];
                const lit=flash&&flash.pi===pi&&flash.row===row&&flash.col===col;
                const face=!c?null:!c.faceUp
                  ?<div className={`${CARD_BOX.xs} bg-blue-900 border border-blue-700 rounded-lg`}/>
                  :c.suit==="joker"?<JokerCard size="xs"/>:<PlayingCard card={c} size="xs"/>;
                return <div key={`${row}-${col}`} className={`rounded-lg transition-shadow ${lit?"ring-4 ring-game-gold":""}`}>{face}</div>;
              }))}
            </div>
            <div className="text-white/40 text-xs mt-1">{grids[pi]?gridScore(grids[pi]):"?"}</div>
          </div>
        ))}
      </div>
      {/* Piles above your grid; side by side on a wide landscape screen (e.g. an
          iPad held sideways) so the bigger cards still fit without scrolling */}
      <div className="flex flex-col items-center lg:landscape:flex-row lg:landscape:justify-center lg:landscape:gap-12">
      <div className="flex justify-center gap-4 mb-3">
        <div className="text-center w-24 flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">Stock ({stock.length})</p>
          {stock.length>0
            ?<div onClick={drawFromStock} className={currentPlayer===0&&!drawn?"cursor-pointer":""}>
              <PlayingCard card={{...stock[0],faceUp:false}} faceDown size="md"/>
             </div>
            :discard.length>1
              ?<div onClick={drawFromStock}
                  className={`${CARD_BOX.md} border-2 border-dashed border-white/40 rounded-2xl flex items-center justify-center text-white/60 text-[10px] text-center leading-tight ${currentPlayer===0&&!drawn?"cursor-pointer":""}`}>
                  Tap to<br/>reshuffle
                </div>
              :<div className={`${CARD_BOX.md} border-2 border-dashed border-white/20 rounded-2xl`}/>}
        </div>
        <div className="text-center w-24 flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">Discard</p>
          {discard.length>0
            ?<div onClick={takeDiscard} className={currentPlayer===0&&!drawn?"cursor-pointer":""}>
              {discard[0].suit==="joker"
                ? <JokerCard size="md" onClick={currentPlayer===0&&!drawn?takeDiscard:undefined}/>
                : <PlayingCard card={discard[0]} size="md"/>}
             </div>
            :<div className={`${CARD_BOX.md} border-2 border-dashed border-white/20 rounded-2xl`}/>}
        </div>
        {/* The drawn card's slot is always there, so drawing doesn't shift the board */}
        <div className="text-center w-24 flex flex-col items-center">
          <p className={`text-xs mb-1 ${aiMove?"text-game-gold":"text-white/40"}`}>
            {aiMove?`${PLAYER_NAMES[aiMove.pi]}'s card`:"In hand"}
          </p>
          {(()=>{
            const held=aiMove?.card||drawn;
            if (!held) return <div className={`${CARD_BOX.md} border-2 border-dashed border-white/15 rounded-2xl`}/>;
            return held.suit==="joker"?<JokerCard size="md"/>:<PlayingCard card={held} size="md"/>;
          })()}
          <button onClick={discardDrawn}
            className={`text-white/60 hover:text-white text-xs mt-1 px-2 py-1 rounded-lg bg-white/10 ${drawn?"":"invisible"}`}>
            Discard it
          </button>
        </div>
      </div>
      <div className="flex justify-center">
        <div>
          <p className="text-white/40 text-xs text-center mb-1">
            Your Grid{currentPlayer===0?" - Your turn":""}
          </p>
          <PlayerGrid
            grid={grids[0]}
            onCardClick={drawn?(row,col)=>swapWithGrid(row,col):flipCard}
            interactive={currentPlayer===0}
            highlight={!!drawn}
          />
        </div>
      </div>
      </div>
      <p className="text-center text-white/40 text-xs mt-2 min-h-[1rem]">
        {currentPlayer===0&&phase==="playing"&&(drawn?"Tap a card in your grid to swap, or discard it":"Draw a card, or tap a face-down card to flip it")}
      </p>
    </div>
  );
}