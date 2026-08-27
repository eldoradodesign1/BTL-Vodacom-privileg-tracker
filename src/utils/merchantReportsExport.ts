import { jsPDF } from 'jspdf';
import type { BADailyAttendance, BAPosVisit, BATransaction, CampaignRun, User } from '../types';
import type { MerchantSupervisorReport } from './merchantCampaign';

const escapeHtml = (value: string | number | null | undefined) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const number = (value: number) => Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const stamp = () => new Date().toISOString().slice(0, 10);

interface MerchantAgentReportInput {
  ba: Pick<User, 'id' | 'name'> & { phone?: string | null };
  attendance: BADailyAttendance;
  visits: Array<Pick<BAPosVisit, 'pos_id' | 'activity_date' | 'visited_at' | 'operational_status' | 'operational_note'> & { point_of_sale?: BAPosVisit['point_of_sale'] }>;
  transactions: BATransaction[];
  run: CampaignRun | null;
}

function download(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function workbook(): Promise<any> {
  const ExcelJS = await import('exceljs');
  const result = new ExcelJS.Workbook();
  result.creator = 'BTL Vodacom Privilege Tracker';
  result.created = new Date();
  result.calcProperties.fullCalcOnLoad = true;
  return result;
}

function header(row: any): void {
  row.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 26;
}

function sheetStyle(sheet: any, widths: number[]): void {
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: widths.length } };
}

function addSummary(workbookInstance: any, title: string, subtitle: string, source: string, metrics: Array<[string, string, string?]>): void {
  const sheet = workbookInstance.addWorksheet('Synthèse');
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } };
  sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  sheet.getRow(1).height = 34;
  sheet.mergeCells('A2:D2');
  sheet.getCell('A2').value = subtitle;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF475569' }, size: 10 };
  sheet.addRow([]);
  sheet.addRow(['Indicateur', 'Valeur calculée', 'Source', 'Contrôle']);
  header(sheet.getRow(4));
  metrics.forEach(([label, formula, format], index) => {
    const row = index + 5;
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`B${row}`).value = { formula };
    sheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF0F766E' }, size: 12 };
    sheet.getCell(`B${row}`).numFmt = format || '#,##0';
    sheet.getCell(`C${row}`).value = source;
    sheet.getCell(`D${row}`).value = 'Calcul dynamique';
    if (index % 2 === 0) ['A', 'B', 'C', 'D'].forEach((column) => { sheet.getCell(`${column}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  });
  sheet.getColumn('A').width = 30;
  sheet.getColumn('B').width = 20;
  sheet.getColumn('C').width = 22;
  sheet.getColumn('D').width = 20;
  sheet.views = [{ showGridLines: false }];
  workbookInstance.worksheets.splice(workbookInstance.worksheets.indexOf(sheet), 1);
  workbookInstance.worksheets.unshift(sheet);
}

export function buildMerchantAgentReportHtml(input: MerchantAgentReportInput): string {
  const date = input.attendance.activity_date;
  const visits = input.visits.filter((item) => item.activity_date === date);
  const transactions = input.transactions.filter((item) => item.occurred_at.slice(0, 10) === date);
  const amount = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const target = Number(input.run?.transactions_per_pos_target || 3);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>body{margin:0;background:#eef4f7;color:#12202a;font-family:Arial,sans-serif}.page{max-width:900px;margin:0 auto;background:white;padding:34px}.hero{padding:24px;border-radius:18px;background:linear-gradient(135deg,#083344,#0f766e);color:#fff}.eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:800;color:#a5f3fc;text-transform:uppercase}.hero h1{margin:7px 0 5px;font-size:27px}.hero p{margin:0;color:#d1fae5;font-size:13px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.metric{border:1px solid #d9e6eb;border-radius:14px;padding:15px;background:#f8fafc}.metric b{font-size:22px;color:#0f766e}.metric span{display:block;margin-top:4px;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase}.section{margin-top:22px;border:1px solid #d9e6eb;border-radius:15px;overflow:hidden}.section h2{margin:0;padding:12px 15px;background:#f0fdfa;color:#0f4c5c;font-size:12px;text-transform:uppercase;letter-spacing:1px}.section p{padding:0 15px;line-height:1.55;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th{padding:10px 12px;background:#083344;color:#fff;text-align:left;font-size:10px;text-transform:uppercase}td{padding:10px 12px;border-top:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}.muted{color:#64748b;font-size:11px}.footer{margin-top:20px;color:#64748b;font-size:10px;text-align:center}</style></head><body><main class="page"><section class="hero"><div class="eyebrow">Merchant Educational Campaign · Rapport BA</div><h1>${escapeHtml(input.ba.name)}</h1><p>${escapeHtml(dateLabel(date))} · MFS ${escapeHtml(input.attendance.mfs_name || 'Non renseigné')}</p></section><section class="metrics"><div class="metric"><b>${visits.length}</b><span>POS visités</span></div><div class="metric"><b>${transactions.length}</b><span>Transactions</span></div><div class="metric"><b>${number(amount)}</b><span>Montant cumulé</span></div></section><section class="section"><h2>Commentaire de clôture</h2><p>${escapeHtml(input.attendance.closing_comment || 'Aucun commentaire renseigné.')}</p></section><section class="section"><h2>POS visités</h2><table><thead><tr><th>Heure</th><th>POS</th><th>Statut</th><th>Transactions</th></tr></thead><tbody>${visits.map((visit) => { const count = transactions.filter((transaction) => transaction.pos_id === visit.pos_id).length; return `<tr><td>${visit.visited_at ? new Date(visit.visited_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>${escapeHtml(visit.point_of_sale?.denomination || visit.pos_id)}</td><td>${escapeHtml(visit.operational_status === 'inactive' ? 'Inactif · couvert' : count >= target ? 'Complété · couvert' : 'En activité')}</td><td>${count}/${target}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Aucun POS enregistré.</td></tr>'}</tbody></table></section><section class="section"><h2>Transactions</h2><table><thead><tr><th>Heure</th><th>POS</th><th>Client</th><th>Référence</th><th>Montant</th></tr></thead><tbody>${transactions.map((transaction) => `<tr><td>${new Date(transaction.occurred_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td><td>${escapeHtml(transaction.point_of_sale?.denomination || transaction.pos_id)}</td><td>${escapeHtml(transaction.client_number || '—')}</td><td>${escapeHtml(transaction.transaction_reference || '—')}</td><td>${number(Number(transaction.amount || 0))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Aucune transaction enregistrée.</td></tr>'}</tbody></table></section><p class="footer">BTL Vodacom Privilege Tracker · Rapport généré le ${new Date().toLocaleString('fr-FR')}</p></main></body></html>`;
}

export async function exportMerchantAgentReportPdf(input: MerchantAgentReportInput): Promise<void> {
  const date = input.attendance.activity_date;
  const transactions = input.transactions.filter((item) => item.occurred_at.slice(0, 10) === date);
  const visits = input.visits.filter((item) => item.activity_date === date);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = 16;
  const next = () => { pdf.addPage(); y = 16; };
  const lines = (text: string, size = 9, color: [number, number, number] = [30, 41, 59]) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color); const rows = pdf.splitTextToSize(text, width - margin * 2); if (y + rows.length * (size * 0.48) > height - 16) next(); pdf.text(rows, margin, y); y += rows.length * (size * 0.48) + 4; };
  pdf.setFillColor(8, 51, 68); pdf.roundedRect(margin, y, width - margin * 2, 34, 4, 4, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(165, 243, 252); pdf.text('MERCHANT EDUCATIONAL CAMPAIGN · RAPPORT BA', margin + 6, y + 9); pdf.setFontSize(19); pdf.setTextColor(255, 255, 255); pdf.text(input.ba.name, margin + 6, y + 19); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(209, 250, 229); pdf.text(dateLabel(date), margin + 6, y + 27); y += 43;
  const total = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  [[`${visits.length}`, 'POS VISITÉS', [8, 145, 178]], [`${transactions.length}`, 'TRANSACTIONS', [180, 83, 9]], [number(total), 'MONTANT CUMULÉ', [5, 150, 105]]].forEach(([value, label, color], index) => { const x = margin + index * 60; pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.roundedRect(x, y, 54, 22, 3, 3, 'FD'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...(color as [number, number, number])); pdf.text(String(value), x + 4, y + 10); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105); pdf.text(String(label), x + 4, y + 17); }); y += 31;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(8, 51, 68); pdf.text('COMMENTAIRE DE CLÔTURE', margin, y); y += 6; lines(input.attendance.closing_comment || 'Aucun commentaire renseigné.');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(8, 51, 68); pdf.text('DÉTAIL DES TRANSACTIONS', margin, y); y += 6;
  transactions.forEach((item) => { lines(`${new Date(item.occurred_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${item.point_of_sale?.denomination || item.pos_id} · Client ${item.client_number || '—'} · Réf. ${item.transaction_reference || '—'} · ${number(Number(item.amount || 0))}`, 8.5); });
  if (!transactions.length) lines('Aucune transaction enregistrée.', 8.5, [100, 116, 139]);
  pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.text('BTL Vodacom Privilege Tracker', margin, height - 9); pdf.save(`rapport-ba-merchant-${date}-${stamp()}.pdf`);
}

export async function exportMerchantAgentReportExcel(input: MerchantAgentReportInput): Promise<void> {
  const book = await workbook();
  const date = input.attendance.activity_date;
  const visits = input.visits.filter((item) => item.activity_date === date);
  const transactions = input.transactions.filter((item) => item.occurred_at.slice(0, 10) === date);
  const tx = book.addWorksheet('Transactions');
  tx.addRow(['Heure', 'POS', 'Short-code', 'Client', 'Référence', 'Montant', 'MFS', 'Commentaire']);
  transactions.forEach((item) => tx.addRow([item.occurred_at, item.point_of_sale?.denomination || item.pos_id, item.point_of_sale?.agent_number || '', item.client_number || '', item.transaction_reference || '', Number(item.amount || 0), input.attendance.mfs_name || '', item.comment || '']));
  header(tx.getRow(1)); sheetStyle(tx, [20, 30, 17, 18, 22, 16, 24, 36]);
  const pos = book.addWorksheet('POS visités');
  pos.addRow(['Heure arrivée', 'POS', 'Short-code', 'Statut opérationnel', 'Constat inactivité', 'Transactions']);
  visits.forEach((item) => { const row = pos.rowCount + 1; pos.addRow([item.visited_at || '', item.point_of_sale?.denomination || item.pos_id, item.point_of_sale?.agent_number || '', item.operational_status || 'active', item.operational_note || '', { formula: `COUNTIF(Transactions!B$2:B$${Math.max(2, tx.rowCount)},B${row})` }]); });
  header(pos.getRow(1)); sheetStyle(pos, [21, 30, 17, 22, 42, 15]);
  addSummary(book, 'Rapport journalier — Merchant', `${input.ba.name} · ${dateLabel(date)} · MFS ${input.attendance.mfs_name || 'Non renseigné'}`, 'Transactions / POS visités', [
    ['POS visités', `COUNTA('POS visités'!A2:A${Math.max(2, pos.rowCount)})`],
    ['Transactions', `COUNTA(Transactions!A2:A${Math.max(2, tx.rowCount)})`],
    ['Montant total', `SUM(Transactions!F2:F${Math.max(2, tx.rowCount)})`, '#,##0.00'],
    ['POS complétés', `COUNTIF('POS visités'!F2:F${Math.max(2, pos.rowCount)},">="&${Number(input.run?.transactions_per_pos_target || 3)})`],
  ]);
  const notes = book.addWorksheet('Clôture');
  notes.addRow(['Champ', 'Valeur']); notes.addRows([['Commentaire BA', input.attendance.closing_comment || ''], ['Pointage arrivée', input.attendance.checkin_at || ''], ['Pointage clôture', input.attendance.checkout_at || '']]); header(notes.getRow(1)); sheetStyle(notes, [28, 88]);
  await download(await book.xlsx.writeBuffer(), `rapport-ba-merchant-${date}-${stamp()}.xlsx`);
}

export async function exportMerchantSupervisorReportExcel(report: MerchantSupervisorReport, comment: string): Promise<void> {
  const book = await workbook();
  const ba = book.addWorksheet('Performance BA');
  ba.addRow(['BA', 'Téléphone', 'POS', 'Transactions', 'Montant', 'Premier signal']);
  report.byBa.forEach((item) => ba.addRow([item.name, item.phone, item.pos, item.transactions, item.amount, item.firstArrival || '']));
  header(ba.getRow(1)); sheetStyle(ba, [30, 18, 14, 18, 18, 22]);
  const daily = book.addWorksheet('Activité journalière');
  daily.addRow(['Date', 'POS', 'Transactions', 'BA actifs']);
  report.daily.forEach((item) => daily.addRow([item.date, item.pos, item.transactions, item.activeBas]));
  header(daily.getRow(1)); sheetStyle(daily, [18, 14, 18, 16]);
  if (report.agentReports.length) {
    const reports = book.addWorksheet('Rapports BA');
    reports.addRow(['Date', 'BA', 'Téléphone', 'MFS', 'Arrivée', 'Clôture', 'POS', 'Transactions', 'Montant', 'Commentaire BA']);
    report.agentReports.forEach((item) => reports.addRow([item.date, item.name, item.phone, item.mfsName, item.checkinAt || '', item.checkoutAt || '', item.pos, item.transactions, item.amount, item.comment]));
    header(reports.getRow(1)); sheetStyle(reports, [16, 28, 18, 24, 20, 20, 12, 16, 16, 58]);
  }
  const baLast = Math.max(2, ba.rowCount); const dailyLast = Math.max(2, daily.rowCount);
  addSummary(book, `Rapport ${report.kind} — Merchant`, `Du ${dateLabel(report.startsOn)} au ${dateLabel(report.endsOn)}`, 'Performance BA / Activité journalière', [
    ['POS visités', `SUM('Performance BA'!C2:C${baLast})`],
    ['Transactions', `SUM('Performance BA'!D2:D${baLast})`],
    ['Montant cumulé', `SUM('Performance BA'!E2:E${baLast})`, '#,##0.00'],
    ['BA actifs', `MAX('Activité journalière'!D2:D${dailyLast})`],
    ['Exécution POS', `IFERROR(SUM('Performance BA'!C2:C${baLast})/(MAX('Activité journalière'!D2:D${dailyLast})*${report.targets.daily_pos_target}*COUNT('Activité journalière'!A2:A${dailyLast})),0)`, '0.0%'],
  ]);
  const narrative = book.addWorksheet('Commentaire superviseur');
  narrative.addRow(['Type', 'Contenu']); narrative.addRow(['Commentaire validé', comment]); header(narrative.getRow(1)); sheetStyle(narrative, [25, 100]);
  await download(await book.xlsx.writeBuffer(), `rapport-${report.kind}-merchant-${report.startsOn}-${report.endsOn}.xlsx`);
}
