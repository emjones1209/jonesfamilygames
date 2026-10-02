/**
 * BridgeTable — the Bridge screen, drawn from a game view (see bridgeEngine.js)
 * in which the player looking at it is seat 0, South, partnered with North.
 * Used by the single-player game and by play-together tables alike.
 */
import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { sortHand, nextSeat } from '../cards/tricks';
import { CardTable, Wide } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { DENOMINATIONS, PASS, bidHigher, bidLevel, bidDenom, currentBid, BRIDGE_SUIT_ORDER } from './bridgeRules';
import { waitingFor, legalCards, dummyShown, declarerTricks } from './bridgeEngine';

const BG = 'from-game-bg to-teal-900';
const COMPASS = ['South', 'West', 'North', 'East'];
const DENOM_SYMBOL = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
const DENOM_COLOR = { C: 'text-white', D: 'text-red-400', H: 'text-red-400', S: 'text-white', NT: 'text-game-gold' };
const bidText = bid => (bid === PASS ? 'Pass' : `${bidLevel(bid)}${DENOM_SYMBOL[bidDenom(bid)]}`);
const sortBridge = hand => sortHand(hand, { suitOrder: BRIDGE_SUIT_ORDER });

/** The auction so far, one column per player starting with the dealer. */
function AuctionGrid({ auction, dealer, names }) {
  const order = [0, 1, 2, 3].map(i => (dealer + i) % 4);
  const rows = [];
  for (let i = 0; i < auction.length; i += 4) rows.push(auction.slice(i, i + 4));
  return (
    <table className="text-sm text-white/80 w-full max-w-xs">
      <thead>
        <tr>{order.map(s => <th key={s} className="text-white/40 text-xs font-normal truncate max-w-[5rem]">{names[s]}</th>)}</tr>
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

/**
 * @param view        game view with the viewer as seat 0 (South)
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown in the title (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function BridgeTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay }) {
  const myHand = useMemo(() => sortBridge(view.table?.hands[0] ?? view.hands[0]), [view]);
  const long = names.map((n, i) => (i === 0 ? `South (${n})` : `${COMPASS[i]} (${n})`));
  const scoreText = `NS ${view.scores.ns} · EW ${view.scores.ew}`;
  const choosing = waitingFor(view);

  if (view.phase === 'bidding') {
    const high = currentBid(view.auction);
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-4 short:p-2 flex flex-col items-center gap-3 short:gap-1.5`}>
        <div className="self-stretch flex items-center justify-between">
          <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
          <RulesButton game="bridge" title="Bridge" />
        </div>
        <div className="text-white/60 text-sm short:-mt-11">{scoreText} · {names[view.dealer]} dealt{subtitle ? ` · ${subtitle}` : ''}</div>
        <h2 className="text-2xl short:hidden font-bold text-white">Bidding</h2>
        <AuctionGrid auction={view.auction} dealer={view.dealer} names={names.map((n, i) => `${n}${reactions[i] ? ` ${reactions[i]}` : ''}`)} />
        <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
          {myHand.map(card => <PlayingCard key={card.id} card={{ ...card, faceUp: true }} size="sm" />)}
        </div>
        {choosing === 0 ? (
          <div className="w-full max-w-md short:max-w-2xl">
            {/* (Two levels to a row on a phone turned sideways) */}
            <div className="grid grid-cols-5 short:grid-cols-10 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].flatMap(level => DENOMINATIONS.map(d => {
                const bid = `${level}${d}`;
                const ok = bidHigher(bid, high);
                return (
                  <button key={bid} disabled={!ok} onClick={() => onAction({ type: 'bid', seat: 0, bid })}
                    className={`py-2 short:py-1 rounded-lg text-sm font-bold min-h-[40px] short:min-h-[32px] ${ok ? `bg-white/10 hover:bg-white/20 ${DENOM_COLOR[d]}` : 'bg-white/5 text-white/15'}`}>
                    {level}{DENOM_SYMBOL[d]}
                  </button>
                );
              }))}
            </div>
            <Button variant="ghost" className="w-full mt-2" onClick={() => onAction({ type: 'bid', seat: 0, bid: PASS })}>Pass</Button>
          </div>
        ) : (
          <p className="text-white/50 animate-pulse">{long[choosing]} is bidding…</p>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  // ── Play (and the result, over the finished table) ─────────────────────────
  const table = view.table;
  const contract = view.contract;
  const dummy = contract?.dummy;
  const shown = dummyShown(view);
  const iDeclare = contract?.declarer === 0;
  const turn = table?.status === 'playing' ? table.turn : null;
  const myChoice = choosing === 0;
  const dummyCards = dummy != null && table ? sortBridge(table.hands[dummy].filter(Boolean)) : [];
  const play = card => onAction({ type: 'play', seat: 0, cardId: card.id });

  // Dummy's cards face-up after the opening lead; the declarer taps them to play
  const dummyView = (
    <div className={dummy === 2 ? '' : 'max-w-[7.5rem] md:max-w-[11rem] lg:max-w-[12.5rem]'}>
      <CardHand cards={dummyCards} size="xs" wrap={dummy !== 2}
        legal={myChoice && iDeclare && turn === dummy ? legalCards(view) : []} onPlay={play} />
    </div>
  );
  const sides = shown && dummy !== 0 ? { [dummy]: dummyView } : {};

  let message = error || '';
  if (!message && table?.status === 'collecting') message = `${names[table.winner]} ${table.winner === 0 ? 'win' : 'wins'} the trick`;
  else if (!message && myChoice && turn === dummy) message = `Play a card from dummy (${names[dummy]})`;
  else if (!message && contract && !shown) message = `${names[nextSeat(contract.declarer)]} ${nextSeat(contract.declarer) === 0 ? 'make' : 'makes'} the opening lead`;
  const result = view.result;

  return (
    <>
      {table ? (
        <CardTable
          title={contract ? <>{bidText(contract.bid)} by {names[contract.declarer]}{subtitle && <Wide> · {subtitle}</Wide>}</> : 'Bridge'}
          scoreLine={`${declarerTricks(view)}/${contract ? contract.level + 6 : 0} tricks · ${scoreText}`}
          names={long.map((n, s) => (s === dummy ? `${names[s]} (dummy)` : n))}
          table={table}
          seatDetail={seat => [table.tricksWon[seat] || null, reactions[seat]].filter(Boolean).join(' ') || null}
          sides={sides}
          onBack={onExit}
          rules={{ game: 'bridge', title: 'Bridge' }}
          message={message}
          bgClass={BG}
        >
          <CardHand
            cards={myHand}
            label={dummy === 0 ? `You're dummy — ${names[contract.declarer]} plays your cards` : undefined}
            legal={myChoice && turn === 0 ? legalCards(view) : []}
            onPlay={play}
          />
        </CardTable>
      ) : <div className={`min-h-screen bg-gradient-to-br ${BG}`} />}
      {overlay}

      {view.phase === 'handOver' && result && (
        <ResultPanel>
          {result.passedOut ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">All four players passed</h2>
              <p className="text-white/60 mb-4">The hand is thrown in and redealt.</p>
            </>
          ) : (
            <>
              <h2 className={`text-xl font-bold mb-1 ${result.made ? 'text-green-400' : 'text-game-red'}`}>
                {bidText(contract.bid)} by {names[contract.declarer]}: {result.made
                  ? (result.overtricks ? `made +${result.overtricks}` : 'made')
                  : `down ${result.down}`}
              </h2>
              <p className="text-white/60 text-sm mb-3">Declarer took {result.declarerTricks} tricks (needed {contract.level + 6})</p>
              <p className="text-white mb-4">{scoreText}</p>
            </>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onExit}>Home</Button>
            <Button variant="primary" className="flex-1" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
          </div>
        </ResultPanel>
      )}
    </>
  );
}
