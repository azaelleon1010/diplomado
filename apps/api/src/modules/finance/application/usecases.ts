/**
 * Finance use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import {
  FINANCE_ACTIONS,
  type AccountStatus,
  type AccountType,
  type FinanceCategoryKind,
  type FinanceMovementKind,
  type FinanceMovementStatus,
  type PaymentMethod,
} from '../domain/entities';
import type {
  IAccountStore,
  IFinanceCategoryStore,
  IMovementStore,
} from '../domain/ports';

export interface FinanceDeps {
  accounts: IAccountStore;
  categories: IFinanceCategoryStore;
  movements: IMovementStore;
  audit: IAuditSink;
}

export interface FinanceActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

async function audit(deps: FinanceDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

function duplicate(field: string): AppError {
  return new AppError({ code: 'CONFLICT', message: `Duplicate value for ${field}`, statusCode: 409, fields: { duplicateFields: { [field]: true } } });
}

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

async function assertAccountUsable(deps: FinanceDeps, tenantId: string, accountId: string) {
  const account = await deps.accounts.findById(tenantId, accountId);
  if (!account) throw notFound('Account');
  if (account.status !== 'ACTIVE') {
    throw invalid('Account is not active');
  }
  return account;
}

async function assertCategoryUsable(deps: FinanceDeps, tenantId: string, categoryId: string, kind: FinanceMovementKind) {
  const category = await deps.categories.findById(tenantId, categoryId);
  if (!category) throw notFound('Category');
  if (category.status !== 'ACTIVE') {
    throw invalid('Category is not active');
  }
  if (category.kind !== kind) {
    throw invalid(`Category kind ${category.kind} does not match movement kind ${kind}`);
  }
  return category;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  description?: string;
}

export async function createAccount(ctx: FinanceActor, input: CreateAccountInput, deps: FinanceDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.accounts.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  const created = await deps.accounts.create({
    tenantId: ctx.tenantId,
    code,
    name: input.name.trim(),
    type: input.type,
    description: input.description?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.ACCOUNT_CREATED,
    entityType: 'account',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, name: created.name, type: created.type },
  });
  return created;
}

export async function getAccount(ctx: FinanceActor, id: string, deps: FinanceDeps) {
  const account = await deps.accounts.findById(ctx.tenantId, id);
  if (!account) throw notFound('Account');
  return account;
}

export async function listAccounts(ctx: FinanceActor, filters: { search?: string; type?: AccountType; status?: AccountStatus }, page: number, limit: number, deps: FinanceDeps) {
  return deps.accounts.list(ctx.tenantId, filters, page, limit);
}

export interface UpdateAccountInput {
  name?: string;
  description?: string;
  status?: AccountStatus;
  expectedVersion: number;
}

export async function updateAccount(ctx: FinanceActor, id: string, input: UpdateAccountInput, deps: FinanceDeps) {
  const before = await deps.accounts.findById(ctx.tenantId, id);
  if (!before) throw notFound('Account');
  const { expectedVersion, ...fields } = input;
  const updated = await deps.accounts.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Account');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.ACCOUNT_UPDATED,
    entityType: 'account',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateAccount(ctx: FinanceActor, id: string, deps: FinanceDeps) {
  const account = await deps.accounts.findById(ctx.tenantId, id);
  if (!account) throw notFound('Account');
  const linked = await deps.accounts.countMovements(ctx.tenantId, id);
  if (linked > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Account has ${linked} movement(s) and cannot be deactivated`,
      statusCode: 409,
      fields: { movements: linked },
    });
  }
  const updated = await deps.accounts.update(ctx.tenantId, id, { status: 'INACTIVE' }, account.version, ctx.userId);
  if (!updated) throw notFound('Account');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.ACCOUNT_DEACTIVATED,
    entityType: 'account',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: account.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CreateFinanceCategoryInput {
  name: string;
  kind: FinanceCategoryKind;
  description?: string;
}

export async function createFinanceCategory(ctx: FinanceActor, input: CreateFinanceCategoryInput, deps: FinanceDeps) {
  const name = input.name.trim();
  const existing = await deps.categories.findByName(ctx.tenantId, name);
  if (existing) throw duplicate('name');
  const created = await deps.categories.create({
    tenantId: ctx.tenantId,
    name,
    kind: input.kind,
    description: input.description?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.CATEGORY_CREATED,
    entityType: 'financeCategory',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { name: created.name, kind: created.kind },
  });
  return created;
}

export async function getFinanceCategory(ctx: FinanceActor, id: string, deps: FinanceDeps) {
  const category = await deps.categories.findById(ctx.tenantId, id);
  if (!category) throw notFound('Category');
  return category;
}

export async function listFinanceCategories(ctx: FinanceActor, filters: { kind?: FinanceCategoryKind; status?: AccountStatus }, page: number, limit: number, deps: FinanceDeps) {
  return deps.categories.list(ctx.tenantId, filters, page, limit);
}

export interface UpdateFinanceCategoryInput {
  name?: string;
  description?: string;
  status?: AccountStatus;
  expectedVersion: number;
}

export async function updateFinanceCategory(ctx: FinanceActor, id: string, input: UpdateFinanceCategoryInput, deps: FinanceDeps) {
  const before = await deps.categories.findById(ctx.tenantId, id);
  if (!before) throw notFound('Category');
  const { expectedVersion, ...fields } = input;
  const patch: { name?: string; description?: string; status?: AccountStatus } = {};
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (name !== before.name) {
      const clash = await deps.categories.findByName(ctx.tenantId, name);
      if (clash) throw duplicate('name');
    }
    patch.name = name;
  }
  if (fields.description !== undefined) patch.description = fields.description.trim() || undefined;
  if (fields.status !== undefined) patch.status = fields.status;
  const updated = await deps.categories.update(ctx.tenantId, id, patch, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Category');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.CATEGORY_UPDATED,
    entityType: 'financeCategory',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateFinanceCategory(ctx: FinanceActor, id: string, deps: FinanceDeps) {
  const category = await deps.categories.findById(ctx.tenantId, id);
  if (!category) throw notFound('Category');
  const linked = await deps.categories.countMovements(ctx.tenantId, id);
  if (linked > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Category has ${linked} movement(s) and cannot be deactivated`,
      statusCode: 409,
      fields: { movements: linked },
    });
  }
  const updated = await deps.categories.update(ctx.tenantId, id, { status: 'INACTIVE' }, category.version, ctx.userId);
  if (!updated) throw notFound('Category');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.CATEGORY_DEACTIVATED,
    entityType: 'financeCategory',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: category.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

export interface CreateMovementInput {
  accountId: string;
  categoryId?: string;
  kind: FinanceMovementKind;
  amount: number;
  method: PaymentMethod;
  concept: string;
  reference?: string;
  date: string;
}

export async function createMovement(ctx: FinanceActor, input: CreateMovementInput, deps: FinanceDeps) {
  await assertAccountUsable(deps, ctx.tenantId, input.accountId);
  if (input.categoryId) await assertCategoryUsable(deps, ctx.tenantId, input.categoryId, input.kind);
  if (!(input.amount > 0)) throw invalid('amount must be greater than 0');
  const created = await deps.movements.create({
    tenantId: ctx.tenantId,
    accountId: input.accountId,
    categoryId: input.categoryId,
    kind: input.kind,
    amount: input.amount,
    method: input.method,
    concept: input.concept.trim(),
    reference: input.reference?.trim() || undefined,
    date: input.date.trim(),
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.MOVEMENT_CREATED,
    entityType: 'financeMovement',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { kind: created.kind, amount: created.amount, accountId: created.accountId },
  });
  return created;
}

export async function getMovement(ctx: FinanceActor, id: string, deps: FinanceDeps) {
  const movement = await deps.movements.findById(ctx.tenantId, id);
  if (!movement) throw notFound('Movement');
  return movement;
}

export async function listMovements(
  ctx: FinanceActor,
  filters: { accountId?: string; categoryId?: string; kind?: FinanceMovementKind; status?: FinanceMovementStatus; dateFrom?: string; dateTo?: string },
  page: number,
  limit: number,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  deps: FinanceDeps,
) {
  return deps.movements.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export async function movementTotals(
  ctx: FinanceActor,
  filters: { accountId?: string; dateFrom?: string; dateTo?: string },
  deps: FinanceDeps,
) {
  if (filters.accountId) await assertAccountUsable(deps, ctx.tenantId, filters.accountId);
  return deps.movements.totals(ctx.tenantId, filters);
}

export async function voidMovement(ctx: FinanceActor, id: string, expectedVersion: number, deps: FinanceDeps) {
  const movement = await deps.movements.findById(ctx.tenantId, id);
  if (!movement) throw notFound('Movement');
  if (movement.status !== 'POSTED') {
    throw invalid(`Only POSTED movements can be voided (current: ${movement.status})`);
  }
  const updated = await deps.movements.void(ctx.tenantId, id, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Movement');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: FINANCE_ACTIONS.MOVEMENT_VOIDED,
    entityType: 'financeMovement',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: movement.status },
    after: { status: updated.status },
  });
  return updated;
}
