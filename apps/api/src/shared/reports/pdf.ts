/**
 * Generic PDF report builder shared by every module's reports.
 *
 * Produces the layout AGENTS.md asks for: ERP name, tenant, module, title,
 * generation date, user, filters used, a table, totals and page numbers.
 * Built on pdfkit (pure JS, no native binaries — safe on Render); see
 * apps/api/package.json for the dependency evaluation.
 */
import PDFDocument from 'pdfkit';

export interface PdfColumn {
  header: string;
  /** Relative width weight; columns share the page width proportionally. */
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfReportOptions {
  appName: string;
  tenantName: string;
  moduleName: string;
  title: string;
  generatedAt: Date;
  generatedBy: string;
  /** Rendered as "label: value" lines under the title. */
  filters: ReadonlyArray<{ label: string; value: string }>;
  columns: ReadonlyArray<PdfColumn>;
  /** Already-formatted cell text, one array per row, matching `columns` order. */
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /** Rendered as "label: value" lines after the table (e.g. "Total productos: 125"). */
  totals?: ReadonlyArray<{ label: string; value: string }>;
}

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;

function columnWidths(columns: ReadonlyArray<PdfColumn>, availableWidth: number): number[] {
  const totalWeight = columns.reduce((sum, c) => sum + c.width, 0);
  return columns.map((c) => (c.width / totalWeight) * availableWidth);
}

/** Builds the PDF in memory and resolves with its bytes. */
export function buildPdfReport(options: PdfReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const widths = columnWidths(options.columns, pageWidth);

    function drawDocumentHeader(): void {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text(options.appName, { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(options.title.toUpperCase(), { align: 'center' });
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(`Empresa: ${options.tenantName}`);
      doc.text(`Módulo: ${options.moduleName}`);
      doc.text(`Fecha de generación: ${options.generatedAt.toLocaleString('es-MX')}`);
      doc.text(`Generado por: ${options.generatedBy}`);
      if (options.filters.length > 0) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Filtros aplicados:');
        doc.font('Helvetica');
        for (const f of options.filters) doc.text(`• ${f.label}: ${f.value}`);
      }
      doc.moveDown(0.6);
    }

    function drawTableHeader(y: number): number {
      let x = PAGE_MARGIN;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
      doc.rect(PAGE_MARGIN, y, pageWidth, HEADER_HEIGHT).fill('#0F172A');
      doc.fillColor('#FFFFFF');
      options.columns.forEach((col, i) => {
        doc.text(col.header, x + 4, y + 6, { width: widths[i]! - 8, align: col.align ?? 'left' });
        x += widths[i]!;
      });
      return y + HEADER_HEIGHT;
    }

    function ensureSpace(y: number): number {
      const bottom = doc.page.height - PAGE_MARGIN - 30; // room for the footer
      if (y + ROW_HEIGHT <= bottom) return y;
      doc.addPage();
      return drawTableHeader(PAGE_MARGIN);
    }

    drawDocumentHeader();
    let y = drawTableHeader(doc.y);

    options.rows.forEach((row, rowIndex) => {
      y = ensureSpace(y);
      if (rowIndex % 2 === 1) {
        doc.rect(PAGE_MARGIN, y, pageWidth, ROW_HEIGHT).fill('#F1F5F9');
      }
      let x = PAGE_MARGIN;
      doc.font('Helvetica').fontSize(8.5).fillColor('#0F172A');
      row.forEach((cell, i) => {
        doc.text(cell, x + 4, y + 5, { width: widths[i]! - 8, height: ROW_HEIGHT, ellipsis: true, align: options.columns[i]!.align ?? 'left' });
        x += widths[i]!;
      });
      y += ROW_HEIGHT;
    });

    if (options.rows.length === 0) {
      y = ensureSpace(y);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748B').text('No hay datos para los filtros seleccionados.', PAGE_MARGIN, y + 6);
      y += ROW_HEIGHT;
    }

    if (options.totals && options.totals.length > 0) {
      y = ensureSpace(y + 8);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A');
      for (const t of options.totals) {
        y = ensureSpace(y);
        doc.text(`${t.label}: ${t.value}`, PAGE_MARGIN, y + 4);
        y += ROW_HEIGHT;
      }
    }

    // Footer with page numbers, drawn last across every buffered page.
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`Página ${i + 1} de ${pageCount}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN + 5, {
        width: pageWidth,
        align: 'center',
      });
    }

    doc.end();
  });
}
