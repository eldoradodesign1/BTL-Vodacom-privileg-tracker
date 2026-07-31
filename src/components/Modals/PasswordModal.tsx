import React, { useState } from 'react';
import { User } from '../../types';
import { updateUserPassword } from '../../utils/storage';
import { KeyRound, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  currentUser?: User;
  onClose: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, currentUser, onClose }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass) return;
    if (!currentUser) return;

    const res = updateUserPassword(currentUser.id, oldPass, newPass);
    setIsError(!res.success);
    setMsg(res.message);

    if (res.success) {
      setOldPass('');
      setNewPass('');
      setTimeout(() => {
        setMsg('');
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-md text-center">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black uppercase text-red-500 tracking-wider mb-2">Clé de Sécurité</h2>
        <p className="text-xs text-gray-400 mb-6 font-semibold">
          Compte: <b className="text-white">{currentUser?.name || 'Agent'}</b>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
            placeholder="Ancienne clé de sécurité"
            required
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
          />

          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Nouvelle clé de sécurité (min. 4 car.)"
            required
            minLength={4}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
          />

          {msg && (
            <div className={`p-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 ${
              isError ? 'bg-red-950/50 border border-red-500/40 text-red-400' : 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-400'
            }`}>
              {isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{msg}</span>
            </div>
          )}

          <button type="submit" className="btn-neon btn-red w-full">
            <KeyRound className="w-4 h-4" />
            <span>Mettre à jour ma clé</span>
          </button>
        </form>
      </div>
    </div>
  );
};
