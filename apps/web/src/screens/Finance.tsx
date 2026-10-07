/**
 * Finanzas (Web): cuentas, categorías y movimientos (ingresos/gastos).
 *
 * Usa el cliente compartido packages/types/src/finance.ts (nuevo en esta
 * fase). Esto es un registro de caja (no contabilidad de partida doble):
 * los movimientos se publican o se anulan, nunca se borran — ver
 * apps/api/src/modules/finance/domain/entities.ts. El backend es quien
 * impone permisos y reglas; esta pantalla solo oculta botones que el
 * servidor rechazaría. Mobile cubre lo mismo con DTOs propios en
 * apps/mobile/src/lib/api.ts; migrarlo al cliente compartido queda para
 * un cambio dedicado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, financeApi, loadSession } from '../lib/api';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  ACCOUNT_TYPE,
  MOVEMENT_STATUS,
  PAYMENT_METHOD,
  describeFinanceError,
  formatMoney,
  type Account,
  type AccountType,
  type FinanceCategory,
  type FinanceCategoryKind,
  type FinanceMovement,
  type FinanceMovementKind,
  type FinanceMovementStatus,
  type FinanceTotals,
  type PaymentMethod,
  type Tone,
} from '../../../../packages/types/src/finance';

type Tab = 'movements' | 'accounts' | 'categories';
type Panel = 'none' | 'account' | 'category' | 'movement';

const KIND_FILTERS: Array<{ id: FinanceMovementKind | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'INCOME', label: 'Ingresos' },
  { id: 'EXPENSE', label: 'Gastos' },
];

const STATUS_FILTERS: Array<{ id: FinanceMovementStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'POSTED', label: 'Registrados' },
  { id: 'VOIDED', label: 'Anulados' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AccountForm {
  code: string;
  name: string;
  type: AccountType;
  description: string;
}

const EMPTY_ACCOUNT_FORM: AccountForm = { code: '', name: '', type: 'EXPENSE', description: '' };

interface CategoryForm {
  name: string;
  kind: FinanceCategoryKind;
  description: string;
}

const EMPTY_CATEGORY_FORM: CategoryForm = { name: '', kind: 'EXPENSE', description: '' };

interface MovementForm {
  accountId: string;
  categoryId: string;
  kind: FinanceMovementKind;
  amount: string;
  method: PaymentMethod;
  concept: string;
  reference: string;
  date: string;
}

const EMPTY_MOVEMENT_FORM: MovementForm = { accountId: '', categoryId: '', kind: 'INCOME', amount: '', method: 'TRANSFER', concept: '', reference: '', date: todayISO() };

export function FinanceScreen() {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();
  const canCreate = hasPermission(permissions, 'finance.create');
  const canUpdate = hasPermission(permissions, 'finance.update');
  const canDelete = hasPermission(permissions, 'finance.delete');

  const [tab, setTab] = useState<Tab>('movements');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [totals, setTotals] = useState<FinanceTotals>({ income: 0, expenses: 0, balance: 0 });

  const [kindFilter, setKindFilter] = useState<FinanceMovementKind | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<FinanceMovementStatus | 'ALL'>('ALL');
  const [accountFilter, setAccountFilter] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  const [panel, setPanel] = useState<Panel>('none');
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT_FORM);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [movementForm, setMovementForm] = useState<MovementForm>(EMPTY_MOVEMENT_FORM);

  const loadAll = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [accountPage, categoryPage, movementPage, totalsResult] = await Promise.all([
        financeApi.listAccounts(session.accessToken),
        financeApi.listCategories(session.accessToken),
        financeApi.listMovements(session.accessToken, {
          kind: kindFilter === 'ALL' ? undefined : kindFilter,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          accountId: accountFilter || undefined,
          limit: 100,
        }),
        financeApi.totals(session.accessToken, { accountId: accountFilter || undefined }),
      ]);
      setAccounts(accountPage.items);
      setCategories(categoryPage.items);
      setMovements(movementPage.items);
      setMovementsTotal(movementPage.total);
      setTotals(totalsResult);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter, accountFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a._id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat._id, cat])), [categories]);
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
  const accountLabel = (id: string) => {
    const a = accountById.get(id);
    return a ? `${a.code} · ${a.name}` : 'Cuenta no disponible';
  };
  const categoryLabel = (id?: string) => (id && categoryById.get(id)?.name) || '—';

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  // ---- Accounts -------------------------------------------------------------

  const openAccountForm = () => {
    setError('');
    setNotice('');
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setPanel('account');
  };

  const submitAccount = async () => {
    if (!accountForm.code.trim()) return setError('Ingresa el código de la cuenta.');
    if (accountForm.name.trim().length < 2) return setError('El nombre debe tener al menos 2 caracteres.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await financeApi.createAccount(session.accessToken, {
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        type: accountForm.type,
        description: accountForm.description.trim() || undefined,
      });
      setPanel('none');
      setNotice(`Cuenta ${created.code} creada.`);
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleAccountStatus = async (account: Account) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (account.status === 'ACTIVE') {
        await financeApi.deactivateAccount(session.accessToken, account._id);
      } else {
        await financeApi.updateAccount(session.accessToken, account._id, { status: 'ACTIVE', expectedVersion: account.version });
      }
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Categories -----------------------------------------------------------

  const openCategoryForm = () => {
    setError('');
    setNotice('');
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setPanel('category');
  };

  const submitCategory = async () => {
    if (categoryForm.name.trim().length < 2) return setError('El nombre debe tener al menos 2 caracteres.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await financeApi.createCategory(session.accessToken, {
        name: categoryForm.name.trim(),
        kind: categoryForm.kind,
        description: categoryForm.description.trim() || undefined,
      });
      setPanel('none');
      setNotice(`Categoría ${created.name} creada.`);
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryStatus = async (category: FinanceCategory) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (category.status === 'ACTIVE') {
        await financeApi.deactivateCategory(session.accessToken, category._id);
      } else {
        await financeApi.updateCategory(session.accessToken, category._id, { status: 'ACTIVE', expectedVersion: category.version });
      }
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Movements --------------------------------------------------------------

  const openMovementForm = () => {
    setError('');
    setNotice('');
    setMovementForm(EMPTY_MOVEMENT_FORM);
    setPanel('movement');
  };

  const movementCategories = categories.filter((cat) => cat.kind === movementForm.kind && cat.status === 'ACTIVE');

  const submitMovement = async () => {
    if (!movementForm.accountId) return setError('Selecciona la cuenta.');
    const amount = Number(movementForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError('El monto debe ser mayor a 0.');
    if (movementForm.concept.trim().length < 2) return setError('Describe el concepto del movimiento.');
    if (!movementForm.date.trim()) return setError('Selecciona la fecha del movimiento.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await financeApi.createMovement(session.accessToken, {
        accountId: movementForm.accountId,
        categoryId: movementForm.categoryId || undefined,
        kind: movementForm.kind,
        amount,
        method: movementForm.method,
        concept: movementForm.concept.trim(),
        reference: movementForm.reference.trim() || undefined,
        date: movementForm.date.trim(),
      });
      setPanel('none');
      setNotice(`Movimiento registrado: ${formatMoney(created.amount)}.`);
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const voidMovement = async (movement: FinanceMovement) => {
    if (!window.confirm('¿Confirmas anular este movimiento? Esta acción queda registrada y no se puede revertir.')) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await financeApi.voidMovement(session.accessToken, movement._id, movement.version);
      setNotice('Movimiento anulado.');
      await loadAll();
    } catch (err) {
      setError(describeFinanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando finanzas...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Finanzas</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Cuentas, categorías y movimientos de caja</Text>
        </View>
        <View style={styles.actions}>
          {tab === 'accounts' && canCreate ? <ActionButton label="+ Cuenta" onPress={openAccountForm} theme={t} /> : null}
          {tab === 'categories' && canCreate ? <ActionButton label="+ Categoría" onPress={openCategoryForm} theme={t} /> : null}
          {tab === 'movements' && canCreate ? <ActionButton label="+ Nuevo movimiento" onPress={openMovementForm} theme={t} /> : null}
        </View>
      </View>

      <View style={styles.kpis}>
        <Kpi label="Ingresos" value={formatMoney(totals.income)} tone="success" theme={t} />
        <Kpi label="Gastos" value={formatMoney(totals.expenses)} tone="danger" theme={t} />
        <Kpi label="Balance" value={formatMoney(totals.balance)} tone={totals.balance >= 0 ? 'success' : 'danger'} theme={t} />
      </View>

      <View style={styles.tabs}>
        <TabButton label={`Movimientos (${movementsTotal})`} active={tab === 'movements'} onPress={() => setTab('movements')} theme={t} />
        <TabButton label={`Cuentas (${accounts.length})`} active={tab === 'accounts'} onPress={() => setTab('accounts')} theme={t} />
        <TabButton label={`Categorías (${categories.length})`} active={tab === 'categories'} onPress={() => setTab('categories')} theme={t} />
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'account' ? (
        <FormCard title="Nueva cuenta" onClose={() => setPanel('none')} theme={t}>
          <Field label="Código *" theme={t}>
            <TextInput value={accountForm.code} onChangeText={(v: string) => setAccountForm((f) => ({ ...f, code: v }))} placeholder="CTA-01" style={input} />
          </Field>
          <Field label="Nombre *" theme={t}>
            <TextInput value={accountForm.name} onChangeText={(v: string) => setAccountForm((f) => ({ ...f, name: v }))} style={input} />
          </Field>
          <Field label="Tipo" theme={t}>
            <select value={accountForm.type} onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value as AccountType }))} style={select}>
              {(Object.keys(ACCOUNT_TYPE) as AccountType[]).map((k) => <option key={k} value={k}>{ACCOUNT_TYPE[k]}</option>)}
            </select>
          </Field>
          <Field label="Descripción" theme={t}>
            <TextInput value={accountForm.description} onChangeText={(v: string) => setAccountForm((f) => ({ ...f, description: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitAccount()} label="Crear cuenta" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'category' ? (
        <FormCard title="Nueva categoría" onClose={() => setPanel('none')} theme={t}>
          <Field label="Nombre *" theme={t}>
            <TextInput value={categoryForm.name} onChangeText={(v: string) => setCategoryForm((f) => ({ ...f, name: v }))} style={input} />
          </Field>
          <Field label="Tipo" theme={t}>
            <select value={categoryForm.kind} onChange={(e) => setCategoryForm((f) => ({ ...f, kind: e.target.value as FinanceCategoryKind }))} style={select}>
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Gasto</option>
            </select>
          </Field>
          <Field label="Descripción" theme={t}>
            <TextInput value={categoryForm.description} onChangeText={(v: string) => setCategoryForm((f) => ({ ...f, description: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitCategory()} label="Crear categoría" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'movement' ? (
        <FormCard title="Nuevo movimiento" onClose={() => setPanel('none')} theme={t}>
          <Field label="Tipo" theme={t}>
            <select value={movementForm.kind} onChange={(e) => setMovementForm((f) => ({ ...f, kind: e.target.value as FinanceMovementKind, categoryId: '' }))} style={select}>
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Gasto</option>
            </select>
          </Field>
          <Field label="Cuenta *" theme={t}>
            <select value={movementForm.accountId} onChange={(e) => setMovementForm((f) => ({ ...f, accountId: e.target.value }))} style={select}>
              <option value="">Selecciona una cuenta</option>
              {activeAccounts.map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}
            </select>
          </Field>
          <Field label="Categoría" theme={t}>
            <select value={movementForm.categoryId} onChange={(e) => setMovementForm((f) => ({ ...f, categoryId: e.target.value }))} style={select}>
              <option value="">Sin categoría</option>
              {movementCategories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
            </select>
          </Field>
          <Field label="Monto *" theme={t}>
            <TextInput value={movementForm.amount} onChangeText={(v: string) => setMovementForm((f) => ({ ...f, amount: v }))} placeholder="0.00" style={input} />
          </Field>
          <Field label="Método de pago" theme={t}>
            <select value={movementForm.method} onChange={(e) => setMovementForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))} style={select}>
              {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((k) => <option key={k} value={k}>{PAYMENT_METHOD[k]}</option>)}
            </select>
          </Field>
          <Field label="Fecha *" theme={t}>
            <TextInput value={movementForm.date} onChangeText={(v: string) => setMovementForm((f) => ({ ...f, date: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Referencia" theme={t}>
            <TextInput value={movementForm.reference} onChangeText={(v: string) => setMovementForm((f) => ({ ...f, reference: v }))} style={input} />
          </Field>
          <Field label="Concepto *" theme={t}>
            <TextInput value={movementForm.concept} onChangeText={(v: string) => setMovementForm((f) => ({ ...f, concept: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitMovement()} label="Registrar movimiento" theme={t} />
        </FormCard>
      ) : null}

      {tab === 'movements' ? (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} style={{ ...select, minWidth: 220 }}>
              <option value="">Todas las cuentas</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}
            </select>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as FinanceMovementKind | 'ALL')} style={{ ...select, minWidth: 160 }}>
              {KIND_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FinanceMovementStatus | 'ALL')} style={{ ...select, minWidth: 160 }}>
              {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </View>

          {movements.length === 0 ? (
            <Empty text="No hay movimientos con los filtros actuales." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Fecha', 'Concepto', 'Cuenta', 'Categoría', 'Método', 'Monto', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {movements.map((m) => {
                const meta = MOVEMENT_STATUS[m.status];
                return (
                  <View key={m._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{m.date}</Text>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{m.concept}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{accountLabel(m.accountId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{categoryLabel(m.categoryId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{PAYMENT_METHOD[m.method]}</Text>
                    <Text style={[styles.cell, { color: m.kind === 'INCOME' ? c.success : c.danger }]}>
                      {m.kind === 'INCOME' ? '+' : '−'}{formatMoney(m.amount)}
                    </Text>
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    {m.status === 'POSTED' && canUpdate ? (
                      <TouchableOpacity disabled={saving} onPress={() => void voidMovement(m)}>
                        <Text style={[styles.cell, { color: c.danger }]}>Anular</Text>
                      </TouchableOpacity>
                    ) : <Text style={styles.cell} />}
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : tab === 'accounts' ? (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={accountSearch} onChangeText={setAccountSearch} placeholder="Buscar por nombre o código..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
          </View>

          {visibleAccounts.length === 0 ? (
            <Empty text="No hay cuentas con ese criterio." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Cuenta', 'Tipo', 'Descripción', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleAccounts.map((a) => (
                <View key={a._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                  <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{a.code} · {a.name}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{ACCOUNT_TYPE[a.type]}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{a.description || '—'}</Text>
                  <StatusPill label={a.status === 'ACTIVE' ? 'Activa' : 'Inactiva'} tone={a.status === 'ACTIVE' ? 'success' : 'neutral'} theme={t} />
                  <TouchableOpacity disabled={saving || !(a.status === 'ACTIVE' ? canDelete : canUpdate)} onPress={() => void toggleAccountStatus(a)}>
                    <Text style={[styles.cell, { color: a.status === 'ACTIVE' ? c.danger : c.success }]}>
                      {a.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {categories.length === 0 ? (
            <Empty text="No hay categorías registradas." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Categoría', 'Tipo', 'Descripción', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {categories.map((cat) => (
                <View key={cat._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                  <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{cat.name}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{cat.kind === 'INCOME' ? 'Ingreso' : 'Gasto'}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{cat.description || '—'}</Text>
                  <StatusPill label={cat.status === 'ACTIVE' ? 'Activa' : 'Inactiva'} tone={cat.status === 'ACTIVE' ? 'success' : 'neutral'} theme={t} />
                  <TouchableOpacity disabled={saving || !(cat.status === 'ACTIVE' ? canDelete : canUpdate)} onPress={() => void toggleCategoryStatus(cat)}>
                    <Text style={[styles.cell, { color: cat.status === 'ACTIVE' ? c.danger : c.success }]}>
                      {cat.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function ActionButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, { backgroundColor: c.primary }]}>
      <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabButton({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active ? { borderBottomColor: c.primary, borderBottomWidth: 2 } : null]}>
      <Text style={[styles.tabText, { color: active ? c.textPrimary : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Banner({ tone, text, theme }: { tone: 'danger' | 'success'; text: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.banner, { backgroundColor: tone === 'danger' ? c.dangerSoft : c.successSoft, borderColor: tone === 'danger' ? c.danger : c.success }]}>
      <Text accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ color: c.textPrimary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function Kpi({ label, value, tone, theme }: { label: string; value: string; tone?: 'success' | 'danger'; theme: ThemeT }) {
  const c = theme.semanticColors;
  const color = tone === 'success' ? c.success : tone === 'danger' ? c.danger : c.textPrimary;
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone, theme }: { label: string; tone: Tone; theme: ThemeT }) {
  const c = theme.semanticColors;
  const toneColor: Record<Tone, string> = { neutral: c.textMuted, info: c.info, success: c.success, warning: c.warning, danger: c.danger };
  return (
    <View style={[styles.pill, { backgroundColor: toneColor[tone] }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function FormCard({ title, onClose, children, theme }: { title: string; onClose: () => void; children: React.ReactNode; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: c.textPrimary }]}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: c.textSecondary, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function Field({ label, children, theme }: { label: string; children: React.ReactNode; theme: ThemeT }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.semanticColors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function FormActions({ saving, onCancel, onSubmit, label, theme }: { saving: boolean; onCancel: () => void; onSubmit: () => void; label: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={styles.formActions}>
      <TouchableOpacity onPress={onCancel} disabled={saving} style={[styles.button, { borderWidth: 1, borderColor: c.borderStrong }]}>
        <Text style={[styles.buttonText, { color: c.textSecondary }]}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSubmit} disabled={saving} style={[styles.button, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}>
        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{saving ? 'Guardando…' : label}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Empty({ text, theme }: { text: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <Text style={{ color: c.textSecondary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 28, gap: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 5, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  kpis: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  kpi: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderRadius: 14, padding: 18 },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { marginTop: 4, fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
  tabText: { fontSize: 15, fontWeight: '700' },
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  banner: { padding: 14, borderRadius: 10, borderWidth: 1 },
  toolbar: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 220 },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 22 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: '30%', minWidth: 220, gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginHorizontal: 4 },
  pillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
