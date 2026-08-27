import type { MerchantArchiveSummary } from './merchantCampaign';

const columnLetter = (index: number) => String.fromCharCode(64 + index);

function saveWorkbook(data: ArrayBuffer, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function formatTable(sheet: any, widths: number[]): void {
  const lastColumn = columnLetter(widths.length);
  sheet.autoFilter = { from: 'A1', to: `${lastColumn}1` };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const header = sheet.getRow(1);
  header.height = 24;
  header.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } };
    cell.alignment = { vertical: 'middle' };
  });
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const current = sheet.getRow(row);
    current.alignment = { vertical: 'top', wrapText: true };
    if (row % 2 === 0) current.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  }
}

export async function exportMerchantArchiveExcel(
  archives: MerchantArchiveSummary[],
  startDate: string,
  endDate: string,
): Promise<void> {
  // Kept inside the click flow: ExcelJS is never parsed or executed while the PWA starts.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BTL Vodacom Privilege Tracker';
  workbook.calcProperties.fullCalcOnLoad = true;

  const register = workbook.addWorksheet('Rapports BA');
  register.addRow(['Date', 'BA', 'Téléphone', 'MFS', 'POS visités', 'Transactions', 'Montant', 'Commentaire BA']);
  archives.forEach((item) => register.addRow([
    item.attendance.activity_date,
    item.ba.name,
    item.ba.phone || '',
    item.attendance.mfs_name || '',
    Number(item.visitedPosCount || 0),
    Number(item.transactionCount || 0),
    Number(item.totalAmount || 0),
    item.attendance.closing_comment || '',
  ]));
  formatTable(register, [15, 28, 18, 26, 15, 16, 16, 56]);
  register.getColumn(7).numFmt = '#,##0.00';

  const endRow = Math.max(2, register.rowCount);
  const summary = workbook.addWorksheet('Synthèse');
  summary.mergeCells('A1:C1');
  summary.getCell('A1').value = 'COMPILATION DES RAPPORTS · MERCHANT';
  summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083344' } };
  summary.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  summary.getRow(1).height = 30;
  summary.mergeCells('A2:C2');
  summary.getCell('A2').value = `Période : ${startDate} au ${endDate}. Les indicateurs ci-dessous sont calculés par formules depuis « Rapports BA ». `;
  summary.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  summary.addRow([]);
  summary.addRow(['Indicateur', 'Valeur calculée', 'Formule source']);
  const metrics: Array<[string, string, string, string?]> = [
    ['Rapports clôturés', `COUNTA('Rapports BA'!A2:A${endRow})`, 'Rapports BA', '0'],
    ['BA concernés', `SUMPRODUCT(1/COUNTIF('Rapports BA'!B2:B${endRow},'Rapports BA'!B2:B${endRow}))`, 'Rapports BA', '0'],
    ['MFS concernés', `SUMPRODUCT(1/COUNTIF('Rapports BA'!D2:D${endRow},'Rapports BA'!D2:D${endRow}))`, 'Rapports BA', '0'],
    ['POS visités', `SUM('Rapports BA'!E2:E${endRow})`, 'Rapports BA', '0'],
    ['Transactions', `SUM('Rapports BA'!F2:F${endRow})`, 'Rapports BA', '0'],
    ['Montant cumulé', `SUM('Rapports BA'!G2:G${endRow})`, 'Rapports BA', '#,##0.00'],
    ['Moyenne transactions / rapport', `IFERROR(SUM('Rapports BA'!F2:F${endRow})/COUNTA('Rapports BA'!A2:A${endRow}),0)`, 'Rapports BA', '0.00'],
  ];
  metrics.forEach(([label, formula, source, format]) => {
    const row = summary.addRow([label, { formula }, source]);
    row.getCell(2).numFmt = format || '0';
    row.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(2).font = { bold: true, color: { argb: 'FF0F766E' }, size: 12 };
  });
  formatTable(summary, [34, 24, 24]);
  summary.views = [{ showGridLines: false }];

  await saveWorkbook(await workbook.xlsx.writeBuffer(), `compilation-merchant-${startDate}-${endDate}.xlsx`);
}
