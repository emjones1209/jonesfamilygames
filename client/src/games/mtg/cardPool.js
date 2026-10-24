/**
 * The Magic cards in the game: real cards with their Oracle text, each with a
 * description the rules engine can carry out (see mtgRules.js / mtgEngine.js).
 * No card art: card faces are drawn by the app.
 *
 *   cost      mana cost, e.g. '{2}{W}{W}'
 *   type      'Creature' | 'Instant' | 'Sorcery' | 'Enchantment' | 'Basic Land'
 *   sub       subtypes ('Aura' for auras)
 *   pt        [power, toughness]
 *   kw        keywords: flying, reach, firstStrike, doubleStrike, trample, haste,
 *             vigilance, lifelink, deathtouch, defender, menace, shroud,
 *             plus cantBlock and unblockable (written out in the text)
 *   mana      a land's or creature's "{T}: Add {G}."
 *   targets   what a spell (or a creature's "enters" ability) targets, chosen on casting:
 *               { kind: 'creature', controller?: 'you'|'opp', nonColor?, flying?, combat?: 'attackingOrBlocking'|'blocking' }
 *               { kind: 'player', opp? } · { kind: 'any' } (creature or player)
 *               { kind: 'spell', creature?: true|false }
 *               { kind: 'card', cardType: 'Creature'|'InstantSorcery' } (in your graveyard)
 *             optional: true means "you may" / "up to one"
 *   effect    what it does, in order (see `resolveEffect` in mtgEngine.js); `to`/`what` is
 *             the index of a target, or 'self' / 'you' / 'opp'
 *   etb       a creature's "When ~ enters" effect (its targets go in `targets`)
 *   aura      { grant: { p, t, cantAttack, cantBlock, noUntap }, tapOnEnter }
 *   anthem    { others?: true, p, t } creatures you control get +p/+t
 *   abilities activated abilities: [{ cost, tap, targets, effect, label }]
 *   onSpell   "Whenever you cast an instant or sorcery spell" effect
 *   entersTapped
 */

const ANY = { kind: 'any' };
const CREATURE = { kind: 'creature' };

export const CARDS = {
  // ── Basic lands ────────────────────────────────────────────────────────────
  Plains: { type: 'Basic Land', sub: 'Plains', mana: 'W', text: '({T}: Add {W}.)' },
  Island: { type: 'Basic Land', sub: 'Island', mana: 'U', text: '({T}: Add {U}.)' },
  Swamp: { type: 'Basic Land', sub: 'Swamp', mana: 'B', text: '({T}: Add {B}.)' },
  Mountain: { type: 'Basic Land', sub: 'Mountain', mana: 'R', text: '({T}: Add {R}.)' },
  Forest: { type: 'Basic Land', sub: 'Forest', mana: 'G', text: '({T}: Add {G}.)' },

  // ── White ──────────────────────────────────────────────────────────────────
  'Savannah Lions': { cost: '{W}', type: 'Creature', sub: 'Cat', pt: [2, 1], text: '' },
  'Elite Vanguard': { cost: '{W}', type: 'Creature', sub: 'Human Soldier', pt: [2, 1], text: '' },
  'Suntail Hawk': { cost: '{W}', type: 'Creature', sub: 'Bird', pt: [1, 1], kw: ['flying'], text: 'Flying' },
  "Healer's Hawk": { cost: '{W}', type: 'Creature', sub: 'Bird', pt: [1, 1], kw: ['flying', 'lifelink'], text: 'Flying, lifelink' },
  'Youthful Knight': { cost: '{1}{W}', type: 'Creature', sub: 'Human Knight', pt: [2, 1], kw: ['firstStrike'], text: 'First strike' },
  'Knight of Meadowgrain': { cost: '{W}{W}', type: 'Creature', sub: 'Kithkin Knight', pt: [2, 2], kw: ['firstStrike', 'lifelink'], text: 'First strike, lifelink' },
  'Mesa Unicorn': { cost: '{1}{W}', type: 'Creature', sub: 'Unicorn', pt: [2, 2], kw: ['lifelink'], text: 'Lifelink' },
  'Attended Knight': {
    cost: '{2}{W}', type: 'Creature', sub: 'Human Knight', pt: [2, 2], kw: ['firstStrike'],
    text: 'First strike\nWhen Attended Knight enters, create a 1/1 white Soldier creature token.',
    etb: [{ do: 'token', n: 1, token: 'Soldier' }],
  },
  'Pillarfield Ox': { cost: '{3}{W}', type: 'Creature', sub: 'Ox', pt: [2, 4], text: '' },
  'Benalish Marshal': {
    cost: '{W}{W}{W}', type: 'Creature', sub: 'Human Knight', pt: [3, 3],
    text: 'Other creatures you control get +1/+1.', anthem: { others: true, p: 1, t: 1 },
  },
  'Angel of Mercy': {
    cost: '{4}{W}', type: 'Creature', sub: 'Angel', pt: [3, 3], kw: ['flying'],
    text: 'Flying\nWhen Angel of Mercy enters, you gain 3 life.', etb: [{ do: 'gain', n: 3 }],
  },
  'Serra Angel': { cost: '{3}{W}{W}', type: 'Creature', sub: 'Angel', pt: [4, 4], kw: ['flying', 'vigilance'], text: 'Flying, vigilance' },
  'Glorious Anthem': { cost: '{1}{W}{W}', type: 'Enchantment', text: 'Creatures you control get +1/+1.', anthem: { p: 1, t: 1 } },
  Pacifism: {
    cost: '{1}{W}', type: 'Enchantment', sub: 'Aura', text: 'Enchant creature\nEnchanted creature can\'t attack or block.',
    targets: [CREATURE], aura: { grant: { cantAttack: true, cantBlock: true } },
  },
  'Holy Strength': {
    cost: '{W}', type: 'Enchantment', sub: 'Aura', text: 'Enchant creature\nEnchanted creature gets +1/+2.',
    targets: [CREATURE], aura: { grant: { p: 1, t: 2 } },
  },
  'Swords to Plowshares': {
    cost: '{W}', type: 'Instant', text: 'Exile target creature. Its controller gains life equal to its power.',
    targets: [CREATURE], effect: [{ do: 'exile', what: 0, lifeForPower: true }],
  },
  'Raise the Alarm': {
    cost: '{1}{W}', type: 'Instant', text: 'Create two 1/1 white Soldier creature tokens.',
    effect: [{ do: 'token', n: 2, token: 'Soldier' }],
  },
  'Inspired Charge': {
    cost: '{2}{W}{W}', type: 'Instant', text: 'Creatures you control get +2/+1 until end of turn.',
    effect: [{ do: 'pumpAll', p: 2, t: 1 }],
  },
  'Divine Verdict': {
    cost: '{3}{W}', type: 'Instant', text: 'Destroy target attacking or blocking creature.',
    targets: [{ kind: 'creature', combat: 'attackingOrBlocking' }], effect: [{ do: 'destroy', what: 0 }],
  },
  Righteousness: {
    cost: '{W}', type: 'Instant', text: 'Target blocking creature gets +7/+7 until end of turn.',
    targets: [{ kind: 'creature', combat: 'blocking' }], effect: [{ do: 'pump', what: 0, p: 7, t: 7 }],
  },

  // ── Blue ───────────────────────────────────────────────────────────────────
  'Coral Merfolk': { cost: '{1}{U}', type: 'Creature', sub: 'Merfolk', pt: [2, 1], text: '' },
  'Wind Drake': { cost: '{2}{U}', type: 'Creature', sub: 'Drake', pt: [2, 2], kw: ['flying'], text: 'Flying' },
  'Cloudkin Seer': {
    cost: '{2}{U}', type: 'Creature', sub: 'Elemental Wizard', pt: [2, 1], kw: ['flying'],
    text: 'Flying\nWhen Cloudkin Seer enters, draw a card.', etb: [{ do: 'draw', n: 1 }],
  },
  "Man-o'-War": {
    cost: '{2}{U}', type: 'Creature', sub: 'Jellyfish', pt: [2, 2],
    text: "When Man-o'-War enters, return target creature to its owner's hand.",
    targets: [CREATURE], etb: [{ do: 'bounce', what: 0 }],
  },
  'Phantom Warrior': {
    cost: '{1}{U}{U}', type: 'Creature', sub: 'Illusion Warrior', pt: [2, 2], kw: ['unblockable'],
    text: 'Phantom Warrior can\'t be blocked.',
  },
  'Wall of Air': { cost: '{1}{U}{U}', type: 'Creature', sub: 'Wall', pt: [1, 5], kw: ['defender', 'flying'], text: 'Defender, flying' },
  'Air Elemental': { cost: '{3}{U}{U}', type: 'Creature', sub: 'Elemental', pt: [4, 4], kw: ['flying'], text: 'Flying' },
  'Mahamoti Djinn': { cost: '{4}{U}{U}', type: 'Creature', sub: 'Djinn', pt: [5, 6], kw: ['flying'], text: 'Flying' },
  Counterspell: {
    cost: '{U}{U}', type: 'Instant', text: 'Counter target spell.',
    targets: [{ kind: 'spell' }], effect: [{ do: 'counter', what: 0 }],
  },
  Cancel: {
    cost: '{1}{U}{U}', type: 'Instant', text: 'Counter target spell.',
    targets: [{ kind: 'spell' }], effect: [{ do: 'counter', what: 0 }],
  },
  'Essence Scatter': {
    cost: '{1}{U}', type: 'Instant', text: 'Counter target creature spell.',
    targets: [{ kind: 'spell', creature: true }], effect: [{ do: 'counter', what: 0 }],
  },
  Negate: {
    cost: '{1}{U}', type: 'Instant', text: 'Counter target noncreature spell.',
    targets: [{ kind: 'spell', creature: false }], effect: [{ do: 'counter', what: 0 }],
  },
  Unsummon: {
    cost: '{U}', type: 'Instant', text: "Return target creature to its owner's hand.",
    targets: [CREATURE], effect: [{ do: 'bounce', what: 0 }],
  },
  Divination: { cost: '{2}{U}', type: 'Sorcery', text: 'Draw two cards.', effect: [{ do: 'draw', n: 2 }] },
  Claustrophobia: {
    cost: '{1}{U}{U}', type: 'Enchantment', sub: 'Aura',
    text: 'Enchant creature\nWhen Claustrophobia enters, tap enchanted creature.\nEnchanted creature doesn\'t untap during its controller\'s untap step.',
    targets: [CREATURE], aura: { grant: { noUntap: true }, tapOnEnter: true },
  },

  // ── Black ──────────────────────────────────────────────────────────────────
  'Typhoid Rats': { cost: '{B}', type: 'Creature', sub: 'Rat', pt: [1, 1], kw: ['deathtouch'], text: 'Deathtouch' },
  'Diregraf Ghoul': { cost: '{B}', type: 'Creature', sub: 'Zombie', pt: [2, 2], entersTapped: true, text: 'Diregraf Ghoul enters tapped.' },
  'Child of Night': { cost: '{1}{B}', type: 'Creature', sub: 'Vampire', pt: [2, 1], kw: ['lifelink'], text: 'Lifelink' },
  'Walking Corpse': { cost: '{1}{B}', type: 'Creature', sub: 'Zombie', pt: [2, 2], text: '' },
  'Vampire Nighthawk': {
    cost: '{1}{B}{B}', type: 'Creature', sub: 'Vampire Shaman', pt: [2, 3], kw: ['flying', 'deathtouch', 'lifelink'],
    text: 'Flying, deathtouch, lifelink',
  },
  'Dread Shade': {
    cost: '{B}{B}{B}', type: 'Creature', sub: 'Shade', pt: [3, 3], text: '{B}: Dread Shade gets +1/+1 until end of turn.',
    abilities: [{ cost: '{B}', effect: [{ do: 'pump', what: 'self', p: 1, t: 1 }], label: '+1/+1' }],
  },
  Gravedigger: {
    cost: '{3}{B}', type: 'Creature', sub: 'Zombie', pt: [2, 2],
    text: 'When Gravedigger enters, you may return target creature card from your graveyard to your hand.',
    targets: [{ kind: 'card', cardType: 'Creature', optional: true }], etb: [{ do: 'returnToHand', what: 0 }],
  },
  'Vampire Sovereign': {
    cost: '{3}{B}{B}', type: 'Creature', sub: 'Vampire', pt: [3, 4], kw: ['flying'],
    text: 'Flying\nWhen Vampire Sovereign enters, target opponent loses 3 life and you gain 3 life.',
    targets: [{ kind: 'player', opp: true }], etb: [{ do: 'lose', n: 3, who: 0 }, { do: 'gain', n: 3 }],
  },
  Bogstomper: { cost: '{4}{B}{B}', type: 'Creature', sub: 'Beast', pt: [6, 5], text: '' },
  'Doom Blade': {
    cost: '{1}{B}', type: 'Instant', text: 'Destroy target nonblack creature.',
    targets: [{ kind: 'creature', nonColor: 'B' }], effect: [{ do: 'destroy', what: 0 }],
  },
  Murder: {
    cost: '{1}{B}{B}', type: 'Instant', text: 'Destroy target creature.',
    targets: [CREATURE], effect: [{ do: 'destroy', what: 0 }],
  },
  'Last Gasp': {
    cost: '{1}{B}', type: 'Instant', text: 'Target creature gets -3/-3 until end of turn.',
    targets: [CREATURE], effect: [{ do: 'pump', what: 0, p: -3, t: -3 }],
  },
  'Dead Weight': {
    cost: '{B}', type: 'Enchantment', sub: 'Aura', text: 'Enchant creature\nEnchanted creature gets -2/-2.',
    targets: [CREATURE], aura: { grant: { p: -2, t: -2 } },
  },
  "Night's Whisper": {
    cost: '{1}{B}', type: 'Sorcery', text: 'You draw two cards and you lose 2 life.',
    effect: [{ do: 'draw', n: 2 }, { do: 'lose', n: 2, who: 'you' }],
  },
  'Mind Rot': {
    cost: '{2}{B}', type: 'Sorcery', text: 'Target player discards two cards.',
    targets: [{ kind: 'player' }], effect: [{ do: 'discard', n: 2, who: 0 }],
  },
  'Raise Dead': {
    cost: '{B}', type: 'Sorcery', text: 'Return target creature card from your graveyard to your hand.',
    targets: [{ kind: 'card', cardType: 'Creature' }], effect: [{ do: 'returnToHand', what: 0 }],
  },

  // ── Red ────────────────────────────────────────────────────────────────────
  'Raging Goblin': { cost: '{R}', type: 'Creature', sub: 'Goblin Berserker', pt: [1, 1], kw: ['haste'], text: 'Haste' },
  'Goblin Piker': { cost: '{1}{R}', type: 'Creature', sub: 'Goblin Warrior', pt: [2, 1], kw: ['cantBlock'], text: 'Goblin Piker can\'t block.' },
  'Gray Ogre': { cost: '{2}{R}', type: 'Creature', sub: 'Ogre', pt: [2, 2], text: '' },
  'Prodigal Pyromancer': {
    cost: '{2}{R}', type: 'Creature', sub: 'Human Wizard', pt: [1, 1], text: '{T}: Prodigal Pyromancer deals 1 damage to any target.',
    abilities: [{ tap: true, targets: [ANY], effect: [{ do: 'damage', n: 1, to: 0 }], label: '1 damage' }],
  },
  'Furnace Whelp': {
    cost: '{2}{R}{R}', type: 'Creature', sub: 'Dragon', pt: [2, 2], kw: ['flying'],
    text: 'Flying\n{R}: Furnace Whelp gets +1/+0 until end of turn.',
    abilities: [{ cost: '{R}', effect: [{ do: 'pump', what: 'self', p: 1, t: 0 }], label: '+1/+0' }],
  },
  'Hill Giant': { cost: '{3}{R}', type: 'Creature', sub: 'Giant', pt: [3, 3], text: '' },
  'Flametongue Kavu': {
    cost: '{3}{R}', type: 'Creature', sub: 'Kavu', pt: [4, 2],
    text: 'When Flametongue Kavu enters, it deals 4 damage to target creature.',
    targets: [CREATURE], etb: [{ do: 'damage', n: 4, to: 0 }],
  },
  'Fire Elemental': { cost: '{3}{R}{R}', type: 'Creature', sub: 'Elemental', pt: [5, 4], text: '' },
  'Earth Elemental': { cost: '{3}{R}{R}', type: 'Creature', sub: 'Elemental', pt: [4, 5], text: '' },
  'Shivan Dragon': {
    cost: '{4}{R}{R}', type: 'Creature', sub: 'Dragon', pt: [5, 5], kw: ['flying'],
    text: 'Flying\n{R}: Shivan Dragon gets +1/+0 until end of turn.',
    abilities: [{ cost: '{R}', effect: [{ do: 'pump', what: 'self', p: 1, t: 0 }], label: '+1/+0' }],
  },
  'Lightning Bolt': {
    cost: '{R}', type: 'Instant', text: 'Lightning Bolt deals 3 damage to any target.',
    targets: [ANY], effect: [{ do: 'damage', n: 3, to: 0 }],
  },
  Shock: {
    cost: '{R}', type: 'Instant', text: 'Shock deals 2 damage to any target.',
    targets: [ANY], effect: [{ do: 'damage', n: 2, to: 0 }],
  },
  'Lightning Strike': {
    cost: '{1}{R}', type: 'Instant', text: 'Lightning Strike deals 3 damage to any target.',
    targets: [ANY], effect: [{ do: 'damage', n: 3, to: 0 }],
  },
  'Searing Spear': {
    cost: '{1}{R}', type: 'Instant', text: 'Searing Spear deals 3 damage to any target.',
    targets: [ANY], effect: [{ do: 'damage', n: 3, to: 0 }],
  },
  'Volcanic Hammer': {
    cost: '{1}{R}', type: 'Sorcery', text: 'Volcanic Hammer deals 3 damage to any target.',
    targets: [ANY], effect: [{ do: 'damage', n: 3, to: 0 }],
  },
  'Brute Force': {
    cost: '{R}', type: 'Instant', text: 'Target creature gets +3/+3 until end of turn.',
    targets: [CREATURE], effect: [{ do: 'pump', what: 0, p: 3, t: 3 }],
  },
  'Lava Axe': {
    cost: '{4}{R}', type: 'Sorcery', text: 'Lava Axe deals 5 damage to target player or planeswalker.',
    targets: [{ kind: 'player' }], effect: [{ do: 'damage', n: 5, to: 0 }],
  },
  Pyroclasm: {
    cost: '{1}{R}', type: 'Sorcery', text: 'Pyroclasm deals 2 damage to each creature.',
    effect: [{ do: 'damage', n: 2, to: 'eachCreature' }],
  },

  // ── Green ──────────────────────────────────────────────────────────────────
  'Llanowar Elves': { cost: '{G}', type: 'Creature', sub: 'Elf Druid', pt: [1, 1], mana: 'G', text: '{T}: Add {G}.' },
  'Elvish Mystic': { cost: '{G}', type: 'Creature', sub: 'Elf Druid', pt: [1, 1], mana: 'G', text: '{T}: Add {G}.' },
  'Elvish Visionary': {
    cost: '{1}{G}', type: 'Creature', sub: 'Elf Shaman', pt: [1, 1],
    text: 'When Elvish Visionary enters, draw a card.', etb: [{ do: 'draw', n: 1 }],
  },
  'Grizzly Bears': { cost: '{1}{G}', type: 'Creature', sub: 'Bear', pt: [2, 2], text: '' },
  "Garruk's Companion": { cost: '{G}{G}', type: 'Creature', sub: 'Beast', pt: [3, 2], kw: ['trample'], text: 'Trample' },
  'Kalonian Tusker': { cost: '{G}{G}', type: 'Creature', sub: 'Beast', pt: [3, 3], text: '' },
  'Centaur Courser': { cost: '{2}{G}', type: 'Creature', sub: 'Centaur Warrior', pt: [3, 3], text: '' },
  'Giant Spider': { cost: '{3}{G}', type: 'Creature', sub: 'Spider', pt: [2, 4], kw: ['reach'], text: 'Reach' },
  'Rumbling Baloth': { cost: '{2}{G}{G}', type: 'Creature', sub: 'Beast', pt: [4, 4], text: '' },
  'Craw Wurm': { cost: '{4}{G}{G}', type: 'Creature', sub: 'Wurm', pt: [6, 4], text: '' },
  'Colossal Dreadmaw': { cost: '{4}{G}{G}', type: 'Creature', sub: 'Dinosaur', pt: [6, 6], kw: ['trample'], text: 'Trample' },
  'Duskdale Wurm': { cost: '{5}{G}{G}', type: 'Creature', sub: 'Wurm', pt: [7, 7], kw: ['trample'], text: 'Trample' },
  Gigantosaurus: { cost: '{G}{G}{G}{G}{G}', type: 'Creature', sub: 'Dinosaur', pt: [10, 10], text: '' },
  'Giant Growth': {
    cost: '{G}', type: 'Instant', text: 'Target creature gets +3/+3 until end of turn.',
    targets: [CREATURE], effect: [{ do: 'pump', what: 0, p: 3, t: 3 }],
  },
  'Titanic Growth': {
    cost: '{1}{G}', type: 'Instant', text: 'Target creature gets +4/+4 until end of turn.',
    targets: [CREATURE], effect: [{ do: 'pump', what: 0, p: 4, t: 4 }],
  },
  'Rampant Growth': {
    cost: '{1}{G}', type: 'Sorcery',
    text: 'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
    effect: [{ do: 'fetchLand' }],
  },
  'Prey Upon': {
    cost: '{G}', type: 'Sorcery', text: 'Target creature you control fights target creature you don\'t control.',
    targets: [{ kind: 'creature', controller: 'you' }, { kind: 'creature', controller: 'opp' }], effect: [{ do: 'fight', a: 0, b: 1 }],
  },
  Plummet: {
    cost: '{1}{G}', type: 'Instant', text: 'Destroy target creature with flying.',
    targets: [{ kind: 'creature', flying: true }], effect: [{ do: 'destroy', what: 0 }],
  },
  Overrun: {
    cost: '{2}{G}{G}{G}', type: 'Sorcery', text: 'Creatures you control get +3/+3 and gain trample until end of turn.',
    effect: [{ do: 'pumpAll', p: 3, t: 3, kw: ['trample'] }],
  },

  // ── Two colors ─────────────────────────────────────────────────────────────
  Absorb: {
    cost: '{W}{U}{U}', type: 'Instant', text: 'Counter target spell. You gain 3 life.',
    targets: [{ kind: 'spell' }], effect: [{ do: 'counter', what: 0 }, { do: 'gain', n: 3 }],
  },
  'Wall of Denial': {
    cost: '{1}{W}{U}', type: 'Creature', sub: 'Wall', pt: [0, 8], kw: ['defender', 'flying', 'shroud'],
    text: 'Defender, flying\nShroud (This creature can\'t be the target of spells or abilities.)',
  },
  'Wee Dragonauts': {
    cost: '{1}{U}{R}', type: 'Creature', sub: 'Faerie Wizard', pt: [1, 3], kw: ['flying'],
    text: 'Flying\nWhenever you cast an instant or sorcery spell, Wee Dragonauts gets +2/+0 until end of turn.',
    onSpell: [{ do: 'pump', what: 'self', p: 2, t: 0 }],
  },
  'Izzet Chronarch': {
    cost: '{3}{U}{R}', type: 'Creature', sub: 'Human Wizard', pt: [2, 2],
    text: 'When Izzet Chronarch enters, return target instant or sorcery card from your graveyard to your hand.',
    targets: [{ kind: 'card', cardType: 'InstantSorcery' }], etb: [{ do: 'returnToHand', what: 0 }],
  },
  Terminate: {
    cost: '{B}{R}', type: 'Instant', text: 'Destroy target creature. It can\'t be regenerated.',
    targets: [CREATURE], effect: [{ do: 'destroy', what: 0 }],
  },
  Dreadbore: {
    cost: '{B}{R}', type: 'Sorcery', text: 'Destroy target creature or planeswalker.',
    targets: [CREATURE], effect: [{ do: 'destroy', what: 0 }],
  },
  Blightning: {
    cost: '{1}{B}{R}', type: 'Sorcery', text: 'Blightning deals 3 damage to target player or planeswalker. That player discards two cards.',
    targets: [{ kind: 'player' }], effect: [{ do: 'damage', n: 3, to: 0 }, { do: 'discard', n: 2, who: 0 }],
  },
  "Domri's Ambush": {
    cost: '{R}{G}', type: 'Sorcery',
    text: 'Put a +1/+1 counter on target creature you control. Then that creature deals damage equal to its power to target creature or planeswalker you don\'t control.',
    targets: [{ kind: 'creature', controller: 'you' }, { kind: 'creature', controller: 'opp' }],
    effect: [{ do: 'counters', what: 0, n: 1 }, { do: 'bite', a: 0, b: 1 }],
  },
  Watchwolf: { cost: '{G}{W}', type: 'Creature', sub: 'Wolf', pt: [3, 3], text: '' },
  'Advent of the Wurm': {
    cost: '{1}{G}{G}{W}', type: 'Instant', text: 'Create a 5/5 green Wurm creature token with trample.',
    effect: [{ do: 'token', n: 1, token: 'Wurm' }],
  },
  'Armada Wurm': {
    cost: '{2}{G}{G}{W}{W}', type: 'Creature', sub: 'Wurm', pt: [5, 5], kw: ['trample'],
    text: 'Trample\nWhen Armada Wurm enters, create a 5/5 green Wurm creature token with trample.',
    etb: [{ do: 'token', n: 1, token: 'Wurm' }],
  },
};

/** Creature tokens the cards make. */
export const TOKENS = {
  Soldier: { name: 'Soldier', type: 'Token Creature', sub: 'Soldier', pt: [1, 1], colors: ['W'], text: '' },
  Wurm: { name: 'Wurm', type: 'Token Creature', sub: 'Wurm', pt: [5, 5], colors: ['G'], kw: ['trample'], text: 'Trample' },
};

for (const [name, card] of Object.entries(CARDS)) card.name = name;
