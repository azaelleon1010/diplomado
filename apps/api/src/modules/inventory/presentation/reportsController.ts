/**
 * Inventory report controllers — thin HTTP adapters.
 * Builds the same rows the use case returns into CSV or PDF bytes and sends
 * them as a file download. No business logic lives here.
 */
import type { NextFunction, Request, Response } from 'express';
import { buildCsv, type CsvColumn } from '../../../shared/reports/csv';
import { buildPdfReport } from '../../../shared/reports/pdf';
import { sendCsvReport, sendPdfReport } from '../../../shared/reports/http';
import {
  buildMovementsReport,
  buildStockReport,
  resolveTenantName,
  type InventoryReportDeps,
  type MovementsReportRow,
  type StockReportRow,
  type TenantActor,
} from '../application/reports';
import { movementsReportQuerySchema, stockReportQuerySchema } from './schemas';

function actorOf(req: Request): TenantActor {
  return { userId: req.userId as string, tenantId: req.tenantId as string };
}

const STOCK_MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: 'Entrada',
  ISSUE: 'Salida',
  ADJUSTMENT_IN: 'Ajuste (+)',
  ADJUSTMENT_OUT: 'Ajuste (−)',
  TRANSFER_IN: 'Transferencia (entrada)',
  TRANSFER_OUT: 'Transferencia (salida)',
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  TRANSFER: 'Transferencia',
  PURCHASE_RECEIPT: 'Recepción de compra',
  PRODUCTION_ORDER: 'Orden de producción',
  MAINTENANCE_ORDER: 'Orden de mantenimiento',
};

const STOCK_COLUMNS: Array<CsvColumn<StockReportRow>> = [
  { header: 'SKU', value: (r) => r.sku },
  { header: 'Producto', value: (r) => r.productName },
  { header: 'Categoría', value: (r) => r.categoryName },
  { header: 'Almacén', value: (r) => `${r.warehouseCode} - ${r.warehouseName}` },
  { header: 'Existencia', value: (r) => r.quantity },
  { header: 'Unidad', value: (r) => r.unit },
  { header: 'Stock mínimo', value: (r) => r.minimumStock },
  { header: 'Stock máximo', value: (r) => r.maximumStock ?? '' },
  { header: 'Estado', value: (r) => (r.belowMinimum ? 'Bajo mínimo' : 'Normal') },
  { header: 'Actualizado', value: (r) => r.updatedAt.toLocaleString('es-MX') },
];

const MOVEMENT_COLUMNS: Array<CsvColumn<MovementsReportRow>> = [
  { header: 'Fecha', value: (r) => r.date.toLocaleString('es-MX') },
  { header: 'Tipo', value: (r) => STOCK_MOVEMENT_LABEL[r.type] ?? r.type },
  { header: 'Producto', value: (r) => `${r.productSku} - ${r.productName}` },
  { header: 'Almacén', value: (r) => `${r.warehouseCode} - ${r.warehouseName}` },
  { header: 'Cantidad', value: (r) => `${r.direction === 'IN' ? '+' : '-'}${r.quantity}` },
  { header: 'Saldo', value: (r) => r.balanceAfter },
  { header: 'Origen', value: (r) => SOURCE_TYPE_LABEL[r.sourceType] ?? r.sourceType },
  { header: 'Referencia', value: (r) => r.reference },
];

export function createInventoryReportsController(deps: InventoryReportDeps) {
  return {
    async stockReport(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const q = stockReportQuerySchema.parse(req.query);
        const ctx = actorOf(req);
        const [warehouses, categories, result, tenantName] = await Promise.all([
          deps.warehouses.list(ctx.tenantId, {}, 1, 10_000),
          deps.categories.list(ctx.tenantId, {}, 1, 10_000),
          buildStockReport(ctx, { warehouseId: q.warehouseId, categoryId: q.categoryId, status: q.status, nonZero: q.nonZero }, deps),
          resolveTenantName(ctx, deps),
        ]);

        const filters = [
          { label: 'Almacén', value: q.warehouseId ? warehouses.data.find((w) => w._id === q.warehouseId)?.name ?? q.warehouseId : 'Todos' },
          { label: 'Categoría', value: q.categoryId ? categories.data.find((c) => c._id === q.categoryId)?.name ?? q.categoryId : 'Todas' },
          { label: 'Estado del producto', value: q.status === 'ACTIVE' ? 'Activos' : q.status === 'INACTIVE' ? 'Inactivos' : 'Todos' },
          { label: 'Solo con existencia', value: q.nonZero ? 'Sí' : 'No' },
        ];

        if (q.format === 'csv') {
          sendCsvReport(res, 'inventario-existencias', buildCsv(result.rows, STOCK_COLUMNS));
          return;
        }
        const pdf = await buildPdfReport({
          appName: 'TramaTech ERP',
          tenantName,
          moduleName: 'Inventario',
          title: 'Reporte de existencias',
          generatedAt: new Date(),
          generatedBy: result.generatedBy,
          filters,
          columns: [
            { header: 'SKU', width: 10 },
            { header: 'Producto', width: 22 },
            { header: 'Categoría', width: 14 },
            { header: 'Almacén', width: 16 },
            { header: 'Existencia', width: 10, align: 'right' },
            { header: 'Unidad', width: 8 },
            { header: 'Mínimo', width: 9, align: 'right' },
            { header: 'Estado', width: 11 },
          ],
          rows: result.rows.map((r) => [
            r.sku,
            r.productName,
            r.categoryName,
            `${r.warehouseCode} - ${r.warehouseName}`,
            String(r.quantity),
            r.unit,
            String(r.minimumStock),
            r.belowMinimum ? 'Bajo mínimo' : 'Normal',
          ]),
          totals: [
            { label: 'Total de productos', value: String(result.totalProducts) },
            { label: 'Productos bajo el mínimo', value: String(result.belowMinimumCount) },
          ],
        });
        sendPdfReport(res, 'inventario-existencias', pdf);
      } catch (err) {
        next(err);
      }
    },

    async movementsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const q = movementsReportQuerySchema.parse(req.query);
        const ctx = actorOf(req);
        const [warehouses, result, tenantName] = await Promise.all([
          deps.warehouses.list(ctx.tenantId, {}, 1, 10_000),
          buildMovementsReport(ctx, { productId: q.productId, warehouseId: q.warehouseId, type: q.type, sourceType: q.sourceType as never }, deps),
          resolveTenantName(ctx, deps),
        ]);

        const filters = [
          { label: 'Almacén', value: q.warehouseId ? warehouses.data.find((w) => w._id === q.warehouseId)?.name ?? q.warehouseId : 'Todos' },
          { label: 'Tipo de movimiento', value: q.type ? STOCK_MOVEMENT_LABEL[q.type] ?? q.type : 'Todos' },
        ];

        if (q.format === 'csv') {
          sendCsvReport(res, 'inventario-movimientos', buildCsv(result.rows, MOVEMENT_COLUMNS));
          return;
        }
        const pdf = await buildPdfReport({
          appName: 'TramaTech ERP',
          tenantName,
          moduleName: 'Inventario',
          title: 'Reporte de movimientos',
          generatedAt: new Date(),
          generatedBy: result.generatedBy,
          filters,
          columns: [
            { header: 'Fecha', width: 14 },
            { header: 'Tipo', width: 14 },
            { header: 'Producto', width: 20 },
            { header: 'Almacén', width: 14 },
            { header: 'Cantidad', width: 10, align: 'right' },
            { header: 'Saldo', width: 9, align: 'right' },
            { header: 'Origen', width: 12 },
          ],
          rows: result.rows.map((r) => [
            r.date.toLocaleDateString('es-MX'),
            STOCK_MOVEMENT_LABEL[r.type] ?? r.type,
            `${r.productSku} - ${r.productName}`,
            `${r.warehouseCode} - ${r.warehouseName}`,
            `${r.direction === 'IN' ? '+' : '-'}${r.quantity}`,
            String(r.balanceAfter),
            SOURCE_TYPE_LABEL[r.sourceType] ?? r.sourceType,
          ]),
          totals: [{ label: 'Total de movimientos', value: String(result.rows.length) }],
        });
        sendPdfReport(res, 'inventario-movimientos', pdf);
      } catch (err) {
        next(err);
      }
    },
  };
}
