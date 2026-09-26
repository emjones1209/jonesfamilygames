/**
 * Golf's cards and grids, shared by the single-player game (Golf6Game) and
 * play-together tables (GolfTable).
 */
import { motion } from "framer-motion";
import { PlayingCard } from "../../components/PlayingCard";
import { CARD_BOX } from "../../components/cardSizes";

export function JokerCard({ size="md", faceDown=false, selected=false, onClick, disabled=false }) {
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

/** Any Golf card: a joker, a standard card, or a face-down card. */
export function GolfCard({ card, size="md" }) {
  if (!card.faceUp) return <div className={`${CARD_BOX[size]} bg-blue-900 border border-blue-700 rounded-xl`}/>;
  return card.suit==="joker" ? <JokerCard size={size}/> : <PlayingCard card={card} size={size}/>;
}

/** Your own grid: big cards you can tap. `lit` = { row, col } to outline in gold. */
export function PlayerGrid({grid, onCardClick, interactive, highlight, lit}) {
  if (!grid||!grid[0]) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0,1,2].map(col=>(
        <div key={col} className="flex flex-col gap-2">
          {[0,1].map(row=>{
            const card=grid[row]?.[col];
            if (!card) return <div key={row} className={`${CARD_BOX.md} rounded-2xl bg-white/5`}/>;
            const clickFn=interactive?()=>onCardClick(row,col):undefined;
            const isLit=lit&&lit.row===row&&lit.col===col;
            if (card.suit==="joker") return (
              <div key={row} className={`rounded-xl ${isLit?"ring-4 ring-game-gold":""}`}>
                <JokerCard size="md" faceDown={!card.faceUp}
                  selected={highlight&&card.faceUp}
                  onClick={clickFn} disabled={!interactive} />
              </div>
            );
            return (
              <div key={row} onClick={clickFn} className={`rounded-2xl ${interactive?"cursor-pointer":""} ${isLit?"ring-4 ring-game-gold":""}`}>
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

/** Another player's grid in small cards, laid out like your own (2 rows × 3 columns). */
export function MiniGrid({ grid, size="sm", lit }) {
  return (
    <div className="grid grid-cols-3 gap-1 justify-items-center w-fit mx-auto">
      {[0,1].flatMap(row=>[0,1,2].map(col=>{
        const c=grid?.[row]?.[col];
        const isLit=lit&&lit.row===row&&lit.col===col;
        return <div key={`${row}-${col}`} className={`rounded-xl transition-shadow ${isLit?"ring-4 ring-game-gold":""}`}>{c&&<GolfCard card={c} size={size}/>}</div>;
      }))}
    </div>
  );
}
