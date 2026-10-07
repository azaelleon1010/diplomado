/**
 * Inventory ledger — domain types and rules (pure TypeScript).
 *
 * Stock is never a free-form number: every change is an immutable movement
 * linked to its source document; balances are a materialized projection of
 * the movements. Corrections are new opposite movements, never edits.
 */
import type { TxSession } from '../../tenant/domain/ports';

export const STOCK_MOVEMENT_TYPES = [
  'RECEIPT',
  'ISSUE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type StockDirection = 'IN' | 'OUT';

export const STOCK_DIRECTION: Readonly<Record<StockMovementType, StockDirection>> = {
  RECEIPT: 'IN',
  ISSUE: 'OUT',
  ADJUSTMENT_IN: 'IN',
  ADJUSTMENT_OUT: 'OUT',
  TRANSFER_IN: 'IN',
  TRANSFER_OUT: 'OUT',
};

/** Document that originated the movement. Later phases add their own types. */
export const STOCK_SOURCE_TYPES = ['MANUAL', 'TRANSFER'] as const;
export type StockSourceType = (typeof STOCK_SOURCE_TYPES)[number] | 'PURCHASE_RECEIPT' | 'PRODUCTION_ORDER' | 'MAINTENANCE_ORDER';

export interface StockSource {
  type: StockSourceType;
  id?: string;
  reference?: string;
}

export interface StockMovement {
  _id: string;
  tenantId: string;
  postingId: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  direction: StockDirection;
  quantity: number;
  unitCost?: number;
  balanceAfter: number;
  source: StockSource;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface StockBalance {
  _id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  updatedAt: Date;
}

/** Quantities allow up to 3 decimals (kg, m, l) and must be positive. */
export const QUANTITY_SCALE = 1000;
export const MAX_STOCK_QUANTITY = 1_000_000_000;

export function isValidQuantity(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_STOCK_QUANTITY &&
    Math.abs(Math.round(value * QUANTITY_SCALE) - value * QUANTITY_SCALE) < 1e-6
  );
}

/** Avoids binary float drift when balances accumulate decimals. */
export function roundQuantity(value: number): number {
  return Math.round(value * QUANTITY_SCALE) / QUANTITY_SCALE;
}

export interface StockMovementFilters {
  productId?: string;
  warehouseId?: string;
  type?: StockMovementType;
  sourceType?: StockSourceType;
  sourceId?: string;
  postingId?: string;
}

export interface StockBalanceFilters {
  productId?: string;
  warehouseId?: string;
  /** Hide rows whose balance is zero. */
  nonZero?: boolean;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IStockLedger {
  /** Adds quantity (creates the balance row if missing). Returns the new balance. */
  increase(tenantId: string, productId: string, warehouseId: string, quantity: number, userId: string, session: TxSession): Promise<number>;
  /** Subtracts only if enough stock exists; null when it would go negative. */
  decrease(tenantId: string, productId: string, warehouseId: string, quantity: number, userId: string, session: TxSession): Promise<number | null>;
  currentBalance(tenantId: string, productId: string, warehouseId: string, session?: TxSession): Promise<number>;
  insertMovements(movements: Array<Omit<StockMovement, '_id' | 'createdAt'>>, session: TxSession): Promise<StockMovement[]>;
  findMovementsByPosting(tenantId: string, postingId: string, session?: TxSession): Promise<StockMovement[]>;
  listMovements(tenantId: string, filters: StockMovementFilters, page: number, limit: number): Promise<Paged<StockMovement>>;
  listBalances(tenantId: string, filters: StockBalanceFilters, page: number, limit: number): Promise<Paged<StockBalance>>;
}
