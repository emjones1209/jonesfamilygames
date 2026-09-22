import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import api from '../utils/api';

const AVATARS = ['default','cat','dog','star','heart','flower','sun','moon','crown','angel'];
const AVATAR_EMOJIS = {
  default:'😊', cat:'🐱', dog:'🐶', star:'⭐', heart:'❤️',
  flower:'🌸', sun:'☀️', moon:'🌙', crown:'👑', angel:'😇',
};

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'default');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const saveProfile = async () => {
    setMsg(''); setErr('');
    setLoading(true);
    try {
      await api.patch('/users/me', { displayName, avatar: selectedAvatar });
      updateUser({ displayName, avatar: selectedAvatar });
      setMsg('Profile saved! ✅');
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { setErr('Passwords do not match'); return; }
    setMsg(''); setErr('');
    setLoading(true);
    try {
      await api.patch('/users/me/password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwForm({ current: '', newPw: '', confirm: '' });
      setMsg('Password updated! ✅');
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary-400 text-base';

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5">
      <div className="max-w-md mx-auto">
        {/* Back */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={18} /> Back to games
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-game-gold mb-6">Your Profile</h1>

          {/* Avatar selector */}
          <div className="card-panel mb-4">
            <h2 className="text-white font-semibold mb-3">Choose your avatar</h2>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedAvatar(a)}
                  className={`text-3xl p-2 rounded-2xl transition-all ${
                    selectedAvatar === a ? 'bg-primary-600 scale-110' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {AVATAR_EMOJIS[a]}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className={inputClass + ' mb-3'}
            />
            <Button variant="primary" className="w-full" onClick={saveProfile} disabled={loading}>
              Save Profile
            </Button>
          </div>

          {/* Change password */}
          <div className="card-panel mb-4">
            <h2 className="text-white font-semibold mb-3">Change Password</h2>
            <form onSubmit={changePassword} className="space-y-3">
              <input type="password" placeholder="Current password" className={inputClass} value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
              <input type="password" placeholder="New password" className={inputClass} value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
              <input type="password" placeholder="Confirm new password" className={inputClass} value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
                Update Password
              </Button>
            </form>
          </div>

          {msg && <p className="text-primary-400 text-center text-sm">{msg}</p>}
          {err && <p className="text-game-red text-center text-sm">{err}</p>}

          <Button variant="danger" className="w-full mt-4" onClick={() => { logout(); navigate('/login'); }}>
            Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
