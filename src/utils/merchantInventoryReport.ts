import type ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { CampaignRun } from '../types';
import type { MerchantPosControlItem } from './merchantCampaign';

export type MerchantInventoryStatus = MerchantPosControlItem['status'];

interface StatusRow {
  status: MerchantInventoryStatus;
  label: string;
  color: string;
  excelColor: string;
  count: number;
}

export interface MerchantInventoryMfsRow {
  mfs: string;
  posCount: number;
  completed: number;
  inactive: number;
  active: number;
  incomplete: number;
  pending: number;
  transactions: number;
  coverageRate: number;
  baNames: string;
}

export interface MerchantInventoryDailyRow {
  date: string;
  transactions: number;
  amount: number;
}

export interface MerchantInventoryReportData {
  run: CampaignRun;
  controls: MerchantPosControlItem[];
  generatedAt: string;
  totalPos: number;
  totalTransactions: number;
  totalAmount: number;
  coveredCount: number;
  coverageRate: number;
  totalMfs: number;
  statusRows: StatusRow[];
  mfsRows: MerchantInventoryMfsRow[];
  poolRows: Array<{ label: string; posCount: number; covered: number; transactions: number; coverageRate: number }>;
  dailyRows: MerchantInventoryDailyRow[];
  priorityPos: MerchantPosControlItem[];
}

const statusMeta: Record<MerchantInventoryStatus, { label: string; color: string; excelColor: string; rank: number }> = {
  completed: { label: 'Complété', color: '#047857', excelColor: '047857', rank: 4 },
  inactive: { label: 'Non actif', color: '#b45309', excelColor: 'B45309', rank: 3 },
  active: { label: 'Actif', color: '#0369a1', excelColor: '0369A1', rank: 1 },
  incomplete: { label: 'Inachevé', color: '#be123c', excelColor: 'BE123C', rank: 0 },
  pending: { label: 'À faire', color: '#6d28d9', excelColor: '6D28D9', rank: 2 },
};

const statusOrder: MerchantInventoryStatus[] = ['completed', 'inactive', 'active', 'incomplete', 'pending'];
const money = (value: number) => `$${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const dateOnly = (value?: string | null) => value ? value.slice(0, 10) : '';
const statusLabel = (status: MerchantInventoryStatus) => statusMeta[status].label;
const coverage = (item: MerchantPosControlItem) => item.status === 'completed' || item.status === 'inactive';

export function buildMerchantInventoryReportData(controls: MerchantPosControlItem[], run: CampaignRun): MerchantInventoryReportData {
  const totalTransactions = controls.reduce((sum, item) => sum + item.transactionCount, 0);
  const allTransactions = controls.flatMap((item) => item.transactions);
  const totalAmount = allTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const coveredCount = controls.filter(coverage).length;
  const byStatus = statusOrder.map((status) => ({ status, ...statusMeta[status], count: controls.filter((item) => item.status === status).length }));
  const mfsMap = new Map<string, MerchantPosControlItem[]>();
  controls.forEach((item) => {
    const key = item.pos.mfs_name?.trim() || 'Non renseigné';
    mfsMap.set(key, [...(mfsMap.get(key) || []), item]);
  });
  const mfsRows = Array.from(mfsMap.entries()).map(([mfs, items]) => {
    const counts = Object.fromEntries(statusOrder.map((status) => [status, items.filter((item) => item.status === status).length])) as Record<MerchantInventoryStatus, number>;
    const posCount = items.length;
    const covered = counts.completed + counts.inactive;
    return {
      mfs,
      posCount,
      completed: counts.completed,
      inactive: counts.inactive,
      active: counts.active,
      incomplete: counts.incomplete,
      pending: counts.pending,
      transactions: items.reduce((sum, item) => sum + item.transactionCount, 0),
      coverageRate: posCount ? Math.round((covered / posCount) * 100) : 0,
      baNames: Array.from(new Set(items.map((item) => item.ba?.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'fr')).join(' · ') || '—',
    };
  }).sort((a, b) => b.posCount - a.posCount || a.mfs.localeCompare(b.mfs, 'fr'));
  const pools = Array.from(new Set(controls.map((item) => item.pos.pool))).sort((a, b) => a.localeCompare(b, 'fr'));
  const poolRows = pools.map((pool) => {
    const items = controls.filter((item) => item.pos.pool === pool);
    const covered = items.filter(coverage).length;
    return { label: pool, posCount: items.length, covered, transactions: items.reduce((sum, item) => sum + item.transactionCount, 0), coverageRate: items.length ? Math.round((covered / items.length) * 100) : 0 };
  });
  const daily = new Map<string, { transactions: number; amount: number }>();
  allTransactions.forEach((transaction) => {
    const date = dateOnly(transaction.occurred_at);
    if (!date) return;
    const current = daily.get(date) || { transactions: 0, amount: 0 };
    current.transactions += 1;
    current.amount += Number(transaction.amount || 0);
    daily.set(date, current);
  });
  const dailyRows = Array.from(daily.entries()).map(([date, stats]) => ({ date, ...stats })).sort((a, b) => a.date.localeCompare(b.date));
  const priorityPos = [...controls].filter((item) => item.status !== 'completed' && item.status !== 'inactive').sort((a, b) => statusMeta[a.status].rank - statusMeta[b.status].rank || b.transactionCount - a.transactionCount || a.pos.denomination.localeCompare(b.pos.denomination, 'fr'));

  return {
    run,
    controls,
    generatedAt: new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }),
    totalPos: controls.length,
    totalTransactions,
    totalAmount,
    coveredCount,
    coverageRate: controls.length ? Math.round((coveredCount / controls.length) * 100) : 0,
    totalMfs: mfsRows.length,
    statusRows: byStatus,
    mfsRows,
    poolRows,
    dailyRows,
    priorityPos,
  };
}

function statusBars(data: MerchantInventoryReportData): string {
  const max = Math.max(...data.statusRows.map((row) => row.count), 1);
  return `<div style="display:flex;flex-direction:column;gap:10px">${data.statusRows.map((row) => `<div><div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;font-weight:800;color:#0f172a"><span>${row.label}</span><b>${row.count} POS</b></div><div style="margin-top:5px;height:11px;overflow:hidden;border:1px solid #cbd5e1;border-radius:999px;background:#f1f5f9"><div style="height:100%;width:${Math.max(3, Math.round((row.count / max) * 100))}%;border-radius:999px;background:${row.color}"></div></div></div>`).join('')}</div>`;
}

function tableRows(items: MerchantPosControlItem[], target: number, limit?: number): string {
  const rows = typeof limit === 'number' ? items.slice(0, limit) : items;
  return rows.map((item) => {
    const meta = statusMeta[item.status];
    const lastTransaction = item.transactions[0];
    return `<tr><td><b>${escapeHtml(item.pos.denomination)}</b><br/><span>${escapeHtml(item.pos.agent_number)} · ${escapeHtml(item.pos.pool)}</span></td><td>${escapeHtml(item.pos.mfs_name || 'Non renseigné')}<br/><span>${escapeHtml(item.ba?.name || '—')}</span></td><td><span style="display:inline-block;border-radius:999px;background:${meta.color};padding:4px 7px;color:#fff;font-size:8px;font-weight:900;white-space:nowrap">${meta.label}</span></td><td style="font-weight:900;color:#065f46">${item.transactionCount}/${target}</td><td>${escapeHtml(dateTime(item.visit?.visited_at))}</td><td>${escapeHtml(lastTransaction ? dateTime(lastTransaction.occurred_at) : '—')}</td></tr>`;
  }).join('');
}

function reportStyles() {
  return `<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff}.report{width:794px;min-height:1123px;padding:40px 38px;background:#fff}.eyebrow{margin:0;color:#065f46;font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.title{margin:8px 0 5px;color:#0f172a;font-size:33px;letter-spacing:-.025em;line-height:1.08}.sub{margin:0;color:#334155;font-size:13px;font-weight:700;line-height:1.5}.accent-title{border-left:6px solid #059669;padding:3px 0 3px 15px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;align-items:center;margin-top:24px;padding:24px;border-radius:18px;background:linear-gradient(135deg,#052e2b,#047857);color:#fff}.hero h2{margin:0;color:#fff;font-size:29px;line-height:1.1}.hero p{margin:8px 0 0;color:#ecfdf5;font-size:14px;font-weight:700;line-height:1.45}.donut-wrap{text-align:center}.donut-wrap svg{display:inline-block}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-top:18px}.metric{min-height:100px;padding:15px;border:1px solid #cbd5e1;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.06)}.metric span{display:block;color:#334155;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.metric b{display:block;margin-top:7px;color:#0f172a;font-size:25px;line-height:1.05}.metric small{display:block;margin-top:5px;color:#475569;font-size:10px;font-weight:700;line-height:1.35}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.card{padding:17px;border:1px solid #cbd5e1;border-radius:15px;background:#fff}.card h3{margin:0 0 13px;color:#0f172a;font-size:15px}.mfs-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:18px;overflow:hidden;border:1px solid #cbd5e1;border-radius:11px;color:#0f172a;font-size:9px}.mfs-table th{padding:10px 8px;background:#064e3b;color:#fff;font-size:8px;font-weight:900;letter-spacing:.04em;text-align:left;text-transform:uppercase}.mfs-table td{padding:9px 8px;border-bottom:1px solid #cbd5e1;font-weight:650;line-height:1.38}.mfs-table tr:nth-child(even){background:#f8fafc}.mfs-table tr:last-child td{border-bottom:0}.mfs-table td span{color:#475569;font-size:8px;font-weight:700}.section-title{margin:20px 0 8px;color:#0f172a;font-size:17px}.detail-head{margin-bottom:18px;border-bottom:2px solid #065f46;padding-bottom:13px}.detail-head h1{margin:4px 0 0;color:#0f172a;font-size:27px}.detail-head p{margin:5px 0 0;color:#475569;font-size:12px;font-weight:700}.callout{margin-top:18px;padding:15px 17px;border:1px solid #bfdbfe;border-radius:15px;background:#eff6ff;color:#1e3a8a;font-size:12px;font-weight:700;line-height:1.5}.footer{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:10px;color:#475569;font-size:9px;font-weight:700}</style>`;
}

function coverageDonut(data: MerchantInventoryReportData): string {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, data.coverageRate) / 100);
  return `<svg width="145" height="145" viewBox="0 0 145 145"><circle cx="72" cy="72" r="${radius}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="15"/><circle cx="72" cy="72" r="${radius}" fill="none" stroke="#86efac" stroke-width="15" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 72 72)"/><text x="72" y="69" text-anchor="middle" style="font-size:25px;font-weight:900;fill:#fff">${data.coverageRate}%</text><text x="72" y="88" text-anchor="middle" style="font-size:8px;font-weight:900;fill:#d1fae5">COUVERTURE</text></svg>`;
}

function buildSummaryPage(data: MerchantInventoryReportData, totalPages: number): string {
  const target = Number(data.run.transactions_per_pos_target || 3);
  const topMfs = [...data.mfsRows].sort((a, b) => b.coverageRate - a.coverageRate || b.posCount - a.posCount)[0];
  return `${reportStyles()}<main class="report"><section class="accent-title"><p class="eyebrow">BTL Vodacom · Merchant Educational Campaign</p><h1 class="title">Évolution POS & MFS</h1><p class="sub">Synthèse opérationnelle de la vague en cours · Générée le ${escapeHtml(data.generatedAt)}</p></section><section class="hero"><div><h2>${data.coveredCount}/${data.totalPos} POS couverts</h2><p>${data.totalTransactions} transactions enregistrées pour ${money(data.totalAmount)} · Objectif actif : ${target} transactions par POS.</p></div><div class="donut-wrap">${coverageDonut(data)}</div></section><section class="metrics"><div class="metric"><span>POS total</span><b>${data.totalPos}</b><small>Référentiel Merchant</small></div><div class="metric"><span>POS couverts</span><b style="color:#065f46">${data.coveredCount}</b><small>Complétés + non actifs</small></div><div class="metric"><span>Transactions</span><b style="color:#075985">${data.totalTransactions}</b><small>${money(data.totalAmount)} cumulés</small></div><div class="metric"><span>MFS</span><b style="color:#6d28d9">${data.totalMfs}</b><small>Entités recensées</small></div></section><section class="grid"><article class="card"><h3>État des POS</h3>${statusBars(data)}</article><article class="card"><h3>Lecture opérationnelle</h3><p style="margin:0;color:#334155;font-size:12px;font-weight:700;line-height:1.55">${data.priorityPos.length} POS nécessitent encore une attention : ${data.statusRows.find((row) => row.status === 'incomplete')?.count || 0} inachevés, ${data.statusRows.find((row) => row.status === 'active')?.count || 0} actifs et ${data.statusRows.find((row) => row.status === 'pending')?.count || 0} à faire.</p><p style="margin:12px 0 0;color:#334155;font-size:12px;font-weight:700;line-height:1.55">Meilleure couverture MFS : <b>${escapeHtml(topMfs ? `${topMfs.mfs} · ${topMfs.coverageRate}%` : 'Aucune donnée')}</b>.</p></article></section><h2 class="section-title">Couverture par MFS</h2><table class="mfs-table"><thead><tr><th>MFS</th><th>POS</th><th>Couverts</th><th>Tx</th><th>Taux</th><th>BA associés</th></tr></thead><tbody>${data.mfsRows.slice(0, 12).map((row) => `<tr><td><b>${escapeHtml(row.mfs)}</b></td><td>${row.posCount}</td><td>${row.completed + row.inactive}</td><td>${row.transactions}</td><td style="font-weight:900;color:#065f46">${row.coverageRate}%</td><td>${escapeHtml(row.baNames)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:18px;color:#475569">Aucune donnée MFS.</td></tr>'}</tbody></table><p class="footer">Page 1/${totalPages} · Le classeur Excel contient le registre exhaustif des POS, MFS et transactions.</p></main>`;
}

function buildDetailPage(data: MerchantInventoryReportData, items: MerchantPosControlItem[], page: number, totalPages: number): string {
  const target = Number(data.run.transactions_per_pos_target || 3);
  return `${reportStyles()}<main class="report"><header class="detail-head"><p class="eyebrow">BTL Vodacom · Merchant Educational Campaign</p><h1>POS à suivre en priorité</h1><p>État opérationnel, derniers signaux et transactions · ${escapeHtml(data.generatedAt)}</p></header><table class="mfs-table"><thead><tr><th>POS</th><th>MFS · BA</th><th>État</th><th>Tx</th><th>Dernière visite</th><th>Dernière Tx</th></tr></thead><tbody>${tableRows(items, target)}</tbody></table>${items.length === 0 ? '<p class="callout">Aucun POS en attente de suivi : les POS sont complétés ou déclarés non actifs.</p>' : ''}<p class="footer">Page ${page}/${totalPages} · BTL Vodacom Privilege Tracker</p></main>`;
}

export function buildMerchantInventoryReportHtml(data: MerchantInventoryReportData): string {
  return buildSummaryPage(data, 1);
}

function buildPdfPages(data: MerchantInventoryReportData): string[] {
  const pageSize = 12;
  const focused = data.priorityPos.slice(0, 36);
  const chunks = focused.length ? Array.from({ length: Math.ceil(focused.length / pageSize) }, (_, index) => focused.slice(index * pageSize, (index + 1) * pageSize)) : [[]];
  const totalPages = 1 + chunks.length;
  return [buildSummaryPage(data, totalPages), ...chunks.map((chunk, index) => buildDetailPage(data, chunk, index + 2, totalPages))];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportMerchantInventoryPdf(data: MerchantInventoryReportData): Promise<void> {
  const pages = buildPdfPages(data);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  for (let index = 0; index < pages.length; index += 1) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.minHeight = '1123px';
    container.style.background = '#ffffff';
    container.innerHTML = pages[index];
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
    } finally { container.remove(); }
  }
  pdf.save(`evolution-pos-mfs-merchant-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function chartCanvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2; canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de générer le graphique.');
  context.scale(2, 2);
  draw(context);
  return canvas.toDataURL('image/png').split(',')[1];
}

function statusChart(data: MerchantInventoryReportData): string {
  return chartCanvas(440, 220, (context) => {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 440, 220);
    context.font = '800 14px Arial'; context.fillStyle = '#0f172a'; context.fillText('Répartition des POS par état', 18, 25);
    const visible = data.statusRows.filter((row) => row.count > 0); const total = Math.max(data.totalPos, 1); let angle = -Math.PI / 2;
    visible.forEach((row) => { const next = angle + (row.count / total) * Math.PI * 2; context.beginPath(); context.moveTo(112, 125); context.arc(112, 125, 68, angle, next); context.closePath(); context.fillStyle = row.color; context.fill(); angle = next; });
    context.beginPath(); context.arc(112, 125, 39, 0, Math.PI * 2); context.fillStyle = '#ffffff'; context.fill(); context.textAlign = 'center'; context.font = '900 22px Arial'; context.fillStyle = '#0f172a'; context.fillText(String(data.totalPos), 112, 123); context.font = '700 8px Arial'; context.fillStyle = '#64748b'; context.fillText('POS', 112, 140); context.textAlign = 'left';
    data.statusRows.forEach((row, index) => { const y = 58 + index * 28; context.fillStyle = row.color; context.fillRect(232, y - 10, 11, 11); context.font = '700 11px Arial'; context.fillStyle = '#334155'; context.fillText(`${row.label} · ${row.count}`, 251, y); });
  });
}

function mfsChart(data: MerchantInventoryReportData): string {
  return chartCanvas(600, 250, (context) => {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 600, 250); context.font = '800 14px Arial'; context.fillStyle = '#0f172a'; context.fillText('Taux de couverture par MFS', 18, 25);
    const rows = [...data.mfsRows].sort((a, b) => b.coverageRate - a.coverageRate || b.posCount - a.posCount).slice(0, 6);
    rows.forEach((row, index) => { const y = 50 + index * 31; const width = Math.max(4, (row.coverageRate / 100) * 325); context.font = '700 10px Arial'; context.fillStyle = '#475569'; context.fillText(row.mfs.length > 26 ? `${row.mfs.slice(0, 25)}…` : row.mfs, 18, y + 10); context.fillStyle = '#e2e8f0'; context.fillRect(205, y, 325, 16); context.fillStyle = '#047857'; context.fillRect(205, y, width, 16); context.font = '800 10px Arial'; context.fillStyle = '#0f172a'; context.fillText(`${row.coverageRate}% · ${row.posCount} POS`, 540, y + 11); });
  });
}

function styleWorkbook(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  workbook.creator = 'BTL Vodacom Privilege Tracker'; workbook.created = new Date();
  sheet.views = [{ showGridLines: false }];
  sheet.mergeCells('A1:H1'); sheet.getCell('A1').value = 'BTL Vodacom · Évolution POS & MFS'; sheet.getCell('A1').font = { size: 17, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; sheet.getCell('A1').alignment = { vertical: 'middle' }; sheet.getRow(1).height = 31;
}

export async function exportMerchantInventoryExcel(data: MerchantInventoryReportData): Promise<void> {
  const { default: ExcelJSRuntime } = await import('exceljs');
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = workbook.addWorksheet('Synthèse', { properties: { tabColor: { argb: 'FF059669' } } });
  styleWorkbook(workbook, summary);
  summary.mergeCells('A2:H2'); summary.getCell('A2').value = `Généré le ${data.generatedAt} · Les indicateurs sont calculés depuis les registres source.`; summary.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  summary.addRows([
    ['Indicateur', 'Valeur', 'Lecture'],
    ['POS référencés', null, 'Inventaire campagne'],
    ['POS couverts', null, 'Taux de couverture'],
    ['Transactions', null, 'Montant total des transactions'],
    ['MFS recensés', null, 'Regroupement de l’inventaire'],
    ['Objectif transactions / POS', null, 'Référence de complétion'],
  ]);
  summary.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } }; summary.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; summary.getColumn('A').width = 30; summary.getColumn('B').width = 18; summary.getColumn('C').width = 38;

  const parameters = workbook.addWorksheet('Paramètres', { properties: { tabColor: { argb: 'FF64748B' } } });
  parameters.columns = [{ header: 'Paramètre', key: 'label', width: 34 }, { header: 'Valeur', key: 'value', width: 18 }];
  parameters.addRow({ label: 'Transactions / POS (objectif)', value: Math.max(1, Number(data.run.transactions_per_pos_target || 3)) });
  parameters.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; parameters.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; parameters.state = 'hidden';

  const transactions = workbook.addWorksheet('Transactions source', { properties: { tabColor: { argb: 'FF0EA5E9' } } });
  transactions.columns = [{ header: 'Date', key: 'date', width: 18 }, { header: 'Short code', key: 'shortCode', width: 17 }, { header: 'POS', key: 'pos', width: 31 }, { header: 'MFS', key: 'mfs', width: 27 }, { header: 'BA', key: 'ba', width: 25 }, { header: 'Montant', key: 'amount', width: 18 }];
  data.controls.flatMap((item) => item.transactions.map((transaction) => ({ date: dateOnly(transaction.occurred_at), shortCode: item.pos.agent_number, pos: item.pos.denomination, mfs: item.pos.mfs_name || '', ba: item.ba?.name || '', amount: Number(transaction.amount || 0) }))).sort((a, b) => a.date.localeCompare(b.date)).forEach((transaction) => transactions.addRow(transaction));
  transactions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; transactions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; transactions.getColumn('F').numFmt = '$#,##0.00'; transactions.views = [{ state: 'frozen', ySplit: 1 }]; transactions.autoFilter = { from: 'A1', to: 'F1' };
  const lastTransactionRow = Math.max(2, transactions.rowCount);
  const transactionDateRange = `'Transactions source'!$A$2:$A$${lastTransactionRow}`;
  const transactionShortCodeRange = `'Transactions source'!$B$2:$B$${lastTransactionRow}`;
  const transactionAmountRange = `'Transactions source'!$F$2:$F$${lastTransactionRow}`;

  const pos = workbook.addWorksheet('POS', { properties: { tabColor: { argb: 'FF0284C7' } } });
  pos.columns = [
    { header: 'POS', key: 'name', width: 31 }, { header: 'Short code', key: 'shortCode', width: 17 }, { header: 'Adresse', key: 'address', width: 38 }, { header: 'Pool', key: 'pool', width: 16 }, { header: 'MFS', key: 'mfs', width: 27 }, { header: 'Statut', key: 'status', width: 17 }, { header: 'BA', key: 'ba', width: 25 }, { header: 'Téléphone BA', key: 'phone', width: 18 }, { header: 'Dernière visite', key: 'visited', width: 23 }, { header: 'Constat opérationnel', key: 'note', width: 42 }, { header: 'Transactions', key: 'transactions', width: 15 }, { header: 'Objectif Tx', key: 'target', width: 14 }, { header: 'Taux Tx', key: 'rate', width: 14 }, { header: 'Dernière transaction', key: 'lastTx', width: 23 },
  ];
  data.controls.forEach((item) => { const lastTx = item.transactions[0]; const row = pos.addRow({ name: item.pos.denomination, shortCode: item.pos.agent_number, address: item.pos.address, pool: item.pos.pool, mfs: item.pos.mfs_name || '', status: statusLabel(item.status), ba: item.ba?.name || '', phone: item.ba?.phone || '', visited: dateTime(item.visit?.visited_at), note: item.visit?.operational_note || item.visit?.comment || '', lastTx: dateTime(lastTx?.occurred_at) }); row.getCell(11).value = { formula: `COUNTIF(${transactionShortCodeRange},B${row.number})` }; row.getCell(12).value = { formula: "'Paramètres'!$B$2" }; row.getCell(13).value = { formula: `IFERROR(K${row.number}/L${row.number},0)` }; });
  pos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; pos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; pos.getColumn('M').numFmt = '0%'; pos.views = [{ state: 'frozen', ySplit: 1 }]; pos.autoFilter = { from: 'A1', to: 'N1' };
  pos.eachRow((row, index) => { if (index > 1) { row.alignment = { vertical: 'top', wrapText: true }; if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }); const status = data.controls[index - 2]?.status; if (status) { row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${statusMeta[status].excelColor}` } }; row.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } }; } row.getCell(11).font = { bold: true, color: { argb: 'FF065F46' } }; } });
  const lastPosRow = Math.max(2, pos.rowCount);
  const posMfsRange = `'POS'!$E$2:$E$${lastPosRow}`;
  const posStatusRange = `'POS'!$F$2:$F$${lastPosRow}`;
  const posTransactionRange = `'POS'!$K$2:$K$${lastPosRow}`;

  const mfs = workbook.addWorksheet('MFS', { properties: { tabColor: { argb: 'FF7C3AED' } } });
  mfs.columns = [{ header: 'MFS', key: 'mfs', width: 30 }, { header: 'POS', key: 'pos', width: 12 }, { header: 'Complétés', key: 'completed', width: 15 }, { header: 'Non actifs', key: 'inactive', width: 15 }, { header: 'Actifs', key: 'active', width: 12 }, { header: 'Inachevés', key: 'incomplete', width: 15 }, { header: 'À faire', key: 'pending', width: 12 }, { header: 'Transactions', key: 'transactions', width: 16 }, { header: 'Couverture', key: 'coverage', width: 15 }, { header: 'BA associés', key: 'bas', width: 44 }];
  data.mfsRows.forEach((source) => { const row = mfs.addRow({ mfs: source.mfs }); row.getCell(2).value = { formula: `COUNTIF(${posMfsRange},A${row.number})` }; row.getCell(3).value = { formula: `COUNTIFS(${posMfsRange},A${row.number},${posStatusRange},"Complété")` }; row.getCell(4).value = { formula: `COUNTIFS(${posMfsRange},A${row.number},${posStatusRange},"Non actif")` }; row.getCell(5).value = { formula: `COUNTIFS(${posMfsRange},A${row.number},${posStatusRange},"Actif")` }; row.getCell(6).value = { formula: `COUNTIFS(${posMfsRange},A${row.number},${posStatusRange},"Inachevé")` }; row.getCell(7).value = { formula: `COUNTIFS(${posMfsRange},A${row.number},${posStatusRange},"À faire")` }; row.getCell(8).value = { formula: `SUMIF(${posMfsRange},A${row.number},${posTransactionRange})` }; row.getCell(9).value = { formula: `IFERROR((C${row.number}+D${row.number})/B${row.number},0)` }; row.getCell(10).value = { formula: `TEXTJOIN(" · ",TRUE,UNIQUE(FILTER('POS'!$G$2:$G$${lastPosRow},'POS'!$E$2:$E$${lastPosRow}=A${row.number},"")))` }; });
  mfs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; mfs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; mfs.getColumn('I').numFmt = '0%'; mfs.views = [{ state: 'frozen', ySplit: 1 }]; mfs.autoFilter = { from: 'A1', to: 'J1' };
  mfs.eachRow((row, index) => { if (index > 1) { row.alignment = { vertical: 'top', wrapText: true }; if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }; }); row.getCell(9).font = { bold: true, color: { argb: 'FF065F46' } }; } });
  const lastMfsRow = Math.max(2, mfs.rowCount);

  const evolution = workbook.addWorksheet('Évolution transactions', { properties: { tabColor: { argb: 'FF0EA5E9' } } });
  evolution.columns = [{ header: 'Date', key: 'date', width: 18 }, { header: 'Transactions', key: 'transactions', width: 18 }, { header: 'Montant', key: 'amount', width: 20 }];
  data.dailyRows.forEach((source) => { const row = evolution.addRow({ date: source.date }); row.getCell(2).value = { formula: `COUNTIF(${transactionDateRange},A${row.number})` }; row.getCell(3).value = { formula: `SUMIF(${transactionDateRange},A${row.number},${transactionAmountRange})` }; });
  evolution.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; evolution.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; evolution.getColumn('C').numFmt = '$#,##0.00'; evolution.views = [{ state: 'frozen', ySplit: 1 }]; evolution.autoFilter = { from: 'A1', to: 'C1' };

  summary.getCell('B4').value = { formula: `COUNTA('POS'!$A$2:$A$${lastPosRow})` };
  summary.getCell('B5').value = { formula: `COUNTIF(${posStatusRange},"Complété")+COUNTIF(${posStatusRange},"Non actif")` };
  summary.getCell('C5').value = { formula: 'IFERROR(B5/B4,0)' };
  summary.getCell('B6').value = { formula: `SUM(${posTransactionRange})` };
  summary.getCell('C6').value = { formula: `SUM(${transactionAmountRange})` };
  summary.getCell('B7').value = { formula: `COUNTA('MFS'!$A$2:$A$${lastMfsRow})` };
  summary.getCell('B8').value = { formula: "'Paramètres'!$B$2" };
  summary.getCell('B4').numFmt = '0'; summary.getCell('B5').numFmt = '0'; summary.getCell('C5').numFmt = '0%'; summary.getCell('B6').numFmt = '0'; summary.getCell('C6').numFmt = '$#,##0.00'; summary.getCell('B7').numFmt = '0'; summary.getCell('B8').numFmt = '0';
  summary.addImage(workbook.addImage({ base64: statusChart(data), extension: 'png' }), { tl: { col: 4, row: 3 }, ext: { width: 350, height: 175 } });
  summary.addImage(workbook.addImage({ base64: mfsChart(data), extension: 'png' }), { tl: { col: 0, row: 13 }, ext: { width: 500, height: 205 } });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `evolution-pos-mfs-merchant-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
