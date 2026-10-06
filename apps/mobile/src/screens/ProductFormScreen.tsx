import { darkPalette } from '../theme/tokens';
import React, { useEffect, useState } from 'react';
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

import { useAppNavigation } from '../hooks/useAppNavigation';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  type Category,
} from '../lib/api';

export function ProductFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [unit, setUnit] = useState('pieza');
  const [barcode, setBarcode] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [minimumStock, setMinimumStock] = useState('0');
  const [maximumStock, setMaximumStock] = useState('');
  const [trackInventory, setTrackInventory] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories(): Promise<void> {
    try {
      setLoadingCategories(true);

      const session = await loadSession();

      if (!session?.accessToken) {
        Alert.alert(
          'Sesión no disponible',
          'Tu sesión no está disponible. Inicia sesión nuevamente.',
        );
        return;
      }

      const categories = await inventoryApi.listCategories(
        session.accessToken,
      );

      setCategories(Array.isArray(categories) ? categories : []);
    } catch (error) {
      setCategories([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingCategories(false);
    }
  }

  function selectCategory(category: Category): void {
    if (!category._id) {
      Alert.alert(
        'Categoría inválida',
        'La categoría recibida no tiene un identificador válido.',
      );
      return;
    }

    setCategoryId(category._id);
    setCategoryName(category.name);
    setCategoryModalVisible(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!sku.trim()) {
      Alert.alert('Falta información', 'Ingresa el SKU del producto.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Falta información', 'Ingresa el nombre del producto.');
      return;
    }

    if (!unit.trim()) {
      Alert.alert('Falta información', 'Ingresa la unidad del producto.');
      return;
    }

    if (!cost.trim() || Number.isNaN(Number(cost)) || Number(cost) < 0) {
      Alert.alert('Dato inválido', 'Ingresa un costo válido mayor o igual a 0.');
      return;
    }

    if (!price.trim() || Number.isNaN(Number(price)) || Number(price) < 0) {
      Alert.alert('Dato inválido', 'Ingresa un precio válido mayor o igual a 0.');
      return;
    }

    const minStock = Number(minimumStock || '0');

    if (!Number.isInteger(minStock) || minStock < 0) {
      Alert.alert('Dato inválido', 'El stock mínimo debe ser un número entero mayor o igual a 0.');
      return;
    }

    let maxStock: number | undefined;

    if (maximumStock.trim()) {
      maxStock = Number(maximumStock);

      if (!Number.isInteger(maxStock) || maxStock < 0) {
        Alert.alert('Dato inválido', 'El stock máximo debe ser un número entero mayor o igual a 0.');
        return;
      }

      if (maxStock < minStock) {
        Alert.alert(
          'Dato inválido',
          'El stock máximo no puede ser menor que el stock mínimo.',
        );
        return;
      }
    }

    const session = await loadSession();

    if (!session?.accessToken) {
      Alert.alert(
        'Sesión no disponible',
        'Tu sesión no está disponible. Inicia sesión nuevamente.',
      );
      return;
    }

    setSaving(true);

    try {
      await inventoryApi.createProduct(session.accessToken, {
        sku: sku.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        unit: unit.trim(),
        barcode: barcode.trim() || undefined,
        cost: Number(cost),
        price: Number(price),
        minimumStock: minStock,
        maximumStock: maxStock,
        trackInventory,
      });

      Alert.alert(
        'Producto creado',
        'El producto se registró correctamente.',
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setSaving(false);
    }
  }

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
          <Text style={styles.title}>Nuevo producto</Text>
          <Text style={styles.subtitle}>
            Ingresa la información del producto
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>SKU *</Text>

        <TextInput
          value={sku}
          onChangeText={setSku}
          placeholder="Ej. PROD-001"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Nombre del producto *</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej. Laptop Dell"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Descripción</Text>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción del producto"
          placeholderTextColor={darkPalette.textMuted}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <Text style={styles.label}>Categoría</Text>

        <TouchableOpacity
          style={styles.selector}
          onPress={() => setCategoryModalVisible(true)}
          disabled={loadingCategories}
        >
          <View style={styles.selectorContent}>
            {loadingCategories ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>
                  Cargando categorías...
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.selectorText,
                  !categoryName && styles.selectorPlaceholder,
                ]}
              >
                {categoryName || 'Seleccionar categoría'}
              </Text>
            )}
          </View>

          {!loadingCategories ? (
            <Text style={styles.selectorArrow}>⌄</Text>
          ) : null}
        </TouchableOpacity>

        {!loadingCategories && categories.length === 0 ? (
          <Text style={styles.noCategoriesHint}>
            No hay categorías disponibles. Crea una categoría antes de
            registrar el producto.
          </Text>
        ) : null}

        <Text style={styles.label}>Unidad *</Text>

        <TextInput
          value={unit}
          onChangeText={setUnit}
          placeholder="Ej. pieza, kg, litro"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Código de barras</Text>

        <TextInput
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Código de barras"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Costo *</Text>

        <TextInput
          value={cost}
          onChangeText={setCost}
          placeholder="0.00"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Precio de venta *</Text>

        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="0.00"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Stock mínimo</Text>

        <TextInput
          value={minimumStock}
          onChangeText={setMinimumStock}
          placeholder="0"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Stock máximo</Text>

        <TextInput
          value={maximumStock}
          onChangeText={setMaximumStock}
          placeholder="Opcional"
          placeholderTextColor={darkPalette.textMuted}
          style={styles.input}
          keyboardType="numeric"
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
            value={trackInventory}
            onValueChange={setTrackInventory}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={saving}
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Guardando...' : 'Guardar producto'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
                  Elige una categoría existente
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setCategoryModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {categories.length === 0 ? (
              <View style={styles.emptyCategories}>
                <Text style={styles.emptyTitle}>
                  No hay categorías
                </Text>

                <Text style={styles.emptyDescription}>
                  Primero debes crear una categoría para poder asignarla
                  a este producto.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.categoryList}
              >
                {categories.map((category) => {
                  const selected = category._id === categoryId;

                  return (
                    <TouchableOpacity
                      key={category._id}
                      onPress={() => selectCategory(category)}
                      style={[
                        styles.categoryOption,
                        selected && styles.categoryOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          selected &&
                            styles.categoryOptionTextSelected,
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
              </ScrollView>
            )}
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

  selectorLoading: {
    marginLeft: 10,
    fontSize: 15,
    color: darkPalette.textSecondary,
  },

  selectorArrow: {
    fontSize: 24,
    color: darkPalette.textSecondary,
    marginLeft: 10,
  },

  noCategoriesHint: {
    fontSize: 13,
    color: darkPalette.textSecondary,
    marginBottom: 18,
    marginTop: -10,
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
    backgroundColor: darkPalette.disabled,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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

  emptyCategories: {
    padding: 30,
    alignItems: 'center',
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