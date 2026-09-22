import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import api from '../utils/api';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetModal, setResetModal] = useState(null); // { id, name }
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) { navigate('/'); return; }
    api.get('/users').then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  }, [user, navigate]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await api.delete(`/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) return;
    await api.post(`/users/${resetModal.id}/reset-password`, { newPassword });
    setMsg(`Password reset for ${resetModal.name} ✅`);
    setResetModal(null);
    setNewPassword('');
  };

  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary-400 text-base';

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg to-game-card p-5">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white mb-6">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-2xl font-bold text-game-gold mb-6">👑 Admin Panel</h1>

        {msg && <p className="text-primary-400 text-center mb-4 text-sm">{msg}</p>}

        <div className="space-y-3">
          {users.map(u => (
            <motion.div
              key={u.id}
              className="card-panel flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <div className="text-white font-semibold">{u.displayName}</div>
                <div className="text-white/40 text-sm">{u.email}</div>
                {u.isAdmin && <div className="text-game-gold text-xs">Admin</div>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResetModal({ id: u.id, name: u.displayName })}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  title="Reset password"
                >
                  <RefreshCw size={16} />
                </button>
                {u.id !== user.id && (
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-2 rounded-xl bg-game-red/20 hover:bg-game-red/40 text-game-red transition-colors"
                    title="Delete user"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <Modal isOpen={!!resetModal} onClose={() => { setResetModal(null); setNewPassword(''); }} title={`Reset password for ${resetModal?.name}`}>
          <input type="password" placeholder="New password" className={inputClass + ' mb-4'} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setResetModal(null)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleResetPassword}>Reset</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
