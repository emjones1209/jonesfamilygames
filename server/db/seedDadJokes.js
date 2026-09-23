const pool = require('./pool');

const DAD_JOKES = [
  { joke: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
  { joke: "I told my wife she was drawing her eyebrows too high.", punchline: "She looked surprised." },
  { joke: "What do you call a fish without eyes?", punchline: "A fsh!" },
  { joke: "Why can't you give Elsa a balloon?", punchline: "Because she'll let it go!" },
  { joke: "I'm reading a book about anti-gravity.", punchline: "It's impossible to put down!" },
  { joke: "Why do cows wear bells?", punchline: "Because their horns don't work!" },
  { joke: "What do you call cheese that isn't yours?", punchline: "Nacho cheese!" },
  { joke: "Why did the scarecrow win an award?", punchline: "Because he was outstanding in his field!" },
  { joke: "I used to hate facial hair...", punchline: "But then it grew on me!" },
  { joke: "What do you call a fake noodle?", punchline: "An impasta!" },
  { joke: "Why did the bicycle fall over?", punchline: "Because it was two-tired!" },
  { joke: "What do you call a sleeping dinosaur?", punchline: "A dino-snore!" },
  { joke: "I couldn't figure out why the baseball was getting bigger...", punchline: "Then it hit me!" },
  { joke: "What do you call an alligator in a vest?", punchline: "An in-vest-igator!" },
  { joke: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
  { joke: "What do you call a parade of rabbits hopping backwards?", punchline: "A receding hare-line!" },
  { joke: "What do you call a bear with no teeth?", punchline: "A gummy bear!" },
  { joke: "Why did the golfer bring two pairs of pants?", punchline: "In case he got a hole in one!" },
  { joke: "What do you call a lazy kangaroo?", punchline: "A pouch potato!" },
  { joke: "Why did the math book look so sad?", punchline: "Because it had too many problems!" },
  { joke: "What do you call a factory that makes okay products?", punchline: "A satis-factory!" },
  { joke: "Why can't Cinderella play soccer?", punchline: "Because she always runs away from the ball!" },
  { joke: "What did the ocean say to the beach?", punchline: "Nothing, it just waved!" },
  { joke: "I asked my dog what two minus two is.", punchline: "He said nothing." },
  { joke: "What do you call a pile of cats?", punchline: "A meowtain!" },
  { joke: "Why did the invisible man turn down the job offer?", punchline: "He couldn't see himself doing it!" },
  { joke: "What do you call a can opener that doesn't work?", punchline: "A can't opener!" },
  { joke: "How does a penguin build its house?", punchline: "Igloos it together!" },
  { joke: "Why did the coffee file a police report?", punchline: "It got mugged!" },
  { joke: "What do sprinters eat before a race?", punchline: "Nothing — they fast!" },
  { joke: "What did one wall say to the other?", punchline: "I'll meet you at the corner!" },
  { joke: "Why do bananas have to put on sunscreen before they go to the beach?", punchline: "Because they might peel!" },
  { joke: "Why couldn't the leopard play hide and seek?", punchline: "Because he was always spotted!" },
  { joke: "What did the judge say when the skunk walked in the courtroom?", punchline: "Odor in the court!" },
  { joke: "I only know 25 letters of the alphabet.", punchline: "I don't know why." },
  { joke: "What do you call a dog magician?", punchline: "A labra-cadabra-dor!" },
  { joke: "Why did the stadium get hot after the game?", punchline: "All of the fans left!" },
  { joke: "Why did the tomato turn red?", punchline: "Because it saw the salad dressing!" },
  { joke: "What do you call a snowman with a six-pack?", punchline: "An abdominal snowman!" },
  { joke: "Why did the cookie go to the doctor?", punchline: "Because it was feeling crummy!" },
  { joke: "What do Alexander the Great and Winnie the Pooh have in common?", punchline: "They both have 'the' as their middle name!" },
  { joke: "I used to play piano by ear...", punchline: "Now I use my hands!" },
  { joke: "What's a ghost's favorite dessert?", punchline: "I scream!" },
  { joke: "What do you call it when a dinosaur crashes their car?", punchline: "Tyrannosaurus wrecks!" },
  { joke: "Why do fish swim in salt water?", punchline: "Because pepper makes them sneeze!" },
  { joke: "What's the best time to go to the dentist?", punchline: "Tooth-hurty!" },
  { joke: "Why did the student eat his homework?", punchline: "Because the teacher told him it was a piece of cake!" },
  { joke: "What do you call an elephant that doesn't matter?", punchline: "An irrelephant!" },
  { joke: "Why don't oysters share?", punchline: "Because they're shellfish!" },
  { joke: "What do you call a very small valentine?", punchline: "A valen-tiny!" },
  { joke: "Why did the computer go to the doctor?", punchline: "Because it had a virus!" },
  { joke: "What do you call cheese all by itself?", punchline: "Provolone!" },
  { joke: "What kind of shoes does a ninja wear?", punchline: "Sneakers!" },
  { joke: "Why did the banana go to the doctor?", punchline: "Because it wasn't peeling well!" },
  { joke: "What does a cloud wear under his raincoat?", punchline: "Thunderwear!" },
  { joke: "Why did the gym close down?", punchline: "It just didn't work out!" },
  { joke: "What do you call a group of disorganized cats?", punchline: "A cat-astrophe!" },
  { joke: "I'm so good at sleeping...", punchline: "I can do it with my eyes closed!" },
  { joke: "What does a house wear?", punchline: "Address!" },
  { joke: "What do you call a lonely cheese?", punchline: "Provolone!" },
  { joke: "Why did the belt get arrested?", punchline: "Because it was holding up a pair of pants!" },
  { joke: "What do you call a funny mountain?", punchline: "Hill-arious!" },
  { joke: "Why did the pillow go to the doctor?", punchline: "It was feeling a little down!" },
  { joke: "What do you call a shoe made of a banana?", punchline: "A slipper!" },
  { joke: "What do you call a grumpy pea?", punchline: "A com-plaint!" },
  { joke: "What's the difference between a guitar and a fish?", punchline: "You can tune a guitar but you can't tuna fish!" },
  { joke: "How many tickles does it take to make an octopus laugh?", punchline: "Ten-tickles!" },
  { joke: "Why did the bullet end up jobless?", punchline: "Because he got fired!" },
  { joke: "What do you call a man with no body and no nose?", punchline: "Nobody knows!" },
  { joke: "Why did the frog call his insurance company?", punchline: "He had his car toad!" },
  { joke: "What did the Buddhist say to the hot dog vendor?", punchline: "Make me one with everything!" },
  { joke: "What do you call a hippie's wife?", punchline: "Mississippi!" },
  { joke: "What has ears but cannot hear?", punchline: "A cornfield!" },
  { joke: "Why do melons have weddings?", punchline: "Because they cantaloupe!" },
  { joke: "Why did the picture go to jail?", punchline: "Because it was framed!" },
  { joke: "What did the blanket say to the bed?", punchline: "Don't worry, I've got you covered!" },
  { joke: "Why did the calendar feel anxious?", punchline: "Its days were numbered!" },
  { joke: "Why don't skeletons fight each other?", punchline: "They don't have the guts!" },
  { joke: "What do you call a pudgy psychic?", punchline: "A four-chin teller!" },
  { joke: "What do you call a broken can opener?", punchline: "A can't opener!" },
  { joke: "How do trees get on the internet?", punchline: "They log in!" },
  { joke: "What do you call a sleeping T-Rex?", punchline: "A dino-snore!" },
  { joke: "Why did the nurse need a red pen?", punchline: "In case they needed to draw blood!" },
  { joke: "Why do bees have sticky hair?", punchline: "Because they use honeycombs!" },
  { joke: "What did one hat say to the other?", punchline: "Stay here! I'll go on ahead!" },
  { joke: "What's a plumber's favorite shoe?", punchline: "Clogs!" },
  { joke: "What do you call a pony with a cough?", punchline: "A little hoarse!" },
  { joke: "Why is no one friends with Dracula?", punchline: "Because he's a pain in the neck!" },
  { joke: "What do you call a sleeping stegosaurus?", punchline: "A stega-snorus!" },
  { joke: "Why do some fish swim in saltwater?", punchline: "Because pepper makes them sneeze!" },
  { joke: "What did the sushi say to the bee?", punchline: "Wasabi!" },
  { joke: "What do you call a pig that does karate?", punchline: "A pork chop!" },
  { joke: "Why did the broom get a promotion?", punchline: "It swept the competition!" },
  { joke: "What kind of car does a sheep drive?", punchline: "A Lamborghini!" },
  { joke: "What do you call a pencil without lead?", punchline: "Pointless!" },
  { joke: "Why are frogs so happy?", punchline: "They eat whatever bugs them!" },
  { joke: "What did the right eye say to the left eye?", punchline: "Between you and me, something smells!" },
  { joke: "Why did the A go to the bathroom?", punchline: "Because the B-C!" },
  { joke: "What do you call a fish that needs help with his vocals?", punchline: "Auto-tuna!" },
];

async function seed() {
  try {
    // Insert only jokes that aren't already present (safe to re-run)
    let added = 0;
    for (const j of DAD_JOKES) {
      const existing = await pool.query('SELECT 1 FROM dad_jokes WHERE joke = $1', [j.joke]);
      if (existing.rows.length > 0) continue;
      await pool.query('INSERT INTO dad_jokes (joke, punchline) VALUES ($1, $2)', [j.joke, j.punchline]);
      added++;
    }
    console.log(`✅ Seeded ${added} new dad jokes (${DAD_JOKES.length - added} already present)`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  }
}

module.exports = { seedDadJokes: seed };

// Run directly: `node db/seedDadJokes.js`
if (require.main === module) seed().then(() => process.exit(0)).catch(() => process.exit(1));
