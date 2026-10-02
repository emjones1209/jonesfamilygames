/**
 * Covers a game that needs a tall screen (melds, trains) when a phone is turned
 * sideways, asking for it to be turned back. Pure CSS (Tailwind's `short:`), so
 * it comes and goes as the phone turns.
 */
export function TurnUpright({ game }) {
  return (
    <div className="hidden short:flex fixed inset-0 z-40 bg-game-bg/95 flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="text-5xl">📱↻</div>
      <p className="text-white text-lg font-semibold">Turn your phone upright to play {game}</p>
      <p className="text-white/50 text-sm">There isn&apos;t room for everything with it sideways.</p>
    </div>
  );
}
