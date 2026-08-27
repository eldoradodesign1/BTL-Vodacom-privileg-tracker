import type { MerchantTransactionWithBa } from './merchantCampaign';

export type MerchantTransactionReportRecord = MerchantTransactionWithBa;

export interface MerchantTransactionsReportInput {
  records: MerchantTransactionReportRecord[];
  startsOn: string;
  endsOn: string;
  generatedBy?: string;
}

const money = (value: number) => `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const compactDate = (value: string) => new Date(value).toLocaleDateString('fr-FR');
const compactTime = (value: string) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const safe = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
const statusLabel = (status: MerchantTransactionReportRecord['status']) => status === 'verified' ? 'Vérifiée' : status === 'rejected' ? 'Rejetée' : 'Enregistrée';

export const buildMerchantTransactionsReportHtml = ({ records, startsOn, endsOn, generatedBy }: MerchantTransactionsReportInput): string => {
  const totalAmount = records.reduce((total, record) => total + Number(record.amount || 0), 0);
  const uniqueBas = new Set(records.map((record) => record.ba_id)).size;
  const uniquePos = new Set(records.map((record) => record.pos_id)).size;
  const verified = records.filter((record) => record.status === 'verified').length;
  const byBa = Array.from(records.reduce((map, record) => {
    const name = record.ba?.name || 'BA non renseigné';
    const current = map.get(name) || { name, count: 0, amount: 0 };
    current.count += 1; current.amount += Number(record.amount || 0); map.set(name, current); return map;
  }, new Map<string, { name: string; count: number; amount: number }>()).values()).sort((a, b) => b.count - a.count).slice(0, 8);
  return `<main style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:28px;max-width:1120px;margin:auto"><section style="border-radius:22px;padding:26px;background:linear-gradient(135deg,#092c32,#0d424b);color:#fff"><p style="margin:0;color:#a7f3d0;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Merchant Educational Campaign</p><h1 style="margin:9px 0 4px;font-size:27px">Registre des transactions</h1><p style="margin:0;color:#d1fae5;font-size:13px">Période · ${safe(dateLabel(startsOn))} au ${safe(dateLabel(endsOn))}${generatedBy ? ` · Généré par ${safe(generatedBy)}` : ''}</p></section><section style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0">${[['Transactions', records.length], ['Montant total', money(totalAmount)], ['BA actifs', uniqueBas], ['POS concernés', uniquePos]].map(([label, value]) => `<div style="background:#fff;border:1px solid #cbd5e1;border-radius:16px;padding:14px"><span style="display:block;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">${label}</span><b style="display:block;margin-top:7px;font-size:21px">${safe(value)}</b></div>`).join('')}</section><section style="background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:18px"><h2 style="font-size:15px;margin:0 0 12px">Synthèse opérationnelle</h2><p style="margin:0 0 15px;color:#334155;font-size:13px">${records.length} transaction${records.length > 1 ? 's' : ''} recensée${records.length > 1 ? 's' : ''}, dont ${verified} vérifiée${verified > 1 ? 's' : ''}. La moyenne est de ${safe(money(records.length ? totalAmount / records.length : 0))} par transaction.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${byBa.map((item) => `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px"><b style="font-size:12px">${safe(item.name)}</b><span style="float:right;color:#047857;font-weight:800;font-size:12px">${item.count} Tx</span><p style="margin:5px 0 0;color:#475569;font-size:11px">${safe(money(item.amount))}</p></div>`).join('') || '<p style="color:#64748b;font-size:12px">Aucune transaction sur cette période.</p>'}</div></section><section style="margin-top:18px;background:#fff;border:1px solid #cbd5e1;border-radius:18px;overflow:hidden"><div style="padding:16px 18px;border-bottom:1px solid #e2e8f0"><h2 style="margin:0;font-size:15px">Transactions affichées</h2></div><table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr style="background:#064e3b;color:white;text-align:left"><th style="padding:10px">Date</th><th style="padding:10px">BA</th><th style="padding:10px">POS</th><th style="padding:10px">MFS</th><th style="padding:10px">Client</th><th style="padding:10px">Montant</th><th style="padding:10px">Statut</th></tr></thead><tbody>${records.map((record, index) => `<tr style="background:${index % 2 ? '#f8fafc' : '#fff'}"><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(compactDate(record.occurred_at))}<br/><span style="color:#64748b">${safe(compactTime(record.occurred_at))}</span></td><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(record.ba?.name)}</td><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(record.point_of_sale?.agent_number)}<br/><span style="color:#64748b">${safe(record.point_of_sale?.denomination)}</span></td><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(record.point_of_sale?.mfs_name)}</td><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(record.client_number)}</td><td style="padding:10px;border-top:1px solid #e2e8f0;font-weight:800">${safe(money(record.amount))}</td><td style="padding:10px;border-top:1px solid #e2e8f0">${safe(statusLabel(record.status))}</td></tr>`).join('') || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#64748b">Aucune transaction ne correspond aux filtres.</td></tr>'}</tbody></table></section></main>`;
};

export const exportMerchantTransactionsPdf = async (input: MerchantTransactionsReportInput): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalAmount = input.records.reduce((total, record) => total + Number(record.amount || 0), 0);
  document.setFillColor(6, 78, 59); document.rect(0, 0, 297, 34, 'F');
  document.setTextColor(255, 255, 255); document.setFontSize(18); document.text('Registre des transactions Merchant', 14, 16);
  document.setFontSize(9); document.text(`Période : ${dateLabel(input.startsOn)} au ${dateLabel(input.endsOn)} · ${input.records.length} transaction(s) · ${money(totalAmount)}`, 14, 24);
  let y = 44; document.setTextColor(15, 23, 42); document.setFontSize(9);
  const headers = ['Date', 'BA', 'POS', 'MFS', 'Client', 'Référence', 'Montant', 'Statut'];
  const widths = [25, 35, 50, 34, 31, 35, 25, 24];
  const rowHeight = 8;
  const header = () => { document.setFillColor(6, 78, 59); document.rect(12, y - 6, 273, 7, 'F'); document.setTextColor(255, 255, 255); let x = 14; headers.forEach((item, index) => { document.text(item, x, y - 1); x += widths[index]; }); document.setTextColor(15, 23, 42); y += 4; };
  header();
  input.records.forEach((record, index) => {
    if (y + rowHeight > 197) { document.addPage(); y = 18; header(); }
    if (index % 2) { document.setFillColor(248, 250, 252); document.rect(12, y - 5, 273, rowHeight, 'F'); }
    const cells = [compactDate(record.occurred_at), record.ba?.name || '—', `${record.point_of_sale?.agent_number || '—'} ${record.point_of_sale?.denomination || ''}`, record.point_of_sale?.mfs_name || '—', record.client_number || '—', record.transaction_reference || '—', money(record.amount), statusLabel(record.status)];
    let x = 14; cells.forEach((value, cellIndex) => { document.text(document.splitTextToSize(String(value), widths[cellIndex] - 2).slice(0, 2), x, y); x += widths[cellIndex]; }); y += rowHeight;
  });
  document.save(`transactions-merchant-${input.startsOn}-${input.endsOn}.pdf`);
};

export const exportMerchantTransactionsXlsx = async (input: MerchantTransactionsReportInput): Promise<void> => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BTL Vodacom Privilege Tracker';
  const records = input.records;
  const sourceLast = Math.max(2, records.length + 1);
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
  const styleSheet = (sheet: any, widths: number[]) => {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + widths.length) + Math.max(1, sheet.rowCount) };
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    const header = sheet.getRow(1); header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle' }; });
    for (let row = 2; row <= sheet.rowCount; row += 1) if (row % 2 === 0) sheet.getRow(row).eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDFA' } }; });
  };
  const summary = workbook.addWorksheet('Synthèse');
  summary.addRow(['RAPPORT ANALYTIQUE · TRANSACTIONS MERCHANT']); summary.mergeCells('A1:D1');
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } }; summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  summary.addRows([['Période', `${input.startsOn} au ${input.endsOn}`], ['Généré le', new Date().toLocaleString('fr-FR')], [], ['Indicateur', 'Valeur', 'Source'], ['Transactions', { formula: `COUNTA(Transactions!$A$2:$A$${sourceLast})` }, 'Registre Transactions'], ['Montant total', { formula: `SUM(Transactions!$K$2:$K$${sourceLast})` }, 'Registre Transactions'], ['Montant moyen', { formula: `IFERROR(SUM(Transactions!$K$2:$K$${sourceLast})/COUNTA(Transactions!$A$2:$A$${sourceLast}),0)` }, 'Registre Transactions'], ['Transactions vérifiées', { formula: `COUNTIF(Transactions!$L$2:$L$${sourceLast},"verified")` }, 'Registre Transactions'], ['Transactions rejetées', { formula: `COUNTIF(Transactions!$L$2:$L$${sourceLast},"rejected")` }, 'Registre Transactions'], ['BA concernés', { formula: `COUNTA(Agents!$A$2:$A$${Math.max(2, unique(records.map((record) => record.ba?.name || '')).length + 1)})` }, 'Performance BA'], ['POS concernés', { formula: `COUNTA(POS!$A$2:$A$${Math.max(2, unique(records.map((record) => record.pos_id)).length + 1)})` }, 'Performance POS'], ['MFS concernés', { formula: `COUNTA(MFS!$A$2:$A$${Math.max(2, unique(records.map((record) => record.point_of_sale?.mfs_name || '')).length + 1)})` }, 'Performance MFS']]);
  summary.getRow(5).eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
  summary.getColumn(1).width = 28; summary.getColumn(2).width = 24; summary.getColumn(3).width = 28;
  summary.getColumn(2).eachCell((cell, row) => { if (row >= 6) cell.numFmt = row === 6 || row === 7 ? '#,##0.00 [$-fr-FR]" $"' : '0'; });
  const transactions = workbook.addWorksheet('Transactions');
  transactions.addRow(['Date', 'Heure', 'BA', 'Téléphone BA', 'Pool', 'MFS', 'Short-code POS', 'POS', 'Client', 'Référence', 'Montant', 'Statut', 'Commentaire', 'Latitude', 'Longitude']);
  records.forEach((record) => transactions.addRow([record.occurred_at.slice(0, 10), compactTime(record.occurred_at), record.ba?.name || '', record.ba?.phone || '', record.point_of_sale?.pool || '', record.point_of_sale?.mfs_name || '', record.point_of_sale?.agent_number || '', record.point_of_sale?.denomination || '', record.client_number || '', record.transaction_reference || '', Number(record.amount || 0), record.status, record.comment || '', record.latitude ?? '', record.longitude ?? '']));
  styleSheet(transactions, [13, 10, 25, 18, 14, 22, 16, 30, 17, 20, 16, 14, 42, 14, 14]); transactions.getColumn(11).numFmt = '#,##0.00 [$-fr-FR]" $"';
  const addPerformance = (name: string, dimension: string, sourceColumn: string, labels: string[]) => {
    const sheet = workbook.addWorksheet(name); sheet.addRow(labels);
    unique(records.map((record) => dimension === 'ba' ? record.ba?.name || '' : dimension === 'pos' ? record.point_of_sale?.agent_number || '' : dimension === 'mfs' ? record.point_of_sale?.mfs_name || '' : record.occurred_at.slice(0, 10))).forEach((key, index) => {
      const row = index + 2; const criteriaColumn = sourceColumn;
      sheet.addRow([key, { formula: `COUNTIF(Transactions!$${criteriaColumn}$2:$${criteriaColumn}$${sourceLast},A${row})` }, { formula: `SUMIF(Transactions!$${criteriaColumn}$2:$${criteriaColumn}$${sourceLast},A${row},Transactions!$K$2:$K$${sourceLast})` }, { formula: `COUNTIFS(Transactions!$${criteriaColumn}$2:$${criteriaColumn}$${sourceLast},A${row},Transactions!$L$2:$L$${sourceLast},"verified")` }, { formula: `IFERROR(C${row}/B${row},0)` }]);
    });
    styleSheet(sheet, [dimension === 'pos' ? 18 : 28, 18, 20, 18, 20]); sheet.getColumn(3).numFmt = '#,##0.00 [$-fr-FR]" $"'; sheet.getColumn(5).numFmt = '#,##0.00 [$-fr-FR]" $"';
  };
  addPerformance('POS', 'pos', 'G', ['Short-code POS', 'Transactions', 'Montant', 'Vérifiées', 'Moyenne / Tx']);
  addPerformance('Agents', 'ba', 'C', ['Brand Ambassador', 'Transactions', 'Montant', 'Vérifiées', 'Moyenne / Tx']);
  addPerformance('MFS', 'mfs', 'F', ['MFS', 'Transactions', 'Montant', 'Vérifiées', 'Moyenne / Tx']);
  const daily = workbook.addWorksheet('BDD');
  daily.addRow(['Date', 'Transactions', 'Montant', 'BA actifs', 'POS concernés']);
  unique(records.map((record) => record.occurred_at.slice(0, 10))).forEach((date, index) => { const row = index + 2; daily.addRow([date, { formula: `COUNTIF(Transactions!$A$2:$A$${sourceLast},A${row})` }, { formula: `SUMIF(Transactions!$A$2:$A$${sourceLast},A${row},Transactions!$K$2:$K$${sourceLast})` }, { formula: `SUMPRODUCT((Transactions!$A$2:$A$${sourceLast}=A${row})/COUNTIFS(Transactions!$A$2:$A$${sourceLast},A${row},Transactions!$C$2:$C$${sourceLast},Transactions!$C$2:$C$${sourceLast}))` }, { formula: `SUMPRODUCT((Transactions!$A$2:$A$${sourceLast}=A${row})/COUNTIFS(Transactions!$A$2:$A$${sourceLast},A${row},Transactions!$G$2:$G$${sourceLast},Transactions!$G$2:$G$${sourceLast}))` }]); });
  styleSheet(daily, [15, 18, 20, 16, 18]); daily.getColumn(3).numFmt = '#,##0.00 [$-fr-FR]" $"';
  const content = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `analyse-transactions-merchant-${input.startsOn}-${input.endsOn}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
