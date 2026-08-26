import type ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { MerchantFundRequest } from '../types';

export type FundRequestStatus = MerchantFundRequest['status'];

export interface FundRequestReportData {
  requests: MerchantFundRequest[];
  generatedAt: string;
  totalRequests: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  processedRate: number;
  approvalRate: number;
  averageAmount: number;
  statusBreakdown: Array<{ status: FundRequestStatus; label: string; color: string; count: number; amount: number }>;
  byBa: Array<{ label: string; count: number; amount: number }>;
  byMfs: Array<{ label: string; count: number; amount: number }>;
  byDay: Array<{ label: string; count: number; amount: number }>;
}

const statusMeta: Record<FundRequestStatus, { label: string; color: string; excelColor: string }> = {
  pending: { label: 'En attente', color: '#f59e0b', excelColor: 'F59E0B' },
  reviewed: { label: 'Consultée', color: '#38bdf8', excelColor: '38BDF8' },
  approved: { label: 'Approuvée', color: '#34d399', excelColor: '34D399' },
  rejected: { label: 'Rejetée', color: '#fb7185', excelColor: 'FB7185' },
  cancelled: { label: 'Annulée', color: '#94a3b8', excelColor: '94A3B8' },
};

const statusOrder: FundRequestStatus[] = ['pending', 'reviewed', 'approved', 'rejected', 'cancelled'];
const money = (value: number) => `$${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeLabel = (value?: string | null, fallback = 'Non renseigné') => value?.trim() || fallback;

function groupRows(requests: MerchantFundRequest[], selector: (request: MerchantFundRequest) => string) {
  const groups = new Map<string, { count: number; amount: number }>();
  requests.forEach((request) => {
    const label = selector(request);
    const current = groups.get(label) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(request.amount || 0);
    groups.set(label, current);
  });
  return Array.from(groups, ([label, value]) => ({ label, ...value })).sort((a, b) => b.amount - a.amount || b.count - a.count || a.label.localeCompare(b.label, 'fr'));
}

export function buildFundRequestReportData(requests: MerchantFundRequest[]): FundRequestReportData {
  const totalAmount = requests.reduce((sum, request) => sum + Number(request.amount || 0), 0);
  const byStatus = statusOrder.map((status) => {
    const matching = requests.filter((request) => request.status === status);
    return {
      status,
      label: statusMeta[status].label,
      color: statusMeta[status].color,
      count: matching.length,
      amount: matching.reduce((sum, request) => sum + Number(request.amount || 0), 0),
    };
  });
  const findStatus = (status: FundRequestStatus) => byStatus.find((row) => row.status === status)!;
  const approved = findStatus('approved');
  const rejected = findStatus('rejected');
  const pending = findStatus('pending');
  const processedCount = requests.filter((request) => request.status !== 'pending').length;
  const decisionCount = approved.count + rejected.count;
  const byDay = groupRows(requests, (request) => new Date(request.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));

  return {
    requests,
    generatedAt: new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }),
    totalRequests: requests.length,
    totalAmount,
    pendingCount: pending.count,
    pendingAmount: pending.amount,
    approvedCount: approved.count,
    approvedAmount: approved.amount,
    rejectedCount: rejected.count,
    rejectedAmount: rejected.amount,
    processedRate: requests.length ? Math.round((processedCount / requests.length) * 100) : 0,
    approvalRate: decisionCount ? Math.round((approved.count / decisionCount) * 100) : 0,
    averageAmount: requests.length ? totalAmount / requests.length : 0,
    statusBreakdown: byStatus,
    byBa: groupRows(requests, (request) => safeLabel(request.ba?.name, request.ba_id || 'BA non renseigné')),
    byMfs: groupRows(requests, (request) => safeLabel(request.mfs_name)),
    byDay,
  };
}

function donutSvg(data: FundRequestReportData): string {
  const visible = data.statusBreakdown.filter((item) => item.count > 0);
  const total = Math.max(data.totalRequests, 1);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const rings = visible.map((item) => {
    const dash = (item.count / total) * circumference;
    const segment = `<circle cx="70" cy="70" r="${radius}" fill="none" stroke="${item.color}" stroke-width="15" stroke-linecap="butt" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
    offset += dash;
    return segment;
  }).join('');
  return `<svg viewBox="0 0 140 140" width="140" height="140" aria-label="Répartition par statut"><circle cx="70" cy="70" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="15"/>${rings}<text x="70" y="65" text-anchor="middle" style="font-size:22px;font-weight:900;fill:#0f172a">${data.totalRequests}</text><text x="70" y="84" text-anchor="middle" style="font-size:8px;font-weight:800;fill:#64748b">DEMANDES</text></svg>`;
}

function barsSvg(rows: Array<{ label: string; count: number; amount: number }>, color: string, metric: 'count' | 'amount' = 'amount'): string {
  const visible = rows.slice(0, 6);
  const max = Math.max(...visible.map((row) => Number(row[metric])), 1);
  return `<div style="display:flex;flex-direction:column;gap:10px">${visible.map((row) => {
    const value = Number(row[metric]);
    const width = Math.max(4, Math.round((value / max) * 100));
    return `<div><div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;font-weight:800;color:#0f172a"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(row.label)}</span><b style="color:#0f172a">${metric === 'amount' ? money(value) : value}</b></div><div style="margin-top:5px;height:10px;border:1px solid #cbd5e1;border-radius:99px;background:#f1f5f9;overflow:hidden"><div style="height:100%;width:${width}%;border-radius:99px;background:${color}"></div></div></div>`;
  }).join('') || '<p style="font-size:11px;font-weight:700;color:#334155">Aucune donnée disponible.</p>'}</div>`;
}

function statusLegend(data: FundRequestReportData): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:7px">${data.statusBreakdown.map((row) => `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.42);border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;color:#0f172a;background:#ffffff"><i style="width:8px;height:8px;border-radius:50%;background:${row.color};display:block;box-shadow:0 0 0 1px rgba(15,23,42,.15)"></i>${row.label} · ${row.count}</span>`).join('')}</div>`;
}

function reportStyles() {
  return `<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff}.report{max-width:794px;margin:0 auto;padding:30px}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.13em;color:#065f46;text-transform:uppercase}.title{margin:8px 0 5px;font-size:30px;line-height:1.12;color:#0f172a}.sub{margin:0;color:#334155;font-size:13px;font-weight:600;line-height:1.5}.hero{margin-top:22px;padding:21px;border-radius:18px;background:linear-gradient(135deg,#052e2b,#047857);color:#ffffff}.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;align-items:center}.hero h2{margin:0;font-size:24px;line-height:1.12;color:#ffffff}.hero p{margin:8px 0 0;font-size:13px;font-weight:700;line-height:1.45;color:#ecfdf5}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.metric{padding:13px;border-radius:12px;background:#fff;border:1px solid #cbd5e1;box-shadow:0 1px 2px rgba(15,23,42,.05)}.metric .label{font-size:10px;font-weight:900;letter-spacing:.08em;color:#334155;text-transform:uppercase}.metric b{display:block;margin-top:6px;font-size:20px;line-height:1.1;color:#0f172a}.metric span{display:block;margin-top:5px;font-size:10px;font-weight:700;line-height:1.35;color:#334155}.sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{border:1px solid #cbd5e1;border-radius:14px;padding:15px;background:#fff}.card h3{margin:0 0 12px;font-size:14px;color:#0f172a}.card p{font-size:11px;font-weight:600;line-height:1.5;color:#334155}.table-title{margin:22px 0 10px;font-size:16px;color:#0f172a}.table{width:100%;border-collapse:separate;border-spacing:0;font-size:10px;color:#0f172a;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden}.table th{padding:9px 8px;text-align:left;background:#064e3b;color:#fff;font-size:9px;font-weight:900;letter-spacing:.045em;text-transform:uppercase}.table td{padding:9px 8px;border-bottom:1px solid #cbd5e1;vertical-align:top;font-weight:600;line-height:1.38}.table tbody tr:nth-child(even){background:#f8fafc}.table tbody tr:last-child td{border-bottom:0}.badge{display:inline-block;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:900;color:#fff;letter-spacing:.02em;white-space:nowrap}.footer{margin-top:16px;border-top:1px solid #cbd5e1;padding-top:10px;color:#475569;font-size:9px;font-weight:600;line-height:1.45}.pdf-cover{padding:42px 42px 34px}.pdf-title-block{border-left:6px solid #059669;padding:4px 0 4px 16px}.pdf-title-block .title{font-size:35px;letter-spacing:-.02em}.pdf-title-block .sub{font-size:14px}.pdf-cover .hero{margin-top:28px;padding:25px}.pdf-cover .hero h2{font-size:29px}.pdf-cover .hero p{font-size:14px}.pdf-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px}.pdf-kpis .metric{min-height:102px;padding:17px}.pdf-kpis .metric .label{font-size:11px}.pdf-kpis .metric b{font-size:26px}.pdf-kpis .metric span{font-size:11px}.pdf-analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.pdf-analysis-grid .card{padding:18px}.pdf-analysis-grid .card h3{font-size:15px;margin-bottom:14px}.pdf-insight{margin-top:18px;border:1px solid #bbf7d0;border-radius:16px;background:#ecfdf5;padding:17px}.pdf-insight h3{margin:0;color:#065f46;font-size:14px}.pdf-insight p{margin:7px 0 0;color:#134e4a;font-size:12px;font-weight:700;line-height:1.5}.pdf-register-callout{margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid #cbd5e1;border-radius:14px;padding:14px 16px;background:#f8fafc}.pdf-register-callout b{display:block;color:#0f172a;font-size:14px}.pdf-register-callout span{display:block;margin-top:4px;color:#475569;font-size:11px;font-weight:700}.pdf-register-callout .page-chip{border-radius:999px;background:#065f46;padding:8px 11px;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}.pdf-detail{padding:38px 36px}.pdf-detail-header{margin-bottom:18px;border-bottom:2px solid #065f46;padding-bottom:13px}.pdf-detail-header h1{margin:0;color:#0f172a;font-size:27px}.pdf-detail-header p{margin:5px 0 0;color:#475569;font-size:12px;font-weight:700}.pdf-detail .table{font-size:10px}.pdf-detail .table th{padding:11px 8px;font-size:9px}.pdf-detail .table td{padding:12px 8px;line-height:1.48}.pdf-detail .footer{margin-top:22px;font-size:10px}.page-break{page-break-after:always}</style>`;
}

function requestTableRows(requests: MerchantFundRequest[]) {
  return requests.map((request) => {
    const meta = statusMeta[request.status];
    return `<tr><td>${escapeHtml(dateTime(request.requested_at))}</td><td><b>${escapeHtml(safeLabel(request.ba?.name, request.ba_id))}</b><br/><span style="color:#475569;font-weight:700">${escapeHtml(request.ba_phone || request.ba?.phone || '—')}</span></td><td>${escapeHtml(safeLabel(request.point_of_sale?.denomination))}<br/><span style="color:#475569;font-weight:700">${escapeHtml(request.point_of_sale?.agent_number || '—')} · ${escapeHtml(request.mfs_name || 'MFS non renseigné')}</span></td><td style="font-weight:900;color:#065f46">${money(request.amount)}</td><td><span class="badge" style="background:${meta.color}">${meta.label}</span></td><td>${escapeHtml(request.note || '—')}</td></tr>`;
  }).join('');
}

export function buildFundRequestReportHtml(data: FundRequestReportData): string {
  const topBa = data.byBa[0];
  const topMfs = data.byMfs[0];
  return `${reportStyles()}<main class="report"><p class="eyebrow">BTL Vodacom · Merchant Educational Campaign</p><h1 class="title">Rapport des demandes de fonds</h1><p class="sub">Registre opérationnel consolidé · Généré le ${escapeHtml(data.generatedAt)}</p><section class="hero"><div class="hero-grid"><div><h2>${money(data.totalAmount)} sollicités</h2><p>${data.totalRequests} demande${data.totalRequests > 1 ? 's' : ''} enregistrée${data.totalRequests > 1 ? 's' : ''} · ${data.pendingCount} en attente pour ${money(data.pendingAmount)}</p><div style="margin-top:12px">${statusLegend(data)}</div></div><div style="text-align:center">${donutSvg(data)}</div></div></section><section class="summary"><div class="metric"><span class="label">Demandes</span><b>${data.totalRequests}</b><span>${money(data.averageAmount)} en moyenne</span></div><div class="metric"><span class="label">Approuvées</span><b style="color:#047857">${data.approvedCount}</b><span>${money(data.approvedAmount)}</span></div><div class="metric"><span class="label">En attente</span><b style="color:#b45309">${data.pendingCount}</b><span>${money(data.pendingAmount)}</span></div><div class="metric"><span class="label">Traitement</span><b style="color:#0369a1">${data.processedRate}%</b><span>Approbation : ${data.approvalRate}%</span></div></section><section class="sections"><article class="card"><h3>Montants par Brand Ambassador</h3>${barsSvg(data.byBa, '#0f766e')}</article><article class="card"><h3>Montants par MFS</h3>${barsSvg(data.byMfs, '#7c3aed')}</article><article class="card"><h3>Demandes par jour</h3>${barsSvg(data.byDay, '#0284c7', 'count')}</article><article class="card"><h3>Points d’attention</h3><p><b>BA le plus sollicité :</b> ${escapeHtml(topBa ? `${topBa.label} · ${money(topBa.amount)}` : 'Aucune donnée')}</p><p><b>MFS le plus sollicité :</b> ${escapeHtml(topMfs ? `${topMfs.label} · ${money(topMfs.amount)}` : 'Aucune donnée')}</p><p><b>Rejets :</b> ${data.rejectedCount} demande${data.rejectedCount > 1 ? 's' : ''} · ${money(data.rejectedAmount)}</p><p><b>Lecture :</b> le taux de traitement couvre les demandes dont le statut n’est plus « En attente ».</p></article></section><h2 class="table-title">Registre détaillé</h2><table class="table"><thead><tr><th>Date</th><th>BA</th><th>POS · MFS</th><th>Montant</th><th>Statut</th><th>Note</th></tr></thead><tbody>${requestTableRows(data.requests) || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">Aucune demande de fonds pour cette période.</td></tr>'}</tbody></table><p class="footer">Rapport généré depuis le BTL Vodacom Privilege Tracker. Les décisions et statuts reflètent l’état disponible au moment de la génération.</p></main>`;
}

function buildPdfCover(data: FundRequestReportData, pageCount: number): string {
  const topBa = data.byBa[0];
  const topMfs = data.byMfs[0];
  return `${reportStyles()}<main class="report pdf-cover"><section class="pdf-title-block"><p class="eyebrow">BTL Vodacom · Merchant Educational Campaign</p><h1 class="title">Rapport des demandes de fonds</h1><p class="sub">Synthèse décisionnelle · Généré le ${escapeHtml(data.generatedAt)}</p></section><section class="hero"><div class="hero-grid"><div><h2>${money(data.totalAmount)} sollicités</h2><p>${data.totalRequests} demande${data.totalRequests > 1 ? 's' : ''} enregistrée${data.totalRequests > 1 ? 's' : ''} · ${data.pendingCount} en attente pour ${money(data.pendingAmount)}</p><div style="margin-top:15px">${statusLegend(data)}</div></div><div style="text-align:center">${donutSvg(data)}</div></div></section><section class="pdf-kpis"><div class="metric"><span class="label">Demandes</span><b>${data.totalRequests}</b><span>${money(data.averageAmount)} en moyenne</span></div><div class="metric"><span class="label">Approuvées</span><b style="color:#065f46">${data.approvedCount}</b><span>${money(data.approvedAmount)} validés</span></div><div class="metric"><span class="label">En attente</span><b style="color:#92400e">${data.pendingCount}</b><span>${money(data.pendingAmount)} à traiter</span></div><div class="metric"><span class="label">Traitement</span><b style="color:#075985">${data.processedRate}%</b><span>Approbation : ${data.approvalRate}%</span></div></section><section class="pdf-analysis-grid"><article class="card"><h3>Montants par Brand Ambassador</h3>${barsSvg(data.byBa, '#0f766e')}</article><article class="card"><h3>Montants par MFS</h3>${barsSvg(data.byMfs, '#7c3aed')}</article></section><section class="pdf-insight"><h3>Lecture opérationnelle</h3><p>BA le plus sollicité : ${escapeHtml(topBa ? `${topBa.label} · ${money(topBa.amount)}` : 'Aucune donnée')} · MFS le plus sollicité : ${escapeHtml(topMfs ? `${topMfs.label} · ${money(topMfs.amount)}` : 'Aucune donnée')} · ${data.rejectedCount} demande${data.rejectedCount > 1 ? 's' : ''} rejetée${data.rejectedCount > 1 ? 's' : ''} pour ${money(data.rejectedAmount)}.</p></section><section class="pdf-register-callout"><div><b>Registre détaillé</b><span>Le détail complet des demandes, décisions et notes commence à la page suivante.</span></div><span class="page-chip">${data.requests.length} lignes · ${Math.max(0, pageCount - 1)} page${pageCount - 1 > 1 ? 's' : ''}</span></section><p class="footer">Page 1/${pageCount} · BTL Vodacom Privilege Tracker</p></main>`;
}

function buildPdfPages(data: FundRequestReportData): string[] {
  const pageSize = 11;
  const chunks = data.requests.length ? Array.from({ length: Math.ceil(data.requests.length / pageSize) }, (_, index) => data.requests.slice(index * pageSize, (index + 1) * pageSize)) : [];
  const pageCount = 1 + chunks.length;
  const pages = [buildPdfCover(data, pageCount)];
  chunks.forEach((chunk, index) => {
    const firstRequest = index * pageSize + 1;
    const lastRequest = firstRequest + chunk.length - 1;
    pages.push(`${reportStyles()}<main class="report pdf-detail"><header class="pdf-detail-header"><p class="eyebrow">BTL Vodacom · Merchant Educational Campaign</p><h1>Registre détaillé des demandes</h1><p>Demandes ${firstRequest} à ${lastRequest} · ${escapeHtml(data.generatedAt)}</p></header><table class="table"><thead><tr><th>Date</th><th>BA</th><th>POS · MFS</th><th>Montant</th><th>Statut</th><th>Note</th></tr></thead><tbody>${requestTableRows(chunk)}</tbody></table><p class="footer">Page ${index + 2}/${pageCount} · BTL Vodacom Privilege Tracker</p></main>`);
  });
  return pages;
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

export async function exportFundRequestsPdf(data: FundRequestReportData): Promise<void> {
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
    } finally {
      container.remove();
    }
  }
  pdf.save(`rapport-demandes-fonds-merchant-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function chartCanvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de générer le graphique.');
  context.scale(2, 2);
  draw(context);
  return canvas.toDataURL('image/png').split(',')[1];
}

function statusChartPng(data: FundRequestReportData) {
  return chartCanvas(440, 220, (context) => {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 440, 220);
    context.font = '800 14px Arial'; context.fillStyle = '#0f172a'; context.fillText('Répartition des demandes par statut', 18, 25);
    const total = Math.max(data.totalRequests, 1); let angle = -Math.PI / 2;
    data.statusBreakdown.filter((item) => item.count > 0).forEach((item) => {
      const next = angle + (item.count / total) * Math.PI * 2;
      context.beginPath(); context.moveTo(115, 125); context.arc(115, 125, 70, angle, next); context.closePath(); context.fillStyle = item.color; context.fill(); angle = next;
    });
    context.beginPath(); context.arc(115, 125, 40, 0, Math.PI * 2); context.fillStyle = '#ffffff'; context.fill();
    context.textAlign = 'center'; context.font = '900 23px Arial'; context.fillStyle = '#0f172a'; context.fillText(String(data.totalRequests), 115, 124); context.font = '700 8px Arial'; context.fillStyle = '#64748b'; context.fillText('DEMANDES', 115, 140); context.textAlign = 'left';
    data.statusBreakdown.forEach((item, index) => { const y = 58 + index * 29; context.fillStyle = item.color; context.fillRect(235, y - 10, 11, 11); context.font = '700 11px Arial'; context.fillStyle = '#334155'; context.fillText(`${item.label} · ${item.count} · ${money(item.amount)}`, 254, y); });
  });
}

function barChartPng(title: string, rows: Array<{ label: string; amount: number }>, color: string) {
  return chartCanvas(620, 250, (context) => {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 620, 250);
    context.font = '800 14px Arial'; context.fillStyle = '#0f172a'; context.fillText(title, 18, 25);
    const visible = rows.slice(0, 6); const max = Math.max(...visible.map((item) => item.amount), 1);
    visible.forEach((item, index) => { const y = 50 + index * 31; const width = Math.max(5, (item.amount / max) * 350); context.font = '700 10px Arial'; context.fillStyle = '#475569'; context.fillText(item.label.length > 27 ? `${item.label.slice(0, 26)}…` : item.label, 18, y + 10); context.fillStyle = '#e2e8f0'; context.fillRect(210, y, 350, 16); context.fillStyle = color; context.fillRect(210, y, width, 16); context.font = '800 10px Arial'; context.fillStyle = '#0f172a'; context.fillText(money(item.amount), 570, y + 11); });
  });
}

function styleWorkbook(workbook: ExcelJS.Workbook, summary: ExcelJS.Worksheet) {
  workbook.creator = 'BTL Vodacom Privilege Tracker';
  workbook.created = new Date();
  summary.views = [{ showGridLines: false }];
  summary.mergeCells('A1:H1');
  summary.getCell('A1').value = 'BTL Vodacom · Rapport des demandes de fonds';
  summary.getCell('A1').font = { size: 17, bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  summary.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  summary.getRow(1).height = 31;
}

export async function exportFundRequestsExcel(data: FundRequestReportData): Promise<void> {
  const { default: ExcelJSRuntime } = await import('exceljs');
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;

  const details = workbook.addWorksheet('Registre détaillé', { properties: { tabColor: { argb: 'FF0284C7' } } });
  details.columns = [
    { header: 'Date de demande', key: 'requestedAt', width: 23 }, { header: 'BA', key: 'ba', width: 26 }, { header: 'Téléphone BA', key: 'phone', width: 18 }, { header: 'Superviseur', key: 'supervisor', width: 24 }, { header: 'MFS', key: 'mfs', width: 25 }, { header: 'POS', key: 'pos', width: 30 }, { header: 'Short code', key: 'shortCode', width: 16 }, { header: 'Montant', key: 'amount', width: 15 }, { header: 'Statut', key: 'status', width: 16 }, { header: 'Date décision', key: 'reviewedAt', width: 23 }, { header: 'Décidé par', key: 'reviewedBy', width: 24 }, { header: 'Note', key: 'note', width: 50 },
  ];
  data.requests.forEach((request) => details.addRow({ requestedAt: dateTime(request.requested_at), ba: safeLabel(request.ba?.name, request.ba_id), phone: request.ba_phone || request.ba?.phone || '', supervisor: request.supervisor?.name || 'Non affecté', mfs: request.mfs_name || '', pos: request.point_of_sale?.denomination || '', shortCode: request.point_of_sale?.agent_number || '', amount: Number(request.amount || 0), status: statusMeta[request.status].label, reviewedAt: dateTime(request.reviewed_at), reviewedBy: request.reviewed_by || '', note: request.note || '' }));
  details.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; details.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; details.getColumn('H').numFmt = '$#,##0.00'; details.views = [{ state: 'frozen', ySplit: 1 }]; details.autoFilter = { from: 'A1', to: 'L1' };
  details.eachRow((row, index) => { if (index > 1) { row.alignment = { vertical: 'top', wrapText: true }; if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }); const status = data.requests[index - 2]?.status; row.getCell(8).font = { bold: true, color: { argb: 'FF065F46' } }; if (status) { row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${statusMeta[status].excelColor}` } }; row.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } }; } } });
  const lastDetailRow = Math.max(2, details.rowCount);
  const detailStatusRange = `'Registre détaillé'!$I$2:$I$${lastDetailRow}`;
  const detailAmountRange = `'Registre détaillé'!$H$2:$H$${lastDetailRow}`;
  const detailDateRange = `'Registre détaillé'!$A$2:$A$${lastDetailRow}`;

  const statuses = workbook.addWorksheet('Par statut', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  statuses.columns = [{ header: 'Statut', key: 'label', width: 20 }, { header: 'Demandes', key: 'count', width: 16 }, { header: 'Montant', key: 'amount', width: 20 }];
  statusOrder.forEach((status) => {
    const row = statuses.addRow({ label: statusMeta[status].label });
    row.getCell(2).value = { formula: `COUNTIF(${detailStatusRange},A${row.number})` };
    row.getCell(3).value = { formula: `SUMIF(${detailStatusRange},A${row.number},${detailAmountRange})` };
  });
  statuses.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; statuses.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; statuses.getColumn('C').numFmt = '$#,##0.00'; statuses.views = [{ state: 'frozen', ySplit: 1 }]; statuses.autoFilter = { from: 'A1', to: 'C1' };
  statuses.eachRow((row, index) => { if (index > 1) { const status = statusOrder[index - 2]; row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${statusMeta[status].excelColor}` } }; row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } }; row.getCell(3).font = { bold: true, color: { argb: 'FF065F46' } }; } });

  const summary = workbook.addWorksheet('Synthèse', { properties: { tabColor: { argb: 'FF059669' } } });
  styleWorkbook(workbook, summary);
  summary.mergeCells('A2:H2'); summary.getCell('A2').value = `Généré le ${data.generatedAt} · Tous les indicateurs sont calculés depuis le registre détaillé.`; summary.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  summary.addRows([
    ['Indicateur', 'Valeur', 'Lecture'],
    ['Demandes enregistrées', null, 'Montant moyen par demande'],
    ['Montant sollicité', null, 'Somme du registre détaillé'],
    ['En attente', null, 'Montant en attente'],
    ['Approuvées', null, 'Montant approuvé'],
    ['Rejetées', null, 'Montant rejeté'],
    ['Taux de traitement', null, 'Hors demandes en attente'],
    ['Taux d’approbation', null, 'Parmi les décisions approuvée/rejetée'],
  ]);
  summary.getCell('B4').value = { formula: `COUNTA(${detailDateRange})` };
  summary.getCell('C4').value = { formula: 'IFERROR(B5/B4,0)' };
  summary.getCell('B5').value = { formula: `SUM(${detailAmountRange})` };
  summary.getCell('B6').value = { formula: `COUNTIF(${detailStatusRange},"En attente")` };
  summary.getCell('C6').value = { formula: `SUMIF(${detailStatusRange},"En attente",${detailAmountRange})` };
  summary.getCell('B7').value = { formula: `COUNTIF(${detailStatusRange},"Approuvée")` };
  summary.getCell('C7').value = { formula: `SUMIF(${detailStatusRange},"Approuvée",${detailAmountRange})` };
  summary.getCell('B8').value = { formula: `COUNTIF(${detailStatusRange},"Rejetée")` };
  summary.getCell('C8').value = { formula: `SUMIF(${detailStatusRange},"Rejetée",${detailAmountRange})` };
  summary.getCell('B9').value = { formula: 'IFERROR((B4-B6)/B4,0)' };
  summary.getCell('B10').value = { formula: 'IFERROR(B7/(B7+B8),0)' };
  summary.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } }; summary.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  summary.getCell('B4').numFmt = '0'; summary.getCell('B5').numFmt = '$#,##0.00'; ['B6', 'B7', 'B8'].forEach((cell) => { summary.getCell(cell).numFmt = '0'; }); ['C4', 'C6', 'C7', 'C8'].forEach((cell) => { summary.getCell(cell).numFmt = '$#,##0.00'; }); summary.getCell('B9').numFmt = '0%'; summary.getCell('B10').numFmt = '0%'; summary.getColumn('A').width = 28; summary.getColumn('B').width = 17; summary.getColumn('C').width = 35;
  summary.addImage(workbook.addImage({ base64: statusChartPng(data), extension: 'png' }), { tl: { col: 4, row: 3 }, ext: { width: 350, height: 175 } });
  summary.addImage(workbook.addImage({ base64: barChartPng('Montants par BA', data.byBa, '#0F766E'), extension: 'png' }), { tl: { col: 0, row: 13 }, ext: { width: 500, height: 202 } });
  summary.addImage(workbook.addImage({ base64: barChartPng('Montants par MFS', data.byMfs, '#7C3AED'), extension: 'png' }), { tl: { col: 0, row: 26 }, ext: { width: 500, height: 202 } });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `rapport-demandes-fonds-merchant-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
