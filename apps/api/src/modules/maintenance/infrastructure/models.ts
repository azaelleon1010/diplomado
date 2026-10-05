/**
 * Maintenance MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface AssetDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  status: 'ACTIVE' | 'IN_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED';
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<AssetDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    type: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    location: { type: String, trim: true, maxlength: 200 },
    responsible: { type: String, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['ACTIVE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'],
      default: 'ACTIVE',
      index: true,
    },
    purchaseDate: { type: String, trim: true },
    warrantyUntil: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'assets' },
);
assetSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_asset_code' });
assetSchema.index({ tenantId: 1, name: 1 }, { name: 'idx_tenant_asset_name' });
addTenantIndex(assetSchema);

export interface MaintenanceOrderDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  assetId: string;
  type: 'PREVENTIVE' | 'CORRECTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  cost: number;
  assignedTo?: string;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceOrderSchema = new Schema<MaintenanceOrderDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    assetId: { type: String, required: true, trim: true },
    type: { type: String, enum: ['PREVENTIVE', 'CORRECTIVE'], required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'OPEN',
      index: true,
    },
    scheduledFor: { type: String, trim: true },
    startedAt: { type: String, trim: true },
    completedAt: { type: String, trim: true },
    cost: { type: Number, required: true, default: 0, min: 0 },
    assignedTo: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 2000 },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'maintenanceOrders' },
);
maintenanceOrderSchema.index({ tenantId: 1, assetId: 1, status: 1 }, { name: 'idx_tenant_asset_status' });
maintenanceOrderSchema.index({ tenantId: 1, status: 1, priority: 1 }, { name: 'idx_tenant_status_priority' });
addTenantIndex(maintenanceOrderSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const AssetModel = getOrCreate<AssetDoc>('MaintenanceAsset', assetSchema);
export const MaintenanceOrderModel = getOrCreate<MaintenanceOrderDoc>(
  'MaintenanceOrder',
  maintenanceOrderSchema,
);

/** Models whose indexes must exist before the API serves traffic. */
export const maintenanceModels = [AssetModel, MaintenanceOrderModel] as unknown as Array<import('mongoose').Model<unknown>>;
