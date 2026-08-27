export interface DetailPdfRow {
  label: string;
  value: string | number | null | undefined;
}

export interface DetailPdfSection {
  title: string;
  rows?: DetailPdfRow[];
  text?: string;
}

export interface DetailPdfDocument {
  title: string;
  subtitle?: string;
  filename: string;
  sections: DetailPdfSection[];
}

const safeText = (value: DetailPdfRow['value']) => String(value ?? '—').replace(/\s+/g, ' ').trim() || '—';
const filename = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'detail';

export const exportContextDetailPdf = async (document: DetailPdfDocument) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const drawHeader = () => {
    pdf.setFillColor(8, 29, 42);
    pdf.rect(0, 0, pageWidth, 39, 'F');
    pdf.setFillColor(20, 184, 166);
    pdf.rect(0, 37, pageWidth, 2, 'F');
    pdf.setTextColor(236, 253, 245);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(document.title, margin, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(204, 251, 241);
    const subtitle = document.subtitle || 'BTL Vodacom Privilege Tracker';
    pdf.text(pdf.splitTextToSize(subtitle, contentWidth), margin, 25);
    y = 50;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    pdf.addPage();
    drawHeader();
  };

  drawHeader();
  document.sections.forEach((section) => {
    const estimated = 13 + Math.max(section.rows?.length || 0, section.text ? Math.ceil(section.text.length / 95) : 0) * 9;
    ensureSpace(estimated);
    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(section.title.toUpperCase(), margin + 4, y + 5.3);
    y += 12;

    if (section.rows?.length) {
      section.rows.forEach((row) => {
        const label = safeText(row.label);
        const valueLines = pdf.splitTextToSize(safeText(row.value), contentWidth - 53);
        const rowHeight = Math.max(8, valueLines.length * 4.3 + 3);
        ensureSpace(rowHeight + 1);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(label, margin + 2, y + 5);
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.7);
        pdf.text(valueLines, margin + 50, y + 5);
        y += rowHeight + 1;
      });
    }

    if (section.text) {
      const lines = pdf.splitTextToSize(section.text.replace(/\s+/g, ' ').trim(), contentWidth - 4);
      const height = lines.length * 4.5 + 4;
      ensureSpace(height);
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(lines, margin + 2, y + 4);
      y += height;
    }
    y += 6;
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Exporté le ${new Date().toLocaleString('fr-FR')} · Page ${page}/${pages}`, margin, pageHeight - 6.5);
  }
  pdf.save(`${filename(document.filename)}.pdf`);
};
