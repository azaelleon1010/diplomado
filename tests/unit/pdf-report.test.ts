import { describe, it, expect } from 'vitest';
import { buildPdfReport } from '../../apps/api/src/shared/reports/pdf';

describe('buildPdfReport', () => {
  it('produces a valid PDF buffer with the report content', async () => {
    const pdf = await buildPdfReport({
      appName: 'TramaTech ERP',
      tenantName: 'Acme Textil',
      moduleName: 'Inventario',
      title: 'Reporte de existencias',
      generatedAt: new Date('2026-01-15T12:00:00Z'),
      generatedBy: 'admin',
      filters: [{ label: 'Almacén', value: 'Todos' }],
      columns: [{ header: 'SKU', width: 10 }, { header: 'Producto', width: 20 }],
      rows: [['PROD-001', 'Tornillo'], ['PROD-002', 'Tuerca']],
      totals: [{ label: 'Total de productos', value: '2' }],
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('still produces a valid PDF when there are no rows', async () => {
    const pdf = await buildPdfReport({
      appName: 'TramaTech ERP',
      tenantName: 'Acme Textil',
      moduleName: 'Inventario',
      title: 'Reporte de existencias',
      generatedAt: new Date(),
      generatedBy: 'admin',
      filters: [],
      columns: [{ header: 'SKU', width: 10 }],
      rows: [],
    });

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('paginates and numbers pages when rows overflow a single page', async () => {
    const rows = Array.from({ length: 80 }, (_, i) => [`PROD-${i}`, `Producto ${i}`]);
    const pdf = await buildPdfReport({
      appName: 'TramaTech ERP',
      tenantName: 'Acme Textil',
      moduleName: 'Inventario',
      title: 'Reporte de existencias',
      generatedAt: new Date(),
      generatedBy: 'admin',
      filters: [],
      columns: [{ header: 'SKU', width: 10 }, { header: 'Producto', width: 20 }],
      rows,
    });

    // Every page object contributes its own "/Type /Page" entry to the PDF body.
    const pageObjectCount = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pageObjectCount).toBeGreaterThan(1);
  });
});
