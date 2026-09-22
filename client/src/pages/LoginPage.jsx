import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ email: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.displayName.trim()) { setError('Display name required'); setLoading(false); return; }
        await register(form.email, form.displayName, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary-400 text-base min-h-[52px]';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-game-bg via-game-card to-game-accent">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🎮</div>
          <h1 className="text-3xl font-bold text-game-gold font-display">Family Games</h1>
          <p className="text-white/50 mt-1">Welcome to the family game room!</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/10 rounded-2xl p-1 mb-6">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                mode === m ? 'bg-primary-600 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            required
            autoCapitalize="none"
            autoComplete="email"
          />
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Your name (e.g. Mom, Dad)"
              className={inputClass}
              value={form.displayName}
              onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))}
              required
              autoComplete="name"
            />
          )}
          <input
            type="password"
            placeholder="Password"
            className={inputClass}
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && (
            <motion.p
              className="text-game-red text-sm text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          <Button type="submit" variant="primary" className="w-full text-lg" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Sign In 🎮' : 'Create Account 🎉'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
