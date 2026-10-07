/**
 * Almacenes y existencias (Web).
 *
 * Reads balances and movements from the inventory ledger API and posts
 * manual movements/transfers through the shared contract. The API enforces
 * permissions, idempotency and the no-negative-stock rule; this screen only
 * hides actions the server would reject.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, inventoryApi, loadSession, stockApi, type Product } from '../lib/api';
import {
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_PERMISSION,
  describeStockError,
  formatQuantity,
  newIdempotencyKey,
  parseStockQuantity,
  type InventoryWarehouse,
  type ManualStockMovementType,
  type StockBalanceView,
  type StockMovementView,
} from '../../../../packages/types/src/inventory';
import { hasAnyPermission, hasPermission } from '../../../../packages/types/src/permissions';

type Panel = 'none' | 'movement' | 'transfer' | 'warehouse';

const MANUAL_TYPES: ManualStockMovementType[] = ['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'];

interface MovementForm {
  type: ManualStockMovementType;
  productId: string;
  warehouseId: string;
  quantity: string;
  reference: string;
  notes: string;
}

interface TransferForm {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  reference: string;
}

interface WarehouseForm {
  code: string;
  name: string;
  address: string;
}

export function StockScreen() {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();

  const allowedTypes = MANUAL_TYPES.filter((type) => hasPermission(permissions, STOCK_MOVEMENT_PERMISSION[type]));
  const canTransfer = hasPermission(permissions, 'inventory.transfer');
  const canCreateWarehouse = hasPermission(permissions, 'inventory.create');
  const canMove = hasAnyPermission(permissions, ['inventory.stock.in', 'inventory.stock.out', 'inventory.stock.adjust']);

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalanceView[]>([]);
  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<Panel>('none');

  const [movementForm, setMovementForm] = useState<MovementForm>({ type: 'RECEIPT', productId: '', warehouseId: '', quantity: '', reference: '', notes: '' });
  const [transferForm, setTransferForm] = useState<TransferForm>({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reference: '' });
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>({ code: '', name: '', address: '' });
  // One key per intended operation; any edit means a new operation.
  const [operationKey, setOperationKey] = useState(() => newIdempotencyKey('web'));

  const loadData = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [warehousePage, productList, stockPage, movementPage] = await Promise.all([
        stockApi.listWarehouses(session.accessToken),
        inventoryApi.listProducts(session.accessToken, { limit: 100 }),
        stockApi.listStock(session.accessToken, { warehouseId: warehouseFilter || undefined, nonZero: true, limit: 100 }),
        stockApi.listMovements(session.accessToken, { warehouseId: warehouseFilter || undefined, limit: 25 }),
      ]);
      setWarehouses(warehousePage.items);
      setProducts(productList);
      setBalances(stockPage.items);
      setMovements(movementPage.items);
      setMovementTotal(movementPage.total);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [warehouseFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w._id, w])), [warehouses]);
  const activeWarehouses = warehouses.filter((w) => w.status === 'ACTIVE');
  const stockableProducts = products.filter((p) => p.status === 'ACTIVE' && p.trackInventory);

  const productTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const b of balances) totals.set(b.productId, (totals.get(b.productId) ?? 0) + b.quantity);
    return totals;
  }, [balances]);

  const visibleBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balances.filter((b) => {
      if (!q) return true;
      const p = productById.get(b.productId);
      return Boolean(p && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
    });
  }, [balances, search, productById]);

  const belowMinimum = stockableProducts.filter((p) => p.minimumStock > 0 && (productTotals.get(p._id) ?? 0) < p.minimumStock);

  const productLabel = (id: string) => {
    const p = productById.get(id);
    return p ? `${p.sku} · ${p.name}` : 'Producto no disponible';
  };
  const warehouseLabel = (id: string) => {
    const w = warehouseById.get(id);
    return w ? `${w.code} · ${w.name}` : 'Almacén no disponible';
  };

  const openPanel = (next: Panel) => {
    setError('');
    setNotice('');
    setOperationKey(newIdempotencyKey('web'));
    if (next === 'movement') {
      setMovementForm({ type: allowedTypes[0] ?? 'RECEIPT', productId: '', warehouseId: warehouseFilter || activeWarehouses[0]?._id || '', quantity: '', reference: '', notes: '' });
    }
    if (next === 'transfer') {
      setTransferForm({ productId: '', fromWarehouseId: warehouseFilter || '', toWarehouseId: '', quantity: '', reference: '' });
    }
    if (next === 'warehouse') setWarehouseForm({ code: '', name: '', address: '' });
    setPanel(next);
  };

  const editMovement = <K extends keyof MovementForm>(field: K, value: MovementForm[K]) => {
    setMovementForm((f) => ({ ...f, [field]: value }));
    setOperationKey(newIdempotencyKey('web'));
  };
  const editTransfer = <K extends keyof TransferForm>(field: K, value: TransferForm[K]) => {
    setTransferForm((f) => ({ ...f, [field]: value }));
    setOperationKey(newIdempotencyKey('web'));
  };

  const run = async (action: (token: string) => Promise<string>) => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const message = await action(session.accessToken);
      setPanel('none');
      setNotice(message);
      await loadData();
    } catch (err) {
      setError(describeStockError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitMovement = () => {
    const quantity = parseStockQuantity(movementForm.quantity);
    if (!movementForm.productId || !movementForm.warehouseId) return setError('Selecciona producto y almacén.');
    if (quantity === undefined) return setError('La cantidad debe ser mayor a 0 y tener máximo 3 decimales.');
    if (movementForm.type === 'ADJUSTMENT_OUT' || movementForm.type === 'ISSUE') {
      const ok = window.confirm(`¿Confirmas la ${STOCK_MOVEMENT_LABELS[movementForm.type].toLowerCase()} de ${formatQuantity(quantity)} de ${productLabel(movementForm.productId)}?`);
      if (!ok) return;
    }
    void run(async (token) => {
      const result = await stockApi.postMovements(token, {
        lines: [{ productId: movementForm.productId, warehouseId: movementForm.warehouseId, type: movementForm.type, quantity }],
        reference: movementForm.reference.trim() || undefined,
        notes: movementForm.notes.trim() || undefined,
        idempotencyKey: operationKey,
      });
      const after = result.movements[0]?.balanceAfter ?? 0;
      return `${STOCK_MOVEMENT_LABELS[movementForm.type]} registrada. Nuevo saldo: ${formatQuantity(after)}.`;
    });
  };

  const submitTransfer = () => {
    const quantity = parseStockQuantity(transferForm.quantity);
    if (!transferForm.productId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId) return setError('Selecciona producto, origen y destino.');
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) return setError('El origen y el destino deben ser distintos.');
    if (quantity === undefined) return setError('La cantidad debe ser mayor a 0 y tener máximo 3 decimales.');
    void run(async (token) => {
      await stockApi.transfer(token, {
        productId: transferForm.productId,
        fromWarehouseId: transferForm.fromWarehouseId,
        toWarehouseId: transferForm.toWarehouseId,
        quantity,
        reference: transferForm.reference.trim() || undefined,
        idempotencyKey: operationKey,
      });
      return `Transferencia registrada: ${formatQuantity(quantity)} de ${warehouseLabel(transferForm.fromWarehouseId)} a ${warehouseLabel(transferForm.toWarehouseId)}.`;
    });
  };

  const submitWarehouse = () => {
    if (!warehouseForm.code.trim() || warehouseForm.name.trim().length < 2) return setError('Código y nombre (mínimo 2 caracteres) son obligatorios.');
    void run(async (token) => {
      const created = await stockApi.createWarehouse(token, {
        code: warehouseForm.code.trim(),
        name: warehouseForm.name.trim(),
        address: warehouseForm.address.trim() || undefined,
      });
      return `Almacén ${created.code} creado.`;
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando existencias...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Almacenes y existencias</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Saldos por almacén calculados a partir del libro de movimientos</Text>
        </View>
        <View style={styles.actions}>
          {canCreateWarehouse ? <ActionButton label="+ Almacén" onPress={() => openPanel('warehouse')} variant="secondary" theme={t} /> : null}
          {canTransfer ? <ActionButton label="Transferir" onPress={() => openPanel('transfer')} variant="secondary" theme={t} /> : null}
          {canMove && allowedTypes.length > 0 ? <ActionButton label="Registrar movimiento" onPress={() => openPanel('movement')} theme={t} /> : null}
        </View>
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      <View style={styles.kpis}>
        <Kpi label="Almacenes activos" value={String(activeWarehouses.length)} theme={t} />
        <Kpi label="Productos con existencia" value={String(productTotals.size)} theme={t} />
        <Kpi label="Bajo stock mínimo" value={String(belowMinimum.length)} tone={belowMinimum.length > 0 ? 'warning' : undefined} theme={t} />
        <Kpi label="Movimientos registrados" value={String(movementTotal)} theme={t} />
      </View>

      {panel === 'movement' ? (
        <FormCard title="Registrar movimiento" onClose={() => setPanel('none')} theme={t}>
          <Field label="Tipo" theme={t}>
            <select value={movementForm.type} onChange={(e) => editMovement('type', e.target.value as ManualStockMovementType)} style={select}>
              {allowedTypes.map((type) => <option key={type} value={type}>{STOCK_MOVEMENT_LABELS[type]}</option>)}
            </select>
          </Field>
          <Field label="Producto" theme={t}>
            <select value={movementForm.productId} onChange={(e) => editMovement('productId', e.target.value)} style={select}>
              <option value="">Selecciona un producto</option>
              {stockableProducts.map((p) => <option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Almacén" theme={t}>
            <select value={movementForm.warehouseId} onChange={(e) => editMovement('warehouseId', e.target.value)} style={select}>
              <option value="">Selecciona un almacén</option>
              {activeWarehouses.map((w) => <option key={w._id} value={w._id}>{w.code} · {w.name}</option>)}
            </select>
          </Field>
          <Field label="Cantidad" theme={t}>
            <TextInput value={movementForm.quantity} onChangeText={(v: string) => editMovement('quantity', v)} placeholder="0" style={input} />
          </Field>
          <Field label="Referencia" theme={t}>
            <TextInput value={movementForm.reference} onChangeText={(v: string) => editMovement('reference', v)} placeholder="Folio, remisión..." style={input} />
          </Field>
          <Field label="Notas" theme={t}>
            <TextInput value={movementForm.notes} onChangeText={(v: string) => editMovement('notes', v)} placeholder="Motivo del movimiento" style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={submitMovement} label="Registrar" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'transfer' ? (
        <FormCard title="Transferir entre almacenes" onClose={() => setPanel('none')} theme={t}>
          <Field label="Producto" theme={t}>
            <select value={transferForm.productId} onChange={(e) => editTransfer('productId', e.target.value)} style={select}>
              <option value="">Selecciona un producto</option>
              {stockableProducts.map((p) => <option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Origen" theme={t}>
            <select value={transferForm.fromWarehouseId} onChange={(e) => editTransfer('fromWarehouseId', e.target.value)} style={select}>
              <option value="">Almacén de origen</option>
              {activeWarehouses.map((w) => <option key={w._id} value={w._id}>{w.code} · {w.name}</option>)}
            </select>
          </Field>
          <Field label="Destino" theme={t}>
            <select value={transferForm.toWarehouseId} onChange={(e) => editTransfer('toWarehouseId', e.target.value)} style={select}>
              <option value="">Almacén de destino</option>
              {activeWarehouses.map((w) => <option key={w._id} value={w._id}>{w.code} · {w.name}</option>)}
            </select>
          </Field>
          <Field label="Cantidad" theme={t}>
            <TextInput value={transferForm.quantity} onChangeText={(v: string) => editTransfer('quantity', v)} placeholder="0" style={input} />
          </Field>
          <Field label="Referencia" theme={t}>
            <TextInput value={transferForm.reference} onChangeText={(v: string) => editTransfer('reference', v)} placeholder="Opcional" style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={submitTransfer} label="Transferir" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'warehouse' ? (
        <FormCard title="Nuevo almacén" onClose={() => setPanel('none')} theme={t}>
          <Field label="Código" theme={t}>
            <TextInput value={warehouseForm.code} onChangeText={(v: string) => setWarehouseForm((f) => ({ ...f, code: v }))} placeholder="ALM-01" style={input} />
          </Field>
          <Field label="Nombre" theme={t}>
            <TextInput value={warehouseForm.name} onChangeText={(v: string) => setWarehouseForm((f) => ({ ...f, name: v }))} placeholder="Almacén principal" style={input} />
          </Field>
          <Field label="Dirección" theme={t}>
            <TextInput value={warehouseForm.address} onChangeText={(v: string) => setWarehouseForm((f) => ({ ...f, address: v }))} placeholder="Opcional" style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={submitWarehouse} label="Crear almacén" theme={t} />
        </FormCard>
      ) : null}

      <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} style={{ ...select, minWidth: 240 }}>
          <option value="">Todos los almacenes</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.code} · {w.name}{w.status === 'ACTIVE' ? '' : ' (inactivo)'}</option>)}
        </select>
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar producto por nombre o SKU..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
        <TouchableOpacity onPress={() => { setLoading(true); void loadData(); }}>
          <Text style={[styles.link, { color: c.info }]}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      <Section title="Existencias" theme={t}>
        {visibleBalances.length === 0 ? (
          <Empty text={activeWarehouses.length === 0 ? 'Crea un almacén para empezar a registrar existencias.' : 'No hay existencias con los filtros actuales.'} theme={t} />
        ) : (
          <Table
            theme={t}
            columns={['Producto', 'Almacén', 'Cantidad', 'Estado']}
            rows={visibleBalances.map((b) => {
              const p = productById.get(b.productId);
              const total = productTotals.get(b.productId) ?? 0;
              const low = Boolean(p && p.minimumStock > 0 && total < p.minimumStock);
              return {
                key: b._id,
                cells: [productLabel(b.productId), warehouseLabel(b.warehouseId), `${formatQuantity(b.quantity)} ${p?.unit ?? ''}`, low ? `Bajo mínimo (${formatQuantity(total)}/${p?.minimumStock})` : 'OK'],
                tone: low ? 'warning' : undefined,
              };
            })}
          />
        )}
      </Section>

      <Section title={`Movimientos recientes (${movements.length} de ${movementTotal})`} theme={t}>
        {movements.length === 0 ? (
          <Empty text="Aún no hay movimientos." theme={t} />
        ) : (
          <Table
            theme={t}
            columns={['Fecha', 'Tipo', 'Producto', 'Almacén', 'Cantidad', 'Saldo', 'Referencia']}
            rows={movements.map((m) => ({
              key: m._id,
              cells: [
                new Date(m.createdAt).toLocaleString('es-MX'),
                STOCK_MOVEMENT_LABELS[m.type],
                productLabel(m.productId),
                warehouseLabel(m.warehouseId),
                `${m.direction === 'IN' ? '+' : '−'}${formatQuantity(m.quantity)}`,
                formatQuantity(m.balanceAfter),
                m.source.reference ?? (m.source.type === 'MANUAL' ? '—' : m.source.type),
              ],
            }))}
          />
        )}
      </Section>
    </ScrollView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function ActionButton({ label, onPress, variant = 'primary', theme }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, variant === 'primary' ? { backgroundColor: c.primary } : { borderWidth: 1, borderColor: c.borderStrong }]}
    >
      <Text style={[styles.buttonText, { color: variant === 'primary' ? '#FFFFFF' : c.textPrimary }]}>{label}</Text>
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

function Kpi({ label, value, tone, theme }: { label: string; value: string; tone?: 'warning'; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: tone === 'warning' ? c.warning : c.borderStrong }]}>
      <Text style={[styles.kpiValue, { color: tone === 'warning' ? c.warning : c.textPrimary }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>{label}</Text>
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

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: ThemeT }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>{title}</Text>
      {children}
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

function Table({ columns, rows, theme }: { columns: string[]; rows: Array<{ key: string; cells: string[]; tone?: 'warning' }>; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.table, { borderColor: c.borderStrong }]}>
      <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
        {columns.map((col) => (
          <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
          {row.cells.map((cell, i) => (
            <Text key={i} style={[styles.cell, { color: row.tone === 'warning' && i === row.cells.length - 1 ? c.warning : c.textPrimary }]}>{cell}</Text>
          ))}
        </View>
      ))}
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
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  banner: { padding: 14, borderRadius: 10, borderWidth: 1 },
  kpis: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  kpi: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderRadius: 14, padding: 18 },
  kpiValue: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { marginTop: 4, fontSize: 13 },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 22 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: '30%', minWidth: 220, gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  toolbar: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 220 },
  link: { fontSize: 14, fontWeight: '700' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 28, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
});
