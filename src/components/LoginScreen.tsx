import React, { useState } from 'react';
import { User } from '../types';
import { authenticate, purgeAndResetEverything } from '../utils/storage';
import { Lock, Phone, KeyRound, Sparkles, Trash2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('0990000036');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      const result = authenticate(phone, password);
      setLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Identifiants incorrects.');
      }
    }, 400);
  };

  const handleQuickDemo = (demoPhone: string, demoPass: string) => {
    setPhone(demoPhone);
    setPassword(demoPass);
    const res = authenticate(demoPhone, demoPass);
    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setError(res.message || 'Échec de connexion.');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 relative overflow-hidden bg-[#09090b]">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md glass-card border border-white/10 rounded-[45px] p-8 sm:p-10 shadow-2xl relative z-10 animate-pop">
        <div className="text-center mb-8">
          <div className="brand-text text-5xl font-black tracking-tighter mb-1">VODACOM</div>
          <div className="text-xs font-black uppercase text-gray-400 tracking-widest">PRO TRACKER V4.2 GOLD</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center space-x-1">
              <Phone className="w-3 h-3 text-red-500" />
              <span>Identifiant Réseau (MSISDN)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081XXXXXXX"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500 transition-all placeholder:text-gray-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center space-x-1">
              <KeyRound className="w-3 h-3 text-red-500" />
              <span>Clé de Sécurité</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500 transition-all placeholder:text-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-neon btn-red w-full mt-4 flex items-center justify-center space-x-2"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'VÉRICATION...' : 'DÉVERROUILLER'}</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-500/40 rounded-2xl text-red-400 text-center text-xs font-black uppercase">
            {error}
          </div>
        )}

        {/* Demo Fast Account Switchers */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="text-[9px] font-black uppercase text-gray-500 text-center tracking-widest mb-3 flex items-center justify-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Accès Démo Rapide</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickDemo('0990000036', 'password')}
              className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 transition-all text-center"
            >
              Hôtesse (Priskette)
            </button>
            <button
              onClick={() => handleQuickDemo('0812923941', 'test')}
              className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 transition-all text-center"
            >
              Sup (Hervé)
            </button>
            <button
              onClick={() => handleQuickDemo('0896332431', 'admin')}
              className="px-2 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-[10px] font-black uppercase text-red-400 transition-all text-center"
            >
              Admin Master
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Vider complètement le cache et réinitialiser les données ?")) {
                  purgeAndResetEverything();
                  window.location.reload();
                }
              }}
              className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-wider"
            >
              <Trash2 className="w-3 h-3" />
              <span>Vider le cache système & Réinitialiser</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
