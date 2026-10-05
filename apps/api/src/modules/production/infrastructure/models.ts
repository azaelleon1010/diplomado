/**
 * Production MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 * Products/materials reference the inventory catalog (no duplicated catalog).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface ProductionOrderDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  productId: string;
  quantity: number;
  producedQuantity: number;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  materials: Array<{ productId: string; quantityRequired: number; quantityConsumed: number }>;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    quantityRequired: { type: Number, required: true, min: 0 },
    quantityConsumed: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const productionOrderSchema = new Schema<ProductionOrderDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    productId: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    producedQuantity: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    machine: { type: String, trim: true, maxlength: 200 },
    responsible: { type: String, trim: true, maxlength: 200 },
    dueDate: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    startedAt: { type: String, trim: true },
    completedAt: { type: String, trim: true },
    materials: { type: [materialSchema], default: [] },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'productionOrders' },
);
productionOrderSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_production_code' });
productionOrderSchema.index({ tenantId: 1, status: 1 }, { name: 'idx_tenant_production_status' });
productionOrderSchema.index({ tenantId: 1, productId: 1 }, { name: 'idx_tenant_production_product' });
addTenantIndex(productionOrderSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const ProductionOrderModel = getOrCreate<ProductionOrderDoc>(
  'ProductionOrder',
  productionOrderSchema,
);

/** Models whose indexes must exist before the API serves traffic. */
export const productionModels = [ProductionOrderModel] as unknown as Array<import('mongoose').Model<unknown>>;
