import React, { useState } from 'react';
import { saveShop } from '../../utils/storage';
import { Store, X } from 'lucide-react';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('Kinshasa');
  const [type, setType] = useState<'Airport' | 'Standard'>('Standard');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !city) return;

    saveShop(name, city, type);
    setName('');
    setCity('Kinshasa');
    setType('Standard');
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
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Nouveau Shop</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Ajout d'un point de vente ou agence Vodacom</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Nom du Shop</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Shop Aéroport N'djili"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Ville</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: Kinshasa"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Type de Boutique</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
            >
              <option value="Standard">Standard (Cible Roaming: 3, Privilège: 20)</option>
              <option value="Airport">Aéroport (Cible Roaming: 15, Privilège: 10)</option>
            </select>
          </div>

          <button type="submit" className="btn-neon btn-red w-full mt-6">
            <Store className="w-4 h-4" />
            <span>Enregistrer le Shop</span>
          </button>
        </form>
      </div>
    </div>
  );
};
