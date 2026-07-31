import React, { useState } from 'react';
import { User } from '../../types';
import { addLead } from '../../utils/storage';
import { isValidMsisdn, cleanPhoneNumber, formatMsisdn } from '../../utils/phoneValidator';
import { UserCheck, X, AlertCircle } from 'lucide-react';

interface LeadModalProps {
  isOpen: boolean;
  currentUser: User;
  activeShopId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  isOpen,
  currentUser,
  activeShopId,
  onClose,
  onSuccess
}) => {
  const [clientName, setClientName] = useState('');
  const [msisdn, setMsisdn] = useState('');
  const [actionType, setActionType] = useState<'Opt-in Privilège' | 'Opt-in Roaming' | 'Activation Bundle'>('Opt-in Privilège');
  const [phoneError, setPhoneError] = useState('');

  if (!isOpen) return null;

  const handlePhoneChange = (val: string) => {
    // Only keep numeric digits, spaces and leading +
    const filtered = val.replace(/[^\d\+\s]/g, '');
    setMsisdn(filtered);
    if (filtered.trim().length > 0 && !isValidMsisdn(filtered)) {
      setPhoneError('Numéro invalide. Format RDC Vodacom requis : 10 chiffres (ex: 0818889900, 082..., 089..., 099...)');
    } else {
      setPhoneError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    if (!isValidMsisdn(msisdn)) {
      setPhoneError('Format MSISDN invalide. Entrez un numéro Vodacom RDC valide à 10 chiffres (ex: 0818889900, 0990000036).');
      return;
    }

    const cleanedPhone = cleanPhoneNumber(msisdn);
    const formattedPhone = cleanedPhone.length === 10 ? cleanedPhone : formatMsisdn(msisdn);

    addLead({
      agent_id: currentUser.id,
      shop_id: activeShopId || currentUser.permanentShopId,
      timestamp: new Date().toISOString(),
      client_name: clientName.trim(),
      msisdn: formattedPhone,
      action_type: actionType,
      status: 'pending'
    });

    setClientName('');
    setMsisdn('');
    setPhoneError('');
    setActionType('Opt-in Privilège');
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
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Saisie Client (Lead)</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Enregistrement d'activation en direct</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Nom du Client</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Jean-Marc Bukasa"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 flex justify-between">
              <span>MSISDN (Téléphone Client RDC)</span>
              <span className="text-red-400 font-bold">10 Chiffres (081/082/083/089/099...)</span>
            </label>
            <input
              type="tel"
              value={msisdn}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="Ex: 0818889900"
              required
              className={`w-full bg-white/5 border rounded-2xl px-4 py-3 text-white text-sm font-mono font-bold focus:outline-none transition-all ${
                phoneError ? 'border-red-500 bg-red-950/20' : 'border-white/10 focus:border-red-500'
              }`}
            />
            {phoneError && (
              <div className="mt-2 p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-[11px] font-bold flex items-start space-x-1.5 animate-pop">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{phoneError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Type d'Action / Offre</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as any)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500"
            >
              <option value="Opt-in Privilège">Opt-in Privilège VIP</option>
              <option value="Opt-in Roaming">Opt-in Roaming International</option>
              <option value="Activation Bundle">Activation Bundle Data/Voix</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!!phoneError}
            className="btn-neon btn-red w-full mt-6"
          >
            <UserCheck className="w-4 h-4" />
            <span>Valider l'enregistrement</span>
          </button>
        </form>
      </div>
    </div>
  );
};
