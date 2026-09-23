import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Zap, Trophy, HelpCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { DadJokeModal } from '../../components/DadJokeModal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TutorialModal, TUTORIALS } from '../../components/TutorialModal';
import api from '../../utils/api';

const CATEGORY_META = {
  bible:     { name: 'Bible Trivia',    emoji: '✝️',  color: 'from-purple-700 to-purple-900' },
  history:   { name: 'History Trivia',  emoji: '📜',  color: 'from-amber-700 to-amber-900' },
  geography: { name: 'Geography Trivia',emoji: '🌍',  color: 'from-blue-700 to-blue-900' },
};

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Easy',   timeLimit: 45, questionsPerRound: 10, pointsPerCorrect: 100, description: 'Straightforward questions — great for beginners' },
  medium: { label: 'Medium', timeLimit: 45, questionsPerRound: 10, pointsPerCorrect: 200, description: 'Moderate challenge — tests solid knowledge' },
  hard:   { label: 'Hard',   timeLimit: 45, questionsPerRound: 10, pointsPerCorrect: 300, description: 'Expert level — deep knowledge required' },
};

export default function TriviaGame() {
  const { category } = useParams();
  const navigate = useNavigate();
  const meta = CATEGORY_META[category] || CATEGORY_META.bible;

  const [phase, setPhase] = useState('setup');       // setup | playing | dadJoke | results
  const [difficulty, setDifficulty] = useState('easy');
  const [questions, setQuestions] = useState([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState([]);         // shuffled per question
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [loading, setLoading] = useState(false);
  const [showDadJoke, setShowDadJoke] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const timerRef = useRef(null);

  const config = DIFFICULTY_CONFIG[difficulty];
  const currentQ = questions[questionIdx];

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/trivia', {
        params: { category, difficulty, limit: config.questionsPerRound }
      });
      // Top up short rounds from the built-in bank (skipping questions already chosen)
      const seen = new Set(data.map(q => q.question));
      const extra = getSampleQuestions(category, difficulty).filter(q => !seen.has(q.question));
      setQuestions([...data, ...extra].slice(0, config.questionsPerRound));
      setPhase('playing');
    } catch {
      setQuestions(getSampleQuestions(category, difficulty));
      setPhase('playing');
    } finally {
      setLoading(false);
    }
  };

  // Shuffle answers when question changes
  useEffect(() => {
    if (currentQ) {
      const all = [currentQ.correct_answer, ...currentQ.wrong_answers];
      setAnswers(shuffleArr(all));
      setSelected(null);
      setTimeLeft(config.timeLimit);
    }
  }, [questionIdx, currentQ]);

  // Timer — visual only, does NOT auto-fail
  useEffect(() => {
    if (phase !== 'playing' || selected !== null) return;
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, questionIdx, selected]);

  const handleAnswer = useCallback((answer) => {
    clearInterval(timerRef.current);
    setSelected(answer);
    const correct = answer === currentQ?.correct_answer;
    const newStreak = correct ? streak + 1 : 0;
    setStreak(newStreak);
    if (correct) {
      const bonus = newStreak >= 3 ? 1.5 : 1;
      setScore(s => s + Math.floor(config.pointsPerCorrect * bonus));
    }

    setTimeout(() => {
      const isLastQ = questionIdx >= questions.length - 1;
      if (isLastQ) {
        // Show dad joke every round
        setShowDadJoke(true);
      } else {
        const nextIdx = questionIdx + 1;
        // Show dad joke every 5 questions
        if ((nextIdx) % 5 === 0) {
          setShowDadJoke(true);
        } else {
          setQuestionIdx(nextIdx);
        }
      }
    }, 1200);
  }, [currentQ, streak, questionIdx, questions.length, config]);

  const handleDadJokeDone = () => {
    setShowDadJoke(false);
    const nextIdx = questionIdx + 1;
    if (nextIdx >= questions.length) {
      setPhase('results');
      saveScore();
    } else {
      setQuestionIdx(nextIdx);
    }
  };

  const saveScore = async () => {
    try {
      await api.post('/scores', { game: `${category}-trivia`, score, difficulty });
    } catch {}
  };

  const restart = () => {
    setPhase('setup');
    setQuestions([]);
    setQuestionIdx(0);
    setScore(0);
    setStreak(0);
  };

  // ── Render phases ─────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5 flex flex-col">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6">
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
            <div className="text-6xl mb-3">{meta.emoji}</div>
            <h1 className="game-title text-3xl mb-2">{meta.name}</h1>
            <p className="text-white/50 mb-8 text-center">Choose your difficulty to begin</p>

            <div className="w-full space-y-3 mb-8">
              {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    difficulty === key ? 'border-primary-500 bg-primary-600/20' : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-white font-semibold">{cfg.label}</div>
                  <div className="text-white/50 text-sm">{cfg.description}</div>
                </button>
              ))}
            </div>

            <Button variant="primary" className="w-full text-lg" onClick={loadQuestions} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : `Start ${meta.name} 🎯`}
            </Button>
            <button onClick={() => setShowTutorial(true)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mt-2 mx-auto">
              <HelpCircle size={16} /> How to play
            </button>
          </div>
        </div>
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} title={meta.name} slides={TUTORIALS.trivia} />
      </>
    );
  }

  if (phase === 'playing' && currentQ) {
    const timerPct = (timeLeft / config.timeLimit) * 100;
    const timerColor = timerPct > 50 ? 'bg-primary-500' : timerPct > 25 ? 'bg-amber-500' : 'bg-game-red';

    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/')} className="text-white/40 hover:text-white p-2">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            {streak >= 3 && (
              <div className="flex items-center gap-1 text-amber-400 text-sm font-bold">
                <Zap size={14} /> {streak}x streak!
              </div>
            )}
            <div className="flex items-center gap-1 text-game-gold font-bold">
              <Trophy size={16} /> {score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="text-center text-white/50 text-sm mb-2">
          Question {questionIdx + 1} of {questions.length}
        </div>

        {/* Timer bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-6 overflow-hidden">
          <motion.div
            className={`h-full ${timerColor} rounded-full`}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Question */}
        <motion.div
          key={questionIdx}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="card-panel mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              difficulty === 'easy' ? 'bg-green-600/40 text-green-300' :
              difficulty === 'medium' ? 'bg-amber-600/40 text-amber-300' :
              'bg-red-700/40 text-red-300'
            }`}>
              {config.label}
            </span>
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <Clock size={12} /> {timeLeft > 0 ? `${timeLeft}s` : 'Take your time'}
            </div>
          </div>
          <p className="text-white text-lg font-medium leading-relaxed text-center">
            {currentQ.question}
          </p>
        </motion.div>

        {/* Answer options */}
        <div className="grid grid-cols-1 gap-3">
          {answers.map((ans, i) => {
            const isCorrect = ans === currentQ.correct_answer;
            const isSelected = ans === selected;
            const revealed = selected !== null;
            let btnClass = 'w-full p-4 rounded-2xl text-left text-white font-medium transition-all border-2 ';
            if (!revealed) {
              btnClass += 'border-white/20 bg-white/10 hover:bg-white/20 active:scale-98';
            } else if (isCorrect) {
              btnClass += 'border-primary-500 bg-primary-600/30';
            } else if (isSelected && !isCorrect) {
              btnClass += 'border-game-red bg-game-red/20';
            } else {
              btnClass += 'border-white/10 bg-white/5 opacity-60';
            }
            return (
              <button key={i} className={btnClass} onClick={() => !revealed && handleAnswer(ans)} disabled={revealed}>
                <span className="mr-2 text-white/40">{['A','B','C','D'][i]}.</span> {ans}
                {revealed && isCorrect && ' ✅'}
                {revealed && isSelected && !isCorrect && ' ❌'}
              </button>
            );
          })}
        </div>

        <DadJokeModal isOpen={showDadJoke} onClose={handleDadJokeDone} />
      </div>
    );
  }

  if (phase === 'results') {
    const totalPossible = questions.length * config.pointsPerCorrect;
    const pct = Math.round((score / totalPossible) * 100);
    const grade = pct >= 90 ? '🏆 Amazing!' : pct >= 70 ? '🎉 Great job!' : pct >= 50 ? '👍 Good effort!' : '📚 Keep studying!';
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5 flex flex-col items-center justify-center">
        <motion.div
          className="w-full max-w-sm card-panel text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="text-5xl mb-3">{meta.emoji}</div>
          <h2 className="text-2xl font-bold text-white mb-1">{grade}</h2>
          <div className="text-5xl font-bold text-game-gold my-4">{score.toLocaleString()}</div>
          <p className="text-white/50 mb-6">{pct}% accuracy on {config.label}</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>Home</Button>
            <Button variant="primary" className="flex-1" onClick={restart}>Play Again</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSampleQuestions(category, difficulty) {
  const allByCategory = {
    bible: {
      easy: [
        { id:'be1', question:'How many books are in the Old Testament?', correct_answer:'39', wrong_answers:['27','66','46'] },
        { id:'be2', question:'Who built the ark?', correct_answer:'Noah', wrong_answers:['Moses','Abraham','David'] },
        { id:'be3', question:'What is the first book of the Bible?', correct_answer:'Genesis', wrong_answers:['Exodus','Revelation','Matthew'] },
        { id:'be4', question:'How many disciples did Jesus have?', correct_answer:'12', wrong_answers:['7','10','15'] },
        { id:'be5', question:'In which city was Jesus born?', correct_answer:'Bethlehem', wrong_answers:['Jerusalem','Nazareth','Jericho'] },
        { id:'be6', question:'Who was swallowed by a great fish?', correct_answer:'Jonah', wrong_answers:['Elijah','Isaiah','Ezekiel'] },
        { id:'be7', question:'What did God create on the first day?', correct_answer:'Light', wrong_answers:['Sky','Land','Stars'] },
        { id:'be8', question:'Who is the father of all nations in the Bible?', correct_answer:'Abraham', wrong_answers:['Isaac','Jacob','Moses'] },
        { id:'be9', question:'How many days and nights did it rain during the flood?', correct_answer:'40', wrong_answers:['7','120','30'] },
        { id:'be10', question:'Who wrote most of the Psalms?', correct_answer:'David', wrong_answers:['Solomon','Moses','Paul'] },
        { id:'be11', question:'What were the tablets of the Ten Commandments made of?', correct_answer:'Stone', wrong_answers:['Clay','Wood','Gold'] },
        { id:'be12', question:'Who denied Jesus three times?', correct_answer:'Peter', wrong_answers:['Judas','Thomas','John'] },
      ],
      medium: [
        { id:'bm1', question:'What language was most of the New Testament originally written in?', correct_answer:'Greek', wrong_answers:['Latin','Hebrew','Aramaic'] },
        { id:'bm2', question:'Which book of the Bible contains the Beatitudes?', correct_answer:'Matthew', wrong_answers:['Luke','John','Mark'] },
        { id:'bm3', question:'Who was the mother of John the Baptist?', correct_answer:'Elizabeth', wrong_answers:['Mary','Anna','Rachel'] },
        { id:'bm4', question:'In what book does God speak from a burning bush?', correct_answer:'Exodus', wrong_answers:['Leviticus','Numbers','Genesis'] },
        { id:'bm5', question:'How many sons did Jacob have?', correct_answer:'12', wrong_answers:['10','7','14'] },
        { id:'bm6', question:'Which apostle was a tax collector?', correct_answer:'Matthew', wrong_answers:['Peter','James','John'] },
        { id:'bm7', question:'What is the last book of the Old Testament?', correct_answer:'Malachi', wrong_answers:['Zechariah','Joel','Micah'] },
        { id:'bm8', question:'Who wrote the book of Revelation?', correct_answer:'John', wrong_answers:['Paul','Peter','James'] },
        { id:'bm9', question:'Which judge of Israel had extraordinary strength?', correct_answer:'Samson', wrong_answers:['Gideon','Deborah','Samuel'] },
        { id:'bm10', question:'What river was Jesus baptized in?', correct_answer:'Jordan River', wrong_answers:['Nile River','Dead Sea','Sea of Galilee'] },
        { id:'bm11', question:'Who was the first king of Israel?', correct_answer:'Saul', wrong_answers:['David','Solomon','Samuel'] },
        { id:'bm12', question:'What was Paul\'s name before his conversion?', correct_answer:'Saul', wrong_answers:['Stephen','Simon','Silas'] },
      ],
      hard: [
        { id:'bh1', question:'In Hebrew, what does the name "Immanuel" mean?', correct_answer:'God with us', wrong_answers:['God saves','Praise God','God is mighty'] },
        { id:'bh2', question:'How many chapters are in the book of Psalms?', correct_answer:'150', wrong_answers:['100','175','120'] },
        { id:'bh3', question:'Which prophet saw a valley of dry bones come to life?', correct_answer:'Ezekiel', wrong_answers:['Isaiah','Daniel','Jeremiah'] },
        { id:'bh4', question:'What is the Hebrew term for the first five books of Moses?', correct_answer:'Torah', wrong_answers:['Talmud','Midrash','Mishnah'] },
        { id:'bh5', question:'Who was the father of Methuselah, the oldest man in the Bible?', correct_answer:'Enoch', wrong_answers:['Seth','Lamech','Jared'] },
        { id:'bh6', question:'In the Greek New Testament, what word (agape, phileo, eros) specifically describes God\'s unconditional love?', correct_answer:'Agape', wrong_answers:['Phileo','Eros','Storge'] },
        { id:'bh7', question:'Which OT book contains the "Servant Songs" describing a suffering servant?', correct_answer:'Isaiah', wrong_answers:['Jeremiah','Ezekiel','Psalms'] },
        { id:'bh8', question:'What is the Tetragrammaton — the four Hebrew letters of God\'s name?', correct_answer:'YHWH', wrong_answers:['ELOHIM','ADONAI','SHADDAI'] },
        { id:'bh9', question:'In what year (BC) did Nebuchadnezzar destroy Solomon\'s Temple?', correct_answer:'586 BC', wrong_answers:['722 BC','515 BC','70 AD'] },
        { id:'bh10', question:'Which epistle contains Paul\'s description of the "armor of God"?', correct_answer:'Ephesians', wrong_answers:['Colossians','Galatians','Romans'] },
        { id:'bh11', question:'The book of Hebrews says Jesus is a high priest "according to the order of" which mysterious figure?', correct_answer:'Melchizedek', wrong_answers:['Aaron','Levi','Zadok'] },
        { id:'bh12', question:'What Greek word for "word" or "reason" opens the Gospel of John?', correct_answer:'Logos', wrong_answers:['Rhema','Pneuma','Sophia'] },
        { id:'bh13', question:'In Revelation, how many elders surround the throne of God?', correct_answer:'24', wrong_answers:['12','7','144'] },
        { id:'bh14', question:'Which OT prophet foretold that the Messiah would be born in Bethlehem?', correct_answer:'Micah', wrong_answers:['Isaiah','Zechariah','Hosea'] },
        { id:'bh15', question:'The genealogy in Matthew 1 is structured into how many groups of generations each?', correct_answer:'14', wrong_answers:['12','7','10'] },
      ],
    },
    history: {
      easy: [
        { id:'he1', question:'In what year did World War II end?', correct_answer:'1945', wrong_answers:['1939','1944','1918'] },
        { id:'he2', question:'Who was the first President of the United States?', correct_answer:'George Washington', wrong_answers:['Thomas Jefferson','John Adams','Benjamin Franklin'] },
        { id:'he3', question:'In what year did America declare independence?', correct_answer:'1776', wrong_answers:['1783','1765','1812'] },
        { id:'he4', question:'What year did the Titanic sink?', correct_answer:'1912', wrong_answers:['1905','1920','1898'] },
        { id:'he5', question:'Who was the first person to walk on the moon?', correct_answer:'Neil Armstrong', wrong_answers:['Buzz Aldrin','Yuri Gagarin','John Glenn'] },
        { id:'he6', question:'What war was fought between the Union and the Confederacy?', correct_answer:'American Civil War', wrong_answers:['War of 1812','Revolutionary War','Spanish-American War'] },
        { id:'he7', question:'Who was the first woman to win a Nobel Prize?', correct_answer:'Marie Curie', wrong_answers:['Florence Nightingale','Rosa Parks','Amelia Earhart'] },
        { id:'he8', question:'In what year did the Berlin Wall fall?', correct_answer:'1989', wrong_answers:['1991','1979','1985'] },
        { id:'he9', question:'Which country did Christopher Columbus sail for when he discovered America?', correct_answer:'Spain', wrong_answers:['Portugal','England','France'] },
        { id:'he10', question:'What ancient wonder was located in Alexandria, Egypt?', correct_answer:'The Lighthouse of Alexandria', wrong_answers:['The Colossus of Rhodes','The Hanging Gardens','The Statue of Zeus'] },
      ],
      medium: [
        { id:'hm1', question:'Which empire was ruled by Julius Caesar?', correct_answer:'Roman Empire', wrong_answers:['Greek Empire','Ottoman Empire','Persian Empire'] },
        { id:'hm2', question:'Who was known as the "Iron Lady"?', correct_answer:'Margaret Thatcher', wrong_answers:['Queen Elizabeth II','Hillary Clinton','Angela Merkel'] },
        { id:'hm3', question:'Which country was the first to grant women the right to vote nationally?', correct_answer:'New Zealand', wrong_answers:['USA','UK','Australia'] },
        { id:'hm4', question:'Who painted the Sistine Chapel ceiling?', correct_answer:'Michelangelo', wrong_answers:['Leonardo da Vinci','Raphael','Botticelli'] },
        { id:'hm5', question:'What was the name of the first artificial Earth satellite?', correct_answer:'Sputnik 1', wrong_answers:['Explorer 1','Vostok 1','Apollo 1'] },
        { id:'hm6', question:'The Magna Carta was signed in what year?', correct_answer:'1215', wrong_answers:['1066','1415','1300'] },
        { id:'hm7', question:'Which pharaoh is most associated with the Exodus of the Israelites?', correct_answer:'Ramesses II', wrong_answers:['Tutankhamun','Cleopatra','Akhenaten'] },
        { id:'hm8', question:'The Protestant Reformation is generally dated as beginning in what year?', correct_answer:'1517', wrong_answers:['1453','1600','1480'] },
        { id:'hm9', question:'What invention did Gutenberg introduce to Europe around 1440?', correct_answer:'The printing press', wrong_answers:['The compass','Gunpowder','The telescope'] },
        { id:'hm10', question:'Which empire, at its peak, was the largest contiguous land empire in history?', correct_answer:'Mongol Empire', wrong_answers:['British Empire','Roman Empire','Ottoman Empire'] },
      ],
      hard: [
        { id:'hh1', question:'The Peloponnesian War was fought between Athens and which rival city-state?', correct_answer:'Sparta', wrong_answers:['Corinth','Thebes','Argos'] },
        { id:'hh2', question:'In what year did the Ottoman Empire capture Constantinople?', correct_answer:'1453', wrong_answers:['1389','1529','1571'] },
        { id:'hh3', question:'The Battle of Thermopylae (480 BC) saw a small Greek force led by which Spartan king?', correct_answer:'Leonidas I', wrong_answers:['Cleomenes','Agis II','Pausanias'] },
        { id:'hh4', question:'What was the primary cause of the Irish Potato Famine (1845–1852)?', correct_answer:'A water mold called Phytophthora infestans', wrong_answers:['Drought','A fungal blight called Ergot','Locust infestation'] },
        { id:'hh5', question:'Which treaty formally ended World War I?', correct_answer:'Treaty of Versailles', wrong_answers:['Treaty of Brest-Litovsk','Treaty of Paris','Treaty of Locarno'] },
        { id:'hh6', question:'Emperor Charlemagne was crowned Holy Roman Emperor in what year?', correct_answer:'800 AD', wrong_answers:['768 AD','962 AD','843 AD'] },
        { id:'hh7', question:'The Sykes-Picot Agreement (1916) secretly divided the Middle East between which two powers?', correct_answer:'Britain and France', wrong_answers:['USA and Russia','Britain and Russia','France and Italy'] },
        { id:'hh8', question:'Which ancient library, one of the largest of antiquity, was located in Egypt?', correct_answer:'Library of Alexandria', wrong_answers:['Library of Pergamon','Library of Nineveh','Library of Athens'] },
        { id:'hh9', question:'The Thirty Years\' War (1618–1648) ended with which peace treaty?', correct_answer:'Peace of Westphalia', wrong_answers:['Peace of Augsburg','Peace of Utrecht','Peace of Paris'] },
        { id:'hh10', question:'What was the name of the ancient trade route connecting China to the Mediterranean?', correct_answer:'Silk Road', wrong_answers:['Amber Road','Incense Route','Royal Road'] },
      ],
    },
    geography: {
      easy: [
        { id:'ge1', question:'What is the capital of Australia?', correct_answer:'Canberra', wrong_answers:['Sydney','Melbourne','Brisbane'] },
        { id:'ge2', question:'Which is the longest river in the world?', correct_answer:'Nile', wrong_answers:['Amazon','Mississippi','Yangtze'] },
        { id:'ge3', question:'How many continents are there on Earth?', correct_answer:'7', wrong_answers:['5','6','8'] },
        { id:'ge4', question:'What is the smallest country in the world?', correct_answer:'Vatican City', wrong_answers:['Monaco','San Marino','Liechtenstein'] },
        { id:'ge5', question:'What is the highest mountain in the world?', correct_answer:'Mount Everest', wrong_answers:['K2','Kangchenjunga','Lhotse'] },
        { id:'ge6', question:'Which ocean is the largest?', correct_answer:'Pacific Ocean', wrong_answers:['Atlantic Ocean','Indian Ocean','Arctic Ocean'] },
        { id:'ge7', question:'What is the capital of Brazil?', correct_answer:'Brasília', wrong_answers:['Rio de Janeiro','São Paulo','Salvador'] },
        { id:'ge8', question:'What is the largest continent by area?', correct_answer:'Asia', wrong_answers:['Africa','North America','Europe'] },
        { id:'ge9', question:'Which country has the most natural lakes?', correct_answer:'Canada', wrong_answers:['Russia','USA','Finland'] },
        { id:'ge10', question:'What is the capital of Japan?', correct_answer:'Tokyo', wrong_answers:['Osaka','Kyoto','Hiroshima'] },
      ],
      medium: [
        { id:'gm1', question:'What is the largest desert in the world (by area)?', correct_answer:'Antarctic Desert', wrong_answers:['Sahara Desert','Arabian Desert','Gobi Desert'] },
        { id:'gm2', question:'Which country has the longest coastline in the world?', correct_answer:'Canada', wrong_answers:['Norway','Russia','Indonesia'] },
        { id:'gm3', question:'The Amazon River flows primarily through which country?', correct_answer:'Brazil', wrong_answers:['Peru','Colombia','Venezuela'] },
        { id:'gm4', question:'What is the capital of Canada?', correct_answer:'Ottawa', wrong_answers:['Toronto','Vancouver','Montreal'] },
        { id:'gm5', question:'Which African country has the most pyramids (more than Egypt)?', correct_answer:'Sudan', wrong_answers:['Ethiopia','Libya','Morocco'] },
        { id:'gm6', question:'Mount Kilimanjaro is located in which country?', correct_answer:'Tanzania', wrong_answers:['Kenya','Uganda','Ethiopia'] },
        { id:'gm7', question:'The Strait of Magellan connects which two oceans?', correct_answer:'Pacific and Atlantic', wrong_answers:['Atlantic and Indian','Pacific and Indian','Arctic and Pacific'] },
        { id:'gm8', question:'What is the most populous city in Africa?', correct_answer:'Lagos', wrong_answers:['Cairo','Kinshasa','Johannesburg'] },
        { id:'gm9', question:'Which is the only country that shares a border with Portugal?', correct_answer:'Spain', wrong_answers:['France','Morocco','Andorra'] },
        { id:'gm10', question:'The Ganges River empties into which body of water?', correct_answer:'Bay of Bengal', wrong_answers:['Arabian Sea','Indian Ocean','Persian Gulf'] },
      ],
      hard: [
        { id:'gh1', question:'What is the name of the deepest lake in the world?', correct_answer:'Lake Baikal', wrong_answers:['Lake Tanganyika','Caspian Sea','Lake Superior'] },
        { id:'gh2', question:'The Dasht-e Kavir and Dasht-e Lut are major deserts in which country?', correct_answer:'Iran', wrong_answers:['Saudi Arabia','Pakistan','Afghanistan'] },
        { id:'gh3', question:'Which country contains more than 17,000 islands, the most of any country?', correct_answer:'Indonesia', wrong_answers:['Philippines','Japan','Maldives'] },
        { id:'gh4', question:'The Marianas Trench, the deepest ocean point, lies in which ocean?', correct_answer:'Pacific Ocean', wrong_answers:['Atlantic Ocean','Indian Ocean','Arctic Ocean'] },
        { id:'gh5', question:'What is the name of the narrow strip of land connecting North and South America?', correct_answer:'Isthmus of Panama', wrong_answers:['Strait of Panama','Bering Land Bridge','Darien Gap'] },
        { id:'gh6', question:'Which mountain range separates Europe from Asia in Russia?', correct_answer:'Ural Mountains', wrong_answers:['Caucasus Mountains','Carpathian Mountains','Altai Mountains'] },
        { id:'gh7', question:'The Atacama Desert, one of the driest places on Earth, is primarily in which country?', correct_answer:'Chile', wrong_answers:['Peru','Bolivia','Argentina'] },
        { id:'gh8', question:'Which African country is home to Kilimanjaro AND does NOT contain the Victoria Falls?', correct_answer:'Tanzania', wrong_answers:['Zimbabwe','Zambia','Mozambique'] },
        { id:'gh9', question:'The Danube River flows through how many countries (the most of any river)?', correct_answer:'10', wrong_answers:['7','8','12'] },
        { id:'gh10', question:'What country controls the Svalbard archipelago, located between Norway and the North Pole?', correct_answer:'Norway', wrong_answers:['Russia','Denmark','Iceland'] },
      ],
    },
  };

  const pool = allByCategory[category]?.[difficulty] || allByCategory.bible.easy;
  // Return all questions shuffled (up to 10)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map(q => ({ ...q, difficulty, category }));
}
