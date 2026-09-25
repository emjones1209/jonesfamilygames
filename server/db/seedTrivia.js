const pool = require('./pool');

// Trivia question banks.
// Each question: { category, difficulty, question, correct_answer, wrong_answers: [3 wrong answers] }
//
// Difficulty guide
//   easy   – Sunday-school / school-textbook knowledge
//   medium – a well-read enthusiast should know most of these
//   hard   – aimed at real buffs: minor figures, exact dates, fathers of prophets…
// Wrong answers are drawn from the same story or period so they can't be ruled
// out by elimination.
//
// Seeding syncs by question text: new questions are added, and existing ones
// are updated if their difficulty or answers change here. To remove or reword a
// question, add its old text to RETIRED so it is deleted from the database.

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
  { category:'bible', difficulty:'easy', question:'What language was most of the Old Testament written in?', correct_answer:'Hebrew', wrong_answers:['Latin','Greek','Aramaic'] },
  { category:'bible', difficulty:'easy', question:'Who was the first King of Israel?', correct_answer:'Saul', wrong_answers:['David','Solomon','Samson'] },
  { category:'bible', difficulty:'easy', question:'How many plagues did God send to Egypt?', correct_answer:'10', wrong_answers:['7','12','5'] },
  { category:'bible', difficulty:'easy', question:'What were the names of Noahs three sons?', correct_answer:'Shem, Ham, and Japheth', wrong_answers:['Cain, Abel, Seth','Isaac, Ishmael, Jacob','James, John, Peter'] },
  { category:'bible', difficulty:'easy', question:'Who interpreted Pharaoh\'s dreams?', correct_answer:'Joseph', wrong_answers:['Moses','Daniel','Elijah'] },
  { category:'bible', difficulty:'easy', question:'What did Jesus turn water into at the wedding in Cana?', correct_answer:'Wine', wrong_answers:['Juice','Milk','Oil'] },
  { category:'bible', difficulty:'easy', question:'Which book comes after Genesis?', correct_answer:'Exodus', wrong_answers:['Leviticus','Numbers','Deuteronomy'] },
  { category:'bible', difficulty:'easy', question:'How many years did the Israelites wander in the wilderness?', correct_answer:'40', wrong_answers:['20','30','50'] },
  { category:'bible', difficulty:'easy', question:'Who betrayed Jesus for 30 pieces of silver?', correct_answer:'Judas Iscariot', wrong_answers:['Peter','Thomas','Bartholomew'] },
  { category:'bible', difficulty:'easy', question:'What is the shortest verse in the Bible?', correct_answer:'"Jesus wept" (John 11:35)', wrong_answers:['"God is love"','Jesus said "I am"','Amen'] },
  { category:'bible', difficulty:'easy', question:'Who wrote the book of Revelation?', correct_answer:'John', wrong_answers:['Paul','Peter','James'] },
  { category:'bible', difficulty:'easy', question:'In which city did Pentecost occur?', correct_answer:'Jerusalem', wrong_answers:['Bethlehem','Antioch','Rome'] },
  { category:'bible', difficulty:'easy', question:'What are the first five books of the Bible collectively called?', correct_answer:'The Pentateuch (Torah)', wrong_answers:['The Gospels','The Epistles','The Prophecy Books'] },
  { category:'bible', difficulty:'easy', question:'Who succeeded Moses as leader of the Israelites?', correct_answer:'Joshua', wrong_answers:['Aaron','Caleb','Phinehas'] },
  { category:'bible', difficulty:'easy', question:'Which prophet was taken to heaven in a whirlwind?', correct_answer:'Elijah', wrong_answers:['Elisha','Enoch','Ezekiel'] },
  { category:'bible', difficulty:'easy', question:'Who was the father of King Solomon?', correct_answer:'David', wrong_answers:['Saul','Abraham','Moses'] },
  { category:'bible', difficulty:'easy', question:'How many days did it rain during the flood?', correct_answer:'40', wrong_answers:['7','14','100'] },

  // Medium
  { category:'bible', difficulty:'medium', question:'What was the name of Abraham\'s first son?', correct_answer:'Ishmael', wrong_answers:['Isaac','Jacob','Esau'] },
  { category:'bible', difficulty:'medium', question:'Who was Esther\'s cousin who raised her?', correct_answer:'Mordecai', wrong_answers:['Haman','Ahasuerus','Boaz'] },
  { category:'bible', difficulty:'medium', question:'How many New Testament letters are traditionally attributed to Paul (not counting Hebrews)?', correct_answer:'13', wrong_answers:['10','7','15'] },
  { category:'bible', difficulty:'medium', question:'Which book of the Bible has the most chapters?', correct_answer:'Psalms', wrong_answers:['Isaiah','Jeremiah','Genesis'] },
  { category:'bible', difficulty:'medium', question:'Who was the mother of the prophet Samuel?', correct_answer:'Hannah', wrong_answers:['Peninnah','Rachel','Elizabeth'] },
  { category:'bible', difficulty:'medium', question:'In Acts, who fell dead after lying about the price of his land, along with his wife Sapphira?', correct_answer:'Ananias', wrong_answers:['Simon','Demetrius','Aeneas'] },
  { category:'bible', difficulty:'medium', question:'Who was chosen to replace Judas Iscariot as one of the Twelve?', correct_answer:'Matthias', wrong_answers:['Barnabas','Silas','Stephen'] },
  { category:'bible', difficulty:'medium', question:'Which book tells the story of a Moabite widow who became the great-grandmother of King David?', correct_answer:'Ruth', wrong_answers:['Esther','Judges','Lamentations'] },
  { category:'bible', difficulty:'medium', question:'On which island was John when he received the visions recorded in Revelation?', correct_answer:'Patmos', wrong_answers:['Crete','Cyprus','Malta'] },
  { category:'bible', difficulty:'medium', question:'According to Matthew, to which high priest was Jesus taken after his arrest?', correct_answer:'Caiaphas', wrong_answers:['Eli','Zadok','Hilkiah'] },
  { category:'bible', difficulty:'medium', question:'Goliath came from which Philistine city?', correct_answer:'Gath', wrong_answers:['Gaza','Ashdod','Ekron'] },
  { category:'bible', difficulty:'medium', question:'Who is considered the first Christian martyr?', correct_answer:'Stephen', wrong_answers:['James','Philip','Barnabas'] },
  { category:'bible', difficulty:'medium', question:'Which prophet married a woman named Gomer?', correct_answer:'Hosea', wrong_answers:['Amos','Micah','Joel'] },
  { category:'bible', difficulty:'medium', question:'Which book contains the words "Vanity of vanities; all is vanity"?', correct_answer:'Ecclesiastes', wrong_answers:['Proverbs','Job','Lamentations'] },
  { category:'bible', difficulty:'medium', question:'What was the name of Moses\'s father-in-law, the priest of Midian?', correct_answer:'Jethro', wrong_answers:['Laban','Hur','Balaam'] },
  { category:'bible', difficulty:'medium', question:'Who held up Moses\'s hands during the battle against the Amalekites?', correct_answer:'Aaron and Hur', wrong_answers:['Joshua and Caleb','Eleazar and Phinehas','Nadab and Abihu'] },
  { category:'bible', difficulty:'medium', question:'Which Babylonian king saw the "handwriting on the wall"?', correct_answer:'Belshazzar', wrong_answers:['Nebuchadnezzar','Darius','Cyrus'] },
  { category:'bible', difficulty:'medium', question:'In which city were the disciples first called Christians?', correct_answer:'Antioch', wrong_answers:['Jerusalem','Ephesus','Corinth'] },
  { category:'bible', difficulty:'medium', question:'What was the apostle Paul\'s trade?', correct_answer:'Tentmaker', wrong_answers:['Fisherman','Carpenter','Tax collector'] },
  { category:'bible', difficulty:'medium', question:'Which tribe of Israel received no territory of its own, serving as priests instead?', correct_answer:'Levi', wrong_answers:['Judah','Benjamin','Dan'] },
  { category:'bible', difficulty:'medium', question:'What was the name of the father of John the Baptist?', correct_answer:'Zechariah', wrong_answers:['Joachim','Simeon','Zebedee'] },
  { category:'bible', difficulty:'medium', question:'Which apostle was also called Didymus, "the Twin"?', correct_answer:'Thomas', wrong_answers:['Bartholomew','Thaddaeus','Philip'] },
  { category:'bible', difficulty:'medium', question:'At which pool in Jerusalem did Jesus heal a man who had been ill for 38 years?', correct_answer:'Bethesda', wrong_answers:['Siloam','Gihon','Hezekiah\'s Pool'] },
  { category:'bible', difficulty:'medium', question:'On which mountain did Elijah challenge the prophets of Baal?', correct_answer:'Mount Carmel', wrong_answers:['Mount Horeb','Mount Tabor','Mount Gilboa'] },
  { category:'bible', difficulty:'medium', question:'How many men did Gideon lead against the Midianites after God reduced his army?', correct_answer:'300', wrong_answers:['10,000','32,000','1,000'] },
  { category:'bible', difficulty:'medium', question:'Which Gospel writer does Paul call "the beloved physician"?', correct_answer:'Luke', wrong_answers:['Mark','Matthew','John'] },
  { category:'bible', difficulty:'medium', question:'Which king of Israel, urged on by Jezebel, had Naboth killed to take his vineyard?', correct_answer:'Ahab', wrong_answers:['Jeroboam','Omri','Jehu'] },
  { category:'bible', difficulty:'medium', question:'What was the name of Moses\'s wife?', correct_answer:'Zipporah', wrong_answers:['Miriam','Jochebed','Keturah'] },
  { category:'bible', difficulty:'medium', question:'Which Persian king decreed that the Jews could return and rebuild the temple?', correct_answer:'Cyrus', wrong_answers:['Darius','Artaxerxes','Xerxes'] },
  { category:'bible', difficulty:'medium', question:'Which of David\'s sons led a revolt and was caught by his head in an oak tree?', correct_answer:'Absalom', wrong_answers:['Amnon','Adonijah','Solomon'] },
  { category:'bible', difficulty:'medium', question:'The Septuagint is a translation of the Old Testament into which language?', correct_answer:'Greek', wrong_answers:['Latin','Aramaic','Syriac'] },
  { category:'bible', difficulty:'medium', question:'How many books make up the "Minor Prophets"?', correct_answer:'12', wrong_answers:['10','7','14'] },
  { category:'bible', difficulty:'medium', question:'Which prophetess judged Israel and led it to victory with Barak?', correct_answer:'Deborah', wrong_answers:['Jael','Miriam','Huldah'] },
  { category:'bible', difficulty:'medium', question:'Which prophet saw a vision of a valley of dry bones coming to life?', correct_answer:'Ezekiel', wrong_answers:['Isaiah','Daniel','Jeremiah'] },

  // Hard
  { category:'bible', difficulty:'hard', question:'Which king of Judah was struck with leprosy for burning incense in the temple?', correct_answer:'Uzziah', wrong_answers:['Hezekiah','Jehoshaphat','Amaziah'] },
  { category:'bible', difficulty:'hard', question:'Who took forbidden plunder from Jericho, causing Israel\'s defeat at Ai?', correct_answer:'Achan', wrong_answers:['Korah','Gehazi','Abiram'] },
  { category:'bible', difficulty:'hard', question:'Gehazi, who was struck with Naaman\'s leprosy, was the servant of which prophet?', correct_answer:'Elisha', wrong_answers:['Elijah','Samuel','Nathan'] },
  { category:'bible', difficulty:'hard', question:'Which book of the Bible never mentions God by name?', correct_answer:'Esther', wrong_answers:['Ruth','Ecclesiastes','Lamentations'] },
  { category:'bible', difficulty:'hard', question:'What is the shortest book in the Old Testament?', correct_answer:'Obadiah', wrong_answers:['Haggai','Nahum','Jonah'] },
  { category:'bible', difficulty:'hard', question:'What was the name of Naomi\'s husband?', correct_answer:'Elimelech', wrong_answers:['Boaz','Mahlon','Obed'] },
  { category:'bible', difficulty:'hard', question:'Whom did Abraham marry after Sarah\'s death?', correct_answer:'Keturah', wrong_answers:['Hagar','Milcah','Bilhah'] },
  { category:'bible', difficulty:'hard', question:'Who was the father of the prophet Jonah?', correct_answer:'Amittai', wrong_answers:['Amoz','Buzi','Beeri'] },
  { category:'bible', difficulty:'hard', question:'Who was the father of the prophet Isaiah?', correct_answer:'Amoz', wrong_answers:['Amos','Hilkiah','Amittai'] },
  { category:'bible', difficulty:'hard', question:'In Acts, the Jews of which city were praised for examining the Scriptures daily?', correct_answer:'Berea', wrong_answers:['Thessalonica','Philippi','Corinth'] },
  { category:'bible', difficulty:'hard', question:'Which book comes immediately after Obadiah?', correct_answer:'Jonah', wrong_answers:['Micah','Amos','Nahum'] },
  { category:'bible', difficulty:'hard', question:'What was the name of Moses\'s mother?', correct_answer:'Jochebed', wrong_answers:['Zipporah','Miriam','Elisheba'] },
  { category:'bible', difficulty:'hard', question:'Nehemiah served as cupbearer to which Persian king?', correct_answer:'Artaxerxes', wrong_answers:['Cyrus','Darius','Ahasuerus'] },
  { category:'bible', difficulty:'hard', question:'The Ethiopian eunuch baptized by Philip served which queen?', correct_answer:'Candace', wrong_answers:['Sheba','Vashti','Bernice'] },
  { category:'bible', difficulty:'hard', question:'Paul\'s letter to Philemon concerns which runaway slave?', correct_answer:'Onesimus', wrong_answers:['Tychicus','Epaphras','Eutychus'] },
  { category:'bible', difficulty:'hard', question:'Besides Hebrew, what language are parts of Daniel and Ezra written in?', correct_answer:'Aramaic', wrong_answers:['Greek','Akkadian','Persian'] },
  { category:'bible', difficulty:'hard', question:'Which judge made a rash vow that cost him his daughter?', correct_answer:'Jephthah', wrong_answers:['Gideon','Samson','Ehud'] },
  { category:'bible', difficulty:'hard', question:'Who was the father of Joshua?', correct_answer:'Nun', wrong_answers:['Jephunneh','Amram','Hur'] },
  { category:'bible', difficulty:'hard', question:'Which king of Tyre supplied cedar for Solomon\'s temple?', correct_answer:'Hiram', wrong_answers:['Ben-hadad','Ethbaal','Hadadezer'] },
  { category:'bible', difficulty:'hard', question:'In which Hebrew month is Purim celebrated?', correct_answer:'Adar', wrong_answers:['Nisan','Tishri','Elul'] },
  { category:'bible', difficulty:'hard', question:'Which left-handed judge killed Eglon, king of Moab?', correct_answer:'Ehud', wrong_answers:['Othniel','Shamgar','Jephthah'] },
  { category:'bible', difficulty:'hard', question:'Which young man fell asleep and fell from a third-story window while Paul preached at Troas?', correct_answer:'Eutychus', wrong_answers:['Onesimus','Tychicus','Trophimus'] },
  { category:'bible', difficulty:'hard', question:'Which prophet was told to lie on his left side for 390 days?', correct_answer:'Ezekiel', wrong_answers:['Jeremiah','Hosea','Isaiah'] },
  { category:'bible', difficulty:'hard', question:'How many chapters are in the book of Isaiah?', correct_answer:'66', wrong_answers:['52','48','40'] },
  { category:'bible', difficulty:'hard', question:'How many years did Solomon reign over Israel?', correct_answer:'40', wrong_answers:['20','33','50'] },
  { category:'bible', difficulty:'hard', question:'Who was the father of Methuselah?', correct_answer:'Enoch', wrong_answers:['Seth','Lamech','Jared'] },
  { category:'bible', difficulty:'hard', question:'Which king of Salem, a priest of God Most High, blessed Abram?', correct_answer:'Melchizedek', wrong_answers:['Abimelech','Jethro','Lot'] },
  { category:'bible', difficulty:'hard', question:'Which two sons of Aaron were consumed by fire for offering "strange fire"?', correct_answer:'Nadab and Abihu', wrong_answers:['Eleazar and Ithamar','Hophni and Phinehas','Korah and Dathan'] },
  { category:'bible', difficulty:'hard', question:'What were the names of the high priest Eli\'s two wicked sons?', correct_answer:'Hophni and Phinehas', wrong_answers:['Nadab and Abihu','Eleazar and Ithamar','Joel and Abijah'] },
];

const HISTORY_QUESTIONS = [
  // Easy
  { category:'history', difficulty:'easy', question:'In what year did World War II end?', correct_answer:'1945', wrong_answers:['1939','1944','1918'] },
  { category:'history', difficulty:'easy', question:'Who was the first President of the United States?', correct_answer:'George Washington', wrong_answers:['Thomas Jefferson','John Adams','Benjamin Franklin'] },
  { category:'history', difficulty:'easy', question:'In what year did America declare independence?', correct_answer:'1776', wrong_answers:['1783','1765','1812'] },
  { category:'history', difficulty:'easy', question:'What year did the Titanic sink?', correct_answer:'1912', wrong_answers:['1905','1920','1898'] },
  { category:'history', difficulty:'easy', question:'Who painted the Sistine Chapel ceiling?', correct_answer:'Michelangelo', wrong_answers:['Leonardo da Vinci','Raphael','Botticelli'] },
  { category:'history', difficulty:'easy', question:'In what year did the Berlin Wall fall?', correct_answer:'1989', wrong_answers:['1991','1979','1985'] },
  { category:'history', difficulty:'easy', question:'What ancient wonder was located in Alexandria?', correct_answer:'The Lighthouse of Alexandria', wrong_answers:['The Colossus of Rhodes','The Hanging Gardens','The Statue of Zeus'] },
  { category:'history', difficulty:'easy', question:'Who was the first to walk on the Moon?', correct_answer:'Neil Armstrong', wrong_answers:['Buzz Aldrin','Yuri Gagarin','John Glenn'] },
  { category:'history', difficulty:'easy', question:'Which country was first to grant women the right to vote?', correct_answer:'New Zealand', wrong_answers:['USA','UK','Australia'] },
  { category:'history', difficulty:'easy', question:'Who invented the telephone?', correct_answer:'Alexander Graham Bell', wrong_answers:['Thomas Edison','Nikola Tesla','Samuel Morse'] },
  { category:'history', difficulty:'easy', question:'What was the name of the ship on which the Pilgrims traveled to America?', correct_answer:'Mayflower', wrong_answers:['Santa Maria','Pinta','HMS Endeavour'] },
  { category:'history', difficulty:'easy', question:'What war was fought between the North and South in the United States?', correct_answer:'The Civil War', wrong_answers:['The Revolutionary War','The War of 1812','The Mexican-American War'] },
  { category:'history', difficulty:'easy', question:'Who led the Indian independence movement?', correct_answer:'Mahatma Gandhi', wrong_answers:['Jawaharlal Nehru','Subhas Chandra Bose','Indira Gandhi'] },
  { category:'history', difficulty:'easy', question:'What ancient structure was built by the Egyptian pharaohs as tombs?', correct_answer:'Pyramids', wrong_answers:['Ziggurats','Temples','Mausoleums'] },
  { category:'history', difficulty:'easy', question:'What was the name of the first artificial satellite launched into space?', correct_answer:'Sputnik 1', wrong_answers:['Explorer 1','Vostok 1','Mercury 1'] },
  { category:'history', difficulty:'easy', question:'Who wrote the Declaration of Independence?', correct_answer:'Thomas Jefferson', wrong_answers:['Benjamin Franklin','John Adams','James Madison'] },
  { category:'history', difficulty:'easy', question:'During which decade did the Great Depression occur?', correct_answer:'1930s', wrong_answers:['1920s','1940s','1950s'] },
  { category:'history', difficulty:'easy', question:'Who was the first female Prime Minister of the United Kingdom?', correct_answer:'Margaret Thatcher', wrong_answers:['Theresa May','Queen Victoria','Elizabeth Fry'] },

  // Medium
  { category:'history', difficulty:'medium', question:'Who was the last Pharaoh of ancient Egypt?', correct_answer:'Cleopatra VII', wrong_answers:['Nefertiti','Hatshepsut','Ramesses II'] },
  { category:'history', difficulty:'medium', question:'In what year did the French Revolution begin?', correct_answer:'1789', wrong_answers:['1776','1799','1815'] },
  { category:'history', difficulty:'medium', question:'Who signed the Magna Carta?', correct_answer:'King John of England', wrong_answers:['King Henry VIII','Richard the Lionheart','William the Conqueror'] },
  { category:'history', difficulty:'medium', question:'What was the name of the first African-American Supreme Court Justice?', correct_answer:'Thurgood Marshall', wrong_answers:['Clarence Thomas','John Marshall','Oliver Wendell Holmes'] },
  { category:'history', difficulty:'medium', question:'Which treaty formally ended the American Revolutionary War?', correct_answer:'Treaty of Paris', wrong_answers:['Treaty of Ghent','Treaty of Versailles','Treaty of Utrecht'] },
  { category:'history', difficulty:'medium', question:'In what year was the Battle of Hastings fought?', correct_answer:'1066', wrong_answers:['1087','1016','1154'] },
  { category:'history', difficulty:'medium', question:'Who was U.S. president during the War of 1812?', correct_answer:'James Madison', wrong_answers:['Thomas Jefferson','James Monroe','John Adams'] },
  { category:'history', difficulty:'medium', question:'Which city served as the capital of the Confederacy for most of the Civil War?', correct_answer:'Richmond', wrong_answers:['Atlanta','Montgomery','Charleston'] },
  { category:'history', difficulty:'medium', question:'In which decade did the Suez Canal open?', correct_answer:'1860s', wrong_answers:['1840s','1880s','1900s'] },
  { category:'history', difficulty:'medium', question:'Who was the Roman emperor when Jesus was born?', correct_answer:'Augustus', wrong_answers:['Tiberius','Nero','Julius Caesar'] },
  { category:'history', difficulty:'medium', question:'Which Chinese dynasty built most of the Great Wall as it stands today?', correct_answer:'Ming', wrong_answers:['Qin','Han','Tang'] },
  { category:'history', difficulty:'medium', question:'Who was Britain\'s prime minister when World War II began in 1939?', correct_answer:'Neville Chamberlain', wrong_answers:['Winston Churchill','Stanley Baldwin','Clement Attlee'] },
  { category:'history', difficulty:'medium', question:'The Battle of Waterloo was fought in which present-day country?', correct_answer:'Belgium', wrong_answers:['France','Netherlands','Germany'] },
  { category:'history', difficulty:'medium', question:'Which U.S. president made the Louisiana Purchase?', correct_answer:'Thomas Jefferson', wrong_answers:['James Madison','John Adams','James Monroe'] },
  { category:'history', difficulty:'medium', question:'In what year is the Western Roman Empire traditionally said to have fallen?', correct_answer:'476', wrong_answers:['410','527','1453'] },
  { category:'history', difficulty:'medium', question:'Who was the first Tudor monarch of England?', correct_answer:'Henry VII', wrong_answers:['Henry VIII','Richard III','Edward IV'] },
  { category:'history', difficulty:'medium', question:'Who wrote "The Prince," a classic of political philosophy?', correct_answer:'Niccolò Machiavelli', wrong_answers:['Dante Alighieri','Desiderius Erasmus','Thomas More'] },
  { category:'history', difficulty:'medium', question:'The Alamo is in which present-day U.S. city?', correct_answer:'San Antonio', wrong_answers:['Austin','Houston','El Paso'] },
  { category:'history', difficulty:'medium', question:'Which empire did Hernán Cortés conquer?', correct_answer:'Aztec Empire', wrong_answers:['Inca Empire','Maya civilization','Olmec civilization'] },
  { category:'history', difficulty:'medium', question:'Who was the last Tsar of Russia?', correct_answer:'Nicholas II', wrong_answers:['Alexander III','Alexander II','Peter III'] },
  { category:'history', difficulty:'medium', question:'The Rosetta Stone was the key to deciphering which writing system?', correct_answer:'Egyptian hieroglyphs', wrong_answers:['Cuneiform','Linear B','Maya glyphs'] },
  { category:'history', difficulty:'medium', question:'Who was the first Roman emperor to convert to Christianity?', correct_answer:'Constantine I', wrong_answers:['Theodosius I','Justinian I','Diocletian'] },
  { category:'history', difficulty:'medium', question:'What was the first permanent English settlement in North America, founded in 1607?', correct_answer:'Jamestown', wrong_answers:['Plymouth','Roanoke','St. Augustine'] },
  { category:'history', difficulty:'medium', question:'Which Carthaginian general crossed the Alps with war elephants?', correct_answer:'Hannibal', wrong_answers:['Hamilcar','Hasdrubal','Scipio'] },
  { category:'history', difficulty:'medium', question:'Who was king of Great Britain during the American Revolution?', correct_answer:'George III', wrong_answers:['George II','William IV','George IV'] },
  { category:'history', difficulty:'medium', question:'In what year was the Battle of Gettysburg fought?', correct_answer:'1863', wrong_answers:['1862','1864','1861'] },
  { category:'history', difficulty:'medium', question:'Which general surrendered at Appomattox Court House in 1865?', correct_answer:'Robert E. Lee', wrong_answers:['Stonewall Jackson','J.E.B. Stuart','James Longstreet'] },
  { category:'history', difficulty:'medium', question:'In what year did Constantinople fall to the Ottoman Turks?', correct_answer:'1453', wrong_answers:['1204','1492','1389'] },
  { category:'history', difficulty:'medium', question:'Which Frankish king was crowned emperor by Pope Leo III on Christmas Day in 800?', correct_answer:'Charlemagne', wrong_answers:['Charles Martel','Pepin the Short','Louis the Pious'] },

  // Hard
  { category:'history', difficulty:'hard', question:'Who led the Frankish army that defeated the Umayyad invasion at the Battle of Tours in 732?', correct_answer:'Charles Martel', wrong_answers:['Pepin the Short','Charlemagne','Clovis I'] },
  { category:'history', difficulty:'hard', question:'Which 1494 treaty divided newly discovered lands between Spain and Portugal?', correct_answer:'Treaty of Tordesillas', wrong_answers:['Treaty of Zaragoza','Treaty of Utrecht','Peace of Westphalia'] },
  { category:'history', difficulty:'hard', question:'Which Byzantine emperor built the Hagia Sophia that stands today, completed in 537?', correct_answer:'Justinian I', wrong_answers:['Constantine I','Theodosius II','Heraclius'] },
  { category:'history', difficulty:'hard', question:'In what year was the First Council of Nicaea held?', correct_answer:'325', wrong_answers:['313','381','451'] },
  { category:'history', difficulty:'hard', question:'Which English king was killed at the Battle of Bosworth Field in 1485?', correct_answer:'Richard III', wrong_answers:['Henry VI','Edward V','Richard II'] },
  { category:'history', difficulty:'hard', question:'Who was Abraham Lincoln\'s vice president during his first term?', correct_answer:'Hannibal Hamlin', wrong_answers:['Andrew Johnson','William Seward','Schuyler Colfax'] },
  { category:'history', difficulty:'hard', question:'The Defenestration of Prague in 1618 helped spark which war?', correct_answer:'Thirty Years\' War', wrong_answers:['Hundred Years\' War','Seven Years\' War','War of the Spanish Succession'] },
  { category:'history', difficulty:'hard', question:'Who became the first emperor of a unified China in 221 BC?', correct_answer:'Qin Shi Huang', wrong_answers:['Liu Bang','Kublai Khan','Emperor Wu of Han'] },
  { category:'history', difficulty:'hard', question:'The Edict of Nantes (1598) granted religious rights to which group?', correct_answer:'Huguenots', wrong_answers:['Jansenists','Cathars','Anabaptists'] },
  { category:'history', difficulty:'hard', question:'Which U.S. president was the first to serve two non-consecutive terms?', correct_answer:'Grover Cleveland', wrong_answers:['Benjamin Harrison','Chester A. Arthur','Rutherford B. Hayes'] },
  { category:'history', difficulty:'hard', question:'The Peace of Augsburg (1555) established which principle for the German states?', correct_answer:'Cuius regio, eius religio', wrong_answers:['Sola scriptura','Divine right of kings','Balance of power'] },
  { category:'history', difficulty:'hard', question:'Which Roman general was killed after his defeat by the Parthians at Carrhae in 53 BC?', correct_answer:'Marcus Licinius Crassus', wrong_answers:['Pompey the Great','Mark Antony','Publius Quinctilius Varus'] },
  { category:'history', difficulty:'hard', question:'In which battle were three Roman legions under Varus destroyed in AD 9?', correct_answer:'Battle of the Teutoburg Forest', wrong_answers:['Battle of Cannae','Battle of Adrianople','Battle of Alesia'] },
  { category:'history', difficulty:'hard', question:'Which Ottoman sultan conquered Constantinople in 1453?', correct_answer:'Mehmed II', wrong_answers:['Suleiman the Magnificent','Selim I','Bayezid I'] },
  { category:'history', difficulty:'hard', question:'Which Austrian statesman chaired the Congress of Vienna (1814–1815)?', correct_answer:'Klemens von Metternich', wrong_answers:['Charles-Maurice de Talleyrand','Otto von Bismarck','Viscount Castlereagh'] },
  { category:'history', difficulty:'hard', question:'Who was the first president of the First Continental Congress in 1774?', correct_answer:'Peyton Randolph', wrong_answers:['John Hancock','Henry Laurens','John Jay'] },
  { category:'history', difficulty:'hard', question:'The 1917 Zimmermann Telegram proposed a German alliance with which country?', correct_answer:'Mexico', wrong_answers:['Spain','Argentina','Sweden'] },
  { category:'history', difficulty:'hard', question:'Which pope launched the First Crusade in 1095?', correct_answer:'Urban II', wrong_answers:['Gregory VII','Innocent III','Leo IX'] },
  { category:'history', difficulty:'hard', question:'Which English king won the Battle of Agincourt in 1415?', correct_answer:'Henry V', wrong_answers:['Edward III','Henry IV','Richard II'] },
  { category:'history', difficulty:'hard', question:'The Mausoleum at Halicarnassus was built as the tomb of which ruler?', correct_answer:'Mausolus', wrong_answers:['Croesus','Darius I','Ptolemy I'] },
  { category:'history', difficulty:'hard', question:'Which Assyrian king\'s library at Nineveh preserved the Epic of Gilgamesh?', correct_answer:'Ashurbanipal', wrong_answers:['Sennacherib','Sargon II','Tiglath-Pileser III'] },
  { category:'history', difficulty:'hard', question:'Which Chief Justice wrote the opinion in Marbury v. Madison (1803)?', correct_answer:'John Marshall', wrong_answers:['John Jay','Roger B. Taney','Oliver Ellsworth'] },
  { category:'history', difficulty:'hard', question:'Besides the Thirty Years\' War, which long conflict did the Peace of Westphalia (1648) end?', correct_answer:'Eighty Years\' War', wrong_answers:['Hundred Years\' War','Wars of the Roses','Nine Years\' War'] },
  { category:'history', difficulty:'hard', question:'Which king led the Visigoths when they sacked Rome in 410?', correct_answer:'Alaric I', wrong_answers:['Attila','Odoacer','Genseric'] },
  { category:'history', difficulty:'hard', question:'The naval Battle of Lepanto (1571) was fought between the Holy League and which empire?', correct_answer:'Ottoman Empire', wrong_answers:['Mughal Empire','Safavid Empire','Byzantine Empire'] },
  { category:'history', difficulty:'hard', question:'The Battle of Hattin (1187) opened the way for which leader to capture Jerusalem?', correct_answer:'Saladin', wrong_answers:['Baibars','Nur ad-Din','Zengi'] },
];

// More history (added September 2026 to cut down on repeats)
const HISTORY_MORE = [
  // Easy
  { category:'history', difficulty:'easy', question:'What was the name of the ship Christopher Columbus sailed on his first voyage in 1492?', correct_answer:'Santa María', wrong_answers:['Mayflower','Golden Hind','Victoria'] },
  { category:'history', difficulty:'easy', question:'Who crowned himself the first Emperor of the French in 1804?', correct_answer:'Napoleon Bonaparte', wrong_answers:['Louis XIV','Charlemagne','Louis-Philippe'] },
  { category:'history', difficulty:'easy', question:'Which U.S. president delivered the Gettysburg Address?', correct_answer:'Abraham Lincoln', wrong_answers:['Ulysses S. Grant','Andrew Johnson','James Buchanan'] },
  { category:'history', difficulty:'easy', question:'In what year did World War I begin?', correct_answer:'1914', wrong_answers:['1912','1916','1918'] },
  { category:'history', difficulty:'easy', question:'Which Roman city was buried by the eruption of Mount Vesuvius in AD 79?', correct_answer:'Pompeii', wrong_answers:['Carthage','Ostia','Syracuse'] },
  { category:'history', difficulty:'easy', question:'Which nurse became known as "The Lady with the Lamp" during the Crimean War?', correct_answer:'Florence Nightingale', wrong_answers:['Clara Barton','Mary Seacole','Edith Cavell'] },
  { category:'history', difficulty:'easy', question:'What was the Underground Railroad?', correct_answer:'A network that helped enslaved people escape to freedom', wrong_answers:['The first subway in New York City','A railroad built in secret by Union soldiers','Tunnels used to smuggle goods during Prohibition'] },
  { category:'history', difficulty:'easy', question:'Who gave the "I Have a Dream" speech in 1963?', correct_answer:'Martin Luther King Jr.', wrong_answers:['Malcolm X','John F. Kennedy','Frederick Douglass'] },
  { category:'history', difficulty:'easy', question:'Which country gave the Statue of Liberty to the United States?', correct_answer:'France', wrong_answers:['Great Britain','Spain','Italy'] },
  { category:'history', difficulty:'easy', question:'Which brothers made the first powered airplane flight in 1903?', correct_answer:'The Wright brothers', wrong_answers:['The Montgolfier brothers','The Mayo brothers','The Dodge brothers'] },
  { category:'history', difficulty:'easy', question:'Who was Britain\'s prime minister for most of World War II?', correct_answer:'Winston Churchill', wrong_answers:['Neville Chamberlain','Clement Attlee','Anthony Eden'] },
  { category:'history', difficulty:'easy', question:'In which city was President John F. Kennedy assassinated?', correct_answer:'Dallas', wrong_answers:['Houston','Chicago','Washington, D.C.'] },
  { category:'history', difficulty:'easy', question:'Which Greek city-state sent the famous 300 to fight at Thermopylae?', correct_answer:'Sparta', wrong_answers:['Athens','Corinth','Thebes'] },
  { category:'history', difficulty:'easy', question:'Who discovered penicillin in 1928?', correct_answer:'Alexander Fleming', wrong_answers:['Louis Pasteur','Joseph Lister','Marie Curie'] },
  { category:'history', difficulty:'easy', question:'What wall did the Romans begin building across northern England in AD 122?', correct_answer:'Hadrian\'s Wall', wrong_answers:['The Antonine Wall','Offa\'s Dyke','The Aurelian Wall'] },
  { category:'history', difficulty:'easy', question:'Who was the first woman to fly solo across the Atlantic Ocean?', correct_answer:'Amelia Earhart', wrong_answers:['Bessie Coleman','Harriet Quimby','Jacqueline Cochran'] },
  { category:'history', difficulty:'easy', question:'Which British queen reigned for more than 63 years in the 1800s?', correct_answer:'Queen Victoria', wrong_answers:['Queen Anne','Queen Elizabeth I','Queen Mary II'] },
  { category:'history', difficulty:'easy', question:'Julius Caesar was a leader of which ancient civilization?', correct_answer:'Rome', wrong_answers:['Greece','Egypt','Persia'] },
  { category:'history', difficulty:'easy', question:'Which war did the American colonies fight against Great Britain from 1775 to 1783?', correct_answer:'The American Revolutionary War', wrong_answers:['The War of 1812','The French and Indian War','The Civil War'] },
  { category:'history', difficulty:'easy', question:'Which founding document begins with the words "We the People"?', correct_answer:'The U.S. Constitution', wrong_answers:['The Declaration of Independence','The Articles of Confederation','The Mayflower Compact'] },
  { category:'history', difficulty:'easy', question:'In what year did Christopher Columbus first reach the Americas?', correct_answer:'1492', wrong_answers:['1488','1500','1519'] },
  { category:'history', difficulty:'easy', question:'Germany\'s invasion of which country on September 1, 1939 started World War II in Europe?', correct_answer:'Poland', wrong_answers:['France','Czechoslovakia','Belgium'] },
  { category:'history', difficulty:'easy', question:'What attack on December 7, 1941 brought the United States into World War II?', correct_answer:'The attack on Pearl Harbor', wrong_answers:['The invasion of Poland','The sinking of the Lusitania','The bombing of London'] },
  { category:'history', difficulty:'easy', question:'Who was the first person to travel into space, in 1961?', correct_answer:'Yuri Gagarin', wrong_answers:['Alan Shepard','John Glenn','Neil Armstrong'] },
  { category:'history', difficulty:'easy', question:'In which country were the ancient Olympic Games held?', correct_answer:'Greece', wrong_answers:['Italy','Egypt','Turkey'] },
  { category:'history', difficulty:'easy', question:'Which English queen never married and was called the "Virgin Queen"?', correct_answer:'Elizabeth I', wrong_answers:['Mary I','Victoria','Anne'] },
  { category:'history', difficulty:'easy', question:'What was the great revival of art and learning that began in 14th-century Italy called?', correct_answer:'The Renaissance', wrong_answers:['The Reformation','The Enlightenment','The Industrial Revolution'] },
  { category:'history', difficulty:'easy', question:'Who was the first U.S. president to resign from office?', correct_answer:'Richard Nixon', wrong_answers:['Andrew Johnson','Lyndon B. Johnson','Bill Clinton'] },
  { category:'history', difficulty:'easy', question:'Which inventor developed a practical light bulb and the phonograph?', correct_answer:'Thomas Edison', wrong_answers:['Nikola Tesla','Benjamin Franklin','George Westinghouse'] },
  { category:'history', difficulty:'easy', question:'Whose expedition was the first to sail all the way around the world?', correct_answer:'Ferdinand Magellan\'s', wrong_answers:['Vasco da Gama\'s','Francis Drake\'s','James Cook\'s'] },

  // Medium
  { category:'history', difficulty:'medium', question:'Which state became the 50th U.S. state in 1959?', correct_answer:'Hawaii', wrong_answers:['Alaska','Arizona','New Mexico'] },
  { category:'history', difficulty:'medium', question:'Who led the first expedition to reach the South Pole, in 1911?', correct_answer:'Roald Amundsen', wrong_answers:['Robert Falcon Scott','Ernest Shackleton','Richard Byrd'] },
  { category:'history', difficulty:'medium', question:'Who was the first U.S. president to live in the White House?', correct_answer:'John Adams', wrong_answers:['George Washington','Thomas Jefferson','James Madison'] },
  { category:'history', difficulty:'medium', question:'Who posted the Ninety-five Theses in 1517?', correct_answer:'Martin Luther', wrong_answers:['John Calvin','Huldrych Zwingli','John Wycliffe'] },
  { category:'history', difficulty:'medium', question:'Before World War I, Germany, Austria-Hungary and Italy formed which alliance?', correct_answer:'The Triple Alliance', wrong_answers:['The Triple Entente','The Axis','The Holy Alliance'] },
  { category:'history', difficulty:'medium', question:'Who was called the "Maid of Orléans"?', correct_answer:'Joan of Arc', wrong_answers:['Eleanor of Aquitaine','Catherine de\' Medici','Anne of Brittany'] },
  { category:'history', difficulty:'medium', question:'The Hundred Years\' War was fought mainly between which two kingdoms?', correct_answer:'England and France', wrong_answers:['England and Spain','France and Spain','England and Scotland'] },
  { category:'history', difficulty:'medium', question:'Who became the first chancellor of the unified German Empire in 1871?', correct_answer:'Otto von Bismarck', wrong_answers:['Wilhelm I','Leo von Caprivi','Friedrich Ebert'] },
  { category:'history', difficulty:'medium', question:'What was the code name for the Allied invasion of Normandy in 1944?', correct_answer:'Operation Overlord', wrong_answers:['Operation Market Garden','Operation Torch','Operation Barbarossa'] },
  { category:'history', difficulty:'medium', question:'Who founded the Mongol Empire?', correct_answer:'Genghis Khan', wrong_answers:['Kublai Khan','Tamerlane','Ögedei Khan'] },
  { category:'history', difficulty:'medium', question:'Which ancient Greek writer is called the "Father of History"?', correct_answer:'Herodotus', wrong_answers:['Thucydides','Xenophon','Plutarch'] },
  { category:'history', difficulty:'medium', question:'Who was president of the Confederate States of America?', correct_answer:'Jefferson Davis', wrong_answers:['Alexander Stephens','Robert E. Lee','John C. Calhoun'] },
  { category:'history', difficulty:'medium', question:'In which century did the Black Death sweep through Europe?', correct_answer:'The 14th century', wrong_answers:['The 12th century','The 16th century','The 10th century'] },
  { category:'history', difficulty:'medium', question:'What was the American program to rebuild Western Europe after World War II called?', correct_answer:'The Marshall Plan', wrong_answers:['The New Deal','The Truman Doctrine','Lend-Lease'] },
  { category:'history', difficulty:'medium', question:'Which 1867 purchase from Russia was mocked as "Seward\'s Folly"?', correct_answer:'Alaska', wrong_answers:['Hawaii','The Oregon Country','The Yukon'] },
  { category:'history', difficulty:'medium', question:'Which queen was executed in 1587 on the orders of Elizabeth I?', correct_answer:'Mary, Queen of Scots', wrong_answers:['Lady Jane Grey','Anne Boleyn','Catherine Howard'] },
  { category:'history', difficulty:'medium', question:'Which Chinese dynasty ruled when Marco Polo visited Kublai Khan?', correct_answer:'The Yuan dynasty', wrong_answers:['The Ming dynasty','The Song dynasty','The Tang dynasty'] },
  { category:'history', difficulty:'medium', question:'Who led the Soviet Union during World War II?', correct_answer:'Joseph Stalin', wrong_answers:['Vladimir Lenin','Nikita Khrushchev','Leon Trotsky'] },
  { category:'history', difficulty:'medium', question:'Which U.S. president launched the New Deal?', correct_answer:'Franklin D. Roosevelt', wrong_answers:['Herbert Hoover','Harry S. Truman','Woodrow Wilson'] },
  { category:'history', difficulty:'medium', question:'In what year did the Wall Street Crash begin the Great Depression?', correct_answer:'1929', wrong_answers:['1919','1933','1939'] },
  { category:'history', difficulty:'medium', question:'The "Charge of the Light Brigade" took place at which 1854 battle?', correct_answer:'The Battle of Balaclava', wrong_answers:['The Battle of Inkerman','The Battle of the Alma','The Siege of Sevastopol'] },
  { category:'history', difficulty:'medium', question:'Who was the first European to reach India by sea, in 1498?', correct_answer:'Vasco da Gama', wrong_answers:['Bartolomeu Dias','Ferdinand Magellan','Pedro Álvares Cabral'] },
  { category:'history', difficulty:'medium', question:'The Council of Trent was a key part of which movement?', correct_answer:'The Counter-Reformation', wrong_answers:['The Protestant Reformation','The Great Schism','The Enlightenment'] },
  { category:'history', difficulty:'medium', question:'Suleiman the Magnificent ruled which empire?', correct_answer:'The Ottoman Empire', wrong_answers:['The Safavid Empire','The Mughal Empire','The Byzantine Empire'] },
  { category:'history', difficulty:'medium', question:'Which English colony of the 1580s became known as the "Lost Colony"?', correct_answer:'Roanoke', wrong_answers:['Jamestown','Plymouth','St. Augustine'] },
  { category:'history', difficulty:'medium', question:'Which treaty ended World War I between the Allies and Germany?', correct_answer:'The Treaty of Versailles', wrong_answers:['The Treaty of Paris','The Treaty of Ghent','The Treaty of Brest-Litovsk'] },
  { category:'history', difficulty:'medium', question:'Who was the Aztec emperor when Hernán Cortés arrived?', correct_answer:'Moctezuma II', wrong_answers:['Cuauhtémoc','Atahualpa','Itzcóatl'] },
  { category:'history', difficulty:'medium', question:'Which of the Seven Wonders of the Ancient World stood at Olympia?', correct_answer:'The Statue of Zeus', wrong_answers:['The Colossus of Rhodes','The Temple of Artemis','The Mausoleum'] },
  { category:'history', difficulty:'medium', question:'In what year did the United States enter World War I?', correct_answer:'1917', wrong_answers:['1914','1915','1918'] },
  { category:'history', difficulty:'medium', question:'Which Russian ruler founded St. Petersburg in 1703?', correct_answer:'Peter the Great', wrong_answers:['Catherine the Great','Ivan the Terrible','Alexander I'] },
  { category:'history', difficulty:'medium', question:'The sinking of which ocean liner in 1915 turned American opinion against Germany?', correct_answer:'The Lusitania', wrong_answers:['The Titanic','The Britannic','The Maine'] },
  { category:'history', difficulty:'medium', question:'Who was the first U.S. president to be impeached?', correct_answer:'Andrew Johnson', wrong_answers:['Richard Nixon','Andrew Jackson','Bill Clinton'] },
  { category:'history', difficulty:'medium', question:'What was the capital of the Byzantine Empire?', correct_answer:'Constantinople', wrong_answers:['Rome','Antioch','Alexandria'] },
  { category:'history', difficulty:'medium', question:'The Treaty of Ghent (1814) ended which war?', correct_answer:'The War of 1812', wrong_answers:['The Revolutionary War','The Mexican–American War','The French and Indian War'] },
  { category:'history', difficulty:'medium', question:'The Battle of the Bulge (1944–45) was fought mainly in which forested region?', correct_answer:'The Ardennes', wrong_answers:['Normandy','The Black Forest','Alsace'] },

  // Hard
  { category:'history', difficulty:'hard', question:'Who is the only person to have served as both U.S. president and Chief Justice?', correct_answer:'William Howard Taft', wrong_answers:['Charles Evans Hughes','John Marshall','Earl Warren'] },
  { category:'history', difficulty:'hard', question:'Which Frankish king converted to Catholic Christianity and was baptized at Reims?', correct_answer:'Clovis I', wrong_answers:['Pepin the Short','Childeric I','Dagobert I'] },
  { category:'history', difficulty:'hard', question:'Who was the last Byzantine emperor, killed when Constantinople fell in 1453?', correct_answer:'Constantine XI Palaiologos', wrong_answers:['John VIII Palaiologos','Manuel II Palaiologos','Alexios V Doukas'] },
  { category:'history', difficulty:'hard', question:'The Battle of Manzikert (1071) was a crushing defeat for which empire?', correct_answer:'The Byzantine Empire', wrong_answers:['The Holy Roman Empire','The Abbasid Caliphate','The Kingdom of Jerusalem'] },
  { category:'history', difficulty:'hard', question:'Which English king was nicknamed "Lackland"?', correct_answer:'John', wrong_answers:['Henry III','Richard I','Stephen'] },
  { category:'history', difficulty:'hard', question:'Which mother of Emperor Constantine was credited with finding the True Cross?', correct_answer:'Helena', wrong_answers:['Theodora','Fausta','Livia'] },
  { category:'history', difficulty:'hard', question:'Which pope convened the Council of Trent in 1545?', correct_answer:'Paul III', wrong_answers:['Pius IV','Julius III','Leo X'] },
  { category:'history', difficulty:'hard', question:'Which emperor presided over the Diet of Worms in 1521, where Luther refused to recant?', correct_answer:'Charles V', wrong_answers:['Maximilian I','Ferdinand I','Frederick III'] },
  { category:'history', difficulty:'hard', question:'Who commanded the Union army at the Battle of Gettysburg?', correct_answer:'George G. Meade', wrong_answers:['Joseph Hooker','Ulysses S. Grant','George B. McClellan'] },
  { category:'history', difficulty:'hard', question:'Which 1848 treaty ended the Mexican–American War?', correct_answer:'The Treaty of Guadalupe Hidalgo', wrong_answers:['The Treaties of Velasco','The Adams–Onís Treaty','The Gadsden Purchase'] },
  { category:'history', difficulty:'hard', question:'At Canossa in 1077, Emperor Henry IV sought forgiveness from which pope?', correct_answer:'Gregory VII', wrong_answers:['Urban II','Innocent III','Leo IX'] },
  { category:'history', difficulty:'hard', question:'Which Portuguese prince sponsored the early voyages down the African coast?', correct_answer:'Henry the Navigator', wrong_answers:['John II','Manuel I','Afonso V'] },
  { category:'history', difficulty:'hard', question:'Who founded the Mughal Empire in India?', correct_answer:'Babur', wrong_answers:['Akbar','Humayun','Aurangzeb'] },
  { category:'history', difficulty:'hard', question:'At which battle in 1066, weeks before Hastings, did Harold Godwinson defeat Harald Hardrada?', correct_answer:'Stamford Bridge', wrong_answers:['Fulford','Maldon','Brunanburh'] },
  { category:'history', difficulty:'hard', question:'Wat Tyler led which English uprising in 1381?', correct_answer:'The Peasants\' Revolt', wrong_answers:['Jack Cade\'s Rebellion','The Pilgrimage of Grace','Kett\'s Rebellion'] },
  { category:'history', difficulty:'hard', question:'Which U.S. president died just 31 days after taking office?', correct_answer:'William Henry Harrison', wrong_answers:['Zachary Taylor','James A. Garfield','Warren G. Harding'] },
  { category:'history', difficulty:'hard', question:'Which king of Macedon was the father of Alexander the Great?', correct_answer:'Philip II', wrong_answers:['Amyntas III','Perdiccas III','Antipater'] },
  { category:'history', difficulty:'hard', question:'At which battle in 331 BC did Alexander decisively defeat Darius III?', correct_answer:'Gaugamela', wrong_answers:['Issus','Granicus','Hydaspes'] },
  { category:'history', difficulty:'hard', question:'Which statesman led Athens at the outbreak of the Peloponnesian War?', correct_answer:'Pericles', wrong_answers:['Themistocles','Alcibiades','Cleon'] },
  { category:'history', difficulty:'hard', question:'Whose donation of land to the pope in 756 founded the Papal States?', correct_answer:'Pepin the Short', wrong_answers:['Charlemagne','Charles Martel','Louis the Pious'] },
  { category:'history', difficulty:'hard', question:'Who was Roman emperor when the Temple in Jerusalem was destroyed in AD 70?', correct_answer:'Vespasian', wrong_answers:['Titus','Nero','Domitian'] },
  { category:'history', difficulty:'hard', question:'Which conquistador led the Spanish conquest of the Inca Empire?', correct_answer:'Francisco Pizarro', wrong_answers:['Diego de Almagro','Hernán Cortés','Hernando de Soto'] },
  { category:'history', difficulty:'hard', question:'The Glorious Revolution of 1688 brought which monarchs to the English throne?', correct_answer:'William III and Mary II', wrong_answers:['James II and Mary of Modena','Charles II and Catherine of Braganza','George I and Sophia Dorothea'] },
  { category:'history', difficulty:'hard', question:'Which battle in 1453 effectively ended the Hundred Years\' War?', correct_answer:'The Battle of Castillon', wrong_answers:['The Battle of Agincourt','The Battle of Crécy','The Battle of Poitiers'] },
  { category:'history', difficulty:'hard', question:'Which Roman general defeated Hannibal at Zama in 202 BC?', correct_answer:'Scipio Africanus', wrong_answers:['Fabius Maximus','Scipio Aemilianus','Claudius Marcellus'] },
  { category:'history', difficulty:'hard', question:'In what year was the Missouri Compromise passed?', correct_answer:'1820', wrong_answers:['1850','1854','1803'] },
  { category:'history', difficulty:'hard', question:'Which 1857 Supreme Court decision held that African Americans could not be U.S. citizens?', correct_answer:'Dred Scott v. Sandford', wrong_answers:['Plessy v. Ferguson','McCulloch v. Maryland','Worcester v. Georgia'] },
  { category:'history', difficulty:'hard', question:'Whose succession to the Habsburg lands set off the War of the Austrian Succession in 1740?', correct_answer:'Maria Theresa', wrong_answers:['Maria Anna','Elisabeth Christine','Marie Antoinette'] },
  { category:'history', difficulty:'hard', question:'Which Russian tsar emancipated the serfs in 1861?', correct_answer:'Alexander II', wrong_answers:['Nicholas I','Alexander III','Alexander I'] },
  { category:'history', difficulty:'hard', question:'Which Anglo-Saxon king defeated the Danes at the Battle of Edington in 878?', correct_answer:'Alfred the Great', wrong_answers:['Æthelred the Unready','Edward the Elder','Athelstan'] },
  { category:'history', difficulty:'hard', question:'Which church father wrote "The City of God" after the sack of Rome in 410?', correct_answer:'Augustine of Hippo', wrong_answers:['Jerome','Ambrose of Milan','John Chrysostom'] },
  { category:'history', difficulty:'hard', question:'Who translated the Bible into the Latin version known as the Vulgate?', correct_answer:'Jerome', wrong_answers:['Origen','Eusebius','Tertullian'] },
  { category:'history', difficulty:'hard', question:'Which English Bible translator was executed for heresy in 1536?', correct_answer:'William Tyndale', wrong_answers:['John Wycliffe','Miles Coverdale','Thomas Cranmer'] },
  { category:'history', difficulty:'hard', question:'Which pope called the Fourth Lateran Council in 1215?', correct_answer:'Innocent III', wrong_answers:['Gregory VII','Boniface VIII','Alexander III'] },
  { category:'history', difficulty:'hard', question:'Which sitting U.S. vice president killed Alexander Hamilton in an 1804 duel?', correct_answer:'Aaron Burr', wrong_answers:['George Clinton','Elbridge Gerry','John C. Calhoun'] },
];

const GEOGRAPHY_QUESTIONS = [
  // Easy
  { category:'geography', difficulty:'easy', question:'What is the capital of Australia?', correct_answer:'Canberra', wrong_answers:['Sydney','Melbourne','Brisbane'] },
  { category:'geography', difficulty:'easy', question:'Which river is traditionally considered the longest in the world?', correct_answer:'Nile', wrong_answers:['Mississippi','Yangtze','Congo'] },
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
  { category:'geography', difficulty:'easy', question:'What country has the most population?', correct_answer:'India', wrong_answers:['China','USA','Indonesia'] },
  { category:'geography', difficulty:'easy', question:'What is the capital of Canada?', correct_answer:'Ottawa', wrong_answers:['Toronto','Vancouver','Montreal'] },
  { category:'geography', difficulty:'easy', question:'Which country is home to the Great Barrier Reef?', correct_answer:'Australia', wrong_answers:['Indonesia','Philippines','Maldives'] },
  { category:'geography', difficulty:'easy', question:'What is the smallest continent by land area?', correct_answer:'Australia', wrong_answers:['Europe','Antarctica','South America'] },

  // Medium
  { category:'geography', difficulty:'medium', question:'Which African country has the largest population?', correct_answer:'Nigeria', wrong_answers:['Egypt','Ethiopia','South Africa'] },
  { category:'geography', difficulty:'medium', question:'What is the deepest lake in the world?', correct_answer:'Lake Baikal', wrong_answers:['Caspian Sea','Lake Superior','Lake Tanganyika'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of South Africa?', correct_answer:'Pretoria (administrative)', wrong_answers:['Cape Town','Johannesburg','Durban'] },
  { category:'geography', difficulty:'medium', question:'Which mountain range separates Europe from Asia?', correct_answer:'Ural Mountains', wrong_answers:['Alps','Carpathian Mountains','Pyrenees'] },
  { category:'geography', difficulty:'medium', question:'Which two countries share the longest border?', correct_answer:'USA and Canada', wrong_answers:['Russia and China','Argentina and Chile','China and Mongolia'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of New Zealand?', correct_answer:'Wellington', wrong_answers:['Auckland','Christchurch','Queenstown'] },
  { category:'geography', difficulty:'medium', question:'Which river flows through Baghdad?', correct_answer:'Tigris', wrong_answers:['Euphrates','Jordan','Nile'] },
  { category:'geography', difficulty:'medium', question:'The historic city of Timbuktu is in which country?', correct_answer:'Mali', wrong_answers:['Niger','Chad','Mauritania'] },
  { category:'geography', difficulty:'medium', question:'The Strait of Gibraltar separates Spain from which country?', correct_answer:'Morocco', wrong_answers:['Algeria','Tunisia','Portugal'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of Turkey?', correct_answer:'Ankara', wrong_answers:['Istanbul','Izmir','Bursa'] },
  { category:'geography', difficulty:'medium', question:'Which U.S. state has the longest coastline?', correct_answer:'Alaska', wrong_answers:['Florida','California','Hawaii'] },
  { category:'geography', difficulty:'medium', question:'What is the capital of Switzerland?', correct_answer:'Bern', wrong_answers:['Zurich','Geneva','Basel'] },
  { category:'geography', difficulty:'medium', question:'Lake Titicaca lies on the border of Peru and which other country?', correct_answer:'Bolivia', wrong_answers:['Chile','Ecuador','Brazil'] },
  { category:'geography', difficulty:'medium', question:'The ancient city of Petra is in which modern country?', correct_answer:'Jordan', wrong_answers:['Syria','Lebanon','Israel'] },
  { category:'geography', difficulty:'medium', question:'Into which sea does the Danube River empty?', correct_answer:'Black Sea', wrong_answers:['Adriatic Sea','Caspian Sea','Aegean Sea'] },

  // Hard
  { category:'geography', difficulty:'hard', question:'What is the only sea without any coasts?', correct_answer:'Sargasso Sea', wrong_answers:['Dead Sea','Caspian Sea','Aral Sea'] },
  { category:'geography', difficulty:'hard', question:'Counting overseas territories, which country spans the most time zones?', correct_answer:'France', wrong_answers:['Russia','USA','United Kingdom'] },
  { category:'geography', difficulty:'hard', question:'What is the capital of Kazakhstan?', correct_answer:'Astana', wrong_answers:['Almaty','Tashkent','Bishkek'] },
  { category:'geography', difficulty:'hard', question:'What is the capital of Myanmar?', correct_answer:'Naypyidaw', wrong_answers:['Yangon','Mandalay','Bagan'] },
  { category:'geography', difficulty:'hard', question:'Which African country was historically known as Abyssinia?', correct_answer:'Ethiopia', wrong_answers:['Eritrea','Somalia','Sudan'] },
  { category:'geography', difficulty:'hard', question:'What is the largest island in the Mediterranean Sea?', correct_answer:'Sicily', wrong_answers:['Sardinia','Cyprus','Crete'] },
  { category:'geography', difficulty:'hard', question:'What is the capital of Australia\'s Northern Territory?', correct_answer:'Darwin', wrong_answers:['Alice Springs','Katherine','Cairns'] },
  { category:'geography', difficulty:'hard', question:'The ruins of the ancient city of Ephesus are in which modern country?', correct_answer:'Turkey', wrong_answers:['Greece','Syria','Cyprus'] },
  { category:'geography', difficulty:'hard', question:'Which country is completely surrounded by South Africa?', correct_answer:'Lesotho', wrong_answers:['Eswatini','Botswana','Namibia'] },
  { category:'geography', difficulty:'hard', question:'What is the capital of Bhutan?', correct_answer:'Thimphu', wrong_answers:['Paro','Kathmandu','Punakha'] },
  { category:'geography', difficulty:'hard', question:'Mount Ararat, where tradition says Noah\'s Ark came to rest, is in which country?', correct_answer:'Turkey', wrong_answers:['Armenia','Iran','Georgia'] },
];

const ALL_QUESTIONS = [...BIBLE_QUESTIONS, ...HISTORY_QUESTIONS, ...HISTORY_MORE, ...GEOGRAPHY_QUESTIONS];

// Questions removed because they were wrong, ambiguous, reworded, or near-duplicates.
const RETIRED = [
  'Who was known as the "Iron Lady"?',                                  // same answer as the first female PM question
  'What were the two cities destroyed along with Sodom?',            // asked for two, answered one
  'What is the longest book in the Bible?',                           // by words it's Jeremiah → reworded
  'How many epistles did Paul write in the New Testament?',           // 13 or 14 (Hebrews) → reworded
  'Which empire was ruled by Julius Caesar?',                         // he ruled the Republic, not the Empire
  'Which country had the first constitution in modern history?',      // disputed
  'Who was the Byzantine Emperor who rebuilt Constantinople?',        // vague
  'Through how many countries does the Amazon River flow?',           // the river flows through 3, not 9
  'What is the highest capital city in the world?',                   // La Paz is higher than Quito
  'Which country has the most UNESCO World Heritage Sites?',          // changes year to year
  'Which is the longest river in the world?',                         // Nile vs Amazon is disputed → reworded
  'Which country has the most time zones?',                           // reworded to count territories
  // Near-duplicates from the built-in local (SQLite) starter set
  'Who was swallowed by a large fish?',
  'What is the longest river in the world?',
  'Who was the first US President?',
  'What is the largest ocean?',
  'What country has the most natural lakes?',
];

async function seed() {
  try {
    let retired = 0, added = 0, updated = 0;
    for (const text of RETIRED) {
      const res = await pool.query('DELETE FROM trivia_questions WHERE question = $1', [text]);
      retired += res.rowCount || 0;
    }
    for (const q of ALL_QUESTIONS) {
      const existing = await pool.query(
        'SELECT difficulty, category, correct_answer, wrong_answers FROM trivia_questions WHERE question = $1',
        [q.question]
      );
      const row = existing.rows[0];
      if (!row) {
        await pool.query(
          `INSERT INTO trivia_questions (category, difficulty, question, correct_answer, wrong_answers) VALUES ($1,$2,$3,$4,$5)`,
          [q.category, q.difficulty, q.question, q.correct_answer, q.wrong_answers]
        );
        added++;
      } else if (row.difficulty !== q.difficulty || row.category !== q.category || row.correct_answer !== q.correct_answer
                 || JSON.stringify(row.wrong_answers) !== JSON.stringify(q.wrong_answers)) {
        // Keep existing questions in step with this file (e.g. re-graded difficulty)
        await pool.query(
          'UPDATE trivia_questions SET category = $1, difficulty = $2, correct_answer = $3, wrong_answers = $4 WHERE question = $5',
          [q.category, q.difficulty, q.correct_answer, q.wrong_answers, q.question]
        );
        updated++;
      }
    }
    console.log(`✅ Trivia: ${added} added, ${updated} updated, ${retired} retired (${ALL_QUESTIONS.length} total)`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  }
}

module.exports = { seedTrivia: seed, ALL_QUESTIONS };

// Run directly: `node db/seedTrivia.js`
if (require.main === module) seed().then(() => process.exit(0)).catch(() => process.exit(1));
