import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import type { Campaign, CampaignRun, User } from '../../types';
import { getUsers, normalizePhoneMSISDN } from '../../utils/storage';
import { getActiveCampaignRuns, getMerchantCampaign, importDailyAssignments, type AssignmentImportRow } from '../../utils/merchantCampaign';

interface MerchantAssignmentImportModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onImported: () => void;
}

function key(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[\s_\-./]+/g, '');
}

function parseDate(value: unknown, XLSX: typeof import('xlsx')): string | null {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

export const MerchantAssignmentImportModal: React.FC<MerchantAssignmentImportModalProps> = ({ isOpen, currentUser, onClose, onImported }) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        const nextCampaign = await getMerchantCampaign();
        if (!nextCampaign) throw new Error('Campagne Merchant introuvable.');
        const runs = await getActiveCampaignRuns(nextCampaign.id);
        setCampaign(nextCampaign);
        setRun(runs.find((item) => item.status === 'active') || runs[0] || null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Initialisation de l’import impossible.');
      }
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!file || !campaign || !run) {
      setError('Sélectionnez un fichier et vérifiez qu’une vague active existe.');
      return;
    }
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!rows.length) throw new Error('Le fichier ne contient aucune ligne exploitable.');

      const baUsers = getUsers().filter((user) => user.userCategory === 'brand_ambassador');
      const baLookup = new Map<string, string>();
      baUsers.forEach((user) => {
        [user.id, user.name, user.phone, normalizePhoneMSISDN(user.phone)].forEach((value) => {
          const normalized = key(value);
          if (normalized) baLookup.set(normalized, user.id);
        });
      });

      const rejected: string[] = [];
      const prepared: AssignmentImportRow[] = [];
      rows.forEach((row, index) => {
        const columns = Object.fromEntries(Object.entries(row).map(([name, value]) => [key(name), value]));
        const date = parseDate(columns.activitydate || columns.date || columns.jour || columns.planningdate, XLSX);
        const baRaw = columns.baid || columns.ba || columns.brandambassador || columns.ambassadeur || columns.phone || columns.telephone;
        const baId = baLookup.get(key(baRaw));
        const agentNumber = String(columns.agentnumber || columns.shortcode || columns.pos || columns.numeropos || '').trim().replace(/\.0$/, '');
        if (!date || !baId || !agentNumber) {
          rejected.push(`Ligne ${index + 2} : date, BA ou short code invalide.`);
          return;
        }
        prepared.push({ activityDate: date, baId, agentNumber });
      });
      if (!prepared.length) throw new Error(`Aucune affectation valide. ${rejected.slice(0, 3).join(' ')}`);

      const source = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
      const result = await importDailyAssignments({
        campaignRunId: run.id,
        campaignId: campaign.id,
        assignedBy: currentUser.id,
        source,
        rows: prepared,
      });
      const issues = [...rejected, ...result.errors];
      setSummary(`${result.imported} affectation(s) importée(s).${issues.length ? ` ${issues.length} ligne(s) à corriger.` : ''}`);
      if (issues.length) setError(issues.slice(0, 5).join(' '));
      onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <div className="w-full max-w-xl rounded-t-[2rem] border border-white/15 bg-zinc-950 p-5 text-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-2xl bg-red-500/15 p-3 text-red-300"><FileSpreadsheet size={22}/></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Merchant Education</p><h2 className="text-lg font-black">Importer les affectations</h2><p className="mt-1 text-xs text-gray-400">Un POS ne peut appartenir qu’à un BA pour la même date.</p></div></div><button onClick={onClose} className="rounded-xl border border-white/10 p-2 text-gray-300"><X size={18}/></button></div>
        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-gray-300"><p className="font-black text-white">Colonnes reconnues</p><p><b>Date :</b> `activity_date`, `date`, `jour` · <b>BA :</b> `ba`, `ba_id`, téléphone ou nom · <b>POS :</b> `agent_number`, `short_code` ou `pos`.</p><p className="text-gray-500">Exemple : 2026-08-19 | Dieu Merci Makami | 8000420922</p><a href={`${import.meta.env.BASE_URL}templates/merchant-affectations-template.csv`} download className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase text-red-200"><FileSpreadsheet size={14}/>Télécharger le modèle CSV</a></div>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 w-full rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-5 text-xs font-black uppercase text-gray-200">{file ? `Fichier sélectionné : ${file.name}` : 'Choisir le fichier CSV ou XLSX'}</button>
        {error && <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-100">{error}</div>}
        {summary && <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-100">{summary}</div>}
        <button type="button" disabled={loading || !file} onClick={() => void handleImport()} className="btn-neon btn-red mt-4 w-full disabled:opacity-40"><Upload size={16}/><span>{loading ? 'Import en cours…' : 'Valider l’import'}</span></button>
      </div>
    </div>
  );
};
