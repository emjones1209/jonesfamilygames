/**
 * WelcomePage — a one-page guide for family members, shown right after they
 * create an account and reachable any time from the "Guide" button on the home
 * screen. Written for iPads (Safari "Add to Home Screen" etc.).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share, SquarePlus, CircleHelp, Users, KeyRound, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';

// Opened from the Home Screen icon rather than in a browser tab?
const isHomeScreenApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function Section({ emoji, title, children }) {
  return (
    <section className="card-panel">
      <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
        <span className="text-2xl">{emoji}</span> {title}
      </h2>
      <div className="text-white/80 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-game-gold text-game-bg font-bold flex items-center justify-center text-sm">{n}</span>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

// An inline picture of an iPad button, so people know what to look for
const Key = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/15 text-white font-semibold whitespace-nowrap align-middle">
    {Icon && <Icon size={16} />}{children}
  </span>
);

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const address = window.location.origin;
  const installed = isHomeScreenApp();

  const copyAddress = () => {
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5 pb-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="text-center pt-4 pb-2">
          <div className="text-6xl mb-3">🎮</div>
          <h1 className="text-3xl font-bold text-game-gold font-display">
            Welcome{user?.displayName ? `, ${user.displayName}` : ''}!
          </h1>
          <p className="text-white/60 mt-2">
            Here's how to get the most out of Family Games on your iPad. You can come back to this
            page any time from the <Key>📖 Guide</Key> button on the home screen.
          </p>
        </header>

        <Section emoji="📲" title="Put it on your Home Screen">
          {installed ? (
            <p className="flex items-center gap-2 text-green-300">
              <Check size={20} /> You're already using the Home Screen app — you're all set!
            </p>
          ) : (
            <>
              <p>Add Family Games to your Home Screen so it opens like an app, full screen:</p>
              <Step n={1}>In <b>Safari</b>, tap the <Key icon={Share}>Share</Key> button (top right, next to the address).</Step>
              <Step n={2}>Scroll down the list and tap <Key icon={SquarePlus}>Add to Home Screen</Key>.</Step>
              <Step n={3}>Tap <b>Add</b>. A Family Games icon appears on your Home Screen — open it from there from now on.</Step>
              <p className="text-white/50 text-sm">
                You'll stay signed in, so you won't need your password each time.
              </p>
            </>
          )}
        </Section>

        <Section emoji="🃏" title="Playing the games">
          <p>Tap any game on the home screen. Every game has a <Key icon={CircleHelp}>How to play</Key> guide if you'd like the rules.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Card games</b> (Hearts, Spades, Bridge, Rook): tap a card to pick it, then tap it again to play it. Cards you can't play right now are dimmed.</li>
            <li><b>Solitaire</b>: tap a card, then tap where it should go — or drag it. Tap a card twice to send it up to the piles at the top.</li>
            <li><b>Trivia</b>: Easy, Medium and Hard really are different — Hard is for the experts!</li>
            <li>Turn your iPad sideways for the biggest cards.</li>
            <li>Your scores are saved to your account automatically.</li>
          </ul>
        </Section>

        <Section emoji="🔑" title="Your account">
          <p className="flex gap-2"><KeyRound size={18} className="shrink-0 mt-1" />
            <span>Tap your picture at the top of the home screen to change your name, picture or password.</span>
          </p>
          <p>
            <b>Forgot your password?</b> Just ask the family organizer — they can reset it for you.
          </p>
        </Section>

        <Section emoji="👨‍👩‍👧‍👦" title="Invite the family">
          <p className="flex gap-2"><Users size={18} className="shrink-0 mt-1" />
            <span>To join, family members open this address on their iPad and tap <b>Create Account</b>:</span>
          </p>
          <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2">
            <span className="text-game-gold font-mono text-sm break-all flex-1">{address}</span>
            <button onClick={copyAddress} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Copy address">
              {copied ? <Check size={18} className="text-green-300" /> : <Copy size={18} />}
            </button>
          </div>
          <p className="text-white/50 text-sm">
            They'll also need the <b>family invite code</b> — ask the family organizer for it.
          </p>
        </Section>

        <Button variant="primary" className="w-full text-lg" onClick={() => navigate('/')}>
          Let's play! 🎮
        </Button>
      </div>
    </div>
  );
}
