import React, { useEffect, useState } from 'react';
import { ClipboardList, Send, X } from 'lucide-react';

interface MerchantClosingReportModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  posCount: number;
  transactionCount: number;
  posTarget: number;
  transactionsPerPosTarget: number;
  inactivePosCount?: number;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

export const MerchantClosingReportModal: React.FC<MerchantClosingReportModalProps> = ({
  isOpen,
  isSaving = false,
  posCount,
  transactionCount,
  posTarget,
  transactionsPerPosTarget,
  inactivePosCount = 0,
  onClose,
  onSubmit,
}) => {
  const [comment, setComment] = useState('');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const transactionTarget = Math.max(0, (posTarget - inactivePosCount) * transactionsPerPosTarget);
  const isBelowTarget = posCount < posTarget || transactionCount < transactionTarget;

  useEffect(() => {
    if (isOpen) {
      setComment('');
      setRequiresConfirmation(false);
    }
  }, [isOpen]);

  const requestClose = () => {
    if (!comment.trim()) return;
    if (isBelowTarget && !requiresConfirmation) {
      setRequiresConfirmation(true);
      return;
    }
    onSubmit(comment);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="merchant-closing-report-title">
      <div className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto border border-amber-300/30 p-5 shadow-2xl animate-pop">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200"><ClipboardList size={22} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Rapport journalier</p>
              <h2 id="merchant-closing-report-title" className="mt-1 text-lg font-black">Clôturer la journée</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 disabled:opacity-40" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 text-center"><b className="block text-xl font-black text-cyan-200">{posCount}<span className="text-sm text-cyan-100/55">/{posTarget}</span></b><span className="text-[9px] font-black uppercase text-gray-400">POS visités</span></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 text-center"><b className="block text-xl font-black text-amber-200">{transactionCount}<span className="text-sm text-amber-100/55">/{transactionTarget}</span></b><span className="text-[9px] font-black uppercase text-gray-400">Transactions</span></div>
        </div>
        {inactivePosCount > 0 && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/[0.08] px-3 py-2 text-[10px] font-semibold text-amber-100">{inactivePosCount} POS non actif{inactivePosCount > 1 ? 's' : ''} : la cible transactionnelle est ajustée à {transactionTarget}.</p>}
        {requiresConfirmation && <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-500/10 p-3 text-xs font-semibold leading-relaxed text-amber-100"><b className="block text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">Objectif non atteint</b><p className="mt-1">Vous n’avez pas atteint votre objectif de {posTarget} POS et {transactionTarget} transactions. Voulez-vous vraiment clôturer ?</p></div>}

        <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400" htmlFor="merchant-closing-comment">Commentaire de clôture <span className="text-rose-200">*</span></label>
        <textarea id="merchant-closing-comment" value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSaving} required placeholder="Résumé obligatoire de la journée, alerte ou information terrain…" className="app-input mt-2 min-h-28 w-full rounded-2xl p-4 text-sm" />
        {!comment.trim() && <p className="mt-2 text-[10px] font-bold text-amber-200">Ajoutez un commentaire pour pouvoir clôturer la journée.</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase transition hover:bg-white/10 disabled:opacity-40">Annuler</button>
          <button type="button" onClick={requestClose} disabled={isSaving || !comment.trim()} className="btn-neon btn-red flex flex-1 items-center justify-center gap-2 disabled:opacity-40"><Send size={16} /><span>{isSaving ? 'Clôture…' : (requiresConfirmation ? 'Clôturer quand même' : 'Clôturer')}</span></button>
        </div>
      </div>
    </div>
  );
};
