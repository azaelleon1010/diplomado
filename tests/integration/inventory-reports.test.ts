import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startHarness, registerCompany, userWith, client, type Harness, type Company } from '../helpers/integration';

describe('Inventory reports: CSV/PDF downloads respect permissions, tenant isolation and filters', () => {
  let h: Harness;
  let company: Company;
  let warehouseId: string;
  let productId: string;

  beforeAll(async () => {
    h = await startHarness('test_inventory_reports');
    company = await registerCompany(h, 'ReportsCo');
    const api = client(h, company.token);

    const warehouse = await api.post('/inventory/warehouses', { code: `ALM-${h.stamp}`, name: 'Almacén central' });
    warehouseId = warehouse.body.data._id;

    const product = await api.post('/inventory/products', {
      sku: `SKU-${h.stamp}`,
      name: 'Tornillo hexagonal',
      unit: 'pza',
      cost: 1,
      price: 2,
      minimumStock: 100,
    });
    productId = product.body.data._id;

    await api.post('/inventory/movements', {
      lines: [{ productId, warehouseId, type: 'RECEIPT', quantity: 10 }],
      idempotencyKey: `report-seed-${h.stamp}`,
    });
  });

  afterAll(async () => {
    await h.stop();
  });

  it('downloads the stock report as CSV with the expected headers and rows', async () => {
    const res = await client(h, company.token).get(`/inventory/reports/stock?format=csv&warehouseId=${warehouseId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('inventario-existencias');
    expect(res.headers['content-disposition']).toContain('.csv');
    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('SKU,Producto,Categoría,Almacén,Existencia,Unidad,Stock mínimo,Stock máximo,Estado,Actualizado');
    expect(text).toContain('Tornillo hexagonal');
    expect(text).toContain('Bajo mínimo'); // minimumStock 100 > received 10
  });

  it('downloads the stock report as a PDF file', async () => {
    const res = await request(h.app)
      .get(`/api/v1/inventory/reports/stock?format=pdf&warehouseId=${warehouseId}`)
      .set('Authorization', `Bearer ${company.token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('downloads the movements report as CSV, reflecting the posted receipt', async () => {
    const res = await client(h, company.token).get(`/inventory/reports/movements?format=csv&warehouseId=${warehouseId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Entrada');
    expect(res.text).toContain('Tornillo hexagonal');
    expect(res.text).toContain('+10');
  });

  it('rejects a report request without a format', async () => {
    const res = await client(h, company.token).get('/inventory/reports/stock');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('enforces inventory.read on report endpoints', async () => {
    const noAccessToken = await userWith(h, company, ['finance.read'], `noaccess${h.stamp}`);
    const res = await client(h, noAccessToken).get('/inventory/reports/stock?format=csv');
    expect(res.status).toBe(403);
  });

  it('never returns another tenant\'s rows in a report', async () => {
    const other = await registerCompany(h, 'OtherCo');
    const res = await client(h, other.token).get('/inventory/reports/stock?format=csv');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Tornillo hexagonal');
  });
});
