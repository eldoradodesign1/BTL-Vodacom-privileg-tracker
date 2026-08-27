import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Download, FileText, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { MerchantArchiveSummary } from '../../utils/merchantCampaign';
import { buildMerchantCompiledReport, defaultMerchantSupervisorComment, exportMerchantCompiledExcel, exportMerchantCompiledPdf, merchantCompiledReportHtml } from '../../utils/merchantCompiledReport';
import { getMerchantSupervisorComment, saveMerchantSupervisorComment, suggestMerchantSupervisorComment } from '../../utils/supervisorReportComments';

interface Props { isOpen: boolean; archives: MerchantArchiveSummary[]; startDate: string; endDate: string; onClose: () => void; }

type ExportMode = 'pdf' | 'xlsx' | null;

export const MerchantCompiledReportModal: React.FC<Props> = ({ isOpen, archives, startDate, endDate, onClose }) => {
  const [comment, setComment] = useState('');
  const [fromAi, setFromAi] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [exporting, setExporting] = useState<ExportMode>(null);
  const [error, setError] = useState('');
  const report = useMemo(() => buildMerchantCompiledReport(archives, startDate, endDate, comment), [archives, startDate, endDate, comment]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const prepareComment = async () => {
      setError(''); setLoadingComment(true);
      const draft = buildMerchantCompiledReport(archives, startDate, endDate, '');
      const metrics = { rapports: draft.totals.reports, ba: draft.byBa.length, pos: draft.totals.pos, transactions: draft.totals.transactions, montant: draft.totals.amount };
      try {
        const stored = await getMerchantSupervisorComment(startDate, endDate);
        if (stored?.comment) { if (!cancelled) { setComment(stored.comment); setFromAi(stored.aiGenerated); } return; }
        const suggested = await suggestMerchantSupervisorComment({ startDate, endDate, metrics, agentComments: draft.agentComments });
        if (!cancelled) { setComment(suggested || defaultMerchantSupervisorComment(draft)); setFromAi(Boolean(suggested)); }
      } catch {
        if (!cancelled) { setComment(defaultMerchantSupervisorComment(draft)); setFromAi(false); }
      } finally { if (!cancelled) setLoadingComment(false); }
    };
    void prepareComment();
    return () => { cancelled = true; };
  }, [isOpen, archives, startDate, endDate]);

  if (!isOpen) return null;
  const metrics = { rapports: report.totals.reports, ba: report.byBa.length, pos: report.totals.pos, transactions: report.totals.transactions, montant: report.totals.amount };
  const prepareExport = async (mode: Exclude<ExportMode, null>) => {
    const value = comment.trim();
    if (!value) { setError('Le commentaire superviseur est requis avant l’export.'); return; }
    setExporting(mode); setError('');
    try {
      await saveMerchantSupervisorComment({ startDate, endDate, comment: value, aiGenerated: fromAi, agentComments: report.agentComments, metrics });
      const completed = buildMerchantCompiledReport(archives, startDate, endDate, value);
      if (mode === 'xlsx') await exportMerchantCompiledExcel(completed); else await exportMerchantCompiledPdf(completed);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Export impossible.'); }
    finally { setExporting(null); }
  };

  return <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5">
    <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#071018]/95 shadow-2xl sm:rounded-[2rem]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-[#0b1c26] via-[#0b1c26]/95 to-[#0b1c26]/80 px-5 py-4 backdrop-blur-xl">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/70">Archives Merchant</p><h2 className="mt-1 truncate text-lg font-black text-white">Rapport compilé</h2><p className="mt-0.5 text-xs text-slate-400">{startDate} → {endDate} · {report.totals.reports} rapport{report.totals.reports > 1 ? 's' : ''}</p></div>
        <button type="button" onClick={onClose} className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200"><X size={18}/></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {error && <div className="mb-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm font-semibold text-rose-100">{error}</div>}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Rapports', report.totals.reports, 'text-white'], ['BA', report.byBa.length, 'text-cyan-100'], ['POS', report.totals.pos, 'text-cyan-100'], ['Transactions', report.totals.transactions, 'text-amber-100'], ['Montant', `${report.totals.amount.toLocaleString('fr-FR')} $`, 'text-emerald-100']].map(([label, value, tone]) => <div key={String(label)} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className={`mt-1 text-lg font-black ${tone}`}>{value}</p></div>)}</div>
        <section className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100"><Sparkles size={15}/>{loadingComment ? 'Préparation du commentaire…' : fromAi ? 'Suggestion IA en français' : 'Commentaire superviseur'}</div><textarea value={comment} onChange={(event) => { setComment(event.target.value); setFromAi(false); }} disabled={loadingComment} placeholder="Synthèse du superviseur…" className="app-input min-h-28 w-full resize-y rounded-xl p-3 text-sm leading-relaxed"/><p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><Bot size={13}/>Le texte est éditable. Un commentaire déjà validé est toujours réutilisé avant toute nouvelle suggestion.</p></section>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white" dangerouslySetInnerHTML={{ __html: merchantCompiledReportHtml(report) }}/>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-white/10 bg-[#0b1c26]/95 px-4 py-3 backdrop-blur-xl sm:px-5"><button type="button" onClick={() => void prepareExport('pdf')} disabled={Boolean(exporting) || loadingComment} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">{exporting === 'pdf' ? <LoaderCircle className="animate-spin" size={16}/> : <FileText size={16}/>}PDF</button><button type="button" onClick={() => void prepareExport('xlsx')} disabled={Boolean(exporting) || loadingComment} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-50">{exporting === 'xlsx' ? <LoaderCircle className="animate-spin" size={16}/> : <Download size={16}/>}Excel</button></footer>
    </div>
  </div>;
};
