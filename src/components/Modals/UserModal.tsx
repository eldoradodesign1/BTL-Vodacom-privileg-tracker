import React, { useState } from 'react';
import { User, Shop, UserRole } from '../../types';
import { saveUser, getUsers } from '../../utils/storage';
import { UserPlus, X } from 'lucide-react';

interface UserModalProps {
  isOpen: boolean;
  shops: Shop[];
  onClose: () => void;
  onSuccess: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  shops,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [supervisorId, setSupervisorId] = useState('');
  const [shopId, setShopId] = useState('');
  const [password, setPassword] = useState('vodacom123');

  if (!isOpen) return null;

  const supervisors = getUsers().filter(u => u.role === 'supervisor' || u.role === 'admin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !shopId) return;

    saveUser({
      name,
      phone,
      role,
      supervisorId: role === 'agent' ? supervisorId : undefined,
      permanentShopId: shopId
    });

    setName('');
    setPhone('');
    setRole('agent');
    setSupervisorId('');
    setShopId('');
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-lg">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Nouvel Utilisateur</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Création de compte Hôtesse ou Superviseur</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Nom Complet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sarah Kabedi"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">MSISDN (Téléphone)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 0813333333"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Rôle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="agent">Agent (Hôtesse)</option>
                <option value="supervisor">Superviseur</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Shop Affectation</label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="">-- Sélectionner Shop --</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                ))}
              </select>
            </div>
          </div>

          {role === 'agent' && (
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Superviseur Rattaché</label>
              <select
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="">-- Choisir Superviseur --</option>
                {supervisors.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <button type="submit" className="btn-neon btn-red w-full mt-6">
            <UserPlus className="w-4 h-4" />
            <span>Créer l'utilisateur</span>
          </button>
        </form>
      </div>
    </div>
  );
};
