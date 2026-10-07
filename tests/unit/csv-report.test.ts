import { describe, it, expect } from 'vitest';
import { buildCsv } from '../../apps/api/src/shared/reports/csv';

interface Row {
  name: string;
  qty: number;
  note?: string;
}

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM so Excel detects accents correctly', () => {
    const csv = buildCsv<Row>([{ name: 'Café', qty: 1 }], [{ header: 'Nombre', value: (r) => r.name }, { header: 'Cantidad', value: (r) => r.qty }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('writes the header row followed by one row per item, CRLF-separated', () => {
    const csv = buildCsv<Row>(
      [{ name: 'Tornillo', qty: 10 }, { name: 'Tuerca', qty: 25 }],
      [{ header: 'Nombre', value: (r) => r.name }, { header: 'Cantidad', value: (r) => r.qty }],
    );
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Nombre,Cantidad');
    expect(lines[1]).toBe('Tornillo,10');
    expect(lines[2]).toBe('Tuerca,25');
  });

  it('quotes fields containing the separator, quotes or newlines (RFC 4180)', () => {
    const csv = buildCsv<Row>(
      [{ name: 'Tornillo, 10mm', qty: 1, note: 'Dice "largo"\ny delgado' }],
      [{ header: 'Nombre', value: (r) => r.name }, { header: 'Nota', value: (r) => r.note }],
    );
    const line = csv.slice(1).split('\r\n')[1];
    expect(line).toBe('"Tornillo, 10mm","Dice ""largo""\ny delgado"');
  });

  it('renders null/undefined as an empty cell', () => {
    const csv = buildCsv<Row>([{ name: 'Sin nota', qty: 1, note: undefined }], [{ header: 'Nota', value: (r) => r.note }]);
    expect(csv.slice(1).split('\r\n')[1]).toBe('');
  });

  it('produces only the header row when there are no items', () => {
    const csv = buildCsv<Row>([], [{ header: 'Nombre', value: (r) => r.name }]);
    expect(csv.slice(1).trim()).toBe('Nombre');
  });
});
