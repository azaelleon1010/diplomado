/**
 * Producción (Web): órdenes de producción contra el catálogo de inventario.
 *
 * Usa el cliente compartido packages/types/src/production.ts (nuevo en esta
 * fase). El backend es quien impone permisos y transiciones; esta pantalla
 * solo oculta botones que el servidor rechazaría. Mobile cubre lo mismo con
 * DTOs propios en apps/mobile/src/lib/api.ts; migrarlo al cliente
 * compartido queda para un cambio dedicado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, inventoryApi, loadSession, productionApi, type Product } from '../lib/api';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  PRODUCTION_ORDER_STATUS,
  describeProductionError,
  productionOrderActions,
  progressPercent,
  type ProductionOrder,
  type ProductionOrderStatus,
  type Tone,
} from '../../../../packages/types/src/production';

type Panel = 'none' | 'order';

const STATUS_FILTERS: Array<{ id: ProductionOrderStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'DRAFT', label: 'Borrador' },
  { id: 'RELEASED', label: 'Liberada' },
  { id: 'IN_PROGRESS', label: 'En proceso' },
  { id: 'PAUSED', label: 'Pausada' },
  { id: 'COMPLETED', label: 'Completada' },
  { id: 'CANCELLED', label: 'Cancelada' },
];

interface MaterialDraft {
  key: string;
  productId: string;
  quantityRequired: string;
}

interface OrderForm {
  code: string;
  productId: string;
  quantity: string;
  machine: string;
  responsible: string;
  dueDate: string;
  notes: string;
  materials: MaterialDraft[];
}

const EMPTY_FORM: OrderForm = { code: '', productId: '', quantity: '', machine: '', responsible: '', dueDate: '', notes: '', materials: [] };

let materialSeq = 0;

export function ProductionScreen() {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();
  const canCreate = hasPermission(permissions, 'production.create');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ProductionOrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const [panel, setPanel] = useState<Panel>('none');
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [materialProductId, setMaterialProductId] = useState('');
  const [materialQty, setMaterialQty] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [productList, orderPage] = await Promise.all([
        inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
        productionApi.listOrders(session.accessToken, { status: statusFilter === 'ALL' ? undefined : statusFilter, limit: 100 }),
      ]);
      setProducts(productList);
      setOrders(orderPage.items);
      setOrdersTotal(orderPage.total);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');
  const productLabel = (id: string) => {
    const p = productById.get(id);
    return p ? `${p.sku} · ${p.name}` : 'Producto no disponible';
  };

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => o.code.toLowerCase().includes(q) || productLabel(o.productId).toLowerCase().includes(q));
  }, [orders, search, productById]);

  const openForm = () => {
    setError('');
    setNotice('');
    setForm(EMPTY_FORM);
    setMaterialProductId('');
    setMaterialQty('');
    setPanel('order');
  };

  const addMaterial = () => {
    if (!materialProductId) return setError('Selecciona el material a consumir.');
    const qty = Number(materialQty);
    if (!Number.isFinite(qty) || qty <= 0) return setError('La cantidad requerida debe ser mayor a 0.');
    if (form.materials.some((m) => m.productId === materialProductId)) return setError('Ese material ya está en la lista.');
    materialSeq += 1;
    setError('');
    setForm((f) => ({ ...f, materials: [...f.materials, { key: `mat-${materialSeq}`, productId: materialProductId, quantityRequired: String(qty) }] }));
    setMaterialProductId('');
    setMaterialQty('');
  };

  const removeMaterial = (key: string) => setForm((f) => ({ ...f, materials: f.materials.filter((m) => m.key !== key) }));

  const submitOrder = async () => {
    if (!form.code.trim()) return setError('Ingresa el folio de la orden.');
    if (!form.productId) return setError('Selecciona el producto a fabricar.');
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError('La cantidad a producir debe ser mayor a 0.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await productionApi.createOrder(session.accessToken, {
        code: form.code.trim(),
        productId: form.productId,
        quantity: qty,
        machine: form.machine.trim() || undefined,
        responsible: form.responsible.trim() || undefined,
        dueDate: form.dueDate.trim() || undefined,
        notes: form.notes.trim() || undefined,
        materials: form.materials.map((m) => ({ productId: m.productId, quantityRequired: Number(m.quantityRequired) })),
      });
      setPanel('none');
      setNotice(`Orden ${created.code} creada.`);
      await loadAll();
    } catch (err) {
      setError(describeProductionError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = useCallback(async (id: string) => {
    setSelectedOrderId(id);
    setDetailLoading(true);
    setError('');
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setDetailLoading(false);
      return;
    }
    try {
      const order = await productionApi.getOrder(session.accessToken, id);
      setSelectedOrder(order);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
  };

  const transition = async (to: 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED') => {
    if (!selectedOrder) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const updated = await productionApi.transitionOrder(session.accessToken, selectedOrder._id, to, selectedOrder.version);
      setSelectedOrder(updated);
      setNotice(`Orden ${updated.code}: ${PRODUCTION_ORDER_STATUS[updated.status].label}.`);
      await loadAll();
    } catch (err) {
      setError(describeProductionError(err) ?? friendlyMessage(err));
      await openDetail(selectedOrder._id);
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('¿Confirmas cancelar esta orden de producción?')) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const updated = await productionApi.cancelOrder(session.accessToken, selectedOrder._id);
      setSelectedOrder(updated);
      setNotice(`Orden ${updated.code} cancelada.`);
      await loadAll();
    } catch (err) {
      setError(describeProductionError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando producción...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };
  const selectedActions = selectedOrder ? productionOrderActions(selectedOrder, permissions) : [];
  const selectedMeta = selectedOrder ? PRODUCTION_ORDER_STATUS[selectedOrder.status] : null;
  const progress = selectedOrder ? progressPercent(selectedOrder) : 0;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Producción</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Órdenes de producción y consumo de materiales</Text>
        </View>
        {canCreate ? <ActionButton label="+ Nueva orden" onPress={openForm} theme={t} /> : null}
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'order' ? (
        <FormCard title="Nueva orden de producción" onClose={() => setPanel('none')} theme={t}>
          <Field label="Folio *" theme={t}>
            <TextInput value={form.code} onChangeText={(v: string) => setForm((f) => ({ ...f, code: v }))} placeholder="OP-1001" style={input} />
          </Field>
          <Field label="Producto a fabricar *" theme={t}>
            <select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} style={select}>
              <option value="">Selecciona un producto</option>
              {activeProducts.map((p) => <option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Cantidad a producir *" theme={t}>
            <TextInput value={form.quantity} onChangeText={(v: string) => setForm((f) => ({ ...f, quantity: v }))} placeholder="0" style={input} />
          </Field>
          <Field label="Máquina" theme={t}>
            <TextInput value={form.machine} onChangeText={(v: string) => setForm((f) => ({ ...f, machine: v }))} style={input} />
          </Field>
          <Field label="Responsable" theme={t}>
            <TextInput value={form.responsible} onChangeText={(v: string) => setForm((f) => ({ ...f, responsible: v }))} style={input} />
          </Field>
          <Field label="Fecha compromiso" theme={t}>
            <TextInput value={form.dueDate} onChangeText={(v: string) => setForm((f) => ({ ...f, dueDate: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Notas" theme={t}>
            <TextInput value={form.notes} onChangeText={(v: string) => setForm((f) => ({ ...f, notes: v }))} style={input} />
          </Field>

          <View style={styles.fieldFull}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Materiales a consumir</Text>
            <View style={styles.lineRow}>
              <select value={materialProductId} onChange={(e) => setMaterialProductId(e.target.value)} style={{ ...select, flex: 2, minWidth: 220 }}>
                <option value="">Selecciona un material</option>
                {activeProducts.map((p) => <option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}
              </select>
              <TextInput value={materialQty} onChangeText={setMaterialQty} placeholder="Cantidad requerida" style={[input, { flex: 1 }]} />
              <TouchableOpacity onPress={addMaterial} style={[styles.button, { backgroundColor: c.primary }]}>
                <Text style={styles.buttonText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            {form.materials.length === 0 ? (
              <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6 }}>Esta orden no requiere materiales registrados.</Text>
            ) : (
              <View style={[styles.table, { borderColor: c.borderStrong }]}>
                {form.materials.map((m) => (
                  <View key={m.key} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1 }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{productLabel(m.productId)}</Text>
                    <Text style={[styles.cell, { color: c.textPrimary }]}>{m.quantityRequired}</Text>
                    <TouchableOpacity onPress={() => removeMaterial(m.key)}>
                      <Text style={[styles.cell, { color: c.danger }]}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitOrder()} label="Crear orden" theme={t} />
        </FormCard>
      ) : null}

      <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar por folio o producto..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProductionOrderStatus | 'ALL')} style={{ ...select, minWidth: 200 }}>
          {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <Text style={[styles.count, { color: c.textSecondary }]}>{ordersTotal} órdenes</Text>
      </View>

      {selectedOrderId ? (
        <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: c.textPrimary }]}>{selectedOrder ? `Orden ${selectedOrder.code}` : 'Orden de producción'}</Text>
            <TouchableOpacity onPress={closeDetail}>
              <Text style={{ color: c.textSecondary, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {detailLoading || !selectedOrder || !selectedMeta ? (
            <Text style={{ color: c.textSecondary }}>Cargando orden...</Text>
          ) : (
            <View style={{ gap: 16 }}>
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '800' }}>{productLabel(selectedOrder.productId)}</Text>
                  <Text style={{ color: c.textSecondary, marginTop: 6 }}>
                    Progreso: {selectedOrder.producedQuantity}/{selectedOrder.quantity} ({progress}%)
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: c.background, borderColor: c.borderStrong }]}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: c.primary }]} />
                  </View>
                </View>
                <StatusPill label={selectedMeta.label} tone={selectedMeta.tone} theme={t} />
              </View>

              <Section title="Asignación" theme={t}>
                <Text style={{ color: c.textSecondary }}>Máquina: {selectedOrder.machine ?? 'Sin asignar'}</Text>
                <Text style={{ color: c.textSecondary }}>Responsable: {selectedOrder.responsible ?? 'Sin asignar'}</Text>
                <Text style={{ color: c.textSecondary }}>Compromiso: {selectedOrder.dueDate ?? 'Sin fecha'}</Text>
              </Section>

              <View style={styles.actionsRow}>
                {selectedActions.includes('RELEASE') ? <ActionButton label="Liberar orden" onPress={() => void transition('RELEASED')} theme={t} /> : null}
                {selectedActions.includes('START') ? <ActionButton label={selectedOrder.status === 'PAUSED' ? 'Reanudar' : 'Iniciar producción'} onPress={() => void transition('IN_PROGRESS')} theme={t} /> : null}
                {selectedActions.includes('PAUSE') ? <ActionButton label="Pausar" onPress={() => void transition('PAUSED')} variant="secondary" theme={t} /> : null}
                {selectedActions.includes('COMPLETE') ? <ActionButton label="Completar" onPress={() => void transition('COMPLETED')} theme={t} /> : null}
                {selectedActions.includes('CANCEL') ? <ActionButton label="Cancelar orden" onPress={() => void cancelOrder()} variant="danger" theme={t} /> : null}
              </View>

              <Section title={`Materiales (${selectedOrder.materials.length})`} theme={t}>
                {selectedOrder.materials.length === 0 ? (
                  <Empty text="Esta orden no registra consumo de materiales." theme={t} />
                ) : (
                  <View style={[styles.table, { borderColor: c.borderStrong }]}>
                    <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                      {['Material', 'Requerido', 'Consumido'].map((col) => (
                        <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                      ))}
                    </View>
                    {selectedOrder.materials.map((m) => (
                      <View key={m.productId} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1 }]}>
                        <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{productLabel(m.productId)}</Text>
                        <Text style={[styles.cell, { color: c.textPrimary }]}>{m.quantityRequired}</Text>
                        <Text style={[styles.cell, { color: c.textPrimary }]}>{m.quantityConsumed}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Section>
            </View>
          )}
        </View>
      ) : null}

      {visibleOrders.length === 0 ? (
        <Empty text="No hay órdenes de producción con los filtros actuales." theme={t} />
      ) : (
        <View style={[styles.table, { borderColor: c.borderStrong }]}>
          <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
            {['Folio', 'Producto', 'Avance', 'Estado', ''].map((col) => (
              <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
            ))}
          </View>
          {visibleOrders.map((o) => {
            const meta = PRODUCTION_ORDER_STATUS[o.status];
            return (
              <View key={o._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                <Text style={[styles.cell, { color: c.textPrimary }]}>{o.code}</Text>
                <Text style={[styles.cell, { color: c.textSecondary, flex: 2 }]}>{productLabel(o.productId)}</Text>
                <Text style={[styles.cell, { color: c.textSecondary }]}>{o.producedQuantity}/{o.quantity}</Text>
                <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                <TouchableOpacity onPress={() => void openDetail(o._id)}>
                  <Text style={[styles.cell, { color: c.info }]}>Ver</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function ActionButton({ label, onPress, variant = 'primary', theme }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; theme: ThemeT }) {
  const c = theme.semanticColors;
  const background = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : undefined;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, background ? { backgroundColor: background } : { borderWidth: 1, borderColor: c.borderStrong }]}>
      <Text style={[styles.buttonText, { color: background ? '#FFFFFF' : c.textPrimary }]}>{label}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 28, gap: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 5, fontSize: 14 },
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  banner: { padding: 14, borderRadius: 10, borderWidth: 1 },
  toolbar: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 220 },
  count: { fontSize: 14, fontWeight: '600' },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 22 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: '30%', minWidth: 220, gap: 7 },
  fieldFull: { width: '100%', gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  lineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  progressTrack: { height: 10, borderRadius: 999, borderWidth: 1, marginTop: 10, overflow: 'hidden', maxWidth: 360 },
  progressFill: { height: 10, borderRadius: 999 },
  actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  section: { gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginHorizontal: 4 },
  pillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
