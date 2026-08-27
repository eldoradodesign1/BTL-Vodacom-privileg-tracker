import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { BarChart3, Download, FileSpreadsheet, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import type { CampaignRun } from '../../types';
import { getMerchantSupervisorReport, MERCHANT_CAMPAIGN_START, merchantTodayIso, type MerchantSupervisorReport, type MerchantSupervisorReportKind } from '../../utils/merchantCampaign';
import { exportMerchantSupervisorReportExcel } from '../../utils/merchantReportsExport';
import { getSupervisorReportComment, saveSupervisorReportComment, suggestSupervisorReportComment } from '../../utils/supervisorReportComments';
import { DateIconPicker } from '../DateIconPicker';
import { DateRangeKnobSlider } from '../DateRangeKnobSlider';
import { cleanReportComment } from '../../utils/reportComment';

interface MerchantSupervisorReportsModalProps { isOpen: boolean; run: CampaignRun | null; onClose: () => void; }
const reportLabels: Record<MerchantSupervisorReportKind, string> = { daily: 'Journalier', weekly: 'Hebdomadaire', compiled: 'Compilé' };
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const shiftDays = (date: string, offset: number) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };

export const MerchantSupervisorReportsModal: React.FC<MerchantSupervisorReportsModalProps> = ({ isOpen, run, onClose }) => {
  const today = merchantTodayIso();
  const [kind, setKind] = useState<MerchantSupervisorReportKind>('daily');
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(shiftDays(today, -6) < MERCHANT_CAMPAIGN_START ? MERCHANT_CAMPAIGN_START : shiftDays(today, -6));
  const [endDate, setEndDate] = useState(today);
  const [comment, setComment] = useState('');
  const [commentIsAi, setCommentIsAi] = useState(false);
  const [report, setReport] = useState<MerchantSupervisorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');

  const reportPeriod = useMemo(() => kind === 'daily' ? { startDate: selectedDate, endDate: selectedDate } : { startDate, endDate }, [kind, selectedDate, startDate, endDate]);
  const commentMetrics = (next: MerchantSupervisorReport) => ({
    total: next.totals.transactions,
    activePeople: next.totals.activeBas,
    shops: next.totals.pos,
    average: Math.round((next.totals.transactions / Math.max(1, next.daily.length)) * 100) / 100,
    peak: Math.max(0, ...next.daily.map((item) => item.transactions)),
    activityLevel: next.totals.transactions >= next.totals.activeBas * next.targets.daily_pos_target ? 'Soutenu' : next.totals.transactions > 0 ? 'En progression' : 'Sans activité',
  });

  const load = async () => {
    if (!run || reportPeriod.startDate > reportPeriod.endDate) return;
    setLoading(true); setError('');
    try {
      const next = await getMerchantSupervisorReport(run, kind, selectedDate, reportPeriod);
      setReport(next);
      const existing = await getSupervisorReportComment('merchant', kind, next.startsOn, next.endsOn);
      const legacyAiFormatting = Boolean(existing?.aiGenerated && /^\s*(?:process(?:us|ing)?|summary|synth[eè]se|comment(?:aire)?|analysis|analyse)\s*:/i.test(existing.comment));
      if (existing && !legacyAiFormatting) { setComment(cleanReportComment(existing.comment)); setCommentIsAi(existing.aiGenerated); return; }
      setComment(''); setCommentIsAi(false);
      setGeneratingComment(true);
      const suggestion = await suggestSupervisorReportComment({
        campaign: 'merchant', kind, startsOn: next.startsOn, endsOn: next.endsOn,
        metrics: commentMetrics(next), agentComments: next.agentReports.map((item) => cleanReportComment(item.comment)).filter(Boolean),
      });
      if (suggestion) { setComment(suggestion); setCommentIsAi(true); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de préparer le rapport Merchant.');
    } finally { setLoading(false); setGeneratingComment(false); }
  };

  useEffect(() => { if (isOpen) void load(); }, [isOpen, kind, run?.id, selectedDate, startDate, endDate]);

  const persistComment = async (): Promise<boolean> => {
    if (!report || !comment.trim()) { setError('Le commentaire du superviseur est requis avant l’export.'); return false; }
    try {
      await saveSupervisorReportComment({
        campaign: 'merchant', kind: report.kind, startsOn: report.startsOn, endsOn: report.endsOn, comment,
        aiGenerated: commentIsAi, sourceComments: report.agentReports.map((item) => cleanReportComment(item.comment)).filter(Boolean), metrics: commentMetrics(report),
      });
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement du commentaire impossible.'); return false; }
  };

  const saveComment = async () => { if (!report) return; setExporting('xlsx'); const ok = await persistComment(); setExporting(null); if (ok) setError(''); };

  const exportPdf = async () => {
    if (!report) return;
    setExporting('pdf'); setError('');
    if (!await persistComment()) { setExporting(null); return; }
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const margin = 14; const contentWidth = pageWidth - margin * 2; let y = 14;
      const footer = () => { pdf.setDrawColor(203, 213, 225); pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.text('BTL VODACOM PRIVILEGE TRACKER · MERCHANT EDUCATIONAL CAMPAIGN', margin, pageHeight - 7); pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 7, { align: 'right' }); };
      const nextPage = () => { footer(); pdf.addPage(); y = 14; };
      const space = (height: number) => { if (y + height > pageHeight - 17) nextPage(); };
      const heading = (value: string) => { space(12); pdf.setFillColor(8, 51, 68); pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.text(value.toUpperCase(), margin + 4, y + 5.2); y += 12; };
      const paragraph = (value: string) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.7); pdf.setTextColor(51, 65, 85); const lines = pdf.splitTextToSize(value, contentWidth - 7); space(lines.length * 4.35 + 5); pdf.text(lines, margin + 3, y); y += lines.length * 4.35 + 5; };
      pdf.setFillColor(8, 47, 73); pdf.roundedRect(margin, y, contentWidth, 38, 5, 5, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(165, 243, 252); pdf.text('MERCHANT EDUCATIONAL CAMPAIGN', margin + 6, y + 9); pdf.setFontSize(19); pdf.setTextColor(255, 255, 255); pdf.text(`Rapport ${reportLabels[report.kind].toLowerCase()}`, margin + 6, y + 19); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(207, 250, 254); pdf.text(`Du ${formatDate(report.startsOn)} au ${formatDate(report.endsOn)}`, margin + 6, y + 28); y += 46;
      const metric = (x: number, label: string, value: string, color: [number, number, number]) => { pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.roundedRect(x, y, 42, 23, 3, 3, 'FD'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...color); pdf.text(value, x + 4, y + 10); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139); pdf.text(label.toUpperCase(), x + 4, y + 17); };
      metric(margin, 'POS visités', String(report.totals.pos), [8, 145, 178]); metric(margin + 45, 'Transactions', String(report.totals.transactions), [180, 83, 9]); metric(margin + 90, 'BA actifs', String(report.totals.activeBas), [5, 150, 105]); metric(margin + 135, 'Montant', report.totals.amount.toLocaleString('fr-FR'), [126, 34, 206]); y += 31;
      heading('Commentaire du superviseur'); paragraph(comment.trim());
      heading('Activité de la période'); report.daily.forEach((item) => { space(7); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(51, 65, 85); pdf.text(formatDate(item.date), margin, y); pdf.setTextColor(8, 145, 178); pdf.text(`${item.pos} POS`, margin + 75, y); pdf.setTextColor(180, 83, 9); pdf.text(`${item.transactions} transactions`, margin + 108, y); pdf.setTextColor(5, 150, 105); pdf.text(`${item.activeBas} BA`, pageWidth - margin, y, { align: 'right' }); y += 6; });
      heading('Performance par Brand Ambassador'); report.byBa.forEach((item) => { space(10); pdf.setDrawColor(226, 232, 240); pdf.line(margin, y, pageWidth - margin, y); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(15, 23, 42); pdf.text(pdf.splitTextToSize(item.name, 84)[0] || item.name, margin + 2, y + 5.5); pdf.setTextColor(8, 145, 178); pdf.text(`${item.pos} POS`, margin + 89, y + 5.5); pdf.setTextColor(180, 83, 9); pdf.text(`${item.transactions} Tx`, margin + 116, y + 5.5); pdf.setTextColor(5, 150, 105); pdf.text(item.amount.toLocaleString('fr-FR'), pageWidth - margin - 2, y + 5.5, { align: 'right' }); y += 8; });
      if (report.kind === 'compiled') { heading('Rapports BA inclus'); report.agentReports.forEach((item) => { space(17); pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.roundedRect(margin, y, contentWidth, 13, 2, 2, 'FD'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(15, 23, 42); pdf.text(`${formatDate(item.date)} · ${item.name}`, margin + 3, y + 5); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.4); pdf.setTextColor(71, 85, 105); pdf.text(`${item.pos} POS · ${item.transactions} transactions · ${item.amount.toLocaleString('fr-FR')} · ${item.mfsName || 'MFS non renseigné'}`, margin + 3, y + 10); y += 15; if (item.comment) paragraph(`Commentaire BA : ${item.comment}`); }); }
      footer(); pdf.save(`rapport-${report.kind}-merchant-${report.startsOn}-${report.endsOn}.pdf`);
    } catch (caught) { setError(caught instanceof Error ? `Export PDF impossible : ${caught.message}` : 'Export PDF impossible.'); } finally { setExporting(null); }
  };

  const exportExcel = async () => { if (!report) return; setExporting('xlsx'); setError(''); if (!await persistComment()) { setExporting(null); return; } try { await exportMerchantSupervisorReportExcel(report, comment.trim()); } catch (caught) { setError(caught instanceof Error ? `Export Excel impossible : ${caught.message}` : 'Export Excel impossible.'); } finally { setExporting(null); } };

  if (!isOpen) return null;
  const maxPos = Math.max(1, ...(report?.daily.map((item) => item.pos) || [1]));
  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}><div className="modal-sheet max-h-[94vh] w-full max-w-3xl overflow-y-auto p-4 shadow-2xl sm:rounded-[2rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
    <div className="modal-sticky-header -mx-4 -mt-4 mb-4 px-4 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5"><button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button><div className="pr-11"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Rapports superviseur</p><h2 className="mt-1 text-xl font-black text-white">Pilotage Merchant</h2><p className="mt-1 text-xs text-gray-400">Aperçu HTML, commentaire de supervision et exports PDF/XLSX.</p></div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{(Object.keys(reportLabels) as MerchantSupervisorReportKind[]).map((option) => <button key={option} type="button" onClick={() => setKind(option)} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase transition ${kind === option ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}>{reportLabels[option]}</button>)}</div>
    {kind === 'daily' ? <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-2"><DateIconPicker value={selectedDate} min={MERCHANT_CAMPAIGN_START} max={today} onChange={setSelectedDate} className="flex items-center gap-2" buttonClassName="h-10 w-10 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100 transition hover:bg-cyan-400/15" labelClassName="text-[10px] font-black uppercase text-gray-200" popoverAlign="left"/><p className="mt-1 px-1 text-[10px] font-semibold text-gray-400">Choisissez le jour précis à rapporter.</p></div> : <section className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Période du rapport {reportLabels[kind].toLowerCase()}</p><DateRangeKnobSlider minDate={MERCHANT_CAMPAIGN_START} maxDate={today} startDate={startDate} endDate={endDate} onChange={({ startDate: start, endDate: end }) => { setStartDate(start); setEndDate(end); }}/></section>}
    <label className="mt-3 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Commentaire du superviseur <span className="normal-case font-semibold text-cyan-200">requis avant export</span><textarea value={comment} onChange={(event) => { setComment(event.target.value); setCommentIsAi(false); }} placeholder={generatingComment ? 'Génération de la synthèse des commentaires BA…' : 'Synthèse, points d’attention et priorités…'} className="app-input mt-2 min-h-28 w-full rounded-2xl p-3 text-sm"/>{generatingComment && <span className="mt-2 flex items-center gap-2 normal-case text-[10px] font-bold text-cyan-200"><Sparkles size={13} className="animate-pulse"/>Suggestion IA en cours…</span>}{commentIsAi && !generatingComment && <span className="mt-2 flex items-center gap-2 normal-case text-[10px] font-bold text-violet-200"><Sparkles size={13}/>Suggestion IA préremplie — modifiable avant export.</span>}</label>
    {error && <div className={`mt-4 rounded-2xl border p-3 text-xs font-bold ${error === '' ? '' : error.startsWith('Commentaire') ? 'border-amber-400/40 bg-amber-950/45 text-amber-100' : 'border-red-400/40 bg-red-950/45 text-red-100'}`}>{error}</div>}
    {loading && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-xs font-black uppercase tracking-[0.16em] text-gray-400">Préparation du rapport…</div>}
    {report && !loading && <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_92%_0%,rgba(34,211,238,0.16),transparent_33%),linear-gradient(145deg,#101827,#0b101a)] p-4 text-white sm:p-6"><div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200">Merchant Educational Campaign</p><h3 className="mt-1 text-lg font-black">Rapport {reportLabels[report.kind].toLowerCase()}</h3><p className="mt-1 text-[11px] text-gray-300">Du {formatDate(report.startsOn)} au {formatDate(report.endsOn)} · {report.agentReports.length} rapport(s) BA clôturé(s)</p></div><div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-right"><b className="block text-xl font-black text-cyan-100">{report.totals.executionRate}%</b><span className="text-[8px] font-black uppercase text-cyan-200/75">Exécution POS</span></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-cyan-100">{report.totals.pos}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">POS visités</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-amber-100">{report.totals.transactions}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">Transactions</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-emerald-100">{report.totals.activeBas}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">BA actifs</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-fuchsia-100">{report.totals.amount.toLocaleString('fr-FR')}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">Montant cumulé</span></div></div><section className="mt-5"><div className="flex items-center gap-2"><BarChart3 size={16} className="text-cyan-200"/><h4 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Activité de la période</h4></div><div className="mt-3 flex h-28 items-end gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">{report.daily.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><div className="w-full rounded-t-lg bg-gradient-to-t from-cyan-500/45 to-cyan-200" style={{ height: `${Math.max(8, Math.round((item.pos / maxPos) * 74))}px` }}/><span className="text-[8px] font-bold text-gray-400">{item.date.slice(8, 10)}</span></div>)}</div></section><section className="mt-5"><h4 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Performance par Brand Ambassador</h4><div className="mt-3 overflow-hidden rounded-2xl border border-white/10"><table className="w-full text-left text-[10px]"><thead className="bg-white/[0.06] text-[8px] font-black uppercase tracking-[0.1em] text-gray-400"><tr><th className="px-3 py-2">BA</th><th className="px-2 py-2 text-center">POS</th><th className="px-2 py-2 text-center">Tx</th><th className="px-3 py-2 text-right">Montant</th></tr></thead><tbody>{report.byBa.map((item) => <tr key={item.id} className="border-t border-white/[0.06]"><td className="px-3 py-2 font-bold text-white">{item.name}</td><td className="px-2 py-2 text-center text-cyan-100">{item.pos}</td><td className="px-2 py-2 text-center text-amber-100">{item.transactions}</td><td className="px-3 py-2 text-right text-emerald-100">{item.amount.toLocaleString('fr-FR')}</td></tr>)}{report.byBa.length === 0 && <tr><td colSpan={4} className="px-3 py-5 text-center text-gray-400">Aucune activité validée sur cette période.</td></tr>}</tbody></table></div></section>{report.kind === 'compiled' && <section className="mt-5 overflow-hidden rounded-2xl border border-white/10"><div className="border-b border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200">Rapports BA inclus dans le compilé</div>{report.agentReports.map((item) => <div key={`${item.baId}-${item.date}`} className="border-b border-white/[0.06] px-3 py-3 last:border-0"><div className="flex items-center justify-between gap-2"><b className="text-xs text-white">{item.name}</b><span className="text-[9px] font-bold text-gray-400">{item.date}</span></div><p className="mt-1 text-[10px] text-cyan-100">{item.pos} POS · {item.transactions} transactions · {item.amount.toLocaleString('fr-FR')} · {item.mfsName || 'MFS non renseigné'}</p>{cleanReportComment(item.comment) && <p className="mt-1 text-[10px] leading-relaxed text-gray-300">{cleanReportComment(item.comment)}</p>}</div>)}{report.agentReports.length === 0 && <p className="p-4 text-center text-xs text-gray-400">Aucun rapport BA clôturé sur cette période.</p>}</section>}{comment.trim() && <section className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100">Commentaire du rapport</p><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-200">{cleanReportComment(comment)}</p></section>}<p className="mt-5 text-[8px] font-bold uppercase tracking-[0.12em] text-gray-500">Objectifs de référence : {report.targets.daily_pos_target} POS / BA / jour · {report.targets.transactions_per_pos_target} transactions / POS.</p></div>}
    <div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300 transition hover:bg-white/10"><RefreshCw size={14}/>Actualiser</button><div className="flex gap-2"><button type="button" disabled={!report || exporting !== null} onClick={() => void saveComment()} className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-[10px] font-black uppercase text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"><Save size={14}/>Enregistrer</button><button type="button" disabled={!report || exporting !== null} onClick={() => void exportExcel()} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/35 bg-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"><FileSpreadsheet size={14}/>{exporting === 'xlsx' ? 'Export…' : 'Excel'}</button><button type="button" disabled={!report || exporting !== null} onClick={() => void exportPdf()} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-500/20 px-3 py-2 text-[10px] font-black uppercase text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-50"><Download size={14}/>{exporting === 'pdf' ? 'Export…' : 'PDF'}</button></div></div>
  </div></div>;
};
