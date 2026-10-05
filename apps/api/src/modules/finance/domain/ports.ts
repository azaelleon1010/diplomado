/**
 * Finance ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type {
  Account,
  AccountStatus,
  AccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceMovement,
  FinanceMovementKind,
  FinanceMovementStatus,
  PaymentMethod,
} from './entities';

export interface IAccountStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Account | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<Account | null>;
  list(tenantId: string, filters: { search?: string; type?: AccountType; status?: AccountStatus }, page: number, limit: number): Promise<{
    data: Account[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; code: string; name: string; type: AccountType; description?: string; createdBy: string }, session?: TxSession): Promise<Account>;
  update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: AccountStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Account | null>;
  countMovements(tenantId: string, accountId: string, session?: TxSession): Promise<number>;
}

export interface IFinanceCategoryStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<FinanceCategory | null>;
  findByName(tenantId: string, name: string, session?: TxSession): Promise<FinanceCategory | null>;
  list(tenantId: string, filters: { kind?: FinanceCategoryKind; status?: AccountStatus }, page: number, limit: number): Promise<{
    data: FinanceCategory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; name: string; kind: FinanceCategoryKind; description?: string; createdBy: string }, session?: TxSession): Promise<FinanceCategory>;
  update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: AccountStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<FinanceCategory | null>;
  countMovements(tenantId: string, categoryId: string, session?: TxSession): Promise<number>;
}

export interface MovementFilters {
  accountId?: string;
  categoryId?: string;
  kind?: FinanceMovementKind;
  status?: FinanceMovementStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface IMovementStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<FinanceMovement | null>;
  list(tenantId: string, filters: MovementFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: FinanceMovement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  totals(tenantId: string, filters: { accountId?: string; dateFrom?: string; dateTo?: string }, session?: TxSession): Promise<{ income: number; expenses: number; balance: number }>;
  create(data: { tenantId: string; accountId: string; categoryId?: string; kind: FinanceMovementKind; amount: number; method: PaymentMethod; concept: string; reference?: string; date: string; createdBy: string }, session?: TxSession): Promise<FinanceMovement>;
  void(tenantId: string, id: string, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<FinanceMovement | null>;
}
