/**
 * CardHand — the player's hand. Tap a card to select it, tap again to play.
 * Cards that can't be played right now are dimmed and ignore taps.
 */
import { useState } from 'react';
import { PlayingCard } from '../../components/PlayingCard';

const defaultRender = (card, { selected, disabled, onClick, size }) => (
  <PlayingCard card={{ ...card, faceUp: true }} size={size} selected={selected} disabled={disabled} onClick={onClick} />
);

export function CardHand({
  cards,
  legal = [],            // cards playable now (empty when it isn't your turn)
  onPlay,
  size = 'sm',
  renderCard = defaultRender,
  label,
}) {
  const [selectedId, setSelectedId] = useState(null);
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
      <div className="flex flex-wrap justify-center gap-1">
        {cards.map(card => {
          const playable = legal.some(c => c.id === card.id);
          return (
            <div key={card.id}>
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
        {selected ? 'Tap again to play' : active ? 'Your turn — pick a card' : ''}
      </p>
    </div>
  );
}
