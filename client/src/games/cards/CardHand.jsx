/**
 * CardHand — the player's hand. Tap a card to select it, tap again to play.
 * Cards that can't be played right now are dimmed and ignore taps.
 */
import { useState } from 'react';
import { PlayingCard } from '../../components/PlayingCard';
import { useMediaQuery, PHONE_UPRIGHT } from '../../utils/useMediaQuery';

const defaultRender = (card, { selected, disabled, onClick, size }) => (
  <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} disabled={disabled} onClick={onClick} />
);

export function CardHand({
  cards,
  legal = [],            // cards playable now (empty when it isn't your turn)
  onPlay,
  size: askedSize = 'sm',
  renderCard = defaultRender,
  label,
  wrap: askedWrap,
  hints = { selected: 'Tap again to play', active: 'Your turn — pick a card' },
}) {
  const [selectedId, setSelectedId] = useState(null);
  // On a phone held upright one row of 13 cards is a squeeze: lay a normal-sized
  // hand out in rows of slightly bigger cards instead (iPads keep the single row)
  const phone = useMediaQuery(PHONE_UPRIGHT) && askedSize === 'sm';
  const size = phone ? 'hand' : askedSize;
  const wrap = askedWrap ?? phone;
  const active = legal.length > 0;
  // Forget a selection that is no longer playable (e.g. the turn moved on)
  const selected = active && legal.some(c => c.id === selectedId) ? selectedId : null;

  const tap = card => {
    if (!legal.some(c => c.id === card.id)) return;
    if (selected === card.id) { setSelectedId(null); onPlay(card); }
    else setSelectedId(card.id);
  };

  return (
    <div>
      {label && <p className="text-white/40 text-xs text-center mb-1">{label}</p>}
      {/* One row that fans (cards overlap) when space runs short, so a full hand
          of big cards still fits; `wrap` lays cards out in rows instead. */}
      <div className={`flex justify-center gap-1 ${wrap ? 'flex-wrap' : ''}`}>
        {cards.map((card, i) => {
          const playable = legal.some(c => c.id === card.id);
          const last = i === cards.length - 1;
          return (
            <div key={card.id}
              className={`relative ${wrap || last ? 'shrink-0' : 'min-w-0'} ${selected === card.id ? 'z-10' : ''}`}>
              {renderCard(card, {
                selected: selected === card.id,
                disabled: !playable,
                onClick: playable ? () => tap(card) : undefined,
                size,
              })}
            </div>
          );
        })}
      </div>
      <p className="text-center text-white/50 text-xs mt-1 h-4">
        {selected ? hints.selected : active ? hints.active : ''}
      </p>
    </div>
  );
}
