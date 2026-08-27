import type { MerchantArchiveSummary } from './merchantCampaign';

function download(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function styleHeader(row: any): void {
  row.height = 24;
  row.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } };
    cell.alignment = { vertical: 'middle' };
  });
}

function styleRows(sheet: any, widths: number[]): void {
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + widths.length)}1` };
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const current = sheet.getRow(row);
    current.alignment = { vertical: 'top', wrapText: true };
    if (row % 2 === 0) current.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  }
}

export async function exportMerchantArchiveCompilation(archives: MerchantArchiveSummary[], startDate: string, endDate: string): Promise<void> {
  // ExcelJS is intentionally imported only after the operator explicitly requests an export.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BTL Vodacom Privilege Tracker';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const source = workbook.addWorksheet('Rapports BA');
  source.addRow(['Date', 'BA', 'Téléphone', 'MFS', 'POS visités', 'Transactions', 'Montant', 'Commentaire BA']);
  archives.forEach((item) => source.addRow([
    item.attendance.activity_date,
    item.ba.name,
    item.ba.phone || '',
    item.attendance.mfs_name || '',
    Number(item.visitedPosCount || 0),
    Number(item.transactionCount || 0),
    Number(item.totalAmount || 0),
    item.attendance.closing_comment || '',
  ]));
  styleHeader(source.getRow(1));
  styleRows(source, [15, 30, 18, 26, 15, 16, 16, 56]);
  source.getColumn(7).numFmt = '#,##0.00';

  const last = Math.max(2, source.rowCount);
  const byBa = workbook.addWorksheet('Performance BA');
  byBa.addRow(['BA', 'Rapports', 'POS visités', 'Transactions', 'Montant']);
  const names = Array.from(new Set(archives.map((item) => item.ba.name))).sort((left, right) => left.localeCompare(right));
  names.forEach((name, index) => {
    const row = index + 2;
    byBa.addRow([
      name,
      { formula: `COUNTIF('Rapports BA'!$B$2:$B$${last},A${row})` },
      { formula: `SUMIF('Rapports BA'!$B$2:$B$${last},A${row},'Rapports BA'!$E$2:$E$${last})` },
      { formula: `SUMIF('Rapports BA'!$B$2:$B$${last},A${row},'Rapports BA'!$F$2:$F$${last})` },
      { formula: `SUMIF('Rapports BA'!$B$2:$B$${last},A${row},'Rapports BA'!$G$2:$G$${last})` },
    ]);
  });
  styleHeader(byBa.getRow(1));
  styleRows(byBa, [30, 14, 16, 16, 18]);
  byBa.getColumn(5).numFmt = '#,##0.00';

  const byMfs = workbook.addWorksheet('Performance MFS');
  byMfs.addRow(['MFS', 'Rapports', 'POS visités', 'Transactions', 'Montant']);
  const mfsNames = Array.from(new Set(archives.map((item) => item.attendance.mfs_name || 'Non renseigné'))).sort((left, right) => left.localeCompare(right));
  mfsNames.forEach((name, index) => {
    const row = index + 2;
    byMfs.addRow([
      name,
      { formula: `COUNTIF('Rapports BA'!$D$2:$D$${last},A${row})` },
      { formula: `SUMIF('Rapports BA'!$D$2:$D$${last},A${row},'Rapports BA'!$E$2:$E$${last})` },
      { formula: `SUMIF('Rapports BA'!$D$2:$D$${last},A${row},'Rapports BA'!$F$2:$F$${last})` },
      { formula: `SUMIF('Rapports BA'!$D$2:$D$${last},A${row},'Rapports BA'!$G$2:$G$${last})` },
    ]);
  });
  styleHeader(byMfs.getRow(1));
  styleRows(byMfs, [30, 14, 16, 16, 18]);
  byMfs.getColumn(5).numFmt = '#,##0.00';

  const summary = workbook.addWorksheet('Synthèse');
  summary.mergeCells('A1:D1');
  summary.getCell('A1').value = 'COMPILATION DES RAPPORTS · MERCHANT';
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF082F49' } };
  summary.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(1).height = 30;
  summary.mergeCells('A2:D2');
  summary.getCell('A2').value = `Période : ${startDate} au ${endDate} · Toutes les cellules de synthèse sont calculées par formules.`;
  summary.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  summary.addRow([]);
  summary.addRow(['Indicateur', 'Valeur', 'Source de calcul', '']);
  const summaryMetrics: Array<[string, string, string]> = [
    ['Rapports clôturés', `COUNTA('Rapports BA'!A2:A${last})`, 'Rapports BA'],
    ['BA concernés', `COUNTA('Performance BA'!A2:A${Math.max(2, byBa.rowCount)})`, 'Performance BA'],
    ['MFS concernés', `COUNTA('Performance MFS'!A2:A${Math.max(2, byMfs.rowCount)})`, 'Performance MFS'],
    ['POS visités', `SUM('Rapports BA'!E2:E${last})`, 'Rapports BA'],
    ['Transactions', `SUM('Rapports BA'!F2:F${last})`, 'Rapports BA'],
    ['Montant cumulé', `SUM('Rapports BA'!G2:G${last})`, 'Rapports BA'],
    ['Moyenne transactions / rapport', `IFERROR(SUM('Rapports BA'!F2:F${last})/COUNTA('Rapports BA'!A2:A${last}),0)`, 'Rapports BA'],
  ];
  summaryMetrics.forEach(([label, formula, sourceLabel]) => summary.addRow([label, { formula }, sourceLabel]));
  styleHeader(summary.getRow(4));
  summary.getColumn(1).width = 32; summary.getColumn(2).width = 24; summary.getColumn(3).width = 26;
  summary.getColumn(2).numFmt = '#,##0.00';
  for (let row = 5; row <= summary.rowCount; row += 1) {
    summary.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF0F172A' } };
    summary.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF0F766E' }, size: 12 };
    summary.getRow(row).height = 24;
  }
  summary.views = [{ showGridLines: false }];
  workbook.worksheets.splice(workbook.worksheets.indexOf(summary), 1);
  workbook.worksheets.unshift(summary);

  await download(await workbook.xlsx.writeBuffer(), `compilation-merchant-${startDate}-${endDate}.xlsx`);
}
