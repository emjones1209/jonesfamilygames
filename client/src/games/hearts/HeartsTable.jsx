/**
 * HeartsTable — the Hearts screen, drawn from a game view (see heartsEngine.js)
 * in which the player looking at it is seat 0. Used by the single-player game
 * and by play-together tables alike: moves go out through `onAction`.
 */
import { useState, useMemo } from 'react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { sortHand } from '../cards/tricks';
import { CardTable, Wide } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { legalFor, pointsTaken } from './heartsEngine';

const BG = 'from-game-bg to-red-950';
const TO = { left: 1, across: 2, right: 3 };
const listNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

function CardFace({ card, size, selected, disabled, onClick, highlight }) {
  return (
    <div className={highlight ? 'rounded-xl ring-2 ring-sky-400' : ''}>
      <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} disabled={disabled} onClick={onClick} />
    </div>
  );
}

function ScoreRows({ view, names }) {
  const last = view.lastHand;
  return (
    <div className="space-y-1 mb-4">
      {names.map((name, i) => (
        <div key={i} className={`flex justify-between text-sm ${i === 0 ? 'text-game-gold font-semibold' : 'text-white/80'}`}>
          <span className="truncate">{name}</span>
          <span>
            {last && <span className="text-white/40 mr-2">+{last.points[i]}</span>}
            {view.totals[i]} pts
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function HeartsTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [passSel, setPassSel] = useState([]);
  const myHand = useMemo(() => sortHand(view.table?.hands[0] ?? view.hands[0]), [view]);
  const passTo = names[TO[view.direction]];

  if (view.phase === 'passing') {
    const chosen = view.passes[0] != null;
    const waiting = [1, 2, 3].filter(seat => view.passes[seat] == null).map(seat => names[seat]);
    const toggle = card => setPassSel(sel =>
      sel.includes(card.id) ? sel.filter(id => id !== card.id) : sel.length < 3 ? [...sel, card.id] : sel);
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 short:p-2 flex flex-col items-center justify-center gap-4 short:gap-1.5`}>
        <div className="self-stretch flex items-center justify-between">
          <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
          <RulesButton game="hearts" title="Hearts" />
        </div>
        <h2 className="text-2xl short:text-lg font-bold text-white text-center">Pass 3 cards to {passTo} ({view.direction})</h2>
        {chosen ? (
          <p className="text-white/60 animate-pulse">Waiting for {listNames(waiting)} to choose…</p>
        ) : (
          <p className="text-white/50 text-sm text-center max-w-xs">
            Tip: pass high hearts, and the Queen of Spades if you don't have many low spades to protect it.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(card => (
            <CardFace key={card.id} card={card} size="sm"
              selected={(chosen ? view.passes[0] : passSel).includes(card.id)}
              onClick={chosen ? undefined : () => toggle(card)} />
          ))}
        </div>
        {!chosen && (
          <Button variant="primary" disabled={passSel.length !== 3}
            onClick={() => { onAction({ type: 'pass', seat: 0, ids: passSel }); setPassSel([]); }}>
            Pass {passSel.length}/3 to {passTo}
          </Button>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  const table = view.table;
  const taken = pointsTaken(view);
  let message = error || '';
  if (!message && table.status === 'collecting') message = `${names[table.winner]} ${table.winner === 0 ? 'take' : 'takes'} the trick`;
  else if (!message && table.trickNumber === 0 && table.trick.length === 0) message = `${names[table.turn]} ${table.turn === 0 ? 'lead' : 'leads'} the 2♣`;
  else if (!message && view.received[0].length && table.trickNumber === 0) message = 'Cards you were passed are outlined';
  const winners = view.winners ?? [];

  return (
    <>
      <CardTable
        title={<>Hearts{subtitle && <Wide> · {subtitle}</Wide>}</>}
        rules={{ game: 'hearts', title: 'Hearts' }}
        onBack={onExit}
        scoreLine={<><div>Hand {view.handNo + 1}</div><div className="text-white/40">Totals · +this hand</div></>}
        names={names}
        table={table}
        seatDetail={seat => {
          const now = taken[seat];
          return `${view.totals[seat]}${now ? ` +${now}` : ''}${reactions[seat] ? ` ${reactions[seat]}` : ''}`;
        }}
        message={message}
        bgClass={BG}
      >
        <CardHand
          cards={myHand}
          legal={legalFor(view, 0)}
          onPlay={card => onAction({ type: 'play', seat: 0, cardId: card.id })}
          renderCard={(card, props) => (
            <CardFace card={card} {...props} highlight={table.trickNumber === 0 && view.received[0].includes(card.id)} />
          )}
        />
      </CardTable>
      {overlay}

      {view.phase === 'handOver' && view.lastHand && (
        <ResultPanel>
          <h2 className="text-xl font-bold text-white mb-1">Hand over</h2>
          {view.lastHand.shooter != null && (
            <p className="text-game-gold text-sm mb-2">🌙 {names[view.lastHand.shooter]} shot the moon!</p>
          )}
          <ScoreRows view={view} names={names} />
          <Button variant="primary" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
        </ResultPanel>
      )}

      {view.phase === 'gameOver' && (
        <ResultPanel>
          <div className="text-5xl mb-3">{winners.includes(0) ? '🏆' : '😢'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-2">
            {winners.includes(0) ? (winners.length > 1 ? 'You tie for the win!' : 'You Win!')
              : winners.length > 1 ? `${listNames(winners.map(w => names[w]))} tie!` : `${names[winners[0]]} Wins!`}
          </h2>
          <ScoreRows view={view} names={names} />
          {gameOverActions}
        </ResultPanel>
      )}
    </>
  );
}
