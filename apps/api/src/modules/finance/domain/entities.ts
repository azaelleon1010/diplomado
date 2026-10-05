/**
 * Finance domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 *
 * Generic business finance foundation: chart of accounts, income/expense
 * categories and posted/voided money movements. Not a full double-entry
 * ledger (that is a later phase); totals derive from posted movements.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface Account {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type FinanceCategoryKind = 'INCOME' | 'EXPENSE';

export interface FinanceCategory {
  _id: string;
  tenantId: string;
  name: string;
  kind: FinanceCategoryKind;
  description?: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type FinanceMovementKind = 'INCOME' | 'EXPENSE';
export type FinanceMovementStatus = 'POSTED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER';

export interface FinanceMovement {
  _id: string;
  tenantId: string;
  accountId: string;
  categoryId?: string;
  kind: FinanceMovementKind;
  amount: number;
  method: PaymentMethod;
  concept: string;
  reference?: string;
  date: string;
  status: FinanceMovementStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const FINANCE_ACTIONS = {
  ACCOUNT_CREATED: 'finance.account.created',
  ACCOUNT_UPDATED: 'finance.account.updated',
  ACCOUNT_DEACTIVATED: 'finance.account.deactivated',
  CATEGORY_CREATED: 'finance.category.created',
  CATEGORY_UPDATED: 'finance.category.updated',
  CATEGORY_DEACTIVATED: 'finance.category.deactivated',
  MOVEMENT_CREATED: 'finance.movement.created',
  MOVEMENT_VOIDED: 'finance.movement.voided',
} as const;
