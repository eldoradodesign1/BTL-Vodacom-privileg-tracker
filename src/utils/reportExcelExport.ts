import type { PDFAdminBatchData, PDFReportData, PDFSupervisorData } from './pdfGenerator';

const cleanSheetName = (value: string): string => value.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Données';
const isoStamp = () => new Date().toISOString().slice(0, 10);

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

function themeHeader(row: any): void {
  row.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B47' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF38BDF8' } } };
  });
  row.height = 26;
}

function themeWorksheet(sheet: any, widths: number[]): void {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: widths.length } };
}

function metricSheet(workbook: any, title: string, period: string, metrics: Array<{ label: string; formula: string; numberFormat?: string }>, sourceName: string): any {
  const sheet = workbook.addWorksheet('Synthèse');
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF082F49' } };
  sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 34;
  sheet.mergeCells('A2:D2');
  sheet.getCell('A2').value = period;
  sheet.getCell('A2').font = { color: { argb: 'FF475569' }, italic: true, size: 10 };
  sheet.getCell('A4').value = 'Indicateur';
  sheet.getCell('B4').value = 'Valeur calculée';
  sheet.getCell('C4').value = 'Source';
  sheet.getCell('D4').value = 'Lecture';
  themeHeader(sheet.getRow(4));
  metrics.forEach((metric, index) => {
    const row = 5 + index;
    sheet.getCell(`A${row}`).value = metric.label;
    sheet.getCell(`B${row}`).value = { formula: metric.formula };
    sheet.getCell(`B${row}`).numFmt = metric.numberFormat || '#,##0';
    sheet.getCell(`C${row}`).value = sourceName;
    sheet.getCell(`D${row}`).value = 'Calcul dynamique';
    if (index % 2 === 0) {
      ['A', 'B', 'C', 'D'].forEach((column) => { sheet.getCell(`${column}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
    }
    sheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF0F766E' }, size: 12 };
  });
  sheet.getColumn('A').width = 30;
  sheet.getColumn('B').width = 18;
  sheet.getColumn('C').width = 22;
  sheet.getColumn('D').width = 22;
  sheet.views = [{ showGridLines: false }];
  return sheet;
}

async function createWorkbook(): Promise<any> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BTL Vodacom Privilege Tracker';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function exportAgentReportExcel(report: PDFReportData): Promise<void> {
  const workbook = await createWorkbook();
  const details = workbook.addWorksheet('Activations');
  details.addRow(['Heure', 'Client', 'MSISDN', 'Type d’activation']);
  report.leads.forEach((lead) => details.addRow([lead.timestamp, lead.client_name, lead.msisdn, lead.action_type]));
  themeHeader(details.getRow(1));
  themeWorksheet(details, [20, 28, 20, 32]);
  const last = Math.max(2, details.rowCount);
  metricSheet(workbook, 'Rapport journalier — Vodacom Privilège', `${report.agentName} · ${report.shopName} · ${report.date}`, [
    { label: 'Privilège', formula: `COUNTIF(Activations!D2:D${last},"*Privil*")` },
    { label: 'Roaming', formula: `COUNTIF(Activations!D2:D${last},"*Roam*")` },
    { label: 'Bundles', formula: `COUNTIF(Activations!D2:D${last},"*Bund*")` },
    { label: 'Activations totales', formula: `COUNTA(Activations!A2:A${last})` },
  ], 'Activations');
  const context = workbook.addWorksheet('Contexte');
  context.addRow(['Champ', 'Valeur']);
  context.addRows([
    ['Pointage arrivée', report.arrivalTime], ['Pointage clôture', report.departureTime],
    ['Commentaire', report.comment || ''], ['Carte arrivée', report.mapsIn], ['Carte clôture', report.mapsOut],
  ]);
  themeHeader(context.getRow(1));
  themeWorksheet(context, [26, 80]);
  await download(await workbook.xlsx.writeBuffer(), `rapport-hotesse-${report.date}-${isoStamp()}.xlsx`);
}

export async function exportSupervisorReportExcel(report: PDFSupervisorData): Promise<void> {
  const workbook = await createWorkbook();
  const team = workbook.addWorksheet('Équipe');
  team.addRow(['BA / Hôtesse', 'Point de vente', 'Statut', 'Privilège', 'Roaming', 'Bundles', 'Total activations', 'Arrivée', 'Clôture']);
  report.team.forEach((member) => team.addRow([
    member.name, member.shop, member.status, member.stats.priv, member.stats.roam, member.stats.bund,
    { formula: `SUM(D${team.rowCount + 1}:F${team.rowCount + 1})` }, member.arrivalTime || '', member.departureTime || '',
  ]));
  themeHeader(team.getRow(1));
  themeWorksheet(team, [28, 28, 16, 13, 13, 13, 18, 16, 16]);
  const last = Math.max(2, team.rowCount);
  metricSheet(workbook, 'Rapport de supervision — Vodacom Privilège', `${report.supName} · ${report.date}`, [
    { label: 'Membres suivis', formula: `COUNTA(Équipe!A2:A${last})` },
    { label: 'Privilège', formula: `SUM(Équipe!D2:D${last})` },
    { label: 'Roaming', formula: `SUM(Équipe!E2:E${last})` },
    { label: 'Bundles', formula: `SUM(Équipe!F2:F${last})` },
    { label: 'Activations totales', formula: `SUM(Équipe!G2:G${last})` },
  ], 'Équipe');
  if (report.reports?.length) {
    const reports = workbook.addWorksheet('Rapports agents');
    reports.addRow(['Date', 'Agent', 'Shop', 'Privilège', 'Roaming', 'Bundles', 'Commentaire']);
    report.reports.forEach((item) => reports.addRow([item.date, item.agentName, item.shopName, item.totalPrivilege, item.totalRoaming, item.totalBundles, item.comment || '']));
    themeHeader(reports.getRow(1));
    themeWorksheet(reports, [15, 28, 28, 13, 13, 13, 46]);
  }
  await download(await workbook.xlsx.writeBuffer(), `rapport-supervision-${report.date}-${isoStamp()}.xlsx`);
}

export async function exportAdminBatchReportExcel(report: PDFAdminBatchData): Promise<void> {
  const workbook = await createWorkbook();
  const reports = workbook.addWorksheet('Rapports');
  reports.addRow(['Date', 'Agent', 'Privilège', 'Roaming', 'Bundles', 'Total activations']);
  (report.rows || []).forEach((row) => reports.addRow([row.date, row.agent, row.priv, row.roam, row.bund, { formula: `SUM(C${reports.rowCount + 1}:E${reports.rowCount + 1})` }]));
  themeHeader(reports.getRow(1));
  themeWorksheet(reports, [16, 30, 14, 14, 14, 20]);
  const last = Math.max(2, reports.rowCount);
  metricSheet(workbook, report.title || 'Rapport compilé — Vodacom Privilège', report.period, [
    { label: 'Rapports inclus', formula: `COUNTA(Rapports!A2:A${last})` },
    { label: 'Privilège', formula: `SUM(Rapports!C2:C${last})` },
    { label: 'Roaming', formula: `SUM(Rapports!D2:D${last})` },
    { label: 'Bundles', formula: `SUM(Rapports!E2:E${last})` },
    { label: 'Activations totales', formula: `SUM(Rapports!F2:F${last})` },
  ], 'Rapports');
  if (report.groups?.length) {
    const groups = workbook.addWorksheet('Par superviseur');
    groups.addRow(['Superviseur', 'Agents', 'Activations', 'Privilège', 'Roaming', 'Bundles']);
    report.groups.forEach((group) => groups.addRow([group.supervisor, group.agentCount, group.totalLeads, group.totalPrivilege, group.totalRoaming, group.totalBundles]));
    themeHeader(groups.getRow(1));
    themeWorksheet(groups, [28, 14, 18, 14, 14, 14]);
  }
  await download(await workbook.xlsx.writeBuffer(), `rapport-compile-vodacom-privilege-${isoStamp()}.xlsx`);
}
