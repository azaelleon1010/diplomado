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
  productionApi,
  type Product,
} from '../lib/api';
import { pushAlert } from '../data/alerts';

interface MaterialRow {
  key: string;
  productId: string;
  productLabel: string;
  quantityRequired: string;
}

let materialSeq = 0;

export function ProductionOrderFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [code, setCode] = useState('');
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [machine, setMachine] = useState('');
  const [responsible, setResponsible] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialProductId, setMaterialProductId] = useState('');
  const [materialProductName, setMaterialProductName] = useState('');
  const [materialQty, setMaterialQty] = useState('');
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts(): Promise<void> {
    try {
      setLoadingProducts(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const list = await inventoryApi.listProducts(session.accessToken, { limit: 100 });
      setProducts(Array.isArray(list) ? list.filter((p) => p.status === 'ACTIVE') : []);
    } catch (error) {
      setProducts([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingProducts(false);
    }
  }

  function productLabelOf(product: Product): string {
    return `${product.sku} · ${product.name}`;
  }

  function addMaterial(): void {
    if (!materialProductId) {
      Alert.alert('Falta información', 'Selecciona el material a consumir.');
      return;
    }
    const qty = Number(materialQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Dato inválido', 'La cantidad requerida debe ser mayor a 0.');
      return;
    }
    if (materials.some((m) => m.productId === materialProductId)) {
      Alert.alert('Dato inválido', 'Ese material ya está en la lista.');
      return;
    }
    materialSeq += 1;
    setMaterials((prev) => [
      ...prev,
      { key: `mat-${materialSeq}`, productId: materialProductId, productLabel: materialProductName, quantityRequired: String(qty) },
    ]);
    setMaterialProductId('');
    setMaterialProductName('');
    setMaterialQty('');
  }

  async function handleSubmit(): Promise<void> {
    if (!code.trim()) {
      Alert.alert('Falta información', 'Ingresa el folio de la orden.');
      return;
    }
    if (!productId) {
      Alert.alert('Falta información', 'Selecciona el producto a fabricar.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Dato inválido', 'La cantidad a producir debe ser mayor a 0.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await productionApi.createOrder(session.accessToken, {
        code: code.trim(),
        productId,
        quantity: qty,
        machine: machine.trim() || undefined,
        responsible: responsible.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        materials: materials.map((m) => ({ productId: m.productId, quantityRequired: Number(m.quantityRequired) })),
      });
      pushAlert('production', 'Orden de producción creada', `${created.code} · ${created.quantity} unidades`, 'info');
      Alert.alert('Orden creada', 'La orden de producción se registró correctamente.', [
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
          <Text style={styles.subtitle}>Producción desde el catálogo</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Folio *</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="Ej. OT-001" placeholderTextColor={darkPalette.textMuted} style={styles.input} autoCapitalize="characters" />
        <Text style={styles.label}>Producto a fabricar *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setProductModalVisible(true)} disabled={loadingProducts}>
          <View style={styles.selectorContent}>
            {loadingProducts ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>Cargando catálogo…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !productName && styles.selectorPlaceholder]}>
                {productName || 'Seleccionar producto'}
              </Text>
            )}
          </View>
          {!loadingProducts ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        {!loadingProducts && products.length === 0 ? (
          <Text style={styles.hint}>No hay productos activos. Registra productos en Inventario primero.</Text>
        ) : null}
        <Text style={styles.label}>Cantidad a producir *</Text>
        <TextInput value={quantity} onChangeText={setQuantity} placeholder="Ej. 100" placeholderTextColor={darkPalette.textMuted} style={styles.input} keyboardType="decimal-pad" />
        <Text style={styles.label}>Máquina</Text>
        <TextInput value={machine} onChangeText={setMachine} placeholder="Ej. Línea 1" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Responsable</Text>
        <TextInput value={responsible} onChangeText={setResponsible} placeholder="Nombre del responsable" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Fecha compromiso</Text>
        <TextInput value={dueDate} onChangeText={setDueDate} placeholder="Ej. 2026-11-01" placeholderTextColor={darkPalette.textMuted} style={styles.input} />

        <Text style={styles.label}>Materiales a consumir</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setMaterialModalVisible(true)} disabled={loadingProducts}>
          <Text style={[styles.selectorText, !materialProductName && styles.selectorPlaceholder]}>
            {materialProductName || 'Seleccionar material'}
          </Text>
          <Text style={styles.selectorArrow}>⌄</Text>
        </TouchableOpacity>
        <View style={styles.materialRow}>
          <TextInput
            value={materialQty}
            onChangeText={setMaterialQty}
            placeholder="Cantidad"
            placeholderTextColor={darkPalette.textMuted}
            style={[styles.input, styles.materialQty]}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity onPress={addMaterial} style={styles.addMaterialButton}>
            <Text style={styles.addMaterialText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>
        {materials.map((m) => (
          <View key={m.key} style={styles.materialItem}>
            <Text style={styles.materialText}>{m.productLabel} × {m.quantityRequired}</Text>
            <TouchableOpacity onPress={() => setMaterials((prev) => prev.filter((x) => x.key !== m.key))}>
              <Text style={styles.materialRemove}>Quitar</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Crear orden'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={productModalVisible} transparent animationType="slide" onRequestClose={() => setProductModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar producto</Text>
              <TouchableOpacity onPress={() => setProductModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  onPress={() => {
                    setProductId(product._id);
                    setProductName(productLabelOf(product));
                    setProductModalVisible(false);
                  }}
                  style={[styles.option, productId === product._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, productId === product._id && styles.optionTextSelected]}>
                    {productLabelOf(product)}
                  </Text>
                  {productId === product._id ? <Text style={styles.checkmark}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={materialModalVisible} transparent animationType="slide" onRequestClose={() => setMaterialModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar material</Text>
              <TouchableOpacity onPress={() => setMaterialModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  onPress={() => {
                    setMaterialProductId(product._id);
                    setMaterialProductName(productLabelOf(product));
                    setMaterialModalVisible(false);
                  }}
                  style={[styles.option, materialProductId === product._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, materialProductId === product._id && styles.optionTextSelected]}>
                    {productLabelOf(product)}
                  </Text>
                  {materialProductId === product._id ? <Text style={styles.checkmark}>✓</Text> : null}
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
  selector: { minHeight: 51, backgroundColor: darkPalette.surface, borderWidth: 1, borderColor: darkPalette.borderStrong, borderRadius: 10, paddingHorizontal: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  selectorText: { fontSize: 16, color: darkPalette.textPrimary },
  selectorPlaceholder: { color: darkPalette.textMuted },
  selectorLoading: { marginLeft: 10, fontSize: 15, color: darkPalette.textSecondary },
  selectorArrow: { fontSize: 24, color: darkPalette.textSecondary, marginLeft: 10 },
  hint: { fontSize: 13, color: darkPalette.textSecondary, marginBottom: 18, marginTop: -10 },
  materialRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  materialQty: { flex: 1, marginBottom: 0 },
  addMaterialButton: { backgroundColor: darkPalette.brandSoft, borderWidth: 1, borderColor: darkPalette.brand, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addMaterialText: { color: darkPalette.brand, fontWeight: '700', fontSize: 14 },
  materialItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: darkPalette.surface, borderWidth: 1, borderColor: darkPalette.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  materialText: { fontSize: 14, color: darkPalette.textPrimary, flex: 1 },
  materialRemove: { color: darkPalette.danger, fontWeight: '600', fontSize: 14 },
  saveButton: { backgroundColor: darkPalette.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
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
