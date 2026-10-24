/**
 * MtgTable — the Magic screen, drawn from a game view (see mtgEngine.js) in
 * which you are seat 0, at the bottom.
 *
 * Tap any card to read it (and to cast it, play it or use its ability). Spells
 * that need a target ask for one, and the legal choices glow yellow. Cards you
 * can play glow green. Attacking and blocking are done by tapping creatures.
 * A line of advice says what you can do next.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Flag, ScrollText } from 'lucide-react';
import { Button } from '../../components/Button';
import { RulesButton } from '../../components/RulesButton';
import { ResultPanel } from '../cards/GameSetup';
import { useMediaQuery } from '../../utils/useMediaQuery';
import { CardFace, MiniCard, LandTile, ManaCost } from './CardFace';
import {
  defOf, isLand, isCreature, legalTargets, targetSpecs, targetsAvailable, canBlock, sameTarget, manaAvailable, payment,
} from './mtgRules';
import { waitingFor, canCast, canPlayLand, canActivate, instantOptions, attackersFor, describeLog, isMain } from './mtgEngine';
import { deckById } from './decks';

const BG = 'from-[#1b1424] to-[#0d1a14]';

const SPEC_TEXT = {
  any: 'any target (a creature or a player)',
  player: 'a player',
  spell: 'a spell on the stack',
};
function specText(spec) {
  if (spec.kind === 'creature') {
    const bits = [];
    if (spec.combat === 'blocking') bits.push('blocking');
    if (spec.combat === 'attackingOrBlocking') bits.push('attacking or blocking');
    if (spec.nonColor === 'B') bits.push('nonblack');
    let t = `a ${bits.join(' ')} creature`.replace('a  ', 'a ').replace(/a ([aeiou])/, 'an $1');
    if (spec.flying) t += ' with flying';
    if (spec.controller === 'you') t += ' you control';
    if (spec.controller === 'opp') t += ' you don\'t control';
    return t;
  }
  if (spec.kind === 'player' && spec.opp) return 'an opponent';
  if (spec.kind === 'spell' && spec.creature === true) return 'a creature spell';
  if (spec.kind === 'spell' && spec.creature === false) return 'a noncreature spell';
  if (spec.kind === 'card') return spec.cardType === 'Creature' ? 'a creature card in your graveyard' : 'an instant or sorcery card in your graveyard';
  return SPEC_TEXT[spec.kind];
}

/** Why you can't play this card from your hand right now. */
function whyNot(view, card) {
  const def = defOf(card);
  const myMain = view.active === 0 && isMain(view);
  if (isLand(def)) {
    if (view.seats[0].landsPlayed >= 1) return 'You\'ve already played a land this turn (one per turn).';
    if (!myMain) return 'Lands can only be played in your own main phase.';
    return 'Finish what\'s on the stack first.';
  }
  if (def.type !== 'Instant' && !myMain) return 'This can only be cast in your own main phase (only instants can be cast at other times).';
  if (def.type !== 'Instant' && view.stack.length) return 'Wait for the stack to resolve first.';
  if (!payment(view, 0, def.cost)) return `Not enough mana: you have ${manaAvailable(view, 0)} untapped mana, of the right colors for some costs.`;
  if (!isCreature(def) && !targetsAvailable(view, 0, targetSpecs(def))) return 'There\'s nothing for it to target.';
  if (waitingFor(view) !== 0) return 'Wait for your chance to act.';
  return null;
}

/**
 * @param view   the game as you see it (viewFor(game, 0))
 * @param names  [you, opponent]
 */
export function MtgTable({ view, names, onAction, onExit, error, subtitle, reactions = {}, overlay, gameOverActions }) {
  const big = useMediaQuery('(min-width: 768px)');
  const huge = useMediaQuery('(min-width: 1100px) and (min-height: 800px)');
  const W = huge ? 88 : big ? 76 : 56;                  // battlefield card width
  const HW = huge ? 100 : big ? 88 : 64;                // hand card width

  const [detail, setDetail] = useState(null);           // { card, p } to read
  const [targeting, setTargeting] = useState(null);     // { action, specs, chosen, name }
  const [attackers, setAttackers] = useState(null);     // Set of ids while choosing attackers
  const [blocks, setBlocks] = useState([]);             // [{ blocker, attacker }] while blocking
  const [blocker, setBlocker] = useState(null);         // a blocker picked, waiting for its attacker
  const [picked, setPicked] = useState([]);             // cards chosen to discard / put on the bottom
  const [showLog, setShowLog] = useState(false);
  const [showGy, setShowGy] = useState(null);           // seat whose graveyard you're looking at
  const [confirmResign, setConfirmResign] = useState(false);

  const me = view.seats[0], opp = view.seats[1];
  const myMove = waitingFor(view) === 0;
  const over = view.phase === 'gameOver';
  const pending = view.pending?.seat === 0 ? view.pending : null;
  const sorcery = myMove && !pending && view.active === 0 && isMain(view) && !view.stack.length;
  const blocking = myMove && view.step === 'declareBlockers';
  const top = view.stack[view.stack.length - 1];

  const send = action => {
    setDetail(null); setTargeting(null); setAttackers(null); setBlocker(null);
    onAction({ seat: 0, ...action });
  };

  // ── What can be done ──
  const spec = targeting ? targeting.specs[targeting.chosen.length] : null;
  const legal = useMemo(() => (spec ? legalTargets(view, 0, spec) : []), [view, spec]);
  const isTarget = ref => legal.some(r => sameTarget(r, ref));
  const playable = card => myMove && !pending && !targeting && !attackers && (canPlayLand(view, 0, card) || canCast(view, 0, card));
  const canAttackWith = useMemo(() => (sorcery && view.step === 'main1' ? attackersFor(view).filter(p => p.controller === 0) : []), [view, sorcery]);
  const combatIds = new Set(view.combat?.attackers.map(a => a.id) ?? []);
  const blockerOf = id => view.combat?.attackers.find(a => a.blockers.includes(id));

  // ── Starting actions ──
  const startTargets = (action, specs, name, creature) => {
    if (!specs.length || (creature && !targetsAvailable(view, 0, specs))) return send({ ...action, targets: specs.map(() => null) });
    setDetail(null);
    setTargeting({ action, specs, chosen: [], name });
  };
  const cast = card => {
    const def = defOf(card);
    if (isLand(def)) return send({ type: 'play', card: card.id });
    startTargets({ type: 'cast', card: card.id }, targetSpecs(def), card.name, isCreature(def));
  };
  const activate = (p, i) => startTargets({ type: 'activate', perm: p.id, ability: i }, defOf(p).abilities[i].targets ?? [], p.name, false);

  const choose = ref => {
    const chosen = [...targeting.chosen, ref];
    if (chosen.length === targeting.specs.length) return send({ ...targeting.action, targets: chosen });
    setTargeting({ ...targeting, chosen });
  };

  // ── Taps ──
  const tapPerm = p => {
    const ref = { type: 'perm', id: p.id };
    if (targeting) { if (isTarget(ref)) choose(ref); return; }
    if (attackers) {
      if (!canAttackWith.some(x => x.id === p.id)) return setDetail({ card: p, p });
      const next = new Set(attackers);
      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
      return setAttackers(next);
    }
    if (blocking) {
      if (p.controller === 0 && isCreature(defOf(p))) {
        if (blocks.some(b => b.blocker === p.id)) { setBlocks(blocks.filter(b => b.blocker !== p.id)); return setBlocker(null); }
        if (view.combat.attackers.some(a => { const att = view.battlefield.find(x => x.id === a.id); return att && canBlock(view, p, att); })) return setBlocker(p.id);
      }
      if (p.controller === 1 && combatIds.has(p.id) && blocker) {
        const b = view.battlefield.find(x => x.id === blocker);
        if (canBlock(view, b, p)) { setBlocks([...blocks, { blocker, attacker: p.id }]); return setBlocker(null); }
      }
    }
    setDetail({ card: p, p });
  };
  const tapPlayer = seat => {
    const ref = { type: 'player', seat };
    if (targeting && isTarget(ref)) choose(ref);
  };
  const tapStack = item => {
    const ref = { type: 'stack', id: item.id };
    if (targeting) { if (isTarget(ref)) choose(ref); return; }
    if (item.card) setDetail({ card: item.card });
  };

  // ── Glows and labels ──
  const permGlow = p => {
    if (targeting) return isTarget({ type: 'perm', id: p.id }) ? 'target' : null;
    if (attackers) return attackers.has(p.id) ? 'attacking' : canAttackWith.some(x => x.id === p.id) ? 'play' : null;
    if (blocking) {
      if (p.id === blocker) return 'selected';
      if (blocks.some(b => b.blocker === p.id)) return 'blocking';
      if (combatIds.has(p.id)) return blocker ? 'target' : 'attacking';
      return null;
    }
    if (combatIds.has(p.id)) return 'attacking';
    if (blockerOf(p.id)) return 'blocking';
    if (myMove && !pending && (defOf(p).abilities ?? []).some((_, i) => canActivate(view, 0, p, i))) return 'play';
    return null;
  };
  const permLabel = p => {
    const b = blocking ? blocks.find(x => x.blocker === p.id) : null;
    const att = b ? view.battlefield.find(x => x.id === b.attacker) : blockerOf(p.id) ? view.battlefield.find(x => x.id === blockerOf(p.id).id) : null;
    if (att) return `🛡 ${att.name}`;
    if (combatIds.has(p.id) || attackers?.has(p.id)) return '⚔️ attacking';
    const auras = view.battlefield.filter(x => x.attachedTo === p.id);
    if (auras.length) return `✨ ${auras.map(a => a.name).join(', ')}`;
    return null;
  };

  // ── Status and advice ──
  const status = (() => {
    if (over) return '';
    if (targeting) return `${targeting.name}: choose ${specText(spec)}.`;
    if (attackers) return 'Tap the creatures you want to attack with (red), then Attack.';
    if (blocking) return blocker ? 'Now tap the attacker it should block.' : `${names[1]} is attacking! To block, tap one of your creatures, then an attacker. Then tap Done.`;
    if (!myMove) {
      if (view.pending?.seat === 1) return view.pending.type === 'mulligan' ? `${names[1]} is looking at their opening hand…` : `${names[1]} is choosing cards…`;
      return `${names[1]} is thinking…`;
    }
    if (pending) return '';
    if (top && top.controller === 1) return `${names[1]} is ${top.card ? `casting ${top.card.name}` : `using ${top.sourceName}`}. You can respond with an instant, or tap OK.`;
    if (top) return `Your ${top.card?.name ?? top.sourceName} is waiting to resolve. Tap OK.`;
    if (view.step === 'attacks') return `${names[1]} is attacking. Cast an instant before blocking, or tap OK.`;
    if (view.step === 'blocks') return 'Blockers are set. Cast a combat trick now, or tap OK for combat damage.';
    if (view.step === 'end') return `${names[1]}'s turn is ending: last chance for instants. Tap OK when done.`;
    if (view.step === 'main1') return 'Your turn: play a land, cast spells, then attack.';
    if (view.step === 'main2') return 'After combat: cast more spells, then tap End turn.';
    return '';
  })();

  const advice = (() => {
    if (!sorcery || targeting || attackers) return [];
    const out = [];
    if (me.hand.some(c => canPlayLand(view, 0, c))) out.push('You can play a land: tap it in your hand.');
    if (me.hand.some(c => !isLand(defOf(c)) && canCast(view, 0, c))) out.push('Green-glowing cards can be cast. Tap one to read it.');
    if (canAttackWith.length) out.push(`You have ${canAttackWith.length} creature${canAttackWith.length > 1 ? 's' : ''} that can attack.`);
    return out;
  })();

  const okButton = myMove && !pending && !sorcery && !blocking && !targeting;
  const responses = okButton ? instantOptions(view, 0) : [];
  const logLines = view.log.slice(-3).reverse();

  // ── Pieces of the screen ──
  const battlefield = seat => {
    const mine = view.battlefield.filter(p => p.controller === seat && !defOf(p).aura);
    const lands = mine.filter(p => isLand(defOf(p)));
    const others = mine.filter(p => !isLand(defOf(p)));
    const landRow = (
      <div className="flex flex-wrap gap-1 justify-center min-h-[2rem]">
        {lands.map(p => <LandTile key={p.id} p={p} size={big ? 34 : 26} onClick={() => setDetail({ card: p, p })} />)}
      </div>
    );
    const creatureRow = (
      <div className="flex flex-wrap gap-2 justify-center items-center" style={{ minHeight: W * 1.36 }}>
        {others.map(p => (
          <MiniCard key={p.id} card={p} p={p} s={view} width={W} glow={permGlow(p)} label={permLabel(p)} onClick={() => tapPerm(p)} />
        ))}
      </div>
    );
    return <div className="flex flex-col gap-2 w-full">{seat === 1 ? <>{landRow}{creatureRow}</> : <>{creatureRow}{landRow}</>}</div>;
  };

  const playerBar = seat => {
    const p = view.seats[seat];
    const ref = { type: 'player', seat };
    const glow = targeting && isTarget(ref);
    const deck = deckById(p.deck);
    const active = waitingFor(view) === seat;
    return (
      <div className={`flex items-center gap-3 text-sm px-3 py-1 rounded-full transition-all ${active ? 'bg-white/15' : ''}`}
        style={{ boxShadow: glow ? '0 0 0 3px #facc15, 0 0 14px #facc15' : 'none' }}
        onClick={() => tapPlayer(seat)}>
        <span className={`font-bold ${active ? 'text-game-gold' : 'text-white/90'}`}>{names[seat]}</span>
        <span className="font-bold text-red-300 text-base">❤️ {p.life}</span>
        <span className="text-white/60" title="Cards in hand">✋ {p.hand.length}</span>
        <span className="text-white/60" title="Cards left in library">📚 {p.library}</span>
        <button type="button" className="text-white/60 underline decoration-dotted" title="Graveyard" onClick={e => { e.stopPropagation(); setShowGy(seat); }}>
          🪦 {p.graveyard.length}
        </button>
        {deck && <span className="hidden md:inline text-white/40 text-xs">{deck.name}</span>}
        {reactions[seat] && <span>{reactions[seat]}</span>}
        {glow && <span className="text-yellow-300 font-semibold text-xs">tap to target</span>}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${BG} p-2 md:p-3 flex flex-col items-center gap-1.5 select-none text-white`}>
      <header className="self-stretch flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onExit} className="p-2 text-white/50 hover:text-white min-h-[44px] min-w-[44px]" aria-label="Back to games">
            <ArrowLeft size={20} />
          </button>
          <RulesButton game="mtg" title="Magic" />
          <button onClick={() => setShowLog(true)} aria-label="Game log"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold min-h-[36px]">
            <ScrollText size={14} /> <span className="hidden md:inline">Log</span>
          </button>
        </div>
        <div className="text-white/80 text-sm font-semibold">Magic{subtitle ? ` · ${subtitle}` : ''} · Turn {view.turnNo}</div>
        <div className="text-white/70 text-xs text-right font-semibold">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}</div>
      </header>

      {/* The opponent */}
      {playerBar(1)}
      <div className="flex gap-0.5 -mt-1">
        {opp.hand.map(c => <div key={c.id} className="w-4 h-6 md:w-5 md:h-7 rounded-sm bg-gradient-to-br from-amber-800 to-amber-950 border border-amber-600/50" />)}
      </div>
      {battlefield(1)}

      {/* The middle: the stack, what's happening, what to do */}
      <div className="w-full max-w-3xl flex flex-col items-center gap-1 py-1 border-y border-white/10">
        {view.stack.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-white/50 uppercase tracking-wide">Stack</span>
            {[...view.stack].reverse().map((item, i) => (
              <div key={item.id} className="flex flex-col items-center">
                <MiniCard card={item.card ?? { name: item.sourceName, token: item.sourceToken }} width={W * 0.8}
                  glow={targeting && isTarget({ type: 'stack', id: item.id }) ? 'target' : i === 0 ? 'selected' : null}
                  onClick={() => tapStack(item)} />
                <span className="text-[10px] text-white/60 mt-0.5 max-w-[7rem] text-center leading-tight">
                  {names[item.controller]}{item.kind === 'ability' ? '\'s ability' : ''}
                  {item.targets.filter(Boolean).length ? ` → ${item.targets.filter(Boolean).map(t => targetName(view, t, names)).join(', ')}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className={`font-semibold text-center text-sm md:text-base ${error ? 'text-red-300' : targeting ? 'text-yellow-300' : 'text-white/90'}`}>{error || status}</p>
        {advice.map(t => <p key={t} className="text-xs text-green-300/90 text-center">💡 {t}</p>)}
        <div className="text-xs text-white/50 text-center leading-snug">
          {logLines.map(e => <div key={e.n}>{describeLog(e, names)}</div>)}
        </div>
        <div className="flex gap-2 flex-wrap justify-center mt-1">
          {targeting && (
            <>
              {spec?.optional && <Button variant="ghost" onClick={() => choose(null)}>No target</Button>}
              {spec?.kind === 'card' && <Button variant="gold" onClick={() => setShowGy(0)}>Choose from graveyard</Button>}
              <Button variant="ghost" onClick={() => setTargeting(null)}>Cancel</Button>
            </>
          )}
          {attackers && (
            <>
              <Button variant="danger" disabled={!attackers.size} onClick={() => send({ type: 'attack', attackers: [...attackers] })}>⚔️ Attack with {attackers.size}</Button>
              <Button variant="ghost" onClick={() => setAttackers(new Set(canAttackWith.map(p => p.id)))}>All</Button>
              <Button variant="ghost" onClick={() => setAttackers(null)}>Cancel</Button>
            </>
          )}
          {sorcery && !targeting && !attackers && (
            <>
              {view.step === 'main1' && canAttackWith.length > 0 && <Button variant="danger" onClick={() => setAttackers(new Set())}>⚔️ Attack</Button>}
              <Button variant="ghost" onClick={() => send({ type: 'endTurn' })}>End turn</Button>
            </>
          )}
          {blocking && (
            <Button variant="gold" onClick={() => { const b = blocks; setBlocks([]); send({ type: 'block', blocks: b }); }}>
              {blocks.length ? `🛡 Done blocking (${blocks.length})` : 'No blocks'}
            </Button>
          )}
          {okButton && <Button variant="gold" onClick={() => send({ type: 'pass' })}>OK{responses.length ? '' : ' →'}</Button>}
        </div>
      </div>

      {/* You */}
      {battlefield(0)}
      {playerBar(0)}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex gap-1.5 justify-center min-w-max px-2 pt-1">
          {me.hand.map(c => (
            <MiniCard key={c.id} card={c} width={HW} glow={playable(c) ? 'play' : null} onClick={() => setDetail({ card: c, inHand: true })} />
          ))}
        </div>
      </div>
      {!over && (
        <button className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full ${confirmResign ? 'bg-red-600 text-white' : 'text-white/40'}`}
          onClick={() => {
            if (!confirmResign) { setConfirmResign(true); setTimeout(() => setConfirmResign(false), 3000); return; }
            setConfirmResign(false); onAction({ type: 'resign', seat: 0 });
          }}>
          <Flag size={12} /> {confirmResign ? 'Tap again to concede' : 'Concede'}
        </button>
      )}
      {overlay}

      {/* Reading a card */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <CardFace card={detail.card} p={detail.p} s={detail.p ? view : null} width={big ? 280 : 240} />
          <div className="flex flex-col gap-2 w-full max-w-[280px]">
            {detail.inHand && (() => {
              const card = detail.card;
              if (playable(card)) {
                return <Button variant="primary" onClick={() => cast(card)}>{isLand(defOf(card)) ? 'Play land' : <>Cast <ManaCost cost={defOf(card).cost} size={16} /></>}</Button>;
              }
              const why = whyNot(view, card);
              return why && <p className="text-white/70 text-sm text-center">{why}</p>;
            })()}
            {detail.p && (defOf(detail.p).abilities ?? []).map((ab, i) => (
              canActivate(view, 0, detail.p, i)
                ? <Button key={i} variant="primary" onClick={() => activate(detail.p, i)}>Use: {ab.cost && <ManaCost cost={ab.cost} />}{ab.tap ? ' tap' : ''} → {ab.label}</Button>
                : detail.p.controller === 0 && <p key={i} className="text-white/50 text-xs text-center">Its ability ({ab.label}) can't be used right now.</p>
            ))}
            {detail.p && view.battlefield.filter(x => x.attachedTo === detail.p.id).map(a => (
              <Button key={a.id} variant="ghost" onClick={() => setDetail({ card: a, p: a })}>✨ Enchanted by {a.name}</Button>
            ))}
            {detail.p?.attachedTo && (() => {
              const host = view.battlefield.find(x => x.id === detail.p.attachedTo);
              return host && <p className="text-white/60 text-xs text-center">Attached to {host.name}</p>;
            })()}
            {detail.p?.tapped && <p className="text-white/50 text-xs text-center">Tapped (turned sideways): it untaps at the start of its controller's turn.</p>}
            <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* Graveyards (and choosing a card from yours as a target) */}
      {showGy != null && (
        <Modal onClose={() => setShowGy(null)}>
          <h3 className="text-game-gold font-bold">{showGy === 0 ? 'Your graveyard' : `${names[1]}'s graveyard`}</h3>
          {targeting && spec?.kind === 'card' && showGy === 0 && <p className="text-yellow-300 text-sm">Choose {specText(spec)}.</p>}
          <div className="flex flex-wrap gap-2 justify-center max-h-[60vh] overflow-y-auto p-1">
            {view.seats[showGy].graveyard.length === 0 && <p className="text-white/50 text-sm">Empty</p>}
            {view.seats[showGy].graveyard.map(c => {
              const ref = { type: 'card', id: c.id };
              const pickable = targeting && showGy === 0 && isTarget(ref);
              return <MiniCard key={c.id} card={c} width={W} glow={pickable ? 'target' : null}
                onClick={() => { if (pickable) { setShowGy(null); choose(ref); } else setDetail({ card: c }); }} />;
            })}
          </div>
          <Button variant="ghost" onClick={() => setShowGy(null)}>Close</Button>
        </Modal>
      )}

      {/* The log */}
      {showLog && (
        <Modal onClose={() => setShowLog(false)}>
          <h3 className="text-game-gold font-bold">What's happened</h3>
          <div className="max-h-[60vh] overflow-y-auto text-sm text-white/80 w-full max-w-md space-y-1">
            {[...view.log].reverse().map(e => <div key={e.n}>{describeLog(e, names)}</div>)}
          </div>
          <Button variant="ghost" onClick={() => setShowLog(false)}>Close</Button>
        </Modal>
      )}

      {/* Choices: opening hand, cards to the bottom, discards */}
      {pending && !over && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="card-panel max-w-2xl w-full flex flex-col items-center gap-3">
            {pending.type === 'mulligan' ? (
              <>
                <h2 className="text-xl font-bold text-game-gold">Your opening hand</h2>
                <p className="text-white/70 text-sm text-center">
                  {me.hand.filter(c => isLand(defOf(c))).length} lands. A good hand usually has 2–5 lands.
                  {me.mulligans > 0 && ` After keeping, you'll put ${me.mulligans} card${me.mulligans > 1 ? 's' : ''} on the bottom.`}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {me.hand.map(c => <MiniCard key={c.id} card={c} width={HW} onClick={() => setDetail({ card: c })} />)}
                </div>
                <div className="flex gap-3">
                  <Button variant="gold" onClick={() => send({ type: 'keep' })}>Keep</Button>
                  {me.mulligans < 6 && <Button variant="ghost" onClick={() => send({ type: 'mulligan' })}>Mulligan (new hand)</Button>}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-game-gold">
                  {pending.type === 'bottom' ? `Put ${pending.count} card${pending.count > 1 ? 's' : ''} on the bottom of your library`
                    : `Discard ${pending.count} card${pending.count > 1 ? 's' : ''}`}
                </h2>
                <p className="text-white/60 text-sm">
                  {pending.reason === 'handSize' ? 'You can only keep seven cards in hand at the end of your turn.' : 'Tap cards to choose them.'}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {me.hand.map(c => (
                    <MiniCard key={c.id} card={c} width={HW} glow={picked.includes(c.id) ? 'selected' : null}
                      onClick={() => setPicked(picked.includes(c.id) ? picked.filter(x => x !== c.id) : picked.length < pending.count ? [...picked, c.id] : picked)} />
                  ))}
                </div>
                <Button variant="gold" disabled={picked.length !== pending.count}
                  onClick={() => { const cards = picked; setPicked([]); send({ type: 'choose', cards }); }}>
                  Done ({picked.length}/{pending.count})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {over && (
        <ResultPanel>
          <div className="text-5xl mb-2">{view.winner === 0 ? '🏆' : view.winner == null ? '🤝' : '😢'}</div>
          <h2 className="text-2xl font-bold text-game-gold mb-1">
            {view.winner == null ? 'It\'s a draw' : view.winner === 0 ? 'You win!' : `${names[1]} wins!`}
          </h2>
          <p className="text-white/60 text-sm mb-3">
            {view.reason === 'resigned' ? `${view.winner === 0 ? names[1] : 'You'} conceded.`
              : view.reason === 'deck' ? `${view.winner === 0 ? names[1] : 'You'} had to draw from an empty library.`
                : view.reason === 'draw' ? 'Both players lost at the same time.'
                  : `${view.winner === 0 ? `${names[1]} is` : 'You are'} out of life.`}
          </p>
          <p className="text-white/80 text-sm mb-4">{names[0]} {view.wins[0]} · {names[1]} {view.wins[1]}</p>
          {gameOverActions}
        </ResultPanel>
      )}
    </div>
  );
}

function targetName(view, t, names) {
  if (t.type === 'player') return t.seat === 0 ? 'you' : names[1];
  if (t.type === 'perm') return view.battlefield.find(p => p.id === t.id)?.name ?? '?';
  if (t.type === 'stack') return view.stack.find(i => i.id === t.id)?.card?.name ?? '?';
  return view.seats.flatMap(p => p.graveyard).find(c => c.id === t.id)?.name ?? '?';
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="flex flex-col items-center gap-3 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

