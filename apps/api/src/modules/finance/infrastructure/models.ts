/**
 * Finance MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface AccountDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<AccountDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, minlength: 1, maxlength: 16 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    type: { type: String, enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'], required: true },
    description: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'accounts' },
);
accountSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_account_code' });
accountSchema.index({ tenantId: 1, type: 1 }, { name: 'idx_tenant_account_type' });
addTenantIndex(accountSchema);

export interface FinanceCategoryDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  kind: 'INCOME' | 'EXPENSE';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const financeCategorySchema = new Schema<FinanceCategoryDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    kind: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
    description: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'financeCategories' },
);
financeCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_finance_category' });
addTenantIndex(financeCategorySchema);

export interface FinanceMovementDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  accountId: string;
  categoryId?: string;
  kind: 'INCOME' | 'EXPENSE';
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER';
  concept: string;
  reference?: string;
  date: string;
  status: 'POSTED' | 'VOIDED';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const financeMovementSchema = new Schema<FinanceMovementDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    accountId: { type: String, required: true, trim: true },
    categoryId: { type: String, trim: true },
    kind: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['CASH', 'TRANSFER', 'CARD', 'OTHER'], required: true },
    concept: { type: String, required: true, trim: true, minlength: 2, maxlength: 300 },
    reference: { type: String, trim: true, maxlength: 120 },
    date: { type: String, required: true, trim: true },
    status: { type: String, enum: ['POSTED', 'VOIDED'], default: 'POSTED', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'financeMovements' },
);
financeMovementSchema.index({ tenantId: 1, accountId: 1, date: -1 }, { name: 'idx_tenant_account_date' });
financeMovementSchema.index({ tenantId: 1, kind: 1, date: -1 }, { name: 'idx_tenant_kind_date' });
addTenantIndex(financeMovementSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const AccountModel = getOrCreate<AccountDoc>('FinanceAccount', accountSchema);
export const FinanceCategoryModel = getOrCreate<FinanceCategoryDoc>('FinanceCategory', financeCategorySchema);
export const FinanceMovementModel = getOrCreate<FinanceMovementDoc>('FinanceMovement', financeMovementSchema);

/** Models whose indexes must exist before the API serves traffic. */
export const financeModels = [AccountModel, FinanceCategoryModel, FinanceMovementModel] as unknown as Array<import('mongoose').Model<unknown>>;
