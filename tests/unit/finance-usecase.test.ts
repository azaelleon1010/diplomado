import { describe, it, expect } from 'vitest';
import {
  createAccount,
  createFinanceCategory,
  createMovement,
  deactivateAccount,
  movementTotals,
  voidMovement,
  type FinanceDeps,
} from '../../apps/api/src/modules/finance/application/usecases';
import type { IAccountStore, IFinanceCategoryStore, IMovementStore } from '../../apps/api/src/modules/finance/domain/ports';
import type { Account, FinanceCategory, FinanceMovement } from '../../apps/api/src/modules/finance/domain/entities';

function makeDeps() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const accounts = new Map<string, Account>();
  const categories = new Map<string, FinanceCategory>();
  const movements = new Map<string, FinanceMovement>();
  const audits: unknown[] = [];

  const accountStore: IAccountStore = {
    findById: async (tenantId, aid) => {
      const a = accounts.get(aid);
      return a && a.tenantId === tenantId ? a : null;
    },
    findByCode: async (tenantId, code) =>
      [...accounts.values()].find((a) => a.tenantId === tenantId && a.code === code.toUpperCase()) ?? null,
    list: async (tenantId) => {
      const data = [...accounts.values()].filter((a) => a.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const a: Account = {
        _id: id('acc'), tenantId: data.tenantId, code: data.code.toUpperCase(), name: data.name,
        type: data.type, description: data.description, status: 'ACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      accounts.set(a._id, a);
      return a;
    },
    update: async (tenantId, aid, patch, expectedVersion) => {
      const a = accounts.get(aid);
      if (!a || a.tenantId !== tenantId) return null;
      if (a.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...a, ...patch, version: a.version + 1, updatedAt: now() };
      accounts.set(aid, next);
      return next;
    },
    countMovements: async (tenantId, accountId) =>
      [...movements.values()].filter((m) => m.tenantId === tenantId && m.accountId === accountId).length,
  };

  const categoryStore: IFinanceCategoryStore = {
    findById: async (tenantId, cid) => {
      const c = categories.get(cid);
      return c && c.tenantId === tenantId ? c : null;
    },
    findByName: async (tenantId, name) =>
      [...categories.values()].find((c) => c.tenantId === tenantId && c.name === name) ?? null,
    list: async (tenantId) => {
      const data = [...categories.values()].filter((c) => c.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const c: FinanceCategory = {
        _id: id('cat'), tenantId: data.tenantId, name: data.name, kind: data.kind,
        description: data.description, status: 'ACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      categories.set(c._id, c);
      return c;
    },
    update: async (tenantId, cid, patch, expectedVersion) => {
      const c = categories.get(cid);
      if (!c || c.tenantId !== tenantId) return null;
      if (c.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...c, ...patch, version: c.version + 1, updatedAt: now() };
      categories.set(cid, next);
      return next;
    },
    countMovements: async (tenantId, categoryId) =>
      [...movements.values()].filter((m) => m.tenantId === tenantId && m.categoryId === categoryId).length,
  };

  const movementStore: IMovementStore = {
    findById: async (tenantId, mid) => {
      const m = movements.get(mid);
      return m && m.tenantId === tenantId ? m : null;
    },
    list: async (tenantId) => {
      const data = [...movements.values()].filter((m) => m.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    totals: async (tenantId, filters) => {
      let income = 0;
      let expenses = 0;
      for (const m of movements.values()) {
        if (m.tenantId !== tenantId || m.status !== 'POSTED') continue;
        if (filters.accountId && m.accountId !== filters.accountId) continue;
        if (m.kind === 'INCOME') income += m.amount;
        else expenses += m.amount;
      }
      return { income, expenses, balance: income - expenses };
    },
    create: async (data) => {
      const m: FinanceMovement = {
        _id: id('mov'), tenantId: data.tenantId, accountId: data.accountId, categoryId: data.categoryId,
        kind: data.kind, amount: data.amount, method: data.method, concept: data.concept,
        reference: data.reference, date: data.date, status: 'POSTED',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      movements.set(m._id, m);
      return m;
    },
    void: async (tenantId, mid, expectedVersion) => {
      const m = movements.get(mid);
      if (!m || m.tenantId !== tenantId) return null;
      if (m.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...m, status: 'VOIDED' as const, version: m.version + 1, updatedAt: now() };
      movements.set(mid, next);
      return next;
    },
  };

  const deps: FinanceDeps = {
    accounts: accountStore,
    categories: categoryStore,
    movements: movementStore,
    audit: { record: async (event) => { audits.push(event); } },
  };
  return { deps, audits, accounts, movements };
}

const ctx = { userId: 'u-1', tenantId: 't-1' };

describe('finance use cases (fake stores)', () => {
  it('creates accounts, categories and movements with audit trail', async () => {
    const { deps, audits } = makeDeps();
    const account = await createAccount(ctx, { code: '1000', name: 'Caja', type: 'ASSET' }, deps);
    expect(account.code).toBe('1000');
    const category = await createFinanceCategory(ctx, { name: 'Ventas', kind: 'INCOME' }, deps);
    const movement = await createMovement(
      ctx,
      { accountId: account._id, categoryId: category._id, kind: 'INCOME', amount: 1500, method: 'TRANSFER', concept: 'Cobro factura F-1', date: '2026-10-05' },
      deps,
    );
    expect(movement.status).toBe('POSTED');
    const totals = await movementTotals(ctx, {}, deps);
    expect(totals).toEqual({ income: 1500, expenses: 0, balance: 1500 });
    expect(audits.length).toBe(3);
  });

  it('validates duplicates, references and amounts', async () => {
    const { deps } = makeDeps();
    await createAccount(ctx, { code: '1000', name: 'Caja', type: 'ASSET' }, deps);
    await expect(createAccount(ctx, { code: '1000', name: 'Otra', type: 'ASSET' }, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await expect(
      createMovement(ctx, { accountId: 'missing', kind: 'INCOME', amount: 10, method: 'CASH', concept: 'X', date: '2026-10-05' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    const account = await createAccount(ctx, { code: '2000', name: 'Banco', type: 'ASSET' }, deps);
    await expect(
      createMovement(ctx, { accountId: account._id, kind: 'EXPENSE', amount: 0, method: 'CASH', concept: 'X', date: '2026-10-05' }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    const incomeCat = await createFinanceCategory(ctx, { name: 'Ventas', kind: 'INCOME' }, deps);
    await expect(
      createMovement(ctx, { accountId: account._id, categoryId: incomeCat._id, kind: 'EXPENSE', amount: 10, method: 'CASH', concept: 'X', date: '2026-10-05' }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('voids movements and excludes them from totals', async () => {
    const { deps } = makeDeps();
    const account = await createAccount(ctx, { code: '1000', name: 'Caja', type: 'ASSET' }, deps);
    const movement = await createMovement(
      ctx,
      { accountId: account._id, kind: 'EXPENSE', amount: 200, method: 'CASH', concept: 'Renta', date: '2026-10-05' },
      deps,
    );
    const voided = await voidMovement(ctx, movement._id, 1, deps);
    expect(voided.status).toBe('VOIDED');
    const totals = await movementTotals(ctx, {}, deps);
    expect(totals).toEqual({ income: 0, expenses: 0, balance: 0 });
    await expect(voidMovement(ctx, movement._id, 2, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('blocks account deactivation with movements and isolates tenants', async () => {
    const { deps } = makeDeps();
    const account = await createAccount(ctx, { code: '1000', name: 'Caja', type: 'ASSET' }, deps);
    await createMovement(ctx, { accountId: account._id, kind: 'INCOME', amount: 10, method: 'CASH', concept: 'X', date: '2026-10-05' }, deps);
    await expect(deactivateAccount(ctx, account._id, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    const other = await createAccount({ ...ctx, tenantId: 't-2' }, { code: '1000', name: 'Caja B', type: 'ASSET' }, deps);
    expect(other.tenantId).toBe('t-2');
  });
});
