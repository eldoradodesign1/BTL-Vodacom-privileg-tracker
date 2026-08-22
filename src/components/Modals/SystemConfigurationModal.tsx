import React, { useEffect, useState } from 'react';
import { Braces, Database, Download, KeyRound, RefreshCw, Save, Settings2, Trash2, X } from 'lucide-react';
import type { User } from '../../types';
import { SCHEMA_SQL } from '../../data/schemaSql';
import { getSharedRuntimeConfig, loadSharedRuntimeConfig, updateSharedRuntimeConfig } from '../../utils/appConfig';
import { getCheckins, getLeads, getReports, getShops, getUsers, purgeAndResetEverything } from '../../utils/storage';

interface SystemConfigurationModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onRefreshData: () => void;
}

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const SystemConfigurationModal: React.FC<SystemConfigurationModalProps> = ({ isOpen, currentUser, onClose, onRefreshData }) => {
  const initialConfig = getSharedRuntimeConfig();
  const [url, setUrl] = useState(initialConfig?.url || '');
  const [anonKey, setAnonKey] = useState(initialConfig?.anonKey || '');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiConfigured, setGeminiConfigured] = useState(Boolean(initialConfig?.geminiConfigured));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    void loadSharedRuntimeConfig().then((config) => {
      if (!active) return;
      if (config) {
        setUrl(config.url);
        setAnonKey(config.anonKey);
        setGeminiConfigured(config.geminiConfigured);
      }
    }).catch(() => {
      // The cached configuration remains usable when the network is weak.
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const saveConfiguration = async () => {
    if (currentUser.role !== 'super_admin') {
      setMessage({ type: 'error', text: 'Seul le super_admin peut modifier la configuration partagée.' });
      return;
    }
    if (!url.trim() || !anonKey.trim()) {
      setMessage({ type: 'error', text: 'Renseignez l’URL Supabase et la clé API publiable.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      new URL(url.trim());
      const config = await updateSharedRuntimeConfig({
        actor: { phone: currentUser.phone, password: currentUser.password },
        url,
        anonKey,
        geminiApiKey: geminiKey || undefined,
      });
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setGeminiKey('');
      setGeminiConfigured(config.geminiConfigured);
      setMessage({ type: 'success', text: 'Configuration partagée mise à jour pour tous les appareils.' });
      onRefreshData();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'La configuration partagée n’a pas pu être enregistrée.' });
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = () => {
    const sections: Array<[string, Array<Record<string, unknown>>]> = [
      ['users', getUsers() as unknown as Array<Record<string, unknown>>],
      ['shops', getShops() as unknown as Array<Record<string, unknown>>],
      ['checkins', getCheckins() as unknown as Array<Record<string, unknown>>],
      ['leads', getLeads() as unknown as Array<Record<string, unknown>>],
      ['daily_reports', getReports() as unknown as Array<Record<string, unknown>>],
    ];
    const rows = sections.flatMap(([table, values]) => values.map((value) => ({ table, ...value })));
    const headers = Array.from(rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>()));
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `BTL_Tracker_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="system-settings-title">
    <section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl">
      <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18}/></button>
      <div className="flex items-start gap-3 pr-10"><div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3 text-fuchsia-100"><Settings2 size={22}/></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70">Super admin</p><h2 id="system-settings-title" className="mt-1 text-lg font-black">Paramètres de la base</h2><p className="mt-1 text-xs text-gray-400">Configuration commune à tous les appareils et aux deux campagnes.</p></div></div>
      {message && <div className={`mt-4 rounded-2xl border p-3 text-xs font-bold ${message.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-red-400/40 bg-red-500/10 text-red-100'}`}>{message.text}</div>}
      <div className="mt-5 space-y-4">
        <section className="rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.05] p-4"><div className="flex items-center gap-2 text-cyan-100"><Database size={16}/><b className="text-xs uppercase tracking-wide">Connexion Supabase</b></div><p className="mt-2 text-[11px] leading-relaxed text-gray-400">Ces valeurs sont préremplies avec la base actuellement utilisée. Après enregistrement, elles sont servies à tous les utilisateurs dès leur prochain chargement.</p><label className="mt-3 block text-[10px] font-black uppercase text-gray-400">URL Supabase</label><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://votre-projet.supabase.co" inputMode="url" className="app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"/><label className="mt-3 block text-[10px] font-black uppercase text-gray-400">API publishable / anon key</label><input value={anonKey} onChange={(event) => setAnonKey(event.target.value)} type="text" autoComplete="off" placeholder="sb_publishable_… ou eyJ…" className="app-input mt-1 w-full rounded-2xl px-3 py-2.5 text-xs"/></section>
        <section className="rounded-2xl border border-amber-300/25 bg-amber-400/[0.05] p-4"><div className="flex items-center gap-2 text-amber-100"><KeyRound size={16}/><b className="text-xs uppercase tracking-wide">Gemini OCR</b></div><p className="mt-2 text-[11px] leading-relaxed text-gray-400">La clé Gemini est conservée côté serveur et sert à tous les agents Merchant. Elle n’est jamais renvoyée aux navigateurs.</p><input value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} type="password" autoComplete="new-password" placeholder={geminiConfigured ? 'Clé Gemini déjà configurée — laissez vide pour conserver' : 'Clé API Gemini'} className="app-input mt-3 w-full rounded-2xl px-3 py-2.5 text-xs"/></section>
        <button type="button" disabled={loading || saving} onClick={() => { void saveConfiguration(); }} className="btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"><Save size={16}/> {saving ? 'Enregistrement partagé…' : 'Enregistrer les paramètres'}</button>
        <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><summary className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase text-gray-200"><Braces size={16} className="text-violet-200"/> schema.sql</summary><pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/50 p-3 text-[10px] leading-relaxed text-emerald-200">{SCHEMA_SQL}</pre></details>
        <div className="grid grid-cols-2 gap-3"><button type="button" onClick={exportBackup} className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase text-white transition hover:bg-white/10"><Download size={16} className="text-cyan-200"/> Exporter</button><button type="button" onClick={() => { if (window.confirm('Vider le cache local et déconnecter cet appareil ?')) { purgeAndResetEverything(); window.location.reload(); } }} className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-3 py-3 text-xs font-black uppercase text-red-100 transition hover:bg-red-500/15"><Trash2 size={16}/> Vider le cache</button></div>
        <p className="flex items-center gap-2 text-[10px] text-gray-500"><RefreshCw size={13}/> Les données opérationnelles se synchronisent depuis Supabase ; aucun import de fichier ou service externe n’est disponible.</p>
      </div>
    </section>
  </div>;
};
