/**
 * The preconstructed decks: five of one color and five of two colors, 40
 * cards each.
 */
export const DECKS = [
  {
    id: 'white', name: 'Knights of Light', colors: ['W'],
    blurb: 'Lots of small soldiers and knights, angels in the sky, and life gain.',
    cards: {
      Plains: 17, 'Savannah Lions': 2, 'Elite Vanguard': 2, 'Suntail Hawk': 1, "Healer's Hawk": 2, 'Youthful Knight': 2,
      'Knight of Meadowgrain': 2, 'Mesa Unicorn': 2, 'Attended Knight': 2, 'Benalish Marshal': 1, 'Serra Angel': 2,
      'Angel of Mercy': 1, 'Glorious Anthem': 1, Pacifism: 2, 'Swords to Plowshares': 1,
    },
  },
  {
    id: 'blue', name: 'Masters of the Sky', colors: ['U'],
    blurb: 'Flying creatures, extra cards, and counterspells that stop your opponent\'s plans.',
    cards: {
      Island: 17, 'Coral Merfolk': 2, 'Wind Drake': 3, 'Cloudkin Seer': 3, "Man-o'-War": 2, 'Phantom Warrior': 2,
      'Wall of Air': 1, 'Air Elemental': 2, 'Mahamoti Djinn': 1, Counterspell: 2, 'Essence Scatter': 1, Negate: 1,
      Unsummon: 1, Divination: 1, Claustrophobia: 1,
    },
  },
  {
    id: 'black', name: 'Night Stalkers', colors: ['B'],
    blurb: 'Vampires and zombies, deadly creatures, and spells that destroy your opponent\'s.',
    cards: {
      Swamp: 17, 'Typhoid Rats': 2, 'Diregraf Ghoul': 2, 'Child of Night': 2, 'Walking Corpse': 2, 'Vampire Nighthawk': 2,
      'Dread Shade': 1, Gravedigger: 2, 'Vampire Sovereign': 2, Bogstomper: 1, 'Doom Blade': 2, Murder: 1, 'Last Gasp': 1,
      'Dead Weight': 1, "Night's Whisper": 1, 'Mind Rot': 1,
    },
  },
  {
    id: 'red', name: 'Goblin Blitz', colors: ['R'],
    blurb: 'Fast goblins, fire-breathing dragons, and burn spells to finish the job.',
    cards: {
      Mountain: 17, 'Raging Goblin': 2, 'Goblin Piker': 3, 'Gray Ogre': 1, 'Prodigal Pyromancer': 1, 'Furnace Whelp': 2,
      'Hill Giant': 2, 'Flametongue Kavu': 1, 'Fire Elemental': 1, 'Shivan Dragon': 1, 'Lightning Bolt': 2, Shock: 2,
      'Lightning Strike': 1, 'Searing Spear': 1, 'Volcanic Hammer': 1, 'Lava Axe': 1, 'Brute Force': 1,
    },
  },
  {
    id: 'green', name: 'Wild Giants', colors: ['G'],
    blurb: 'Elves for extra mana, then bigger and bigger beasts — up to a 10/10 dinosaur.',
    cards: {
      Forest: 16, 'Llanowar Elves': 2, 'Elvish Mystic': 2, 'Elvish Visionary': 2, 'Grizzly Bears': 1, "Garruk's Companion": 2,
      'Kalonian Tusker': 2, 'Centaur Courser': 2, 'Giant Spider': 1, 'Rumbling Baloth': 2, 'Craw Wurm': 1,
      'Colossal Dreadmaw': 2, Gigantosaurus: 1, 'Giant Growth': 2, 'Rampant Growth': 1, 'Prey Upon': 1,
    },
  },
  {
    id: 'wu', name: 'Azorius Skies', colors: ['W', 'U'],
    blurb: 'White and blue: fliers, angels, and counterspells to protect them.',
    cards: {
      Plains: 8, Island: 9, "Healer's Hawk": 2, 'Mesa Unicorn': 2, 'Wind Drake': 2, 'Cloudkin Seer': 2, 'Wall of Denial': 1,
      "Man-o'-War": 1, 'Serra Angel': 2, 'Angel of Mercy': 1, 'Air Elemental': 1, Pacifism: 2, 'Swords to Plowshares': 1,
      Absorb: 2, Counterspell: 1, 'Essence Scatter': 1, 'Glorious Anthem': 1, Divination: 1,
    },
  },
  {
    id: 'ur', name: 'Izzet Spellstorm', colors: ['U', 'R'],
    blurb: 'Blue and red: lightning, clever tricks, and wizards who get stronger with every spell.',
    cards: {
      Island: 8, Mountain: 9, 'Wee Dragonauts': 3, 'Izzet Chronarch': 2, 'Prodigal Pyromancer': 2, 'Cloudkin Seer': 2,
      'Furnace Whelp': 2, "Man-o'-War": 1, 'Wind Drake': 2, 'Lightning Bolt': 2, Shock: 2, 'Lightning Strike': 2,
      Counterspell: 1, Divination: 1, 'Brute Force': 1,
    },
  },
  {
    id: 'br', name: 'Rakdos Raiders', colors: ['B', 'R'],
    blurb: 'Black and red: attack fast, destroy every blocker, and burn your opponent out.',
    cards: {
      Swamp: 8, Mountain: 9, 'Raging Goblin': 2, 'Typhoid Rats': 1, 'Diregraf Ghoul': 2, 'Child of Night': 2, 'Goblin Piker': 2,
      'Walking Corpse': 1, 'Vampire Nighthawk': 1, 'Hill Giant': 1, 'Flametongue Kavu': 1, 'Vampire Sovereign': 1,
      Terminate: 2, Dreadbore: 1, Blightning: 1, 'Lightning Bolt': 2, Shock: 1, 'Doom Blade': 1, 'Lava Axe': 1,
    },
  },
  {
    id: 'rg', name: 'Gruul Stompers', colors: ['R', 'G'],
    blurb: 'Red and green: huge creatures that trample over blockers, with burn to clear the way.',
    cards: {
      Mountain: 8, Forest: 8, 'Llanowar Elves': 2, "Garruk's Companion": 2, 'Kalonian Tusker': 2, 'Centaur Courser': 2,
      'Hill Giant': 1, 'Rumbling Baloth': 2, 'Fire Elemental': 1, 'Colossal Dreadmaw': 2, 'Duskdale Wurm': 1, 'Shivan Dragon': 1,
      "Domri's Ambush": 2, 'Lightning Strike': 2, 'Searing Spear': 1, 'Giant Growth': 1, 'Brute Force': 1, 'Prey Upon': 1,
    },
  },
  {
    id: 'gw', name: 'Selesnya Pack', colors: ['G', 'W'],
    blurb: 'Green and white: a big team of creatures, then make them all stronger at once.',
    cards: {
      Forest: 8, Plains: 8, 'Elvish Mystic': 2, 'Savannah Lions': 2, Watchwolf: 3, 'Attended Knight': 2, 'Centaur Courser': 2,
      'Rumbling Baloth': 1, 'Serra Angel': 1, 'Armada Wurm': 1, 'Raise the Alarm': 2, 'Advent of the Wurm': 2,
      'Glorious Anthem': 2, Overrun: 1, 'Inspired Charge': 1, 'Giant Growth': 1, Pacifism: 1,
    },
  },
];

export const deckById = id => DECKS.find(d => d.id === id);

/** A deck's card names, one per card (40 of them). */
export const deckList = deck => Object.entries(deck.cards).flatMap(([name, n]) => Array(n).fill(name));
