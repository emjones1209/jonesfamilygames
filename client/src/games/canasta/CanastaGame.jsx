import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PlayingCard } from '../../components/PlayingCard';
import { CARD_BOX } from '../../components/cardSizes';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { TUTORIALS } from '../../components/tutorials';
import { GameSetup, ResultPanel } from '../cards/GameSetup';
import {
  dealHand, act, scoreHand, gameWinner, sortHand, topOfPile, pileFrozen, teamOf, nextSeat, needed,
  meldedValue, isWild, isBlackThree, isCanasta, isNaturalMeld, WINNING_SCORE,
} from './canastaRules';
import { chooseDraw, choosePlay } from './canastaAI';
import api from '../../utils/api';

const NAMES = ['You', 'Left', 'Partner', 'Right'];
// Your partner always plays at Medium, so the difficulty only changes the opponents
const levelFor = (seat, difficulty) => (seat === 2 ? 'medium' : difficulty);
// Computer turns go slowly enough to read: a pause before drawing, then each meld or discard in turn
const THINK_MS = 1500, STEP_MS = 2200;
const SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const label = c => (c.rank === 'JK' ? 'Joker' : `${c.rank}${SUIT[c.suit]}`);
const cardCount = n => `${n} card${n === 1 ? '' : 's'}`;
const plural = (n, rank) => `${n === 1 ? 'a' : n} ${rank === 'JK' ? 'Joker' : rank}${n === 1 ? '' : 's'}`;

function CanastaCard({ card, size = 'sm', selected, onClick }) {
  if (card.rank === 'JK') {
    return (
      <div onClick={onClick}
        className={`${CARD_BOX[size]} rounded-xl border-2 bg-purple-700 flex flex-col items-center justify-center select-none shrink-0
          ${selected ? 'border-yellow-400 -translate-y-2 shadow-lg shadow-yellow-400/40' : 'border-purple-400'} ${onClick ? 'cursor-pointer' : ''}`}>
        <span className="text-xl md:text-2xl">🃏</span>
        <span className="text-white text-[9px] md:text-[11px] font-bold">JOKER</span>
      </div>
    );
  }
  return <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} onClick={onClick} />;
}

/** One meld: its rank, how many cards (and wild cards), gold when it's a canasta. */
function MeldTile({ meld, onClick, highlight, fresh }) {
  const wild = meld.cards.filter(isWild).length;
  const canasta = isCanasta(meld);
  const natural = canasta && isNaturalMeld(meld);
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`relative w-14 h-[4.5rem] md:w-16 md:h-20 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold
        ${canasta ? (natural ? 'bg-red-50 border-4 border-red-500 text-red-700' : 'bg-gray-100 border-4 border-gray-800 text-gray-900') : 'bg-white border-2 border-gray-300 text-gray-900'}
        ${highlight ? 'ring-4 ring-game-gold' : fresh ? 'ring-4 ring-game-gold scale-110' : ''} transition-transform ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <span className="text-xl md:text-2xl leading-none">{meld.rank}</span>
      <span className="text-xs md:text-sm">×{meld.cards.length}</span>
      {wild > 0 && <span className="text-[9px] md:text-[10px] text-purple-700">{wild} wild</span>}
      {canasta && <span className="absolute -top-2 -right-2 text-[9px] bg-game-gold text-game-bg rounded-full px-1.5">{natural ? 500 : 300}</span>}
    </button>
  );
}

function MeldArea({ title, melds, redThrees, onMeldClick, extra, freshRank }) {
  return (
    <div className="card-panel p-2">
      <div className="flex items-center justify-between text-xs text-white/60 mb-1">
        <span className="font-semibold text-white/80">{title}</span>
        <span>{redThrees > 0 && `Red 3s: ${'🔴'.repeat(redThrees)}`} {extra}</span>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[4.5rem] md:min-h-[5rem] items-center">
        {melds.length === 0 && <span className="text-white/30 text-xs">No melds yet</span>}
        {melds.map(m => <MeldTile key={m.rank} meld={m} onClick={onMeldClick ? () => onMeldClick(m) : undefined} highlight={!!onMeldClick} fresh={m.rank === freshRank} />)}
      </div>
    </div>
  );
}

export default function CanastaGame() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState(null);
  const [scores, setScores] = useState([0, 0]);
  const [dealer, setDealer] = useState(3);
  const [game, setGame] = useState(null);         // hand state (see canastaRules)
  const [selected, setSelected] = useState([]);   // ids of your selected cards
  const [msg, setMsg] = useState({ text: '', error: false });
  const [lastMsg, setLastMsg] = useState('');      // the move before, so a missed one can still be read
  const [fresh, setFresh] = useState(null);        // what the last move changed: { team, rank } or 'pile'
  const [result, setResult] = useState(null);     // scoreHand() once the hand is over
  const [handNo, setHandNo] = useState(0);        // restarts the computer-turn effect each hand
  const latest = useRef(null);
  useEffect(() => { latest.current = game; });

  const startHand = (newDealer, currentScores) => {
    setDealer(newDealer);
    setGame(dealHand({ dealer: newDealer, scores: currentScores }));
    setSelected([]); setResult(null); setHandNo(n => n + 1);
    setMsg({ text: '', error: false }); setLastMsg(''); setFresh(null);
  };
  const startGame = diff => { setDifficulty(diff); setScores([0, 0]); startHand(3, [0, 0]); };

  /** Apply an action; report a problem instead of throwing. */
  const apply = (action, describe) => {
    try {
      const next = act(latest.current, action);
      latest.current = next;
      setGame(next);
      const text = describe ? describe(next) : '';
      if (text) {
        setMsg(m => { if (m.text && !m.error) setLastMsg(m.text); return { text, error: false }; });
      }
      if (next.phase === 'over') finishHand(next);
      return next;
    } catch (e) {
      setMsg({ text: e.message, error: true });
      return null;
    }
  };

  const finishHand = s => {
    const res = scoreHand(s);
    const newScores = [scores[0] + res[0].total, scores[1] + res[1].total];
    setScores(newScores);
    setResult({ res, outBy: s.outBy, newScores });
    if (gameWinner(newScores) != null) {
      api.post('/scores', { game: 'canasta', score: Math.max(0, newScores[0]), difficulty }).catch(() => {});
    }
  };

  // ── Computer turns, one visible step at a time ──────────────────────────
  // Runs once per computer turn (keyed on the turn, not the phase, so its own
  // steps don't cancel the rest of the turn)
  const turn = game?.turn;
  useEffect(() => {
    const g = latest.current;
    if (!g || g.phase !== 'draw' || turn === 0) return;
    const seat = turn, level = levelFor(seat, difficulty), name = NAMES[seat];
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    later(() => {
      const before = latest.current;
      const draw = chooseDraw(before, level);
      const pileSize = before.discard.length;
      const pileTop = topOfPile(before);
      const redsBefore = before.redThrees[teamOf(seat)].length;
      const s = apply(draw, next => {
        if (next.phase === 'over') return 'The stock has run out — the hand is over.';
        const reds = next.redThrees[teamOf(seat)].length - redsBefore;
        const redNote = reds ? ` (and a red 3 — +100)` : '';
        return draw.type === 'takePile' ? `${name} takes the pile (${cardCount(pileSize)}) with the ${pileTop.rank}s!` : `${name} draws a card${redNote}.`;
      });
      setFresh(draw.type === 'takePile' ? { team: teamOf(seat), rank: pileTop.rank } : null);
      if (!s || s.phase === 'over') return;
      const steps = choosePlay(s, level);
      steps.forEach((step, i) => later(() => {
        const cur = latest.current;
        apply(step, next => {
          if (next.phase === 'over') return `${name} goes out!`;
          if (step.type === 'discard') { setFresh('pile'); return `${name} discards the ${label(cur.hands[seat].find(c => c.id === step.id))}.`; }
          if (step.type === 'meld') {
            const cards = step.ids.map(id => cur.hands[seat].find(c => c.id === id));
            const rank = cards.find(c => !isWild(c))?.rank ?? step.rank;
            const had = cur.melds[teamOf(seat)].some(m => m.rank === rank);
            setFresh({ team: teamOf(seat), rank });
            return had ? `${name} adds ${cards.length} to the ${rank}s.` : `${name} melds ${plural(cards.length, rank)}.`;
          }
          return '';
        });
      }, STEP_MS * (i + 1)));
    }, THINK_MS);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, handNo]);

  // ── Your moves ───────────────────────────────────────────────────────────
  const yourTurn = game?.turn === 0 && game.phase !== 'over';
  useEffect(() => { if (yourTurn && game.phase === 'play') setFresh(null); }, [yourTurn, game?.phase]);
  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  const drawCard = () => {
    if (!yourTurn || game.phase !== 'draw') return;
    const reds = game.redThrees[0].length;
    apply({ type: 'draw' }, next => (next.redThrees[0].length > reds ? 'You drew a red 3 (+100) and another card.' : ''));
  };
  const takePile = () => {
    if (!yourTurn || game.phase !== 'draw') return;
    const n = game.discard.length;
    if (apply({ type: 'takePile', ids: selected }, () => `You take the pile (${cardCount(n)})!`)) setSelected([]);
  };
  const meld = rank => {
    if (!yourTurn || game.phase !== 'play') return;
    if (apply({ type: 'meld', ids: selected, rank }, next => (next.phase === 'over' ? 'You go out!' : ''))) setSelected([]);
  };
  const discard = () => {
    if (!yourTurn || game.phase !== 'play') return;
    if (selected.length !== 1) { setMsg({ text: 'Select one card to discard.', error: true }); return; }
    if (apply({ type: 'discard', id: selected[0] }, next => (next.phase === 'over' ? 'You go out!' : ''))) setSelected([]);
  };
  const undo = () => { apply({ type: 'undo' }, () => 'Melds taken back.'); setSelected([]); };

  // ── Screens ──────────────────────────────────────────────────────────────
  if (!difficulty) {
    return (
      <GameSetup emoji="♣️" title="Canasta" subtitle="Meld sets, build canastas and go out first!"
        note={`You and Partner vs Left and Right · first team to ${WINNING_SCORE}`}
        bgClass="from-game-bg to-emerald-900" tutorial={TUTORIALS.canasta} onStart={startGame} />
    );
  }
  if (!game) return null;

  const top = topOfPile(game);
  const frozen = pileFrozen(game);
  const hand = sortHand(game.hands[0]);
  const ourNeed = game.initialDone[0] ? null : needed(game, 0);
  const hint = !yourTurn ? `${NAMES[game.turn]} is playing…`
    : game.phase === 'draw'
      ? 'Tap the stock to draw — or select cards that match the top of the pile, then tap the pile to take it.'
      : 'Select cards and tap Meld (or tap one of your melds to add to it). Finish by discarding one card.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-emerald-900 p-3 flex flex-col gap-2 select-none">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="canasta" title="Canasta" />
        </div>
        <div className="text-white/80 text-sm font-semibold">Canasta · {difficulty}</div>
        <div className="text-right text-xs">
          <div className="text-white/90 font-semibold">Us {scores[0]} · Them {scores[1]}</div>
          <div className="text-white/50">{ourNeed ? `Your first meld needs ${ourNeed}` : 'Your team has melded'}</div>
        </div>
      </header>

      {/* Other players */}
      <div className="flex justify-center gap-2 text-xs">
        {[1, 2, 3].map(seat => (
          <div key={seat} className={`px-3 py-1 rounded-full ${game.turn === seat ? 'bg-game-gold text-game-bg font-bold' : 'bg-white/10 text-white/70'}`}>
            {NAMES[seat]} · {game.hands[seat].length} cards
          </div>
        ))}
      </div>

      <MeldArea title="Their melds" melds={game.melds[1]} redThrees={game.redThrees[1].length}
        freshRank={fresh?.team === 1 ? fresh.rank : null} />

      {/* Stock and discard pile */}
      <div className="flex justify-center items-end gap-6">
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">Stock ({game.stock.length})</p>
          <div onClick={drawCard} className={yourTurn && game.phase === 'draw' ? 'cursor-pointer' : ''}>
            <PlayingCard card={{ id: 'stock', faceUp: false }} faceDown size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white/40 text-xs mb-1">
            Pile ({game.discard.length}){frozen && <span className="text-sky-300"> · ❄ frozen</span>}
            {top && isBlackThree(top) && <span className="text-amber-300"> · blocked</span>}
          </p>
          <div onClick={takePile} className={`rounded-xl ${fresh === 'pile' ? 'ring-4 ring-game-gold' : frozen ? 'ring-2 ring-sky-300' : ''} ${yourTurn && game.phase === 'draw' ? 'cursor-pointer' : ''}`}>
            {top ? <CanastaCard card={top} /> : <div className={`${CARD_BOX.sm} rounded-xl border-2 border-dashed border-white/20`} />}
          </div>
        </div>
      </div>

      <MeldArea title="Our melds" melds={game.melds[0]} redThrees={game.redThrees[0].length}
        freshRank={fresh?.team === 0 ? fresh.rank : null}
        extra={!game.initialDone[0] && game.melds[0].length ? `(${meldedValue(game, 0)} of ${ourNeed})` : ''}
        onMeldClick={yourTurn && game.phase === 'play' && selected.length ? m => meld(m.rank) : undefined} />

      {/* The latest move, with the one before it underneath (fixed height, so nothing jumps) */}
      <div className="text-center min-h-[2.5rem]">
        <p className={`text-sm md:text-base font-semibold ${msg.error ? 'text-red-300' : 'text-amber-300'}`}>{msg.text}</p>
        <p className="text-xs md:text-sm text-white/40">{lastMsg}</p>
      </div>

      {/* Your hand: tap cards to select several */}
      <div className="flex flex-wrap justify-center gap-y-3 pt-2 pl-6 md:pl-8">
        {hand.map(c => (
          <div key={c.id} className="-ml-6 md:-ml-8">
            <CanastaCard card={c} selected={selected.includes(c.id)} onClick={yourTurn ? () => toggle(c.id) : undefined} />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
        {game.phase === 'draw' ? (
          <>
            <Button variant="primary" disabled={!yourTurn} onClick={drawCard}>Draw</Button>
            <Button variant="secondary" disabled={!yourTurn || !top} onClick={takePile}>Take pile</Button>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!yourTurn || !selected.length} onClick={() => meld()}>Meld</Button>
            <Button variant="gold" disabled={!yourTurn || selected.length !== 1} onClick={discard}>Discard</Button>
            <Button variant="ghost" disabled={!yourTurn} onClick={undo}>Undo</Button>
          </>
        )}
      </div>
      <p className="text-center text-white/50 text-xs">{hint}</p>

      {result && (
        <ResultPanel>
          {gameWinner(result.newScores) != null ? (
            <>
              <div className="text-5xl mb-2">{gameWinner(result.newScores) === 0 ? '🏆' : '😞'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{gameWinner(result.newScores) === 0 ? 'Your team wins!' : 'They win!'}</h2>
            </>
          ) : (
            <h2 className="text-xl font-bold text-white mb-2">
              {result.outBy == null ? 'The stock ran out' : `${NAMES[result.outBy]} went out`}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Us</th><th>Them</th></tr></thead>
            <tbody>
              {[
                ['Canastas', r => r.natural * 500 + r.mixed * 300],
                ['Red 3s', r => r.redThrees],
                ['Going out', r => r.goingOut],
                ['Cards melded', r => r.cards],
                ['Cards in hand', r => -r.inHand],
              ].map(([name, f]) => (
                <tr key={name}><td className="text-left">{name}</td><td>{f(result.res[0])}</td><td>{f(result.res[1])}</td></tr>
              ))}
              <tr className="font-semibold border-t border-white/10"><td className="text-left">This hand</td><td>{result.res[0].total}</td><td>{result.res[1].total}</td></tr>
              <tr className="font-bold text-game-gold"><td className="text-left">Total</td><td>{result.newScores[0]}</td><td>{result.newScores[1]}</td></tr>
            </tbody>
          </table>
          {gameWinner(result.newScores) == null ? (
            <Button variant="gold" className="w-full" onClick={() => startHand(nextSeat(dealer), result.newScores)}>Next Hand</Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>Home</Button>
              <Button variant="gold" className="flex-1" onClick={() => startGame(difficulty)}>Play Again</Button>
            </div>
          )}
        </ResultPanel>
      )}
    </div>
  );
}
