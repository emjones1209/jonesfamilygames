/**
 * CardTable — layout shared by the four-player card games:
 * header, partner/opponents around the table, the trick in the middle and the
 * player's own area (usually a CardHand) at the bottom.
 *
 * On a phone turned sideways there's very little height, so the header moves up
 * beside the partner, the trick shrinks and your hand sits beside your name.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TrickArea } from './TrickArea';
import { RulesButton } from '../../components/RulesButton';
import { Wide } from '../../components/Wide';
import { useMediaQuery, SHORT_SCREEN } from '../../utils/useMediaQuery';

export { Wide };

export function HiddenHand({ count, vertical = false }) {
  const shown = Math.min(count, vertical ? 7 : 13);
  return (
    <div className={`flex ${vertical ? 'flex-col -space-y-3' : '-space-x-3'} items-center`}>
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} className={`${vertical ? 'w-8 h-5 md:w-11 md:h-7' : 'w-5 h-8 md:w-7 md:h-11'} bg-blue-900 border border-blue-600 rounded shadow`} />
      ))}
    </div>
  );
}

function Seat({ name, active, children, detail }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
        active ? 'bg-game-gold text-game-bg font-bold' : 'text-white/60'}`}>
        {name}{detail != null && <span className="opacity-70"> · {detail}</span>}
      </div>
      {children}
    </div>
  );
}

export function CardTable({
  title, scoreLine, names, table, seatDetail = () => null,
  onBack,                 // defaults to going home
  rules,                  // { game, title } for the Rules button
  sides = {},             // optional replacement content for seats 1-3 (e.g. Bridge dummy)
  message, renderTrickCard, bgClass = 'from-game-bg to-green-950', children,
}) {
  const navigate = useNavigate();
  const short = useMediaQuery(SHORT_SCREEN);
  const turn = table?.status === 'playing' ? table.turn : null;
  const side = seat => sides[seat] ?? <HiddenHand count={table?.hands[seat]?.length ?? 0} vertical={seat !== 2} />;
  const seat = (n, content = side(n)) => <Seat name={names[n]} active={turn === n} detail={seatDetail(n)}>{content}</Seat>;

  const back = (
    <button onClick={onBack ?? (() => navigate('/'))} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px] shrink-0"
      aria-label="Back to games">
      <ArrowLeft size={20} />
    </button>
  );
  const rulesButton = rules && <RulesButton game={rules.game} title={rules.title} />;
  const titleText = <div className="text-white/80 text-sm font-semibold min-w-0 truncate">{title}</div>;
  // (Upright on a phone the score shares the header row with the title, so it gets at most ~⅔ of it)
  const score = (
    <div className={`text-white/60 text-[11px] md:text-xs text-right leading-snug shrink-0 ${short ? '' : 'max-w-[62%] md:max-w-none'}`}>
      {scoreLine}
    </div>
  );
  const trick = (
    <TrickArea
      plays={table?.trick ?? []}
      names={names}
      winner={table?.status === 'collecting' ? table.winner : null}
      message={message}
      renderCard={renderTrickCard}
      size={short ? 'xs' : 'sm'}
    />
  );

  if (short) {
    // Sideways: three columns (header and left seat | partner and trick | score and right seat), hand below
    const sideSeat = sides[2] ? seat(2) : seat(2, null);   // the partner's hidden hand is left out for height
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgClass} px-3 py-1 flex flex-col select-none`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 flex-1">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 min-w-0">{back}{rulesButton}{titleText}</div>
            <div className="flex-1 flex items-center justify-start">{seat(1)}</div>
          </div>
          <div className="flex flex-col items-center gap-1">{sideSeat}{trick}</div>
          <div className="flex flex-col items-end min-w-0">
            <div className="pt-1">{score}</div>
            <div className="flex-1 flex items-center justify-end">{seat(3)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="shrink-0">{seat(0, null)}</div>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgClass} p-3 flex flex-col select-none`}>
      <header className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {back}
          {rulesButton}
          <div className="md:hidden min-w-0 ml-1">{titleText}</div>
        </div>
        <div className="hidden md:block">{titleText}</div>
        {score}
      </header>

      <div className="flex justify-center mb-2">{seat(2)}</div>

      {/* Side seats get equal flexible columns, so the trick stays exactly centred
          however wide their name tags or hands are */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 flex-1">
        <div className="justify-self-start min-w-0">{seat(1)}</div>
        {trick}
        <div className="justify-self-end min-w-0">{seat(3)}</div>
      </div>

      <div className="mt-2">
        <div className="flex justify-center mb-1">{seat(0, null)}</div>
        {children}
      </div>
    </div>
  );
}
