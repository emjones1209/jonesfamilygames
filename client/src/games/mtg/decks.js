/**
 * The preconstructed decks, 40 cards each: five of one color and five of two
 * colors, and three advanced ones built around triggered abilities and artifacts.
 */
export const DECKS = [
  {
    id: 'white', name: 'Knights of Light', colors: ['W'],
    blurb: 'Lots of small soldiers and knights, angels in the sky, and life gain.',
    cards: {
      Plains: 17, 'Savannah Lions': 2, 'Soul Warden': 2, 'Doomed Traveler': 1, "Healer's Hawk": 2, "Ajani's Pridemate": 2,
      'Knight of Meadowgrain': 2, 'Mesa Unicorn': 2, 'Attended Knight': 2, 'Benalish Marshal': 1, 'Serra Angel': 2,
      'Angel of Mercy': 1, 'Glorious Anthem': 1, Pacifism: 2, 'Swords to Plowshares': 1,
    },
  },
  {
    id: 'blue', name: 'Masters of the Sky', colors: ['U'],
    blurb: 'Flying creatures, extra cards, and counterspells that stop your opponent\'s plans.',
    cards: {
      Island: 17, Ornithopter: 1, 'Mind Stone': 1, 'Wind Drake': 2, 'Thieving Magpie': 1, 'Cloudkin Seer': 3, "Man-o'-War": 2, 'Phantom Warrior': 2,
      'Wall of Air': 1, 'Air Elemental': 2, 'Mahamoti Djinn': 1, Counterspell: 2, 'Essence Scatter': 1, Negate: 1,
      Unsummon: 1, Divination: 1, Claustrophobia: 1,
    },
  },
  {
    id: 'black', name: 'Night Stalkers', colors: ['B'],
    blurb: 'Vampires and zombies, deadly creatures, and spells that destroy your opponent\'s.',
    cards: {
      Swamp: 17, 'Typhoid Rats': 2, 'Diregraf Ghoul': 1, 'Hypnotic Specter': 1, 'Child of Night': 2, 'Zulaport Cutthroat': 2, 'Vampire Nighthawk': 2,
      'Dread Shade': 1, Gravedigger: 2, 'Vampire Sovereign': 2, 'Rotting Regisaur': 1, 'Doom Blade': 2, Murder: 1, 'Last Gasp': 1,
      'Dead Weight': 1, 'Phyrexian Arena': 1, 'Mind Rot': 1,
    },
  },
  {
    id: 'red', name: 'Goblin Blitz', colors: ['R'],
    blurb: 'Fast goblins, fire-breathing dragons, and burn spells to finish the job.',
    cards: {
      Mountain: 17, 'Raging Goblin': 2, 'Mogg Fanatic': 2, 'Goblin Piker': 1, 'Plated Geopede': 1, 'Prodigal Pyromancer': 1, 'Furnace Whelp': 2,
      'Hill Giant': 1, 'Ogre Battledriver': 1, 'Flametongue Kavu': 1, 'Fire Elemental': 1, 'Shivan Dragon': 1, 'Lightning Bolt': 2, Shock: 2,
      'Lightning Strike': 1, 'Searing Spear': 1, 'Volcanic Hammer': 1, 'Lava Axe': 1, Bonesplitter: 1,
    },
  },
  {
    id: 'green', name: 'Wild Giants', colors: ['G'],
    blurb: 'Elves for extra mana, then bigger and bigger beasts — up to a 10/10 dinosaur.',
    cards: {
      Forest: 16, 'Llanowar Elves': 2, 'Elvish Mystic': 2, 'Elvish Visionary': 2, 'Sakura-Tribe Elder': 1, "Garruk's Companion": 2,
      'Kalonian Tusker': 2, 'Centaur Courser': 1, 'Grazing Gladehart': 1, 'Giant Spider': 1, 'Rumbling Baloth': 2, 'Pelakka Wurm': 1,
      'Colossal Dreadmaw': 2, Gigantosaurus: 1, 'Giant Growth': 2, 'Rampant Growth': 1, 'Prey Upon': 1,
    },
  },
  {
    id: 'wu', name: 'Azorius Skies', colors: ['W', 'U'],
    blurb: 'White and blue: fliers, angels, and counterspells to protect them.',
    cards: {
      Plains: 8, Island: 9, "Healer's Hawk": 2, 'Soul Warden': 1, "Ajani's Pridemate": 1, 'Wind Drake': 2, 'Cloudkin Seer': 2, 'Wall of Denial': 1,
      "Man-o'-War": 1, 'Serra Angel': 2, 'Angel of Mercy': 1, 'Air Elemental': 1, Pacifism: 2, 'Swords to Plowshares': 1,
      Absorb: 2, Counterspell: 1, 'Essence Scatter': 1, 'Glorious Anthem': 1, 'Thieving Magpie': 1,
    },
  },
  {
    id: 'ur', name: 'Izzet Spellstorm', colors: ['U', 'R'],
    blurb: 'Blue and red: lightning, clever tricks, and wizards who get stronger with every spell.',
    cards: {
      Island: 8, Mountain: 9, 'Wee Dragonauts': 3, 'Izzet Chronarch': 2, 'Prodigal Pyromancer': 2, 'Cloudkin Seer': 2,
      'Furnace Whelp': 1, 'Thieving Magpie': 1, "Man-o'-War": 1, 'Wind Drake': 1, Bonesplitter: 1, 'Lightning Bolt': 2, Shock: 2, 'Lightning Strike': 2,
      Counterspell: 1, Divination: 1, 'Brute Force': 1,
    },
  },
  {
    id: 'br', name: 'Rakdos Raiders', colors: ['B', 'R'],
    blurb: 'Black and red: attack fast, destroy every blocker, and burn your opponent out.',
    cards: {
      Swamp: 8, Mountain: 9, 'Raging Goblin': 1, 'Hypnotic Specter': 1, 'Typhoid Rats': 1, 'Diregraf Ghoul': 2, 'Child of Night': 2, 'Goblin Piker': 2,
      'Mogg Fanatic': 1, 'Vampire Nighthawk': 1, 'Hill Giant': 1, 'Flametongue Kavu': 1, 'Vampire Sovereign': 1,
      Terminate: 2, Dreadbore: 1, Blightning: 1, 'Lightning Bolt': 2, Bonesplitter: 1, 'Doom Blade': 1, 'Lava Axe': 1,
    },
  },
  {
    id: 'rg', name: 'Gruul Stompers', colors: ['R', 'G'],
    blurb: 'Red and green: huge creatures that trample over blockers, with burn to clear the way.',
    cards: {
      Mountain: 8, Forest: 8, 'Llanowar Elves': 2, "Garruk's Companion": 2, 'Kalonian Tusker': 2, 'Centaur Courser': 2,
      'Ogre Battledriver': 1, 'Rumbling Baloth': 2, 'Pelakka Wurm': 1, 'Colossal Dreadmaw': 2, 'Duskdale Wurm': 1, 'Shivan Dragon': 1,
      "Domri's Ambush": 2, 'Lightning Strike': 2, 'Searing Spear': 1, 'Plated Geopede': 1, 'Sakura-Tribe Elder': 1, 'Prey Upon': 1,
    },
  },
  {
    id: 'gw', name: 'Selesnya Pack', colors: ['G', 'W'],
    blurb: 'Green and white: a big team of creatures, then make them all stronger at once.',
    cards: {
      Forest: 8, Plains: 8, 'Elvish Mystic': 2, 'Accorder Paladin': 1, 'Steppe Lynx': 1, Watchwolf: 3, 'Attended Knight': 2, 'Centaur Courser': 2,
      'Grazing Gladehart': 1, 'Serra Angel': 1, 'Armada Wurm': 1, 'Raise the Alarm': 2, 'Advent of the Wurm': 2,
      'Glorious Anthem': 2, Overrun: 1, 'Behemoth Sledge': 1, 'Giant Growth': 1, Pacifism: 1,
    },
  },
  {
    id: 'rw', name: 'Boros Blades', colors: ['R', 'W'], advanced: true,
    blurb: 'Red and white: equipment to arm your attackers, battle cry to charge in together, and landfall creatures.',
    cards: {
      Plains: 8, Mountain: 9, 'Goblin Wardriver': 2, 'Accorder Paladin': 3, 'Plated Geopede': 2, 'Steppe Lynx': 2, 'Mogg Fanatic': 2,
      'Youthful Knight': 2, 'Ogre Battledriver': 1, 'Attended Knight': 1, Bonesplitter: 2, 'Short Sword': 1, 'Loxodon Warhammer': 1,
      'Swiftfoot Boots': 1, 'Lightning Bolt': 2, 'Searing Spear': 1,
    },
  },
  {
    id: 'wb', name: 'Orzhov Lifeblood', colors: ['W', 'B'], advanced: true,
    blurb: 'White and black: every creature that enters or dies drains your opponent and feeds you life — and your Pridemates grow.',
    cards: {
      Plains: 8, Swamp: 9, 'Soul Warden': 2, 'Doomed Traveler': 2, "Ajani's Pridemate": 2, 'Cruel Celebrant': 2, 'Zulaport Cutthroat': 2,
      "Healer's Hawk": 1, 'Child of Night': 1, 'Vampire Nighthawk': 1, 'Bottle Gnomes': 1, 'Vampire Sovereign': 1, 'Angel of Mercy': 1,
      Bitterblossom: 1, 'Phyrexian Arena': 1, 'Raise the Alarm': 1, 'Swords to Plowshares': 1, 'Doom Blade': 1, Pacifism: 1, Gravedigger: 1,
    },
  },
  {
    id: 'artifact', name: 'Steel Legion', colors: ['U'], advanced: true,
    blurb: 'Mostly colorless: artifact creatures that Steel Overseer makes bigger every turn, equipment, and the mighty Wurmcoil Engine.',
    cards: {
      Island: 15, 'Mind Stone': 2, Ornithopter: 2, 'Steel Overseer': 3, 'Bottle Gnomes': 2, 'Solemn Simulacrum': 2, 'Wurmcoil Engine': 1,
      'Thieving Magpie': 2, 'Cloudkin Seer': 2, 'Phantom Warrior': 1, 'Short Sword': 2, 'Vulshok Morningstar': 2, "Accorder's Shield": 1,
      'Swiftfoot Boots': 1, 'Loxodon Warhammer': 1, Counterspell: 1,
    },
  },
];

export const deckById = id => DECKS.find(d => d.id === id);

/** A deck's card names, one per card (40 of them). */
export const deckList = deck => Object.entries(deck.cards).flatMap(([name, n]) => Array(n).fill(name));
