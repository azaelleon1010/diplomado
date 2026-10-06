import { darkPalette } from '../theme/tokens';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppNavigation } from '../hooks/useAppNavigation';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  purchasingApi,
  type Product,
  type Supplier,
} from '../lib/api';
import { pushAlert } from '../data/alerts';

interface OrderLineRow {
  key: string;
  productId: string;
  productLabel: string;
  quantity: string;
  unitCost: string;
}

let lineSeq = 0;

export function PurchaseOrderFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [folio, setFolio] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLineRow[]>([]);
  const [lineProductId, setLineProductId] = useState('');
  const [lineProductName, setLineProductName] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [lineCost, setLineCost] = useState('');
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCatalogs();
  }, []);

  async function loadCatalogs(): Promise<void> {
    try {
      setLoadingSuppliers(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const [fetchedSuppliers, fetchedProducts] = await Promise.all([
        purchasingApi.listSuppliers(session.accessToken),
        inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
      ]);
      setSuppliers((Array.isArray(fetchedSuppliers) ? fetchedSuppliers : []).filter((s) => s.status === 'ACTIVE'));
      setProducts((Array.isArray(fetchedProducts) ? fetchedProducts : []).filter((p) => p.status === 'ACTIVE'));
    } catch (error) {
      setSuppliers([]);
      setProducts([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingSuppliers(false);
    }
  }

  function addLine(): void {
    if (!lineProductId) {
      Alert.alert('Falta información', 'Selecciona el producto de la línea.');
      return;
    }
    const qty = Number(lineQty);
    const cost = Number(lineCost);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Dato inválido', 'La cantidad debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      Alert.alert('Dato inválido', 'El costo debe ser mayor o igual a 0.');
      return;
    }
    if (lines.some((l) => l.productId === lineProductId)) {
      Alert.alert('Dato inválido', 'Ese producto ya está en la orden.');
      return;
    }
    lineSeq += 1;
    setLines((prev) => [
      ...prev,
      { key: `line-${lineSeq}`, productId: lineProductId, productLabel: lineProductName, quantity: String(qty), unitCost: String(cost) },
    ]);
    setLineProductId('');
    setLineProductName('');
    setLineQty('');
    setLineCost('');
  }

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost), 0);

  async function handleSubmit(): Promise<void> {
    if (!folio.trim()) {
      Alert.alert('Falta información', 'Ingresa el folio de la orden.');
      return;
    }
    if (!supplierId) {
      Alert.alert('Falta información', 'Selecciona el proveedor.');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Falta información', 'Agrega al menos una línea a la orden.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await purchasingApi.createOrder(session.accessToken, {
        folio: folio.trim(),
        supplierId,
        expectedDate: expectedDate.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
      });
      pushAlert('purchasing', 'Orden de compra creada', `OC ${created.folio} · $${created.subtotal.toFixed(2)}`, 'info');
      Alert.alert('Orden creada', 'La orden de compra se registró correctamente.', [
        { text: 'Aceptar', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Nueva orden</Text>
          <Text style={styles.subtitle}>Compra a proveedor</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Folio *</Text>
        <TextInput value={folio} onChangeText={setFolio} placeholder="Ej. OC-1001" placeholderTextColor={darkPalette.textMuted} style={styles.input} autoCapitalize="characters" />
        <Text style={styles.label}>Proveedor *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setSupplierModalVisible(true)} disabled={loadingSuppliers}>
          <View style={styles.selectorContent}>
            {loadingSuppliers ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>Cargando proveedores…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !supplierName && styles.selectorPlaceholder]}>
                {supplierName || 'Seleccionar proveedor'}
              </Text>
            )}
          </View>
          {!loadingSuppliers ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        {!loadingSuppliers && suppliers.length === 0 ? (
          <Text style={styles.hint}>No hay proveedores activos. Registra un proveedor primero.</Text>
        ) : null}
        <Text style={styles.label}>Fecha esperada</Text>
        <TextInput value={expectedDate} onChangeText={setExpectedDate} placeholder="Ej. 2026-11-15" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Notas</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notas de la orden" placeholderTextColor={darkPalette.textMuted} style={[styles.input, styles.textArea]} multiline />

        <Text style={styles.label}>Líneas de la orden *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setLineModalVisible(true)} disabled={loadingSuppliers}>
          <Text style={[styles.selectorText, !lineProductName && styles.selectorPlaceholder]}>
            {lineProductName || 'Seleccionar producto del catálogo'}
          </Text>
          <Text style={styles.selectorArrow}>⌄</Text>
        </TouchableOpacity>
        <View style={styles.lineRow}>
          <TextInput value={lineQty} onChangeText={setLineQty} placeholder="Cant." placeholderTextColor={darkPalette.textMuted} style={[styles.input, styles.lineInput]} keyboardType="decimal-pad" />
          <TextInput value={lineCost} onChangeText={setLineCost} placeholder="Costo c/u" placeholderTextColor={darkPalette.textMuted} style={[styles.input, styles.lineInput]} keyboardType="decimal-pad" />
          <TouchableOpacity onPress={addLine} style={styles.addLineButton}>
            <Text style={styles.addLineText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>
        {lines.map((l) => (
          <View key={l.key} style={styles.lineItem}>
            <Text style={styles.lineItemText}>{l.productLabel} × {l.quantity} @ ${Number(l.unitCost).toFixed(2)}</Text>
            <TouchableOpacity onPress={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
              <Text style={styles.lineRemove}>Quitar</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Text style={styles.subtotal}>Subtotal estimado: ${subtotal.toFixed(2)}</Text>

        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Crear orden'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={supplierModalVisible} transparent animationType="slide" onRequestClose={() => setSupplierModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar proveedor</Text>
              <TouchableOpacity onPress={() => setSupplierModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {suppliers.map((supplier) => (
                <TouchableOpacity
                  key={supplier._id}
                  onPress={() => {
                    setSupplierId(supplier._id);
                    setSupplierName(`${supplier.code} · ${supplier.name}`);
                    setSupplierModalVisible(false);
                  }}
                  style={[styles.option, supplierId === supplier._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, supplierId === supplier._id && styles.optionTextSelected]}>
                    {supplier.code} · {supplier.name}
                  </Text>
                  {supplierId === supplier._id ? <Text style={styles.checkmark}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={lineModalVisible} transparent animationType="slide" onRequestClose={() => setLineModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar producto</Text>
              <TouchableOpacity onPress={() => setLineModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  onPress={() => {
                    setLineProductId(product._id);
                    setLineProductName(`${product.sku} · ${product.name}`);
                    setLineModalVisible(false);
                  }}
                  style={[styles.option, lineProductId === product._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, lineProductId === product._id && styles.optionTextSelected]}>
                    {product.sku} · {product.name}
                  </Text>
                  {lineProductId === product._id ? <Text style={styles.checkmark}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkPalette.background },
  header: { backgroundColor: darkPalette.surface, paddingTop: 55, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: darkPalette.borderStrong, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: darkPalette.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backButtonText: { fontSize: 32, color: darkPalette.textPrimary, lineHeight: 36 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: darkPalette.textPrimary },
  subtitle: { fontSize: 15, color: darkPalette.textSecondary, marginTop: 5 },
  content: { padding: 20, paddingBottom: 50 },
  label: { fontSize: 14, fontWeight: '700', color: darkPalette.textPrimary, marginBottom: 7 },
  input: { backgroundColor: darkPalette.surface, borderWidth: 1, borderColor: darkPalette.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: darkPalette.textPrimary, marginBottom: 18 },
  textArea: { height: 90, textAlignVertical: 'top' },
  selector: { minHeight: 51, backgroundColor: darkPalette.surface, borderWidth: 1, borderColor: darkPalette.borderStrong, borderRadius: 10, paddingHorizontal: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  selectorText: { fontSize: 16, color: darkPalette.textPrimary },
  selectorPlaceholder: { color: darkPalette.textMuted },
  selectorLoading: { marginLeft: 10, fontSize: 15, color: darkPalette.textSecondary },
  selectorArrow: { fontSize: 24, color: darkPalette.textSecondary, marginLeft: 10 },
  hint: { fontSize: 13, color: darkPalette.textSecondary, marginBottom: 18, marginTop: -10 },
  lineRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  lineInput: { flex: 1, marginBottom: 0 },
  addLineButton: { backgroundColor: darkPalette.brandSoft, borderWidth: 1, borderColor: darkPalette.brand, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addLineText: { color: darkPalette.brand, fontWeight: '700', fontSize: 14 },
  lineItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: darkPalette.surface, borderWidth: 1, borderColor: darkPalette.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  lineItemText: { fontSize: 14, color: darkPalette.textPrimary, flex: 1 },
  lineRemove: { color: darkPalette.danger, fontWeight: '600', fontSize: 14 },
  subtotal: { fontSize: 16, fontWeight: '700', color: darkPalette.textPrimary, textAlign: 'right', marginBottom: 8 },
  saveButton: { backgroundColor: darkPalette.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: darkPalette.disabled },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: darkPalette.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '75%', paddingBottom: 30 },
  modalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: darkPalette.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: darkPalette.textPrimary },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: darkPalette.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 27, color: darkPalette.textPrimary, lineHeight: 30 },
  optionList: { padding: 20 },
  option: { minHeight: 54, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: darkPalette.borderStrong, backgroundColor: darkPalette.surface, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionSelected: { borderColor: darkPalette.brand, backgroundColor: darkPalette.brandSoft },
  optionText: { fontSize: 16, color: darkPalette.textPrimary },
  optionTextSelected: { color: darkPalette.brand, fontWeight: '700' },
  checkmark: { fontSize: 20, color: darkPalette.brand, fontWeight: '700' },
});
