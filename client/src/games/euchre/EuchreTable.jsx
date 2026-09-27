/**
 * EuchreTable — the Euchre screen, drawn from a game view (see euchreEngine.js)
 * in which the player looking at it is seat 0 (partnered with seat 2). Used by
 * the single-player game and by play-together tables alike.
 */
import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { PlayingCard } from '../../components/PlayingCard';
import { RulesButton } from '../../components/RulesButton';
import { SUIT_SYMBOLS } from '../../utils/cardEngine';
import { CardTable } from '../cards/CardTable';
import { CardHand } from '../cards/CardHand';
import { ResultPanel } from '../cards/GameSetup';
import { sortHand, WINNING_SCORE } from './euchreRules';
import { waitingFor, legalFor, teamTricks, mustCall } from './euchreEngine';

const BG = 'from-game-bg to-rose-950';
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const suitColour = suit => (suit === 'hearts' || suit === 'diamonds' ? 'text-red-400' : 'text-white');
const cardName = c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`;

function Suit({ suit, name = false }) {
  return <span className={suitColour(suit)}>{SUIT_SYMBOLS[suit]}{name ? ` ${SUIT_NAMES[suit]}` : ''}</span>;
}

function callLabel(call) {
  if (call == null) return '…';
  if (call === 'pass') return 'Pass';
  return <><Suit suit={call.suit} />{call.alone ? ' alone' : ''}</>;
}

/**
 * @param view        game view with the viewer as seat 0
 * @param names       display name for each seat (seat 0 = the viewer, usually "You")
 * @param onAction    called with an action for seat 0 (or a table action like nextHand)
 * @param subtitle    shown after the game's name (e.g. the difficulty)
 * @param reactions   seat → emoji being shown right now
 * @param overlay     extra content drawn over the table (e.g. the reactions bar)
 */
export function EuchreTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const myHand = useMemo(() => sortHand(view.table?.hands[0] ?? view.hands[0], view.phase === 'bidding' ? null : view.trump),
    [view]);
  const scoreLine = `Us ${view.scores[0]} · Them ${view.scores[1]}`;
  const say = (seat, verb) => `${names[seat]} ${seat === 0 ? verb.you : verb.them}`;

  if (view.phase === 'bidding' || view.phase === 'discard') {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BG} p-5 flex flex-col items-center gap-4`}>
        <div className="self-stretch flex items-center justify-between">
          <button onClick={onExit} className="text-white/50 hover:text-white text-sm min-h-[44px] px-2">← Back</button>
          <RulesButton game="euchre" title="Euchre" />
        </div>
        <div className="text-white/60 text-sm">{scoreLine} · first to {WINNING_SCORE}</div>
        <h2 className="text-2xl font-bold text-white">
          {view.phase === 'discard' ? 'Picking up' : view.round === 1 ? 'Order it up?' : 'Name trump'}
        </h2>
        <div className="grid grid-cols-4 gap-2 w-full max-w-md">
          {names.map((name, seat) => (
            <div key={seat} className={`rounded-xl p-2 text-center ${seat === waitingFor(view) ? 'bg-game-gold/20 border border-game-gold' : 'bg-white/5'}`}>
              <div className="text-white/60 text-xs truncate">{name}{seat === view.dealer ? ' (dealer)' : ''}{reactions[seat] ? ` ${reactions[seat]}` : ''}</div>
              <div className="text-white font-bold">{callLabel(view.calls[seat])}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className={view.round === 2 ? 'opacity-40 grayscale' : ''}>
            <PlayingCard card={{ ...view.upcard, faceUp: true }} size="md" />
          </div>
          <div className="text-white/50 text-xs">
            {view.round === 2 ? <>Turned down: <Suit suit={view.turnedDown} name /></> : 'The turned-up card'}
          </div>
        </div>

        {view.phase === 'discard' ? (
          waitingFor(view) === 0 ? (
            <div className="w-full max-w-2xl">
              <p className="text-white/70 text-sm text-center mb-2">
                You picked up the {cardName(view.upcard)}. <Suit suit={view.trump} name /> are trump. Throw away one card.
              </p>
              <CardHand cards={myHand} legal={myHand} wrap
                onPlay={card => onAction({ type: 'discard', seat: 0, cardId: card.id })}
                hints={{ selected: 'Tap again to throw it away', active: 'Pick a card to throw away' }} />
            </div>
          ) : (
            <>
              <HandRow cards={myHand} />
              <p className="text-white/50 animate-pulse text-center">
                {names[view.dealer]} picked up the {cardName(view.upcard)} and is throwing a card away…
              </p>
            </>
          )
        ) : (
          <>
            <HandRow cards={myHand} />
            {waitingFor(view) === 0
              ? <CallButtons view={view} names={names} onAction={onAction} />
              : <p className="text-white/50 animate-pulse">{say(view.bidTurn, { you: 'are deciding…', them: 'is deciding…' })}</p>}
          </>
        )}
        {error && <p className="text-red-300 text-sm">{error}</p>}
        {overlay}
      </div>
    );
  }

  const table = view.table;
  const tricks = teamTricks(view);
  const message = error || (table.status === 'collecting' ? `${names[table.winner]} ${table.winner === 0 ? 'win' : 'wins'} the trick` : '');
  const last = view.lastHand;

  return (
    <>
      <CardTable
        title={`Euchre${subtitle ? ` · ${subtitle}` : ''}`}
        rules={{ game: 'euchre', title: 'Euchre' }}
        onBack={onExit}
        scoreLine={
          <>
            <div className="text-white/90 font-semibold">
              Trump <Suit suit={view.trump} /> · {names[view.maker]} called it{view.alone ? ' alone' : ''}
            </div>
            <div className="text-white/50">Tricks: Us {tricks[0]} · Them {tricks[1]} · Game: {scoreLine}</div>
          </>
        }
        names={names}
        table={table}
        seatDetail={seat => (seat === view.sittingOut ? 'sitting out' : `${table.tricksWon[seat]}${reactions[seat] ? ` ${reactions[seat]}` : ''}`)}
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
          ) : <h2 className="text-xl font-bold text-white mb-1">{handHeadline(last)}</h2>}
          <p className="text-white/60 text-sm mb-3">
            {names[last.maker]} called <Suit suit={last.trump} name />{last.alone ? ' and went alone' : ''}
            {' '}— {last.makerTeam === 0 ? 'your team' : 'their team'} took {last.tricks[last.makerTeam]} of 5 tricks.
          </p>
          <table className="w-full text-sm text-white/80 mb-4">
            <thead><tr className="text-white/40 text-xs"><th /><th>Tricks</th><th>Points</th><th>Total</th></tr></thead>
            <tbody>
              {['Us', 'Them'].map((label, team) => (
                <tr key={label}>
                  <td className="text-left">{label}</td>
                  <td>{last.tricks[team]}</td>
                  <td className={last.delta[team] ? 'text-green-400' : ''}>{last.delta[team] ? `+${last.delta[team]}` : '–'}</td>
                  <td className="font-bold">{view.scores[team]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {view.phase === 'handOver'
            ? <Button variant="primary" className="w-full" onClick={() => onAction({ type: 'nextHand' })}>Next Hand</Button>
            : gameOverActions}
        </ResultPanel>
      )}
    </>
  );
}

function handHeadline({ result, makerTeam, alone }) {
  const us = makerTeam === 0;
  if (result === 'euchred') return us ? 'Euchred! 😬' : 'You euchred them! 🎉';
  if (result === 'march') return `${us ? 'You' : 'They'} took all 5${alone ? ' alone' : ''}! ${us ? '🎉' : ''}`;
  return us ? 'You made it!' : 'They made it';
}

function HandRow({ cards }) {
  return (
    <div className="flex flex-wrap justify-center gap-1 max-w-2xl">
      {cards.map(card => <PlayingCard key={card.id} card={{ ...card, faceUp: true }} size="sm" />)}
    </div>
  );
}

function CallButtons({ view, names, onAction }) {
  const [alone, setAlone] = useState(false);
  const iDeal = view.dealer === 0;
  const dealerName = names[view.dealer];
  const call = suit => onAction({ type: 'call', seat: 0, suit, alone });
  const pass = () => onAction({ type: 'pass', seat: 0 });

  const aloneToggle = (
    <button onClick={() => setAlone(a => !a)}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${alone ? 'bg-game-gold text-game-bg' : 'bg-white/10 text-white/70'}`}>
      {alone ? '✓ Going alone' : 'Go alone?'}
    </button>
  );

  if (view.round === 1) {
    const suit = view.upcard.suit;
    return (
      <div className="flex flex-col items-center gap-3 max-w-sm">
        <p className="text-white/60 text-sm text-center">
          {iDeal
            ? <>Pick up the {cardName(view.upcard)} to make <Suit suit={suit} name /> trump (you&apos;ll throw a card away)?</>
            : <>Order it up to make <Suit suit={suit} name /> trump — {dealerName} picks up the {cardName(view.upcard)}{view.dealer === 2 ? ' (good for your team!)' : ''}.</>}
          {' '}Your team will need 3 of the 5 tricks.
        </p>
        {aloneToggle}
        <div className="flex gap-3">
          <Button variant="gold" onClick={() => call(suit)}>{iDeal ? 'Pick It Up' : 'Order It Up'} {SUIT_SYMBOLS[suit]}</Button>
          <Button variant="ghost" onClick={pass}>Pass</Button>
        </div>
        {alone && <p className="text-white/40 text-xs text-center">Alone: your partner sits out. Take all 5 tricks for 4 points!</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 max-w-sm">
      <p className="text-white/60 text-sm text-center">
        {mustCall(view)
          ? 'Everyone passed, so the dealer has to choose trump.'
          : 'Name any other suit as trump, or pass.'}
        {' '}Your team will need 3 of the 5 tricks.
      </p>
      {aloneToggle}
      <div className="flex gap-2">
        {SUITS.filter(s => s !== view.turnedDown).map(s => (
          <button key={s} onClick={() => call(s)}
            className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 text-lg font-bold active:scale-95 min-w-[64px]">
            <Suit suit={s} />
            <div className="text-[11px] text-white/60 font-normal">{SUIT_NAMES[s]}</div>
          </button>
        ))}
      </div>
      {!mustCall(view) && <Button variant="ghost" onClick={pass}>Pass</Button>}
    </div>
  );
}
