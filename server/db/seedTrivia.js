const pool = require('./pool');

// Comprehensive trivia question banks
// Each question: { category, difficulty, question, correct_answer, wrong_answers: [3 wrong answers] }

const BIBLE_QUESTIONS = [
  // Easy
  { category:'bible', difficulty:'easy', question:'How many books are in the New Testament?', correct_answer:'27', wrong_answers:['39','66','12'] },
  { category:'bible', difficulty:'easy', question:'Who built the ark?', correct_answer:'Noah', wrong_answers:['Moses','Abraham','David'] },
  { category:'bible', difficulty:'easy', question:'What is the first book of the Bible?', correct_answer:'Genesis', wrong_answers:['Exodus','Revelation','Matthew'] },
  { category:'bible', difficulty:'easy', question:'How many disciples did Jesus have?', correct_answer:'12', wrong_answers:['7','10','15'] },
  { category:'bible', difficulty:'easy', question:'In which city was Jesus born?', correct_answer:'Bethlehem', wrong_answers:['Jerusalem','Nazareth','Jericho'] },
  { category:'bible', difficulty:'easy', question:'Who was swallowed by a great fish?', correct_answer:'Jonah', wrong_answers:['Elijah','Isaiah','Ezekiel'] },
  { category:'bible', difficulty:'easy', question:'Who is the father of all nations?', correct_answer:'Abraham', wrong_answers:['Isaac','Jacob','Moses'] },
  { category:'bible', difficulty:'easy', question:'Who wrote most of the Psalms?', correct_answer:'David', wrong_answers:['Solomon','Moses','Paul'] },
  { category:'bible', difficulty:'easy', question:'How many books are in the Bible?', correct_answer:'66', wrong_answers:['39','73','52'] },
  { category:'bible', difficulty:'easy', question:'What river was Jesus baptized in?', correct_answer:'Jordan River', wrong_answers:['Nile River','Red Sea','Sea of Galilee'] },
  { category:'bible', difficulty:'easy', question:'Who was the first man created by God?', correct_answer:'Adam', wrong_answers:['Noah','Cain','Abel'] },
  { category:'bible', difficulty:'easy', question:'What did God create on the first day?', correct_answer:'Light', wrong_answers:['Water','Land','Animals'] },
  { category:'bible', difficulty:'easy', question:'How many days did it take God to create the world?', correct_answer:'6', wrong_answers:['7','3','10'] },
  { category:'bible', difficulty:'easy', question:'Who killed Goliath?', correct_answer:'David', wrong_answers:['Saul','Jonathan','Samuel'] },
  { category:'bible', difficulty:'easy', question:'What was the name of the garden where Adam and Eve lived?', correct_answer:'Garden of Eden', wrong_answers:['Garden of Gethsemane','Paradise Garden','Garden of Olives'] },

  // Medium
  { category:'bible', difficulty:'medium', question:'What language was most of the Old Testament written in?', correct_answer:'Hebrew', wrong_answers:['Latin','Greek','Aramaic'] },
  { category:'bible', difficulty:'medium', question:'Who was the first King of Israel?', correct_answer:'Saul', wrong_answers:['David','Solomon','Samson'] },
  { category:'bible', difficulty:'medium', question:'How many plagues did God send to Egypt?', correct_answer:'10', wrong_answers:['7','12','5'] },
  { category:'bible', difficulty:'medium', question:'What were the names of Noahs three sons?', correct_answer:'Shem, Ham, and Japheth', wrong_answers:['Cain, Abel, Seth','Isaac, Ishmael, Jacob','James, John, Peter'] },
  { category:'bible', difficulty:'medium', question:'Who interpreted Pharaoh\'s dreams?', correct_answer:'Joseph', wrong_answers:['Moses','Daniel','Elijah'] },
  { category:'bible', difficulty:'medium', question:'What did Jesus turn water into at the wedding in Cana?', correct_answer:'Wine', wrong_answers:['Juice','Milk','Oil'] },
  { category:'bible', difficulty:'medium', question:'Which book comes after Genesis?', correct_answer:'Exodus', wrong_answers:['Leviticus','Numbers','Deuteronomy'] },
  { category:'bible', difficulty:'medium', question:'How many years did the Israelites wander in the wilderness?', correct_answer:'40', wrong_answers:['20','30','50'] },
  { category:'bible', difficulty:'medium', question:'Who betrayed Jesus for 30 pieces of silver?', correct_answer:'Judas Iscariot', wrong_answers:['Peter','Thomas','Bartholomew'] },
  { category:'bible', difficulty:'medium', question:'What is the longest book in the Bible?', correct_answer:'Psalms', wrong_answers:['Genesis','Isaiah','Jeremiah'] },

  // Hard
  { category:'bible', difficulty:'hard', question:'What is the shortest verse in the Bible?', correct_answer:'"Jesus wept" (John 11:35)', wrong_answers:['"God is love"','Jesus said "I am"','Amen'] },
  { category:'bible', difficulty:'hard', question:'Who wrote the book of Revelation?', correct_answer:'John', wrong_answers:['Paul','Peter','James'] },
  { category:'bible', difficulty:'hard', question:'In which city did Pentecost occur?', correct_answer:'Jerusalem', wrong_answers:['Bethlehem','Antioch','Rome'] },
  { category:'bible', difficulty:'hard', question:'How many epistles did Paul write in the New Testament?', correct_answer:'13', wrong_answers:['10','7','15'] },
  { category:'bible', difficulty:'hard', question:'What are the first five books of the Bible collectively called?', correct_answer:'The Pentateuch (Torah)', wrong_answers:['The Gospels','The Epistles','The Prophecy Books'] },
  { category:'bible', difficulty:'hard', question:'Who was Esther\'s cousin who raised her?', correct_answer:'Mordecai', wrong_answers:['Haman','Ahasuerus','Boaz'] },
  { category:'bible', difficulty:'hard', question:'What was the name of Abraham\'s first son?', correct_answer:'Ishmael', wrong_answers:['Isaac','Jacob','Esau'] },
  { category:'bible', difficulty:'hard', question:'Who succeeded Moses as leader of the Israelites?', correct_answer:'Joshua', wrong_answers:['Aaron','Caleb','Phinehas'] },
  { category:'bible', difficulty:'hard', question:'Which prophet was taken to heaven in a whirlwind?', correct_answer:'Elijah', wrong_answers:['Elisha','Enoch','Ezekiel'] },
  { category:'bible', difficulty:'hard', question:'What were the two cities destroyed along with Sodom?', correct_answer:'Gomorrah', wrong_answers:['Jericho and Ai','Babylon and Nineveh','Tyre and Sidon'] },
];

const HISTORY_QUESTIONS = [
  { category:'history', difficulty:'easy', question:'In what year did World War II end?', correct_answer:'1945', wrong_answers:['1939','1944','1918'] },
  { category:'history', difficulty:'easy', question:'Who was the first President of the United States?', correct_answer:'George Washington', wrong_answers:['Thomas Jefferson','John Adams','Benjamin Franklin'] },
  { category:'history', difficulty:'easy', question:'In what year did America declare independence?', correct_answer:'1776', wrong_answers:['1783','1765','1812'] },
  { category:'history', difficulty:'easy', question:'Who was known as the "Iron Lady"?', correct_answer:'Margaret Thatcher', wrong_answers:['Queen Elizabeth II','Hillary Clinton','Angela Merkel'] },
  { category:'history', difficulty:'easy', question:'What year did the Titanic sink?', correct_answer:'1912', wrong_answers:['1905','1920','1898'] },
  { category:'history', difficulty:'easy', question:'Who painted the Sistine Chapel ceiling?', correct_answer:'Michelangelo', wrong_answers:['Leonardo da Vinci','Raphael','Botticelli'] },
  { category:'history', difficulty:'easy', question:'In what year did the Berlin Wall fall?', correct_answer:'1989', wrong_answers:['1991','1979','1985'] },
  { category:'history', difficulty:'easy', question:'What ancient wonder was located in Alexandria?', correct_answer:'The Lighthouse of Alexandria', wrong_answers:['The Colossus of Rhodes','The Hanging Gardens','The Statue of Zeus'] },
  { category:'history', difficulty:'easy', question:'Who was the first to walk on the Moon?', correct_answer:'Neil Armstrong', wrong_answers:['Buzz Aldrin','Yuri Gagarin','John Glenn'] },
  { category:'history', difficulty:'easy', question:'Which country was first to grant women the right to vote?', correct_answer:'New Zealand', wrong_answers:['USA','UK','Australia'] },
  { category:'history', difficulty:'easy', question:'Who invented the telephone?', correct_answer:'Alexander Graham Bell', wrong_answers:['Thomas Edison','Nikola Tesla','Samuel Morse'] },
  { category:'history', difficulty:'easy', question:'What was the name of the ship on which the Pilgrims traveled to America?', correct_answer:'Mayflower', wrong_answers:['Santa Maria','Pinta','HMS Endeavour'] },

  { category:'history', difficulty:'medium', question:'Which empire was ruled by Julius Caesar?', correct_answer:'Roman Empire', wrong_answers:['Greek Empire','Ottoman Empire','Persian Empire'] },
  { category:'history', difficulty:'medium', question:'What war was fought between the North and South in the United States?', correct_answer:'The Civil War', wrong_answers:['The Revolutionary War','The War of 1812','The Mexican-American War'] },
  { category:'history', difficulty:'medium', question:'Who led the Indian independence movement?', correct_answer:'Mahatma Gandhi', wrong_answers:['Jawaharlal Nehru','Subhas Chandra Bose','Indira Gandhi'] },
  { category:'history', difficulty:'medium', question:'What ancient structure was built by the Egyptian pharaohs as tombs?', correct_answer:'Pyramids', wrong_answers:['Ziggurats','Temples','Mausoleums'] },
  { category:'history', difficulty:'medium', question:'What was the name of the first artificial satellite launched into space?', correct_answer:'Sputnik 1', wrong_answers:['Explorer 1','Vostok 1','Mercury 1'] },
  { category:'history', difficulty:'medium', question:'Who wrote the Declaration of Independence?', correct_answer:'Thomas Jefferson', wrong_answers:['Benjamin Franklin','John Adams','James Madison'] },
  { category:'history', difficulty:'medium', question:'During which decade did the Great Depression occur?', correct_answer:'1930s', wrong_answers:['1920s','1940s','1950s'] },
  { category:'history', difficulty:'medium', question:'Who was the first female Prime Minister of the United Kingdom?', correct_answer:'Margaret Thatcher', wrong_answers:['Theresa May','Queen Victoria','Elizabeth Fry'] },

  { category:'history', difficulty:'hard', question:'Who was the last Pharaoh of ancient Egypt?', correct_answer:'Cleopatra VII', wrong_answers:['Nefertiti','Hatshepsut','Ramesses II'] },
  { category:'history', difficulty:'hard', question:'In what year did the French Revolution begin?', correct_answer:'1789', wrong_answers:['1776','1799','1815'] },
  { category:'history', difficulty:'hard', question:'Who signed the Magna Carta?', correct_answer:'King John of England', wrong_answers:['King Henry VIII','Richard the Lionheart','William the Conqueror'] },
  { category:'history', difficulty:'hard', question:'What was the name of the first African-American Supreme Court Justice?', correct_answer:'Thurgood Marshall', wrong_answers:['Clarence Thomas','John Marshall','Oliver Wendell Holmes'] },
  { category:'history', difficulty:'hard', question:'Which country had the first constitution in modern history?', correct_answer:'United States', wrong_answers:['France','UK','Poland'] },
  { category:'history', difficulty:'hard', question:'Who was the Byzantine Emperor who rebuilt Constantinople?', correct_answer:'Justinian I', wrong_answers:['Constantine I','Theodosius I','Basil II'] },
];

const GEOGRAPHY_QUESTIONS = [
  { category:'geography', difficulty:'easy', question:'What is the capital of Australia?', correct_answer:'Canberra', wrong_answers:['Sydney','Melbourne','Brisbane'] },
  { category:'geography', difficulty:'easy', question:'Which is the longest river in the world?', correct_answer:'Nile', wrong_answers:['Amazon','Mississippi','Yangtze'] },
  { category:'geography', difficulty:'easy', question:'What is the smallest country in the world?', correct_answer:'Vatican City', wrong_answers:['Monaco','San Marino','Liechtenstein'] },
  { category:'geography', difficulty:'easy', question:'What is the highest mountain in the world?', correct_answer:'Mount Everest', wrong_answers:['K2','Kangchenjunga','Lhotse'] },
  { category:'geography', difficulty:'easy', question:'Which ocean is the largest?', correct_answer:'Pacific Ocean', wrong_answers:['Atlantic Ocean','Indian Ocean','Arctic Ocean'] },
  { category:'geography', difficulty:'easy', question:'What is the capital of Brazil?', correct_answer:'Brasília', wrong_answers:['Rio de Janeiro','São Paulo','Salvador'] },
  { category:'geography', difficulty:'easy', question:'What is the largest desert in the world?', correct_answer:'Antarctic Desert', wrong_answers:['Sahara Desert','Arabian Desert','Gobi Desert'] },
  { category:'geography', difficulty:'easy', question:'How many continents are there?', correct_answer:'7', wrong_answers:['5','6','8'] },
  { category:'geography', difficulty:'easy', question:'Which country has the most natural lakes?', correct_answer:'Canada', wrong_answers:['Russia','USA','Finland'] },
  { category:'geography', difficulty:'easy', question:'What is the capital of Japan?', correct_answer:'Tokyo', wrong_answers:['Osaka','Kyoto','Hiroshima'] },
  { category:'geography', difficulty:'easy', question:'Which is the largest country by area?', correct_answer:'Russia', wrong_answers:['Canada','USA','China'] },
  { category:'geography', difficulty:'easy', question:'What is the capital of France?', correct_answer:'Paris', wrong_answers:['Lyon','Marseille','Bordeaux'] },

  { category:'geography', difficulty:'medium', question:'What country has the most population?', correct_answer:'India', wrong_answers:['China','USA','Indonesia'] },
  { category:'geography', difficulty:'medium', question:'Through how many countries does the Amazon River flow?', correct_answer:'9', wrong_answers:['5','3','12'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of Canada?', correct_answer:'Ottawa', wrong_answers:['Toronto','Vancouver','Montreal'] },
  { category:'geography', difficulty:'medium', question:'Which African country has the largest population?', correct_answer:'Nigeria', wrong_answers:['Egypt','Ethiopia','South Africa'] },
  { category:'geography', difficulty:'medium', question:'What is the deepest lake in the world?', correct_answer:'Lake Baikal', wrong_answers:['Caspian Sea','Lake Superior','Lake Tanganyika'] },
  { category:'geography', difficulty:'medium', question:'Which country is home to the Great Barrier Reef?', correct_answer:'Australia', wrong_answers:['Indonesia','Philippines','Maldives'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of South Africa?', correct_answer:'Pretoria (administrative)', wrong_answers:['Cape Town','Johannesburg','Durban'] },
  { category:'geography', difficulty:'medium', question:'Which mountain range separates Europe from Asia?', correct_answer:'Ural Mountains', wrong_answers:['Alps','Caucasus Mountains','Pyrenees'] },

  { category:'geography', difficulty:'hard', question:'What is the smallest continent by land area?', correct_answer:'Australia', wrong_answers:['Europe','Antarctica','South America'] },
  { category:'geography', difficulty:'hard', question:'Which country has the most time zones?', correct_answer:'France', wrong_answers:['Russia','USA','Australia'] },
  { category:'geography', difficulty:'hard', question:'What is the highest capital city in the world?', correct_answer:'Quito, Ecuador', wrong_answers:['La Paz, Bolivia','Bogotá, Colombia','Addis Ababa, Ethiopia'] },
  { category:'geography', difficulty:'hard', question:'Which two countries share the longest border?', correct_answer:'USA and Canada', wrong_answers:['Russia and China','Argentina and Chile','China and Mongolia'] },
  { category:'geography', difficulty:'hard', question:'What is the only sea without any coasts?', correct_answer:'Sargasso Sea', wrong_answers:['Dead Sea','Caspian Sea','Aral Sea'] },
  { category:'geography', difficulty:'hard', question:'Which country has the most UNESCO World Heritage Sites?', correct_answer:'Italy', wrong_answers:['China','Germany','Spain'] },
];

const ALL_QUESTIONS = [...BIBLE_QUESTIONS, ...HISTORY_QUESTIONS, ...GEOGRAPHY_QUESTIONS];

async function seed() {
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM trivia_questions');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('ℹ️  Trivia questions already seeded, skipping...');
      return;
    }
    for (const q of ALL_QUESTIONS) {
      await pool.query(
        `INSERT INTO trivia_questions (category, difficulty, question, correct_answer, wrong_answers) VALUES ($1,$2,$3,$4,$5)`,
        [q.category, q.difficulty, q.question, q.correct_answer, q.wrong_answers]
      );
    }
    console.log(`✅ Seeded ${ALL_QUESTIONS.length} trivia questions`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
