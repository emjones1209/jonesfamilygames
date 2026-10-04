/**
 * PinochleTable — the Pinochle screen, drawn from a game view (see
 * pinochleEngine.js) in which the player looking at it is seat 0 (partnered
 * with seat 2). Used by the single-player game and by play-together tables alike.
 */
import { useState, useMemo } from 'react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../../utils/cardEngine';
import { CardTable, Wide } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { useMediaQuery, SHORT_SCREEN } from '../../utils/useMediaQuery';
import { SUITS, PASS, PASS_COUNT, BID_STEP, GAME_TARGET, sortPinochle, meldOf, sumPoints } from './pinochleRules';
import { waitingFor, legalFor, minBid, dealerStuck, teamMeld } from './pinochleEngine';

const BG = 'from-game-bg to-emerald-950';
const SUIT_NAME = { spades: 'Spades', hearts: 'Hearts', clubs: 'Clubs', diamonds: 'Diamonds' };
const SuitMark = ({ suit }) => <span className={SUIT_COLORS[suit] === 'text-red-600' ? 'text-red-400' : 'text-white'}>{SUIT_SYMBOLS[suit]}</span>;
const bidLabel = b => (b == null ? '—' : b === PASS ? 'Pass' : b);
const verb = (names, seat, you, they) => `${names[seat]} ${seat === 0 ? you : they}`;

function Page({ children, header, scoreLine }) {
  return (
    <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 short:p-2 flex flex-col items-center gap-4 short:gap-1.5`}>
      {header}
      <div className="text-white/60 text-sm short:-mt-11">{scoreLine}</div>
      {children}
    </div>
  );
}

/** Your cards laid out in rows; with `pick`, tap cards to choose them. `outlined` marks the cards just passed to you. */
function HandRow({ cards, chosen = [], onPick, outlined = [] }) {
  return (
    <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
      {cards.map(c => (
        <div key={c.id} className={outlined.includes(c.id) ? 'rounded-xl ring-2 ring-sky-400' : ''}>
          <PlayingCard card={{ ...c, faceUp: true }} size="sm" selected={chosen.includes(c.id)} onClick={onPick ? () => onPick(c.id) : undefined} />
        </div>
      ))}
    </div>
  );
}

/** One player's meld: the total, what it's made of and (room permitting) the cards. */
function MeldBox({ name, meld, ready, short, highlight }) {
  return (
    <div className={`rounded-xl p-2 text-left ${highlight ? 'bg-game-gold/10 border border-game-gold/40' : 'bg-white/5'}`}>
      <div className="flex justify-between text-sm gap-2">
        <span className="text-white/80 truncate">{name}{ready ? ' ✓' : ''}</span>
        <span className="text-game-gold font-bold">{meld.total}</span>
      </div>
      {meld.items.length === 0 && <div className="text-white/30 text-xs">No meld</div>}
      {meld.items.map((item, i) => (
        <div key={i} className="mt-1">
          <div className="text-white/60 text-xs">{item.name} · {item.points}</div>
          {!short && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {item.cards.map(c => <PlayingCard key={c.id} card={{ ...c, faceUp: true }} size="xs" />)}
            </div>
          )}
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
export function PinochleTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const [chosen, setChosen] = useState([]);
  const [bid, setBid] = useState(null);
  const short = useMediaQuery(SHORT_SCREEN);
  const turn = waitingFor(view);
  const myHand = useMemo(() => sortPinochle(view.table?.hands[0] ?? view.hands[0] ?? [], view.trump), [view]);
  const scoreLine = `Us ${view.scores[0]} · Them ${view.scores[1]} · to ${GAME_TARGET.toLocaleString()}`;
  const reactionFor = seat => (reactions[seat] ? <span className="text-lg ml-1">{reactions[seat]}</span> : null);
  const header = (
    <div className="w-full flex items-center justify-between">
      <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
      <RulesButton game="pinochle" title="Pinochle" />
    </div>
  );
  const page = children => <Page header={header} scoreLine={scoreLine}>{children}{error && <p className="text-red-300 text-sm">{error}</p>}{overlay}</Page>;
  const pick = id => setChosen(sel => (sel.includes(id) ? sel.filter(x => x !== id) : sel.length < PASS_COUNT ? [...sel, id] : sel));
  const send = action => { onAction(action); setChosen([]); };
  const trumpLine = view.trump && (
    <span>Trump <b><SuitMark suit={view.trump} /></b> · Bid {view.high?.amount}<Wide> ({names[view.bidder]})</Wide></span>
  );

  // ── Bidding ───────────────────────────────────────────────────────────────
  if (view.phase === 'bidding') {
    const least = minBid(view);
    const amount = Math.max(bid ?? least, least);
    const stuck = dealerStuck(view, 0);
    const meldBySuit = SUITS.map(suit => ({ suit, total: meldOf(myHand, suit).total }));
    return page(
      <>
        <h2 className="text-2xl short:text-lg font-bold text-white">Bidding</h2>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {names.map((name, seat) => (
            <div key={seat} className={`rounded-xl p-2 short:p-1 short:flex short:items-center short:justify-center short:gap-2 text-center ${seat === view.bidTurn ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs truncate">{name}{seat === view.dealer ? ' (dealer)' : ''}{reactionFor(seat)}</div>
              <div className="text-white font-bold">{bidLabel(view.bids[seat])}</div>
            </div>
          ))}
        </div>
        <HandRow cards={myHand} />
        <p className="text-white/50 text-xs text-center">
          Your meld if trump were {meldBySuit.map((m, i) => <span key={m.suit}>{i ? ' · ' : ''}<SuitMark suit={m.suit} /> {m.total}</span>)}
        </p>
        {turn === 0 ? (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={amount <= least} onClick={() => setBid(amount - BID_STEP)}>−10</Button>
              <Button variant="gold" onClick={() => { onAction({ type: 'bid', seat: 0, bid: amount }); setBid(null); }}>Bid {amount}</Button>
              <Button variant="ghost" onClick={() => setBid(amount + BID_STEP)}>+10</Button>
              <Button variant="ghost" onClick={() => setBid(amount + 50)}>+50</Button>
            </div>
            <Button variant="secondary" disabled={stuck} onClick={() => { onAction({ type: 'bid', seat: 0, bid: PASS }); setBid(null); }}>Pass</Button>
            {stuck
              ? <p className="text-amber-400 text-xs">Everyone else passed — as the dealer you must bid.</p>
              : <p className="text-white/30 text-xs text-center max-w-sm short:hidden">Bid what your team will score this hand: meld plus points won in tricks. Pass and you're out of the bidding.</p>}
          </>
        ) : (
          <p className="text-white/50 animate-pulse">{names[view.bidTurn]} is bidding…</p>
        )}
      </>
    );
  }

  // ── Naming trump ──────────────────────────────────────────────────────────
  if (view.phase === 'trump') {
    return page(
      <>
        <h2 className="text-2xl short:text-lg font-bold text-game-gold">{verb(names, view.bidder, 'won', 'won')} the bid at {view.high.amount}{view.bidder === 0 ? '!' : ''}</h2>
        <HandRow cards={myHand} />
        {view.bidder === 0 ? (
          <>
            <p className="text-white/70 text-sm">Name trump. ({names[2]} will then pass you 3 cards.)</p>
            <div className="grid grid-cols-2 short:grid-cols-4 gap-3 w-full max-w-sm short:max-w-xl">
              {SUITS.map(suit => (
                <button key={suit} onClick={() => onAction({ type: 'trump', seat: 0, suit })}
                  className="rounded-xl px-4 py-3 short:py-2 font-bold bg-white/10 hover:bg-white/20 min-h-[52px] text-white">
                  <div className="whitespace-nowrap"><SuitMark suit={suit} /> {SUIT_NAME[suit]}</div>
                  <div className="text-white/50 text-xs font-normal">your meld {meldOf(myHand, suit).total}</div>
                </button>
              ))}
            </div>
          </>
        ) : <p className="text-white/50 animate-pulse">{names[view.bidder]} is naming trump…{reactionFor(view.bidder)}</p>}
      </>
    );
  }

  // ── Passing cards between the bidder and partner ──────────────────────────
  if (view.phase === 'passing' || view.phase === 'passBack') {
    const passer = view.phase === 'passing' ? (view.bidder + 2) % 4 : view.bidder;
    const receiver = (passer + 2) % 4;
    const mine = passer === 0;
    const outlined = view.phase === 'passBack' && view.bidder === 0 ? view.passed.toBidder.filter(Boolean).map(c => c.id) : [];
    return page(
      <>
        <h2 className="text-xl short:text-lg font-bold text-white">{trumpLine}</h2>
        {mine ? (
          <p className="text-white/70 text-sm text-center max-w-sm">
            {view.phase === 'passing'
              ? <>Choose <b>3 cards to pass</b> to {names[receiver]}, your partner, who bid. Trumps and aces help most.</>
              : <>The 3 cards from {names[receiver]} are outlined. Choose <b>3 cards to pass back</b>.</>}
          </p>
        ) : (
          <p className="text-white/50 animate-pulse">{names[passer]} is choosing 3 cards to pass {receiver === 0 ? 'you' : names[receiver]}…{reactionFor(passer)}</p>
        )}
        <HandRow cards={myHand} chosen={chosen} onPick={mine ? pick : undefined} outlined={outlined} />
        {mine && (
          <Button variant="gold" disabled={chosen.length !== PASS_COUNT}
            onClick={() => send({ type: view.phase === 'passing' ? 'pass' : 'passBack', seat: 0, cardIds: chosen })}>
            Pass {chosen.length}/{PASS_COUNT}
          </Button>
        )}
      </>
    );
  }

  // ── Everyone's meld ───────────────────────────────────────────────────────
  if (view.phase === 'meld') {
    const team = teamMeld(view);
    return page(
      <>
        <h2 className="text-xl short:text-lg font-bold text-white">Meld · {trumpLine}</h2>
        <div className="text-white/80 text-sm">Us <b className="text-game-gold">{team[0]}</b> · Them <b className="text-game-gold">{team[1]}</b>
          <span className="text-white/40"> (counts only if the team wins a trick)</span></div>
        {!view.ready[0]
          ? <Button variant="gold" onClick={() => onAction({ type: 'ready', seat: 0 })}>Play the hand</Button>
          : <p className="text-white/50 animate-pulse">Waiting for {names.filter((_, seat) => !view.ready[seat]).join(', ')}…</p>}
        <div className="grid grid-cols-2 short:grid-cols-4 gap-2 w-full max-w-2xl">
          {[0, 2, 1, 3].map(seat => (
            <MeldBox key={seat} name={<>{names[seat]}{reactionFor(seat)}</>} meld={view.meld[seat]} ready={view.ready[seat]} short={short} highlight={seat % 2 === 0} />
          ))}
        </div>
      </>
    );
  }

  // ── Playing, and the end of a hand ────────────────────────────────────────
  const table = view.table;
  const trickPoints = [0, 1].map(t => [t, t + 2].reduce((n, seat) => n + sumPoints(table.taken[seat]), 0));
  const meld = teamMeld(view);
  const message = error
    || (table.status === 'collecting' ? `${verb(names, table.winner, 'win', 'wins')} the trick`
      : table.trickNumber === 0 && table.trick.length === 0 ? `${verb(names, view.bidder, 'lead', 'leads')}` : '');
  const last = view.lastHand;

  return (
    <>
      <CardTable
        title={<>{trumpLine}{subtitle && <Wide> · {subtitle}</Wide>}</>}
        rules={{ game: 'pinochle', title: 'Pinochle' }}
        onBack={onExit}
        scoreLine={
          <>
            <div className="text-white/90 font-semibold"><Wide>Meld + tricks: </Wide>Us {meld[0]}+{trickPoints[0]} · Them {meld[1]}+{trickPoints[1]}</div>
            <div className="text-white/50"><Wide>Game: </Wide>Us {view.scores[0]} · Them {view.scores[1]}</div>
          </>
        }
        names={names}
        table={table}
        seatDetail={seat => [seat === view.bidder ? `bid ${view.high.amount}` : null, reactions[seat]].filter(Boolean).join(' ') || null}
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
          ) : (
            <h2 className={`text-xl font-bold mb-3 ${last.res[last.bid.team].made ? 'text-green-400' : 'text-game-red'}`}>
              {last.bid.team === 0 ? 'We' : 'They'} {last.res[last.bid.team].made ? 'made' : 'were set on'} the bid of {last.bid.amount}
            </h2>
          )}
          <table className="w-full text-sm text-white/80 mb-2">
            <thead><tr className="text-white/40 text-xs"><th /><th>Meld</th><th>Tricks</th><th>Hand</th><th>Total</th></tr></thead>
            <tbody>
              {['Us', 'Them'].map((label, team) => {
                const r = last.res[team];
                const lost = last.meld[team] > 0 && r.meld === 0;
                return (
                  <tr key={label}>
                    <td className="text-left">{label}</td>
                    <td className={lost ? 'line-through text-white/40' : ''}>{last.meld[team]}</td>
                    <td>{r.counters}</td>
                    <td className={r.delta < 0 ? 'text-game-red' : 'text-green-400'}>{r.delta > 0 ? '+' : ''}{r.delta}</td>
                    <td className="font-bold">{view.scores[team]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {last.res.some((r, team) => last.meld[team] > 0 && r.meld === 0) && (
            <p className="text-amber-400 text-xs mb-2">A team that wins no tricks loses its meld.</p>
          )}
          <div className="mb-4" />
          {view.phase === 'handOver'
            ? <Button variant="primary" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
            : gameOverActions}
        </ResultPanel>
      )}
    </>
  );
}
