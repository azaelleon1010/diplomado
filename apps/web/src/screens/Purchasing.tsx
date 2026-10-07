/**
 * Compras (Web): proveedores y órdenes de compra.
 *
 * Usa el mismo cliente compartido que Mobile (packages/types/src/purchasing),
 * así que las reglas de transición, permisos y mensajes de error son
 * idénticas en ambas plataformas; el backend es quien las impone de verdad.
 * Cubre lo que Mobile ya tiene: proveedores, órdenes (crear, enviar, aprobar,
 * cancelar) y recepción contra el libro de inventario. Solicitudes,
 * cotizaciones, facturas de proveedor y cuentas por pagar no tienen pantalla
 * todavía en ninguna plataforma.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, inventoryApi, loadSession, purchasingApi, stockApi, type Product } from '../lib/api';
import {
  formatQuantity,
  newIdempotencyKey,
  parseStockQuantity,
  type InventoryWarehouse,
} from '../../../../packages/types/src/inventory';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  ORDER_STATUS,
  describePurchasingError,
  formatMoney,
  orderActions,
  pendingToReceive,
  type GoodsReceipt,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type Supplier,
  type Tone,
} from '../../../../packages/types/src/purchasing';

type Tab = 'orders' | 'suppliers';
type Panel = 'none' | 'supplier' | 'order';

const STATUS_FILTERS: Array<{ id: PurchaseOrderStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'DRAFT', label: 'Borrador' },
  { id: 'SENT', label: 'Enviada' },
  { id: 'APPROVED', label: 'Aprobada' },
  { id: 'PARTIALLY_RECEIVED', label: 'Recepción parcial' },
  { id: 'RECEIVED', label: 'Recibida' },
  { id: 'CANCELLED', label: 'Cancelada' },
];

interface SupplierForm {
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
}

const EMPTY_SUPPLIER_FORM: SupplierForm = { code: '', name: '', contactName: '', email: '', phone: '', address: '', taxId: '' };

interface OrderLineDraft {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
}

interface OrderForm {
  folio: string;
  supplierId: string;
  expectedDate: string;
  notes: string;
  lines: OrderLineDraft[];
}

const EMPTY_ORDER_FORM: OrderForm = { folio: '', supplierId: '', expectedDate: '', notes: '', lines: [] };

let lineSeq = 0;

export function PurchasingScreen({ initialTab = 'orders' }: { initialTab?: Tab }) {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();

  const canCreate = hasPermission(permissions, 'purchasing.create');
  const canUpdate = hasPermission(permissions, 'purchasing.update');
  const canDelete = hasPermission(permissions, 'purchasing.delete');

  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const [panel, setPanel] = useState<Panel>('none');
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER_FORM);
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER_FORM);
  const [lineProductId, setLineProductId] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [lineCost, setLineCost] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderReceipts, setOrderReceipts] = useState<GoodsReceipt[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [receiveNotes, setReceiveNotes] = useState('');
  const [operationKey, setOperationKey] = useState(() => newIdempotencyKey('web'));

  const loadBase = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [supplierPage, productList, warehousePage, orderPage] = await Promise.all([
        purchasingApi.listSuppliers(session.accessToken),
        inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
        stockApi.listWarehouses(session.accessToken).catch(() => ({ items: [] as InventoryWarehouse[] })),
        purchasingApi.listOrders(session.accessToken, {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 100,
        }),
      ]);
      setSuppliers(supplierPage.items);
      setProducts(productList);
      setWarehouses(warehousePage.items);
      setOrders(orderPage.items);
      setOrdersTotal(orderPage.total);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s._id, s])), [suppliers]);
  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');
  const activeWarehouses = warehouses.filter((w) => w.status === 'ACTIVE');

  const visibleSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  const visibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const supplier = supplierById.get(o.supplierId);
      return o.folio.toLowerCase().includes(q) || Boolean(supplier && supplier.name.toLowerCase().includes(q));
    });
  }, [orders, orderSearch, supplierById]);

  const supplierLabel = (id: string) => {
    const s = supplierById.get(id);
    return s ? `${s.code} · ${s.name}` : 'Proveedor no disponible';
  };
  const productLabel = (id: string) => {
    const p = productById.get(id);
    return p ? `${p.sku} · ${p.name}` : 'Producto no disponible';
  };

  // ---- Suppliers --------------------------------------------------------

  const openSupplierForm = () => {
    setError('');
    setNotice('');
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setPanel('supplier');
  };

  const submitSupplier = async () => {
    if (!supplierForm.code.trim() || supplierForm.name.trim().length < 2) {
      setError('Código y nombre (mínimo 2 caracteres) son obligatorios.');
      return;
    }
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await purchasingApi.createSupplier(session.accessToken, {
        code: supplierForm.code.trim(),
        name: supplierForm.name.trim(),
        contactName: supplierForm.contactName.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        taxId: supplierForm.taxId.trim() || undefined,
      });
      setPanel('none');
      setNotice(`Proveedor ${created.code} creado.`);
      await loadBase();
    } catch (err) {
      setError(describePurchasingError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleSupplierStatus = async (supplier: Supplier) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (supplier.status === 'ACTIVE') {
        await purchasingApi.deactivateSupplier(session.accessToken, supplier._id);
      } else {
        await purchasingApi.updateSupplier(session.accessToken, supplier._id, {
          status: 'ACTIVE',
          expectedVersion: supplier.version,
        });
      }
      await loadBase();
    } catch (err) {
      setError(describePurchasingError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Orders -------------------------------------------------------------

  const openOrderForm = () => {
    setError('');
    setNotice('');
    setOrderForm(EMPTY_ORDER_FORM);
    setLineProductId('');
    setLineQty('');
    setLineCost('');
    setPanel('order');
  };

  const addOrderLine = () => {
    if (!lineProductId) return setError('Selecciona el producto de la línea.');
    const qty = Number(lineQty);
    const cost = Number(lineCost);
    if (!Number.isFinite(qty) || qty <= 0) return setError('La cantidad debe ser mayor a 0.');
    if (!Number.isFinite(cost) || cost < 0) return setError('El costo debe ser mayor o igual a 0.');
    if (orderForm.lines.some((l) => l.productId === lineProductId)) return setError('Ese producto ya está en la orden.');
    lineSeq += 1;
    setError('');
    setOrderForm((f) => ({ ...f, lines: [...f.lines, { key: `line-${lineSeq}`, productId: lineProductId, quantity: String(qty), unitCost: String(cost) }] }));
    setLineProductId('');
    setLineQty('');
    setLineCost('');
  };

  const removeOrderLine = (key: string) => {
    setOrderForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }));
  };

  const orderSubtotal = orderForm.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);

  const submitOrder = async () => {
    if (!orderForm.folio.trim()) return setError('Ingresa el folio de la orden.');
    if (!orderForm.supplierId) return setError('Selecciona el proveedor.');
    if (orderForm.lines.length === 0) return setError('Agrega al menos una línea a la orden.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await purchasingApi.createOrder(session.accessToken, {
        folio: orderForm.folio.trim(),
        supplierId: orderForm.supplierId,
        expectedDate: orderForm.expectedDate.trim() || undefined,
        notes: orderForm.notes.trim() || undefined,
        lines: orderForm.lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
      });
      setPanel('none');
      setNotice(`Orden ${created.folio} creada por ${formatMoney(created.subtotal)}.`);
      await loadBase();
    } catch (err) {
      setError(describePurchasingError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openOrderDetail = useCallback(async (id: string) => {
    setSelectedOrderId(id);
    setReceivePanelOpen(false);
    setDetailLoading(true);
    setError('');
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setDetailLoading(false);
      return;
    }
    try {
      const [order, receiptPage] = await Promise.all([
        purchasingApi.getOrder(session.accessToken, id),
        purchasingApi.listReceipts(session.accessToken, { purchaseOrderId: id }).catch(() => ({ items: [] as GoodsReceipt[] })),
      ]);
      setSelectedOrder(order);
      setOrderReceipts(receiptPage.items);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setOrderReceipts([]);
    setReceivePanelOpen(false);
  };

  const transitionOrder = async (to: 'SENT' | 'APPROVED' | 'CANCELLED') => {
    if (!selectedOrder) return;
    if (to === 'CANCELLED' && !window.confirm('¿Confirmas cancelar esta orden de compra?')) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const updated = await purchasingApi.transitionOrder(session.accessToken, selectedOrder._id, to, selectedOrder.version);
      setSelectedOrder(updated);
      setNotice(`Orden ${updated.folio}: ${ORDER_STATUS[updated.status].label}.`);
      await loadBase();
    } catch (err) {
      setError(describePurchasingError(err) ?? friendlyMessage(err));
      await openOrderDetail(selectedOrder._id);
    } finally {
      setSaving(false);
    }
  };

  const openReceivePanel = () => {
    if (!selectedOrder) return;
    setError('');
    setReceiveWarehouseId(activeWarehouses.length === 1 ? activeWarehouses[0]!._id : '');
    setReceiveQuantities(
      Object.fromEntries(selectedOrder.lines.map((l) => [l.productId, pendingToReceive(l) > 0 ? String(pendingToReceive(l)) : '0'])),
    );
    setReceiveNotes('');
    setOperationKey(newIdempotencyKey('web'));
    setReceivePanelOpen(true);
  };

  const submitReceive = async () => {
    if (!selectedOrder) return;
    if (!receiveWarehouseId) return setError('Selecciona el almacén donde entra la mercancía.');
    const pendingLines = selectedOrder.lines.filter((l) => pendingToReceive(l) > 0);
    const lines: Array<{ productId: string; quantity: number }> = [];
    for (const line of pendingLines) {
      const raw = (receiveQuantities[line.productId] ?? '').trim();
      if (raw === '' || raw === '0') continue;
      const qty = parseStockQuantity(raw);
      if (qty === undefined) return setError(`Cantidad inválida para ${productLabel(line.productId)}.`);
      if (qty > pendingToReceive(line)) return setError(`${productLabel(line.productId)}: excede lo pendiente (${formatQuantity(pendingToReceive(line))}).`);
      lines.push({ productId: line.productId, quantity: qty });
    }
    if (lines.length === 0) return setError('Captura al menos una cantidad recibida.');

    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const result = await purchasingApi.receiveOrder(session.accessToken, selectedOrder._id, {
        warehouseId: receiveWarehouseId,
        lines,
        notes: receiveNotes.trim() || undefined,
        idempotencyKey: operationKey,
      });
      setNotice(`Recepción ${result.receipt.folio} registrada. Orden: ${ORDER_STATUS[result.order.status].label}.`);
      setReceivePanelOpen(false);
      await loadBase();
      await openOrderDetail(selectedOrder._id);
    } catch (err) {
      setError(describePurchasingError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando compras...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };
  const selectedActions = selectedOrder ? orderActions(selectedOrder, permissions) : [];
  const selectedMeta = selectedOrder ? ORDER_STATUS[selectedOrder.status] : null;
  const selectedSupplier = selectedOrder ? supplierById.get(selectedOrder.supplierId) : undefined;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Compras</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Proveedores, órdenes de compra y recepción</Text>
        </View>
        <View style={styles.actions}>
          {tab === 'suppliers' && canCreate ? <ActionButton label="+ Proveedor" onPress={openSupplierForm} theme={t} /> : null}
          {tab === 'orders' && canCreate ? <ActionButton label="+ Nueva orden" onPress={openOrderForm} theme={t} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton label={`Órdenes (${ordersTotal})`} active={tab === 'orders'} onPress={() => { setTab('orders'); closeDetail(); }} theme={t} />
        <TabButton label={`Proveedores (${suppliers.length})`} active={tab === 'suppliers'} onPress={() => setTab('suppliers')} theme={t} />
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'supplier' ? (
        <FormCard title="Nuevo proveedor" onClose={() => setPanel('none')} theme={t}>
          <Field label="Código *" theme={t}>
            <TextInput value={supplierForm.code} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, code: v }))} placeholder="PROV-01" style={input} />
          </Field>
          <Field label="Nombre *" theme={t}>
            <TextInput value={supplierForm.name} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, name: v }))} placeholder="Aceros del Norte" style={input} />
          </Field>
          <Field label="Contacto" theme={t}>
            <TextInput value={supplierForm.contactName} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, contactName: v }))} style={input} />
          </Field>
          <Field label="Correo" theme={t}>
            <TextInput value={supplierForm.email} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, email: v }))} placeholder="contacto@proveedor.mx" style={input} />
          </Field>
          <Field label="Teléfono" theme={t}>
            <TextInput value={supplierForm.phone} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, phone: v }))} style={input} />
          </Field>
          <Field label="RFC / Tax ID" theme={t}>
            <TextInput value={supplierForm.taxId} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, taxId: v }))} style={input} />
          </Field>
          <Field label="Dirección" theme={t}>
            <TextInput value={supplierForm.address} onChangeText={(v: string) => setSupplierForm((f) => ({ ...f, address: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitSupplier()} label="Crear proveedor" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'order' ? (
        <FormCard title="Nueva orden de compra" onClose={() => setPanel('none')} theme={t}>
          <Field label="Folio *" theme={t}>
            <TextInput value={orderForm.folio} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, folio: v }))} placeholder="OC-1001" style={input} />
          </Field>
          <Field label="Proveedor *" theme={t}>
            <select value={orderForm.supplierId} onChange={(e) => setOrderForm((f) => ({ ...f, supplierId: e.target.value }))} style={select}>
              <option value="">Selecciona un proveedor</option>
              {activeSuppliers.map((s) => <option key={s._id} value={s._id}>{s.code} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="Fecha esperada" theme={t}>
            <TextInput value={orderForm.expectedDate} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, expectedDate: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Notas" theme={t}>
            <TextInput value={orderForm.notes} onChangeText={(v: string) => setOrderForm((f) => ({ ...f, notes: v }))} style={input} />
          </Field>

          <View style={styles.fieldFull}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Líneas de la orden *</Text>
            <View style={styles.lineRow}>
              <select value={lineProductId} onChange={(e) => setLineProductId(e.target.value)} style={{ ...select, flex: 2, minWidth: 220 }}>
                <option value="">Selecciona un producto</option>
                {activeProducts.map((p) => <option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}
              </select>
              <TextInput value={lineQty} onChangeText={setLineQty} placeholder="Cantidad" style={[input, { flex: 1 }]} />
              <TextInput value={lineCost} onChangeText={setLineCost} placeholder="Costo c/u" style={[input, { flex: 1 }]} />
              <TouchableOpacity onPress={addOrderLine} style={[styles.button, { backgroundColor: c.primary }]}>
                <Text style={styles.buttonText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            {orderForm.lines.length === 0 ? (
              <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6 }}>Aún no hay líneas.</Text>
            ) : (
              <View style={[styles.table, { borderColor: c.borderStrong }]}>
                {orderForm.lines.map((line) => (
                  <View key={line.key} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1 }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{productLabel(line.productId)}</Text>
                    <Text style={[styles.cell, { color: c.textPrimary }]}>{line.quantity}</Text>
                    <Text style={[styles.cell, { color: c.textPrimary }]}>{formatMoney(Number(line.unitCost))}</Text>
                    <TouchableOpacity onPress={() => removeOrderLine(line.key)}>
                      <Text style={[styles.cell, { color: c.danger }]}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.subtotal, { color: c.textPrimary }]}>Subtotal estimado: {formatMoney(orderSubtotal)}</Text>
          </View>

          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitOrder()} label="Crear orden" theme={t} />
        </FormCard>
      ) : null}

      {tab === 'suppliers' ? (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={supplierSearch} onChangeText={setSupplierSearch} placeholder="Buscar por nombre o código..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
            <Text style={[styles.count, { color: c.textSecondary }]}>{visibleSuppliers.length} proveedores</Text>
          </View>

          {visibleSuppliers.length === 0 ? (
            <Empty text="No hay proveedores con ese criterio." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Proveedor', 'Contacto', 'Términos', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleSuppliers.map((s) => (
                <View key={s._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                  <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{s.code} · {s.name}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{s.email || s.phone || '—'}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{s.paymentTermsDays} días · {s.currency}</Text>
                  <StatusPill label={s.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} tone={s.status === 'ACTIVE' ? 'success' : 'neutral'} theme={t} />
                  <TouchableOpacity
                    disabled={saving || !(s.status === 'ACTIVE' ? canDelete : canUpdate)}
                    onPress={() => void toggleSupplierStatus(s)}
                  >
                    <Text style={[styles.cell, { color: s.status === 'ACTIVE' ? c.danger : c.success }]}>
                      {s.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={orderSearch} onChangeText={setOrderSearch} placeholder="Buscar por folio o proveedor..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'ALL')} style={{ ...select, minWidth: 200 }}>
              {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </View>

          {selectedOrderId ? (
            <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, { color: c.textPrimary }]}>
                  {selectedOrder ? `Orden ${selectedOrder.folio}` : 'Orden de compra'}
                </Text>
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
                      <Text style={{ color: c.textSecondary }}>{selectedSupplier ? `${selectedSupplier.code} · ${selectedSupplier.name}` : 'Proveedor'}</Text>
                      <Text style={[styles.amount, { color: c.textPrimary }]}>{formatMoney(selectedOrder.subtotal, selectedSupplier?.currency)}</Text>
                      {selectedOrder.expectedDate ? <Text style={{ color: c.textSecondary }}>Esperada: {selectedOrder.expectedDate}</Text> : null}
                    </View>
                    <StatusPill label={selectedMeta.label} tone={selectedMeta.tone} theme={t} />
                  </View>

                  <View style={styles.actionsRow}>
                    {selectedActions.includes('SEND') ? <ActionButton label="Enviar al proveedor" onPress={() => void transitionOrder('SENT')} variant="secondary" theme={t} /> : null}
                    {selectedActions.includes('APPROVE') ? <ActionButton label="Aprobar orden" onPress={() => void transitionOrder('APPROVED')} theme={t} /> : null}
                    {selectedActions.includes('RECEIVE') ? <ActionButton label="Registrar recepción" onPress={openReceivePanel} theme={t} /> : null}
                    {selectedActions.includes('CANCEL') ? <ActionButton label="Cancelar orden" onPress={() => void transitionOrder('CANCELLED')} variant="danger" theme={t} /> : null}
                  </View>

                  <Section title={`Líneas (${selectedOrder.lines.length})`} theme={t}>
                    <View style={[styles.table, { borderColor: c.borderStrong }]}>
                      <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                        {['Producto', 'Ordenado', 'Recibido', 'Facturado', 'Costo', 'Pendiente'].map((col) => (
                          <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                        ))}
                      </View>
                      {selectedOrder.lines.map((line) => {
                        const pending = pendingToReceive(line);
                        return (
                          <View key={line.productId} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1 }]}>
                            <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{productLabel(line.productId)}</Text>
                            <Text style={[styles.cell, { color: c.textPrimary }]}>{formatQuantity(line.quantity)}</Text>
                            <Text style={[styles.cell, { color: c.textPrimary }]}>{formatQuantity(line.quantityReceived)}</Text>
                            <Text style={[styles.cell, { color: c.textPrimary }]}>{formatQuantity(line.quantityInvoiced)}</Text>
                            <Text style={[styles.cell, { color: c.textPrimary }]}>{formatMoney(line.unitCost, selectedSupplier?.currency)}</Text>
                            <Text style={[styles.cell, { color: pending > 0 ? c.warning : c.success }]}>{pending > 0 ? formatQuantity(pending) : 'Completo'}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Section>

                  <Section title={`Recepciones (${orderReceipts.length})`} theme={t}>
                    {orderReceipts.length === 0 ? (
                      <Empty text="Aún no hay recepciones." theme={t} />
                    ) : (
                      <View style={[styles.table, { borderColor: c.borderStrong }]}>
                        {orderReceipts.map((r) => (
                          <View key={r._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1 }]}>
                            <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{r.folio}</Text>
                            <Text style={[styles.cell, { color: c.textSecondary }]}>{new Date(r.receivedAt).toLocaleString('es-MX')}</Text>
                            <Text style={[styles.cell, { color: c.textSecondary }]}>{r.lines.length} línea(s)</Text>
                            <Text style={[styles.cell, { color: c.textPrimary }]}>{formatMoney(r.total, selectedSupplier?.currency)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Section>

                  {receivePanelOpen ? (
                    <FormCard title="Registrar recepción" onClose={() => setReceivePanelOpen(false)} theme={t}>
                      <Field label="Almacén de entrada" theme={t}>
                        <select value={receiveWarehouseId} onChange={(e) => setReceiveWarehouseId(e.target.value)} style={select}>
                          <option value="">Selecciona un almacén</option>
                          {activeWarehouses.map((w) => <option key={w._id} value={w._id}>{w.code} · {w.name}</option>)}
                        </select>
                      </Field>
                      <View style={styles.fieldFull}>
                        {selectedOrder.lines.filter((l) => pendingToReceive(l) > 0).map((line) => (
                          <View key={line.productId} style={styles.receiveLine}>
                            <Text style={{ color: c.textPrimary, flex: 2 }}>
                              {productLabel(line.productId)} · pendiente {formatQuantity(pendingToReceive(line))}
                            </Text>
                            <TextInput
                              value={receiveQuantities[line.productId] ?? ''}
                              onChangeText={(v: string) => setReceiveQuantities((q) => ({ ...q, [line.productId]: v }))}
                              placeholder="0"
                              style={[input, { flex: 1 }]}
                            />
                          </View>
                        ))}
                      </View>
                      <Field label="Notas" theme={t}>
                        <TextInput value={receiveNotes} onChangeText={setReceiveNotes} placeholder="Remisión, faltantes, daños..." style={input} />
                      </Field>
                      <FormActions saving={saving} onCancel={() => setReceivePanelOpen(false)} onSubmit={() => void submitReceive()} label="Registrar recepción" theme={t} />
                    </FormCard>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {visibleOrders.length === 0 ? (
            <Empty text="No hay órdenes de compra con los filtros actuales." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Folio', 'Proveedor', 'Líneas', 'Subtotal', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleOrders.map((o) => {
                const meta = ORDER_STATUS[o.status];
                const received = o.lines.reduce((s, l) => s + l.quantityReceived, 0);
                const ordered = o.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <View key={o._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textPrimary }]}>{o.folio}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary, flex: 2 }]}>{supplierLabel(o.supplierId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{formatQuantity(received)}/{formatQuantity(ordered)}</Text>
                    <Text style={[styles.cell, { color: c.textPrimary }]}>{formatMoney(o.subtotal)}</Text>
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    <TouchableOpacity onPress={() => void openOrderDetail(o._id)}>
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
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, background ? { backgroundColor: background } : { borderWidth: 1, borderColor: c.borderStrong }]}
    >
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
  fieldFull: { width: '100%', gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  lineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  subtotal: { marginTop: 10, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  amount: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  receiveLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginHorizontal: 4 },
  pillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
