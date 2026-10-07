/**
 * Mantenimiento (Web): activos y órdenes de mantenimiento preventivo/correctivo.
 *
 * Usa el cliente compartido packages/types/src/maintenance.ts (nuevo en esta
 * fase). El backend es quien impone permisos y transiciones; esta pantalla
 * solo oculta botones que el servidor rechazaría. Mobile cubre lo mismo con
 * DTOs propios en apps/mobile/src/lib/api.ts; migrarlo al cliente
 * compartido queda para un cambio dedicado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, loadSession, maintenanceApi } from '../lib/api';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  ASSET_STATUS,
  MAINTENANCE_ORDER_STATUS,
  MAINTENANCE_PRIORITY,
  MAINTENANCE_TYPE,
  describeMaintenanceError,
  maintenanceOrderActions,
  type Asset,
  type AssetStatus,
  type MaintenanceOrder,
  type MaintenanceOrderStatus,
  type MaintenancePriority,
  type MaintenanceType,
  type Tone,
} from '../../../../packages/types/src/maintenance';

type Tab = 'orders' | 'assets';
type Panel = 'none' | 'asset' | 'order';

const STATUS_FILTERS: Array<{ id: MaintenanceOrderStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'OPEN', label: 'Abierta' },
  { id: 'IN_PROGRESS', label: 'En curso' },
  { id: 'ON_HOLD', label: 'En espera' },
  { id: 'COMPLETED', label: 'Completada' },
  { id: 'CANCELLED', label: 'Cancelada' },
];

interface AssetForm {
  code: string;
  name: string;
  type: string;
  location: string;
  responsible: string;
  notes: string;
}

const EMPTY_ASSET_FORM: AssetForm = { code: '', name: '', type: '', location: '', responsible: '', notes: '' };

interface OrderForm {
  assetId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description: string;
  scheduledFor: string;
  cost: string;
  assignedTo: string;
}

const EMPTY_ORDER_FORM: OrderForm = { assetId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', scheduledFor: '', cost: '0', assignedTo: '' };

export function MaintenanceScreen({ initialTab = 'orders' }: { initialTab?: Tab }) {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();
  const canCreate = hasPermission(permissions, 'maintenance.create');
  const canUpdate = hasPermission(permissions, 'maintenance.update');
  const canDelete = hasPermission(permissions, 'maintenance.delete');

  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<MaintenanceOrderStatus | 'ALL'>('ALL');
  const [assetSearch, setAssetSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const [panel, setPanel] = useState<Panel>('none');
  const [assetForm, setAssetForm] = useState<AssetForm>(EMPTY_ASSET_FORM);
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER_FORM);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);
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
      const [assetPage, orderPage] = await Promise.all([
        maintenanceApi.listAssets(session.accessToken),
        maintenanceApi.listOrders(session.accessToken, { status: statusFilter === 'ALL' ? undefined : statusFilter, limit: 100 }),
      ]);
      setAssets(assetPage.items);
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

  const assetById = useMemo(() => new Map(assets.map((a) => [a._id, a])), [assets]);
  const activeAssets = assets.filter((a) => a.status === 'ACTIVE');
  const assetLabel = (id: string) => {
    const a = assetById.get(id);
    return a ? `${a.code} · ${a.name}` : 'Activo no disponible';
  };

  const visibleAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [assets, assetSearch]);

  const visibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => o.title.toLowerCase().includes(q) || assetLabel(o.assetId).toLowerCase().includes(q));
  }, [orders, orderSearch, assetById]);

  // ---- Assets -------------------------------------------------------------

  const openAssetForm = () => {
    setError('');
    setNotice('');
    setAssetForm(EMPTY_ASSET_FORM);
    setPanel('asset');
  };

  const submitAsset = async () => {
    if (!assetForm.code.trim()) return setError('Ingresa el código del activo.');
    if (!assetForm.name.trim()) return setError('Ingresa el nombre del activo.');
    if (!assetForm.type.trim()) return setError('Ingresa el tipo de activo (ej. Hiladora, Torno).');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await maintenanceApi.createAsset(session.accessToken, {
        code: assetForm.code.trim(),
        name: assetForm.name.trim(),
        type: assetForm.type.trim(),
        location: assetForm.location.trim() || undefined,
        responsible: assetForm.responsible.trim() || undefined,
        notes: assetForm.notes.trim() || undefined,
      });
      setPanel('none');
      setNotice(`Activo ${created.code} registrado.`);
      await loadAll();
    } catch (err) {
      setError(describeMaintenanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleAssetStatus = async (asset: Asset) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (asset.status === 'RETIRED' || asset.status === 'OUT_OF_SERVICE') {
        await maintenanceApi.updateAsset(session.accessToken, asset._id, { status: 'ACTIVE', expectedVersion: asset.version });
      } else {
        await maintenanceApi.retireAsset(session.accessToken, asset._id);
      }
      await loadAll();
    } catch (err) {
      setError(describeMaintenanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Orders ---------------------------------------------------------------

  const openOrderForm = () => {
    setError('');
    setNotice('');
    setOrderForm(EMPTY_ORDER_FORM);
    setPanel('order');
  };

  const submitOrder = async () => {
    if (!orderForm.assetId) return setError('Selecciona el activo a intervenir.');
    if (!orderForm.title.trim()) return setError('Ingresa el título de la orden.');
    const cost = Number(orderForm.cost || '0');
    if (!Number.isFinite(cost) || cost < 0) return setError('El costo debe ser mayor o igual a 0.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await maintenanceApi.createOrder(session.accessToken, {
        assetId: orderForm.assetId,
        type: orderForm.type,
        priority: orderForm.priority,
        title: orderForm.title.trim(),
        description: orderForm.description.trim() || undefined,
        scheduledFor: orderForm.scheduledFor.trim() || undefined,
        cost,
        assignedTo: orderForm.assignedTo.trim() || undefined,
      });
      setPanel('none');
      setNotice(`Orden "${created.title}" creada.`);
      await loadAll();
    } catch (err) {
      setError(describeMaintenanceError(err) ?? friendlyMessage(err));
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
      const order = await maintenanceApi.getOrder(session.accessToken, id);
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

  const transition = async (to: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED') => {
    if (!selectedOrder) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const updated = await maintenanceApi.transitionOrder(session.accessToken, selectedOrder._id, to, selectedOrder.version);
      setSelectedOrder(updated);
      setNotice(`Orden "${updated.title}": ${MAINTENANCE_ORDER_STATUS[updated.status].label}.`);
      await loadAll();
    } catch (err) {
      setError(describeMaintenanceError(err) ?? friendlyMessage(err));
      await openDetail(selectedOrder._id);
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('¿Confirmas cancelar esta orden de mantenimiento?')) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const updated = await maintenanceApi.cancelOrder(session.accessToken, selectedOrder._id);
      setSelectedOrder(updated);
      setNotice(`Orden "${updated.title}" cancelada.`);
      await loadAll();
    } catch (err) {
      setError(describeMaintenanceError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando mantenimiento...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };
  const selectedActions = selectedOrder ? maintenanceOrderActions(selectedOrder, permissions) : [];
  const selectedMeta = selectedOrder ? MAINTENANCE_ORDER_STATUS[selectedOrder.status] : null;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Mantenimiento</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Activos y órdenes de mantenimiento</Text>
        </View>
        <View style={styles.actions}>
          {tab === 'assets' && canCreate ? <ActionButton label="+ Activo" onPress={openAssetForm} theme={t} /> : null}
          {tab === 'orders' && canCreate ? <ActionButton label="+ Nueva orden" onPress={openOrderForm} theme={t} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton label={`Órdenes (${ordersTotal})`} active={tab === 'orders'} onPress={() => { setTab('orders'); closeDetail(); }} theme={t} />
        <TabButton label={`Activos (${assets.length})`} active={tab === 'assets'} onPress={() => setTab('assets')} theme={t} />
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'asset' ? (
        <FormCard title="Nuevo activo" onClose={() => setPanel('none')} theme={t}>
          <Field label="Código *" theme={t}>
            <TextInput value={assetForm.code} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, code: v }))} placeholder="ACT-01" style={input} />
          </Field>
          <Field label="Nombre *" theme={t}>
            <TextInput value={assetForm.name} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, name: v }))} style={input} />
          </Field>
          <Field label="Tipo *" theme={t}>
            <TextInput value={assetForm.type} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, type: v }))} placeholder="Hiladora, Torno..." style={input} />
          </Field>
          <Field label="Ubicación" theme={t}>
            <TextInput value={assetForm.location} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, location: v }))} style={input} />
          </Field>
          <Field label="Responsable" theme={t}>
            <TextInput value={assetForm.responsible} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, responsible: v }))} style={input} />
          </Field>
          <Field label="Notas" theme={t}>
            <TextInput value={assetForm.notes} onChangeText={(v: string) => setAssetForm((f) => ({ ...f, notes: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitAsset()} label="Crear activo" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'order' ? (
        <FormCard title="Nueva orden de mantenimiento" onClose={() => setPanel('none')} theme={t}>
          <Field label="Activo *" theme={t}>
            <select value={orderForm.assetId} onChange={(e) => setOrderForm((f) => ({ ...f, assetId: e.target.value }))} style={select}>
              <option value="">Selecciona un activo</option>
              {activeAssets.map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo" theme={t}>
            <select value={orderForm.type} onChange={(e) => setOrderForm((f) => ({ ...f, type: e.target.value as MaintenanceType }))} style={select}>
              <option value="CORRECTIVE">{MAINTENANCE_TYPE.CORRECTIVE}</option>
              <option value="PREVENTIVE">{MAINTENANCE_TYPE.PREVENTIVE}</option>
            </select>
          </Field>
          <Field label="Prioridad" theme={t}>
            <select value={orderForm.priority} onChange={(e) => setOrderForm((f) => ({ ...f, priority: e.target.value as MaintenancePriority }))} style={select}>
              {(Object.keys(MAINTENANCE_PRIORITY) as MaintenancePriority[]).map((p) => <option key={p} value={p}>{MAINTENANCE_PRIORITY[p].label}</option>)}
            </select>
          </Field>
          <Field label="Título *" theme={t}>
            <TextInput value={orderForm.title} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, title: v }))} style={input} />
          </Field>
          <Field label="Programada" theme={t}>
            <TextInput value={orderForm.scheduledFor} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, scheduledFor: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Costo estimado" theme={t}>
            <TextInput value={orderForm.cost} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, cost: v }))} style={input} />
          </Field>
          <Field label="Asignado a" theme={t}>
            <TextInput value={orderForm.assignedTo} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, assignedTo: v }))} style={input} />
          </Field>
          <Field label="Descripción" theme={t}>
            <TextInput value={orderForm.description} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, description: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitOrder()} label="Crear orden" theme={t} />
        </FormCard>
      ) : null}

      {tab === 'assets' ? (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={assetSearch} onChangeText={setAssetSearch} placeholder="Buscar por nombre o código..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
            <Text style={[styles.count, { color: c.textSecondary }]}>{visibleAssets.length} activos</Text>
          </View>

          {visibleAssets.length === 0 ? (
            <Empty text="No hay activos con ese criterio." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Activo', 'Tipo', 'Ubicación', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleAssets.map((a) => {
                const meta = ASSET_STATUS[a.status as AssetStatus];
                const canToggle = a.status === 'ACTIVE' ? canDelete : canUpdate;
                return (
                  <View key={a._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{a.code} · {a.name}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{a.type}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{a.location || '—'}</Text>
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    <TouchableOpacity disabled={saving || !canToggle || a.status === 'IN_MAINTENANCE'} onPress={() => void toggleAssetStatus(a)}>
                      <Text style={[styles.cell, { color: a.status === 'ACTIVE' ? c.danger : c.success }]}>
                        {a.status === 'ACTIVE' ? 'Retirar' : a.status === 'IN_MAINTENANCE' ? '—' : 'Reactivar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={orderSearch} onChangeText={setOrderSearch} placeholder="Buscar por título o activo..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MaintenanceOrderStatus | 'ALL')} style={{ ...select, minWidth: 200 }}>
              {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </View>

          {selectedOrderId ? (
            <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, { color: c.textPrimary }]}>{selectedOrder ? selectedOrder.title : 'Orden de mantenimiento'}</Text>
                <TouchableOpacity onPress={closeDetail}>
                  <Text style={{ color: c.textSecondary, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {detailLoading || !selectedOrder || !selectedMeta ? (
                <Text style={{ color: c.textSecondary }}>Cargando orden...</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  <View style={styles.detailHeader}>
                    <View>
                      <Text style={{ color: c.textSecondary }}>
                        {MAINTENANCE_TYPE[selectedOrder.type]} · Prioridad {MAINTENANCE_PRIORITY[selectedOrder.priority].label}
                      </Text>
                      {selectedOrder.description ? <Text style={{ color: c.textSecondary, marginTop: 4 }}>{selectedOrder.description}</Text> : null}
                    </View>
                    <StatusPill label={selectedMeta.label} tone={selectedMeta.tone} theme={t} />
                  </View>

                  <Section title="Asignación" theme={t}>
                    <Text style={{ color: c.textSecondary }}>Activo: {assetLabel(selectedOrder.assetId)}</Text>
                    <Text style={{ color: c.textSecondary }}>Asignado a: {selectedOrder.assignedTo ?? 'Sin asignar'}</Text>
                    <Text style={{ color: c.textSecondary }}>Programada: {selectedOrder.scheduledFor ?? 'Sin fecha'}</Text>
                    <Text style={{ color: c.textSecondary }}>Costo: ${selectedOrder.cost.toFixed(2)}</Text>
                  </Section>

                  <View style={styles.actionsRow}>
                    {selectedActions.includes('START') ? <ActionButton label="Iniciar trabajo" onPress={() => void transition('IN_PROGRESS')} theme={t} /> : null}
                    {selectedActions.includes('HOLD') ? <ActionButton label="Pausar" onPress={() => void transition('ON_HOLD')} variant="secondary" theme={t} /> : null}
                    {selectedActions.includes('COMPLETE') ? <ActionButton label="Completar" onPress={() => void transition('COMPLETED')} theme={t} /> : null}
                    {selectedActions.includes('CANCEL') ? <ActionButton label="Cancelar orden" onPress={() => void cancelOrder()} variant="danger" theme={t} /> : null}
                  </View>

                  {selectedOrder.completedAt ? <Text style={{ color: c.textMuted, fontSize: 12 }}>Completada: {selectedOrder.completedAt}</Text> : null}
                </View>
              )}
            </View>
          ) : null}

          {visibleOrders.length === 0 ? (
            <Empty text="No hay órdenes de mantenimiento con los filtros actuales." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Orden', 'Activo', 'Tipo', 'Prioridad', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleOrders.map((o) => {
                const meta = MAINTENANCE_ORDER_STATUS[o.status];
                const priority = MAINTENANCE_PRIORITY[o.priority];
                return (
                  <View key={o._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{o.title}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{assetLabel(o.assetId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{MAINTENANCE_TYPE[o.type]}</Text>
                    <StatusPill label={priority.label} tone={priority.tone} theme={t} />
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    <TouchableOpacity onPress={() => void openDetail(o._id)}>
                      <Text style={[styles.cell, { color: c.info }]}>Ver</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
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
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
  tabText: { fontSize: 15, fontWeight: '700' },
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
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
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
