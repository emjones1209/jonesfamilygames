/**
 * CardTable — layout shared by the four-player card games:
 * header, partner/opponents around the table, the trick in the middle and the
 * player's own area (usually a CardHand) at the bottom.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TrickArea } from './TrickArea';
import { RulesButton } from '../../components/RulesButton';

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
  const turn = table?.status === 'playing' ? table.turn : null;
  const side = seat => sides[seat] ?? <HiddenHand count={table?.hands[seat]?.length ?? 0} vertical={seat !== 2} />;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgClass} p-3 flex flex-col select-none`}>
      <header className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onBack ?? (() => navigate('/'))} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]"
            aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          {rules && <RulesButton game={rules.game} title={rules.title} />}
        </div>
        <div className="text-white/80 text-sm font-semibold">{title}</div>
        <div className="text-white/60 text-xs text-right">{scoreLine}</div>
      </header>

      <div className="flex justify-center mb-2">
        <Seat name={names[2]} active={turn === 2} detail={seatDetail(2)}>{side(2)}</Seat>
      </div>

      {/* Side seats get equal flexible columns, so the trick stays exactly centred
          however wide their name tags or hands are */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 flex-1">
        <div className="justify-self-start min-w-0">
          <Seat name={names[1]} active={turn === 1} detail={seatDetail(1)}>{side(1)}</Seat>
        </div>
        <TrickArea
          plays={table?.trick ?? []}
          names={names}
          winner={table?.status === 'collecting' ? table.winner : null}
          message={message}
          renderCard={renderTrickCard}
        />
        <div className="justify-self-end min-w-0">
          <Seat name={names[3]} active={turn === 3} detail={seatDetail(3)}>{side(3)}</Seat>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex justify-center mb-1">
          <Seat name={names[0]} active={turn === 0} detail={seatDetail(0)} />
        </div>
        {children}
      </div>
    </div>
  );
}
