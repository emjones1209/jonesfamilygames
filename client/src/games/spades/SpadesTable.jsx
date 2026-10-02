/**
 * SpadesTable — the Spades screen, drawn from a game view (see spadesEngine.js)
 * in which the player looking at it is seat 0 (partnered with seat 2). Used by
 * the single-player game and by play-together tables alike.
 */
import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { sortHand } from '../cards/tricks';
import { CardTable, Wide } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { BAG_LIMIT, NIL } from './spadesRules';
import { waitingFor, legalFor, teamTricks, teamBid } from './spadesEngine';

const BG = 'from-game-bg to-slate-900';
const bidLabel = b => (b == null ? '…' : b === NIL ? 'Nil' : b);

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function SpadesTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const myHand = useMemo(() => sortHand(view.table?.hands[0] ?? view.hands[0]), [view]);
  const scoreLine = `Us ${view.scores[0]} · Them ${view.scores[1]}${view.target ? ` · to ${view.target}` : ''}`;

  if (view.phase === 'bidding') {
    const partnerBid = view.bids[2];
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 short:p-2 flex flex-col items-center gap-4 short:gap-1.5`}>
        <div className="self-stretch flex items-center justify-between">
          <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
          <RulesButton game="spades" title="Spades" />
        </div>
        <div className="text-white/60 text-sm short:-mt-11">{scoreLine} · Bags {view.bags[0]}/{BAG_LIMIT}</div>
        <h2 className="text-2xl short:text-lg font-bold text-white">Bidding</h2>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {names.map((name, seat) => (
            <div key={seat} className={`rounded-xl p-2 short:p-1 short:flex short:items-center short:justify-center short:gap-2 text-center ${seat === view.bidTurn ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs truncate">{name}{seat === view.dealer ? ' (dealer)' : ''}{reactions[seat] ? ` ${reactions[seat]}` : ''}</div>
              <div className="text-white font-bold">{bidLabel(view.bids[seat])}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(card => <PlayingCard key={card.id} card={{ ...card, faceUp: true }} size="sm" />)}
        </div>
        {waitingFor(view) === 0 ? (
          <>
            <p className="text-white/60 text-sm text-center max-w-sm">
              How many tricks will you win?
              {partnerBid != null && <> {names[2]} (your partner) bid <b className="text-game-gold">{bidLabel(partnerBid)}</b>.</>}
            </p>
            <div className="grid grid-cols-7 short:grid-cols-[repeat(14,minmax(0,1fr))] gap-2 max-w-md short:max-w-2xl">
              {Array.from({ length: 14 }, (_, n) => (
                <button key={n} onClick={() => onAction({ type: 'bid', seat: 0, bid: n })}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 short:py-2 rounded-xl min-w-[44px] active:scale-95">
                  {n === 0 ? 'Nil' : n}
                </button>
              ))}
            </div>
            <p className="text-white/30 text-xs text-center max-w-sm short:hidden">
              Nil = win no tricks at all: +100 if you do, −100 if you don't.
            </p>
          </>
        ) : (
          <p className="text-white/50 animate-pulse">{names[view.bidTurn]} is bidding…</p>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  const table = view.table;
  const tricks = teamTricks(view), bid = teamBid(view);
  const message = error || (table.status === 'collecting' ? `${names[table.winner]} ${table.winner === 0 ? 'win' : 'wins'} the trick` : '');
  const last = view.lastHand;

  return (
    <>
      <CardTable
        title={<>Spades{subtitle && <Wide> · {subtitle}</Wide>}</>}
        rules={{ game: 'spades', title: 'Spades' }}
        onBack={onExit}
        scoreLine={
          <>
            <div className="text-white/90 font-semibold"><Wide>This hand: </Wide>Us {tricks[0]}/{bid[0]} · Them {tricks[1]}/{bid[1]}<Wide> tricks</Wide></div>
            <div className="text-white/50"><Wide>Game: </Wide>{scoreLine}</div>
          </>
        }
        names={names}
        table={table}
        seatDetail={seat => `${table.tricksWon[seat]}/${bidLabel(view.bids[seat])}${reactions[seat] ? ` ${reactions[seat]}` : ''}`}
        message={message}
        bgClass={BG}
      >
        <CardHand cards={myHand} legal={legalFor(view, 0)} onPlay={card => onAction({ type: 'play', seat: 0, cardId: card.id })} />
      </CardTable>
      {overlay}

      {(view.phase === 'handOver' || view.phase === 'gameOver') && last && (
        <ResultPanel>
          {view.phase === 'gameOver' ? (
            <>
              <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : '😢'}</div>
              <h2 className="text-2xl font-bold text-game-gold mb-2">{view.winner === 0 ? 'Your team wins!' : 'They win!'}</h2>
            </>
          ) : <h2 className="text-xl font-bold text-white mb-3">Hand over</h2>}
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Bid</th><th>Won</th><th>Points</th><th>Total</th></tr></thead>
            <tbody>
              {['Us', 'Them'].map((label, team) => {
                const d = last.detail[team];
                return (
                  <tr key={label}>
                    <td className="text-left">{label}</td>
                    <td>{d.contract}</td>
                    <td>{d.won}</td>
                    <td className={last.delta[team] < 0 ? 'text-game-red' : 'text-green-400'}>
                      {last.delta[team] > 0 ? '+' : ''}{last.delta[team]}
                    </td>
                    <td className="font-bold">{view.scores[team]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {last.detail.some(d => d.bagPenalty) && <p className="text-amber-400 text-xs mb-3">10 bags reached: −100 penalty!</p>}
          {view.phase === 'handOver'
            ? <Button variant="primary" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
            : gameOverActions}
        </ResultPanel>
      )}
    </>
  );
}
