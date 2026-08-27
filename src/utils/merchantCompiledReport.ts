import type { MerchantArchiveSummary } from './merchantCampaign';

export interface MerchantCompiledReport {
  startDate: string;
  endDate: string;
  archives: MerchantArchiveSummary[];
  comment: string;
  totals: { reports: number; pos: number; transactions: number; amount: number };
  byBa: Array<{ name: string; phone: string; mfs: string; reports: number; pos: number; transactions: number; amount: number }>;
  byDay: Array<{ date: string; reports: number; pos: number; transactions: number; amount: number }>;
  agentComments: string[];
}

const money = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`;
const columnLetter = (index: number) => String.fromCharCode(64 + index);

export function buildMerchantCompiledReport(archives: MerchantArchiveSummary[], startDate: string, endDate: string, comment: string): MerchantCompiledReport {
  const sorted = [...archives].sort((a, b) => `${a.attendance.activity_date}${a.ba.name}`.localeCompare(`${b.attendance.activity_date}${b.ba.name}`, 'fr'));
  const totals = sorted.reduce((current, item) => ({ reports: current.reports + 1, pos: current.pos + Number(item.visitedPosCount || 0), transactions: current.transactions + Number(item.transactionCount || 0), amount: current.amount + Number(item.totalAmount || 0) }), { reports: 0, pos: 0, transactions: 0, amount: 0 });
  const baMap = new Map<string, { name: string; phone: string; mfs: Set<string>; reports: number; pos: number; transactions: number; amount: number }>();
  const dayMap = new Map<string, { reports: number; pos: number; transactions: number; amount: number }>();
  sorted.forEach((item) => {
    const key = item.ba.id || item.ba.name;
    const person = baMap.get(key) || { name: item.ba.name, phone: item.ba.phone || '', mfs: new Set<string>(), reports: 0, pos: 0, transactions: 0, amount: 0 };
    person.reports += 1; person.pos += Number(item.visitedPosCount || 0); person.transactions += Number(item.transactionCount || 0); person.amount += Number(item.totalAmount || 0);
    if (item.attendance.mfs_name) person.mfs.add(item.attendance.mfs_name);
    baMap.set(key, person);
    const day = dayMap.get(item.attendance.activity_date) || { reports: 0, pos: 0, transactions: 0, amount: 0 };
    day.reports += 1; day.pos += Number(item.visitedPosCount || 0); day.transactions += Number(item.transactionCount || 0); day.amount += Number(item.totalAmount || 0);
    dayMap.set(item.attendance.activity_date, day);
  });
  return {
    startDate, endDate, archives: sorted, comment: comment.trim(), totals,
    byBa: [...baMap.values()].map((person) => ({ ...person, mfs: [...person.mfs].join(' · ') || 'Non renseigné' })).sort((a, b) => b.transactions - a.transactions || a.name.localeCompare(b.name, 'fr')),
    byDay: [...dayMap.entries()].map(([date, values]) => ({ date, ...values })).sort((a, b) => a.date.localeCompare(b.date)),
    agentComments: sorted.map((item) => item.attendance.closing_comment?.trim()).filter((item): item is string => Boolean(item)),
  };
}

export function defaultMerchantSupervisorComment(report: MerchantCompiledReport): string {
  const activeBa = report.byBa.length;
  const strongest = report.byBa[0];
  const leader = strongest ? ` ${strongest.name} présente le meilleur volume avec ${strongest.transactions} transaction${strongest.transactions > 1 ? 's' : ''}.` : '';
  return `Sur la période du ${report.startDate} au ${report.endDate}, ${report.totals.reports} rapport${report.totals.reports > 1 ? 's ont été' : ' a été'} clôturé${report.totals.reports > 1 ? 's' : ''} par ${activeBa} BA, pour ${report.totals.pos} POS visités et ${report.totals.transactions} transactions.${leader}`;
}

export function merchantCompiledReportHtml(report: MerchantCompiledReport): string {
  const rows = report.byBa.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.reports}</td><td>${item.pos}</td><td>${item.transactions}</td><td>${money(item.amount)}</td></tr>`).join('');
  return `<article style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:28px;line-height:1.45"><div style="border-bottom:3px solid #0f766e;padding-bottom:14px"><p style="margin:0;color:#0f766e;font-size:11px;font-weight:700;letter-spacing:1px">MERCHANT EDUCATIONAL CAMPAIGN</p><h1 style="margin:6px 0;font-size:26px">Rapport compilé</h1><p style="margin:0;color:#475569">Période : ${report.startDate} au ${report.endDate}</p></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin:20px 0">${[['Rapports', report.totals.reports], ['BA', report.byBa.length], ['POS', report.totals.pos], ['Transactions', report.totals.transactions], ['Montant', money(report.totals.amount)]].map(([label, value]) => `<div style="min-width:108px;border:1px solid #cbd5e1;border-radius:10px;padding:10px"><div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">${label}</div><strong style="font-size:18px">${value}</strong></div>`).join('')}</div><section style="background:#ecfdf5;border-left:4px solid #0f766e;border-radius:8px;padding:14px"><p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase">Commentaire superviseur</p><p style="margin:0">${escapeHtml(report.comment)}</p></section><h2 style="font-size:16px;margin:24px 0 8px">Performance BA</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#083344;color:#fff"><th style="text-align:left;padding:8px">BA</th><th style="padding:8px">Rapports</th><th style="padding:8px">POS</th><th style="padding:8px">Transactions</th><th style="padding:8px">Montant</th></tr></thead><tbody>${rows}</tbody></table></article>`;
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }

function download(data: ArrayBuffer, filename: string, type: string): void {
  const anchor = document.createElement('a'); const url = URL.createObjectURL(new Blob([data], { type }));
  anchor.href = url; anchor.download = filename; anchor.hidden = true; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 600);
}

function styleTable(sheet: any, widths: number[]): void {
  const end = columnLetter(widths.length); sheet.autoFilter = { from: 'A1', to: `${end}1` }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.getRow(1).height = 24; sheet.getRow(1).eachCell((cell: any) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } }; cell.alignment = { vertical: 'middle' }; });
  for (let row = 2; row <= sheet.rowCount; row += 1) { const current = sheet.getRow(row); current.alignment = { vertical: 'top', wrapText: true }; if (row % 2 === 0) current.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; }); }
}

export async function exportMerchantCompiledExcel(report: MerchantCompiledReport): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'BTL Vodacom Privilege Tracker'; workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet('Synthèse');
  const performance = workbook.addWorksheet('Performance BA');
  const daily = workbook.addWorksheet('Activité journalière');
  const reports = workbook.addWorksheet('Rapports BA');
  const comment = workbook.addWorksheet('Commentaire superviseur');

  reports.addRow(['Date', 'BA', 'Téléphone', 'MFS', 'POS visités', 'Transactions', 'Montant', 'Commentaire BA']);
  report.archives.forEach((item) => reports.addRow([item.attendance.activity_date, item.ba.name, item.ba.phone || '', item.attendance.mfs_name || '', Number(item.visitedPosCount || 0), Number(item.transactionCount || 0), Number(item.totalAmount || 0), item.attendance.closing_comment || '']));
  styleTable(reports, [15, 28, 18, 24, 15, 16, 15, 54]); reports.getColumn(7).numFmt = '#,##0.00';
  const reportEnd = Math.max(2, reports.rowCount);

  performance.addRow(['BA', 'Téléphone', 'MFS', 'Rapports', 'POS', 'Transactions', 'Montant']);
  report.byBa.forEach((item, index) => { const row = index + 2; performance.addRow([item.name, item.phone, item.mfs, { formula: `COUNTIF('Rapports BA'!B$2:B$${reportEnd},A${row})` }, { formula: `SUMIF('Rapports BA'!B$2:B$${reportEnd},A${row},'Rapports BA'!E$2:E$${reportEnd})` }, { formula: `SUMIF('Rapports BA'!B$2:B$${reportEnd},A${row},'Rapports BA'!F$2:F$${reportEnd})` }, { formula: `SUMIF('Rapports BA'!B$2:B$${reportEnd},A${row},'Rapports BA'!G$2:G$${reportEnd})` }]); });
  styleTable(performance, [30, 18, 28, 13, 13, 16, 16]); performance.getColumn(7).numFmt = '#,##0.00';
  const performanceEnd = Math.max(2, performance.rowCount);

  daily.addRow(['Date', 'Rapports', 'POS', 'Transactions', 'Montant']);
  report.byDay.forEach((item, index) => { const row = index + 2; daily.addRow([item.date, { formula: `COUNTIF('Rapports BA'!A$2:A$${reportEnd},A${row})` }, { formula: `SUMIF('Rapports BA'!A$2:A$${reportEnd},A${row},'Rapports BA'!E$2:E$${reportEnd})` }, { formula: `SUMIF('Rapports BA'!A$2:A$${reportEnd},A${row},'Rapports BA'!F$2:F$${reportEnd})` }, { formula: `SUMIF('Rapports BA'!A$2:A$${reportEnd},A${row},'Rapports BA'!G$2:G$${reportEnd})` }]); });
  styleTable(daily, [16, 14, 14, 17, 18]); daily.getColumn(5).numFmt = '#,##0.00';
  const dailyEnd = Math.max(2, daily.rowCount);

  summary.mergeCells('A1:C1'); summary.getCell('A1').value = 'RAPPORT COMPILÉ · MERCHANT'; summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 }; summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } }; summary.getCell('A1').alignment = { horizontal: 'center' }; summary.getRow(1).height = 30;
  summary.mergeCells('A2:C2'); summary.getCell('A2').value = `Période : ${report.startDate} au ${report.endDate}. Chaque valeur est calculée par formule à partir des feuilles sources.`; summary.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  summary.addRow([]); summary.addRow(['Indicateur', 'Valeur calculée', 'Source']);
  [['Rapports clôturés', `COUNTA('Rapports BA'!A2:A${reportEnd})`, 'Rapports BA', '0'], ['BA concernés', `COUNTA('Performance BA'!A2:A${performanceEnd})`, 'Performance BA', '0'], ['Jours actifs', `COUNTA('Activité journalière'!A2:A${dailyEnd})`, 'Activité journalière', '0'], ['POS visités', `SUM('Rapports BA'!E2:E${reportEnd})`, 'Rapports BA', '0'], ['Transactions', `SUM('Rapports BA'!F2:F${reportEnd})`, 'Rapports BA', '0'], ['Montant cumulé', `SUM('Rapports BA'!G2:G${reportEnd})`, 'Rapports BA', '#,##0.00'], ['Moyenne transactions / rapport', `IFERROR(SUM('Rapports BA'!F2:F${reportEnd})/COUNTA('Rapports BA'!A2:A${reportEnd}),0)`, 'Rapports BA', '0.00']].forEach(([label, formula, source, numberFormat]) => { const row = summary.addRow([label, { formula }, source]); row.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' } }; row.getCell(2).font = { bold: true, color: { argb: 'FF0F766E' }, size: 12 }; row.getCell(2).numFmt = numberFormat; });
  styleTable(summary, [34, 26, 26]); summary.views = [{ showGridLines: false }];

  comment.mergeCells('A1:D1'); comment.getCell('A1').value = 'COMMENTAIRE SUPERVISEUR'; comment.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 }; comment.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } }; comment.getCell('A1').alignment = { horizontal: 'center' }; comment.getRow(1).height = 30;
  comment.mergeCells('A3:D6'); comment.getCell('A3').value = report.comment; comment.getCell('A3').alignment = { vertical: 'top', wrapText: true }; comment.getCell('A3').font = { size: 12, color: { argb: 'FF0F172A' } }; comment.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } }; comment.getColumn(1).width = 32; comment.getColumn(2).width = 28; comment.getColumn(3).width = 28; comment.getColumn(4).width = 28;
  comment.getRow(3).height = 28; comment.getRow(4).height = 28; comment.getRow(5).height = 28; comment.getRow(6).height = 28;
  comment.addRow([]); comment.addRow(['Commentaires BA source']); comment.getRow(8).font = { bold: true, color: { argb: 'FF0F766E' } }; report.agentComments.forEach((value) => comment.addRow([value]));

  download(await workbook.xlsx.writeBuffer(), `rapport-compile-merchant-${report.startDate}-${report.endDate}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportMerchantCompiledPdf(report: MerchantCompiledReport): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  pdf.setFillColor(8, 51, 68); pdf.rect(0, 0, 210, 34, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(15); pdf.text('RAPPORT COMPILÉ · MERCHANT', 14, 16); pdf.setFontSize(9); pdf.text(`Période : ${report.startDate} au ${report.endDate}`, 14, 24);
  pdf.setTextColor(15, 23, 42); y = 45; pdf.setFontSize(11); pdf.text('Indicateurs clés', 14, y); y += 8;
  const cards = [['Rapports', String(report.totals.reports)], ['BA', String(report.byBa.length)], ['POS', String(report.totals.pos)], ['Transactions', String(report.totals.transactions)], ['Montant', money(report.totals.amount)]];
  cards.forEach(([label, value], index) => { const x = 14 + (index % 2) * 94; const row = Math.floor(index / 2); const cardY = y + row * 16; pdf.setDrawColor(203, 213, 225); pdf.roundedRect(x, cardY, 86, 12, 2, 2, 'S'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.text(label, x + 4, cardY + 4); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.text(value, x + 4, cardY + 9); });
  y += 52; pdf.setFillColor(240, 253, 250); pdf.roundedRect(14, y, 182, 28, 2, 2, 'F'); pdf.setFontSize(9); pdf.setTextColor(15, 118, 110); pdf.text('COMMENTAIRE SUPERVISEUR', 18, y + 6); pdf.setFontSize(9); pdf.setTextColor(15, 23, 42); const commentLines = pdf.splitTextToSize(report.comment || 'Aucun commentaire renseigné.', 172); pdf.text(commentLines, 18, y + 13); y += 38;
  pdf.setFontSize(11); pdf.text('Performance BA', 14, y); y += 7; pdf.setFillColor(8, 51, 68); pdf.rect(14, y, 182, 7, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(8); ['BA', 'Rapports', 'POS', 'Transactions', 'Montant'].forEach((label, index) => pdf.text(label, [16, 92, 116, 136, 166][index], y + 4.8)); y += 11;
  pdf.setTextColor(15, 23, 42); report.byBa.forEach((item) => { if (y > 278) { pdf.addPage(); y = 18; } pdf.setFontSize(8); pdf.text(item.name.slice(0, 34), 16, y); pdf.text(String(item.reports), 96, y); pdf.text(String(item.pos), 120, y); pdf.text(String(item.transactions), 143, y); pdf.text(money(item.amount), 166, y); pdf.setDrawColor(226, 232, 240); pdf.line(14, y + 3, 196, y + 3); y += 7; });
  pdf.save(`rapport-compile-merchant-${report.startDate}-${report.endDate}.pdf`);
}
