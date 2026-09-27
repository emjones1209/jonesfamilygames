/**
 * Learn to Play — the chess lessons (see chessLessonData.js): a list, and each
 * lesson's board. Finished lessons are ticked, and remembered on this device
 * for each family member.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { ChessBoard } from './ChessBoard';
import { fromFen, legalMoves, afterMove, inCheck, outcome, typeOf, K, Q, WHITE } from './chessRules';
import { LESSONS, loadDone, saveDone } from './chessLessonData';

export default function ChessLessons() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [done, setDone] = useState(() => loadDone(user));
  const [open, setOpen] = useState(null);           // index of the lesson being played

  const finish = id => {
    if (done.includes(id)) return;
    const next = [...done, id];
    setDone(next);
    saveDone(user, next);
  };

  if (open != null) {
    const lesson = LESSONS[open];
    return (
      <Lesson key={lesson.id} lesson={lesson} number={open + 1}
        onBack={() => setOpen(null)} onDone={() => finish(lesson.id)}
        onNext={open + 1 < LESSONS.length ? () => setOpen(open + 1) : null} />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-emerald-950 p-5">
      <div className="max-w-lg mx-auto flex flex-col gap-4">
        <button onClick={() => navigate('/games/chess')} className="flex items-center gap-2 text-white/50 hover:text-white self-start min-h-[44px]">
          <ArrowLeft size={18} /> Back to Chess
        </button>
        <div className="text-center">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="game-title text-3xl">Learn to Play Chess</h1>
          <p className="text-white/60 text-sm mt-1">{done.length} of {LESSONS.length} lessons done · each takes a minute or two</p>
        </div>
        <div className="flex flex-col gap-2">
          {LESSONS.map((l, i) => (
            <button key={l.id} onClick={() => setOpen(i)}
              className="flex items-center gap-3 card-panel p-3 text-left active:scale-[0.98] transition-transform">
              <span className="text-3xl w-10 text-center">{l.emoji}</span>
              <span className="flex-1">
                <span className="block text-white font-semibold">{i + 1}. {l.title}</span>
                <span className="block text-white/50 text-xs">{l.task}</span>
              </span>
              <span className="text-xl">{done.includes(l.id) ? '✅' : '▶️'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Did this move complete the lesson? (For 'capture', only once nothing black is left)
function succeeded(lesson, before, move, after) {
  switch (lesson.goal) {
    case 'capture': return !after.sq.some(p => p < 0);
    case 'check': return inCheck(after);
    case 'escape': return true;                                      // (only escaping moves are legal)
    case 'mate': return outcome(after) === 'checkmate';
    case 'castle': return move.flag === 'castle';
    case 'promote': return !!move.promo;
    case 'enpassant': return move.flag === 'ep';
    default: return false;
  }
}

const escapeHow = (before, move) => (typeOf(move.piece) === K ? 'You moved your king out of the way.'
  : move.captured ? 'You captured the piece giving check.' : 'You blocked the check with another piece.');

function Lesson({ lesson, number, onBack, onDone, onNext }) {
  const start = useMemo(() => fromFen(lesson.fen), [lesson]);
  const [pos, setPos] = useState(start);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState(0);
  const [message, setMessage] = useState(null);     // { tone: 'good' | 'try', text }
  const [won, setWon] = useState(false);
  const legal = useMemo(() => (won ? [] : legalMoves(pos)), [pos, won]);

  const reset = () => { setPos(start); setSel(null); setMoves(0); setMessage(null); setWon(false); };

  const play = move => {
    let after = afterMove(pos, move);
    setSel(null);
    if (succeeded(lesson, pos, move, after)) {
      setPos(after);
      setWon(true);
      onDone();
      const extra = lesson.goal === 'escape' ? ` ${escapeHow(pos, move)}` : lesson.goal === 'capture' ? ` (${moves + 1} moves)` : '';
      setMessage({ tone: 'good', text: `Well done!${extra}` });
      return;
    }
    if (lesson.goal === 'capture') {
      // Black doesn't move in these lessons: it's straight back to you
      after = { ...after, turn: WHITE, ep: -1 };
      setPos(after);
      setMoves(n => n + 1);
      setMessage(move.captured ? { tone: 'good', text: 'Got one! Keep going.' } : null);
      return;
    }
    // Wrong answer for a one-move puzzle: show it briefly, then put the board back
    setPos(after);
    setMessage({ tone: 'try', text: lesson.goal === 'mate' && inCheck(after) ? 'That\'s check, but not checkmate — the king can still escape. Try again!'
      : lesson.goal === 'check' ? 'That doesn\'t attack the king. Try again!' : 'Not quite — try again!' });
    setTimeout(() => setPos(start), 1200);
  };

  const tap = i => {
    if (won) return;
    if (sel != null) {
      const here = legal.filter(m => m.from === sel && m.to === i);
      if (here.length) return play(here.find(m => !m.promo || m.promo === Q) ?? here[0]);
    }
    setSel(legal.some(m => m.from === i && pos.sq[i] > 0) ? i : null);
  };

  const marks = {};
  const mark = (i, kind) => { (marks[i] ||= []).push(kind); };
  if (inCheck(pos)) mark(pos.sq.indexOf(K * pos.turn), 'check');
  if (sel != null) {
    mark(sel, 'selected');
    for (const m of legal.filter(x => x.from === sel)) mark(m.to, m.captured ? 'capture' : 'target');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-emerald-950 p-3 flex flex-col items-center gap-3">
      <div className="self-stretch flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white min-h-[44px] px-2">
          <ArrowLeft size={18} /> Lessons
        </button>
        <span className="text-white/80 font-semibold">{lesson.emoji} {number}. {lesson.title}</span>
        <button onClick={reset} className="flex items-center gap-1 text-white/50 hover:text-white min-h-[44px] px-2 text-sm">
          <RotateCcw size={16} /> Start over
        </button>
      </div>
      <div className="max-w-lg text-center">
        <p className="text-white/80 text-sm">{lesson.intro}</p>
        <p className="text-game-gold font-semibold mt-2">{lesson.task}</p>
      </div>
      <ChessBoard sq={pos.sq} marks={marks} onSquare={tap} />
      <div className="min-h-[2.5rem] text-center">
        {message && <p className={`font-semibold ${message.tone === 'good' ? 'text-green-300' : 'text-amber-300'}`}>{message.text}</p>}
        {!message && !won && <p className="text-white/40 text-sm">Tap one of your (white) pieces to see where it can go.</p>}
      </div>
      {won && (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={reset}>Try again</Button>
          {onNext ? <Button variant="gold" onClick={onNext}>Next lesson →</Button> : <Button variant="gold" onClick={onBack}>All lessons ✓</Button>}
        </div>
      )}
    </div>
  );
}
