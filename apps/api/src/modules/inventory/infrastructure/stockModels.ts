/**
 * Inventory ledger collections.
 * - inventoryMovements: append-only ledger (never updated or deleted).
 * - inventoryBalances: materialized balance per (tenant, product, warehouse).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { STOCK_MOVEMENT_TYPES } from '../domain/stock';

export interface StockMovementDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  postingId: string;
  productId: string;
  warehouseId: string;
  type: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  unitCost?: number;
  balanceAfter: number;
  source: { type: string; id?: string; reference?: string };
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

const movementSchema = new Schema<StockMovementDoc>(
  {
    tenantId: { type: String, required: true, trim: true },
    postingId: { type: String, required: true },
    productId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    type: { type: String, required: true, enum: [...STOCK_MOVEMENT_TYPES] },
    direction: { type: String, required: true, enum: ['IN', 'OUT'] },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    source: {
      type: { type: String, required: true },
      id: { type: String },
      reference: { type: String, maxlength: 120 },
    },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: String, required: true },
  },
  { collection: 'inventoryMovements', timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false },
);
movementSchema.index({ tenantId: 1, productId: 1, warehouseId: 1, createdAt: -1 }, { name: 'idx_tenant_product_warehouse_created' });
movementSchema.index({ tenantId: 1, warehouseId: 1, createdAt: -1 }, { name: 'idx_tenant_warehouse_created' });
movementSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_tenant_created' });
movementSchema.index({ tenantId: 1, postingId: 1 }, { name: 'idx_tenant_posting' });
movementSchema.index({ tenantId: 1, 'source.type': 1, 'source.id': 1 }, { name: 'idx_tenant_source' });

export interface StockBalanceDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const balanceSchema = new Schema<StockBalanceDoc>(
  {
    tenantId: { type: String, required: true, trim: true },
    productId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
  },
  { collection: 'inventoryBalances', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false },
);
balanceSchema.index({ tenantId: 1, productId: 1, warehouseId: 1 }, { unique: true, name: 'uniq_tenant_product_warehouse' });
balanceSchema.index({ tenantId: 1, warehouseId: 1 }, { name: 'idx_tenant_warehouse' });

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const StockMovementModel = getOrCreate<StockMovementDoc>('InventoryMovement', movementSchema);
export const StockBalanceModel = getOrCreate<StockBalanceDoc>('InventoryBalance', balanceSchema);

export const stockModels = [StockMovementModel, StockBalanceModel] as unknown as Array<Model<unknown>>;
