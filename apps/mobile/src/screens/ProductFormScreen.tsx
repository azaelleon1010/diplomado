import { darkPalette } from '../theme/tokens';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { MODULE_ACCESS, hasAnyPermission } from '../navigation/moduleAccess';
import type { OperationsStackParamList } from '../navigation/types';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  type Category,
  type Product,
} from '../lib/api';
import {
  EMPTY_PRODUCT_FORM,
  VERSION_CONFLICT_MESSAGE,
  isVersionConflict,
  productToFormValues,
  toCreateProductPayload,
  toUpdateProductPayload,
  validateProductForm,
  type ProductFormValues,
} from '../../../../packages/types/src/inventory';

type FormRoute = RouteProp<OperationsStackParamList, 'ProductForm'>;

const SESSION_MISSING = 'Tu sesión no está disponible. Inicia sesión nuevamente.';

export function ProductFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = useRoute<FormRoute>();
  const productId = route.params?.productId;
  const isEditing = productId !== undefined;

  const { me } = useAuth();
  const permissions = me?.permissions ?? [];
  const canSave = hasAnyPermission(
    permissions,
    isEditing ? MODULE_ACCESS.inventoryUpdate : MODULE_ACCESS.inventoryCreate,
  );
  const canDeactivate = hasAnyPermission(permissions, MODULE_ACCESS.inventoryDelete);
  const canActivate = hasAnyPermission(permissions, MODULE_ACCESS.inventoryUpdate);

  const [form, setForm] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  /** Server copy: source of the version sent as expectedVersion. */
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);

    try {
      const session = await loadSession();

      if (!session?.accessToken) {
        setLoadError(SESSION_MISSING);
        return;
      }

      const [fetchedCategories, current] = await Promise.all([
        inventoryApi.listCategories(session.accessToken).catch(() => [] as Category[]),
        productId !== undefined
          ? inventoryApi.getProduct(session.accessToken, productId)
          : Promise.resolve(null),
      ]);

      setCategories(fetchedCategories);

      if (current) {
        setProduct(current);
        setForm(productToFormValues(current));
      }
    } catch (error) {
      setLoadError(friendlyMessage(error));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () =>
      product !== null &&
      JSON.stringify(form) !== JSON.stringify(productToFormValues(product)),
    [form, product],
  );

  const selectableCategories = categories.filter(
    (category) => category.status === 'ACTIVE',
  );
  const selectedCategoryName = form.categoryId
    ? categories.find((category) => category._id === form.categoryId)?.name ??
      'Categoría no disponible'
    : '';

  function handleError(error: unknown): void {
    if (isVersionConflict(error)) {
      Alert.alert('Conflicto de edición', VERSION_CONFLICT_MESSAGE);
      void load();
      return;
    }

    Alert.alert('Error', friendlyMessage(error));
  }

  async function handleSubmit(): Promise<void> {
    if (saving || !canSave) {
      return;
    }

    const result = validateProductForm(form);

    if (!result.ok) {
      Alert.alert('Dato inválido', result.error);
      return;
    }

    const session = await loadSession();

    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', SESSION_MISSING);
      return;
    }

    setSaving(true);

    try {
      if (product) {
        const updated = await inventoryApi.updateProduct(
          session.accessToken,
          product._id,
          toUpdateProductPayload(result.fields, product.version),
        );

        setProduct(updated);
        setForm(productToFormValues(updated));
        Alert.alert('Producto actualizado', 'Los cambios se guardaron correctamente.', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
      } else {
        await inventoryApi.createProduct(
          session.accessToken,
          toCreateProductPayload(result.fields),
        );

        Alert.alert('Producto creado', 'El producto se registró correctamente.', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(current: Product): Promise<void> {
    const session = await loadSession();

    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', SESSION_MISSING);
      return;
    }

    setSaving(true);

    try {
      const updated =
        current.status === 'ACTIVE'
          ? await inventoryApi.deactivateProduct(session.accessToken, current._id)
          : await inventoryApi.activateProduct(session.accessToken, current._id, current.version);

      setProduct(updated);
      setForm(productToFormValues(updated));
      Alert.alert(
        updated.status === 'ACTIVE' ? 'Producto activado' : 'Producto desactivado',
        updated.status === 'ACTIVE'
          ? 'El producto vuelve a estar disponible.'
          : 'El producto quedó inactivo. Puedes reactivarlo cuando lo necesites.',
      );
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  function handleToggleStatus(): void {
    if (!product || saving) {
      return;
    }

    if (dirty) {
      Alert.alert(
        'Cambios sin guardar',
        'Guarda o descarta tus cambios antes de cambiar el estado del producto.',
      );
      return;
    }

    if (product.status === 'ACTIVE') {
      Alert.alert(
        'Desactivar producto',
        `¿Desactivar "${product.name}"? No se elimina: queda inactivo y puede reactivarse.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Desactivar', style: 'destructive', onPress: () => void changeStatus(product) },
        ],
      );
      return;
    }

    void changeStatus(product);
  }

  const editable = canSave && !saving;
  const showStatusAction =
    product !== null &&
    (product.status === 'ACTIVE' ? canDeactivate : canActivate);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={darkPalette.brand} />
          <Text style={styles.centeredText}>
            {isEditing ? 'Cargando producto...' : 'Cargando categorías...'}
          </Text>
        </View>
      );
    }

    if (loadError || (isEditing && !product)) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No se pudo cargar el producto</Text>
          <Text style={styles.emptyDescription}>
            {loadError ?? 'El producto no existe o no pertenece a tu empresa.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.saveButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {product ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Estado</Text>
            <Text
              style={[
                styles.statusValue,
                product.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive,
              ]}
            >
              {product.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
            </Text>
          </View>
        ) : null}

        {!canSave ? (
          <Text style={styles.readOnlyHint}>
            Tu rol no permite {isEditing ? 'editar' : 'crear'} productos.
          </Text>
        ) : null}

        <Text style={styles.label}>SKU *</Text>

        <TextInput
          value={form.sku}
          onChangeText={(value) => updateField('sku', value)}
          placeholder="Ej. PROD-001"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={editable}
        />

        <Text style={styles.label}>Nombre del producto *</Text>

        <TextInput
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Ej. Laptop Dell"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          editable={editable}
        />

        <Text style={styles.label}>Descripción</Text>

        <TextInput
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Descripción del producto"
          placeholderTextColor={darkPalette.textMuted}
          style={[styles.input, styles.textArea]}
          multiline
          editable={editable}
        />

        <Text style={styles.label}>Categoría</Text>

        <TouchableOpacity
          style={styles.selector}
          onPress={() => setCategoryModalVisible(true)}
          disabled={!editable}
        >
          <View style={styles.selectorContent}>
            <Text
              style={[
                styles.selectorText,
                !selectedCategoryName && styles.selectorPlaceholder,
              ]}
            >
              {selectedCategoryName || 'Sin categoría'}
            </Text>
          </View>

          <Text style={styles.selectorArrow}>⌄</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Unidad</Text>

        <TextInput
          value={form.unit}
          onChangeText={(value) => updateField('unit', value)}
          placeholder="Ej. PZA, KG, LT"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          autoCapitalize="characters"
          editable={editable}
        />

        <Text style={styles.label}>Código de barras</Text>

        <TextInput
          value={form.barcode}
          onChangeText={(value) => updateField('barcode', value)}
          placeholder="Código de barras"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
        />

        <Text style={styles.label}>Costo *</Text>

        <TextInput
          value={form.cost}
          onChangeText={(value) => updateField('cost', value)}
          placeholder="0.00"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
          editable={editable}
        />

        <Text style={styles.label}>Precio de venta *</Text>

        <TextInput
          value={form.price}
          onChangeText={(value) => updateField('price', value)}
          placeholder="0.00"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
          editable={editable}
        />

        <Text style={styles.label}>Stock mínimo</Text>

        <TextInput
          value={form.minimumStock}
          onChangeText={(value) => updateField('minimumStock', value)}
          placeholder="0"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="number-pad"
          editable={editable}
        />

        <Text style={styles.label}>Stock máximo</Text>

        <TextInput
          value={form.maximumStock}
          onChangeText={(value) => updateField('maximumStock', value)}
          placeholder="Opcional"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="number-pad"
          editable={editable}
        />

        <View style={styles.switchCard}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>
              Controlar inventario
            </Text>

            <Text style={styles.switchDescription}>
              Registrar movimientos y existencias de este producto.
            </Text>
          </View>

          <Switch
            value={form.trackInventory}
            onValueChange={(value) => updateField('trackInventory', value)}
            disabled={!editable}
          />
        </View>

        {canSave ? (
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            disabled={saving}
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? 'Guardando...'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Guardar producto'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {showStatusAction && product ? (
          <TouchableOpacity
            onPress={handleToggleStatus}
            disabled={saving}
            style={[
              styles.statusButton,
              product.status === 'ACTIVE' ? styles.deactivateButton : styles.activateButton,
              saving && styles.saveButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.statusButtonText,
                product.status === 'ACTIVE' ? styles.deactivateText : styles.activateText,
              ]}
            >
              {product.status === 'ACTIVE' ? 'Desactivar producto' : 'Activar producto'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            {isEditing ? 'Editar producto' : 'Nuevo producto'}
          </Text>
          <Text style={styles.subtitle}>
            {isEditing
              ? 'Los cambios se guardan en la API para Web y Mobile'
              : 'Ingresa la información del producto'}
          </Text>
        </View>
      </View>

      {renderBody()}

      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Seleccionar categoría</Text>
                <Text style={styles.modalSubtitle}>
                  Categorías activas de tu empresa
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setCategoryModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.categoryList}>
              {[{ _id: '', name: 'Sin categoría' }, ...selectableCategories].map((category) => {
                const selected = category._id === form.categoryId;

                return (
                  <TouchableOpacity
                    key={category._id || 'none'}
                    onPress={() => {
                      updateField('categoryId', category._id);
                      setCategoryModalVisible(false);
                    }}
                    style={[
                      styles.categoryOption,
                      selected && styles.categoryOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        selected && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {category.name}
                    </Text>

                    {selected ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {selectableCategories.length === 0 ? (
                <Text style={styles.emptyDescription}>
                  No hay categorías activas. Puedes guardar el producto sin categoría.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkPalette.background,
  },

  header: {
    backgroundColor: darkPalette.surface,
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: darkPalette.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: darkPalette.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backButtonText: {
    fontSize: 32,
    color: darkPalette.textPrimary,
    lineHeight: 36,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: darkPalette.textPrimary,
  },

  subtitle: {
    fontSize: 15,
    color: darkPalette.textSecondary,
    marginTop: 5,
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  centeredText: {
    marginTop: 12,
    fontSize: 15,
    color: darkPalette.textSecondary,
  },

  retryButton: {
    marginTop: 20,
    backgroundColor: darkPalette.brand,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: darkPalette.textPrimary,
  },

  statusValue: {
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    color: '#FFFFFF',
  },

  statusActive: {
    backgroundColor: darkPalette.success,
  },

  statusInactive: {
    backgroundColor: darkPalette.disabled,
  },

  readOnlyHint: {
    fontSize: 13,
    color: darkPalette.textSecondary,
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: darkPalette.textPrimary,
    marginBottom: 7,
  },

  input: {
    backgroundColor: darkPalette.surface,
    borderWidth: 1,
    borderColor: darkPalette.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: darkPalette.textPrimary,
    marginBottom: 18,
  },

  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },

  selector: {
    minHeight: 51,
    backgroundColor: darkPalette.surface,
    borderWidth: 1,
    borderColor: darkPalette.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectorText: {
    fontSize: 16,
    color: darkPalette.textPrimary,
  },

  selectorPlaceholder: {
    color: darkPalette.textMuted,
  },

  selectorArrow: {
    fontSize: 24,
    color: darkPalette.textSecondary,
    marginLeft: 10,
  },

  switchCard: {
    marginTop: 8,
    marginBottom: 25,
    padding: 16,
    backgroundColor: darkPalette.surface,
    borderWidth: 1,
    borderColor: darkPalette.borderStrong,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  switchText: {
    flex: 1,
    paddingRight: 15,
  },

  switchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: darkPalette.textPrimary,
  },

  switchDescription: {
    marginTop: 4,
    fontSize: 13,
    color: darkPalette.textSecondary,
  },

  saveButton: {
    backgroundColor: darkPalette.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  statusButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },

  deactivateButton: {
    borderColor: darkPalette.danger,
  },

  activateButton: {
    borderColor: darkPalette.success,
  },

  statusButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  deactivateText: {
    color: darkPalette.danger,
  },

  activateText: {
    color: darkPalette.success,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: darkPalette.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '75%',
    paddingBottom: 30,
  },

  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: darkPalette.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: darkPalette.textPrimary,
  },

  modalSubtitle: {
    fontSize: 14,
    color: darkPalette.textSecondary,
    marginTop: 4,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: darkPalette.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    fontSize: 27,
    color: darkPalette.textPrimary,
    lineHeight: 30,
  },

  categoryList: {
    padding: 20,
  },

  categoryOption: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: darkPalette.borderStrong,
    backgroundColor: darkPalette.surface,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  categoryOptionSelected: {
    borderColor: darkPalette.brand,
    backgroundColor: darkPalette.brandSoft,
  },

  categoryOptionText: {
    fontSize: 16,
    color: darkPalette.textPrimary,
  },

  categoryOptionTextSelected: {
    color: darkPalette.brand,
    fontWeight: '700',
  },

  checkmark: {
    fontSize: 20,
    color: darkPalette.brand,
    fontWeight: '700',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkPalette.textPrimary,
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: darkPalette.textSecondary,
    textAlign: 'center',
  },
});
