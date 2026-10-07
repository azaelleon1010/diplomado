import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native-web';

import { useTheme } from '../theme/Theme';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  type Category,
  type Product,
} from '../lib/api';
import {
  EMPTY_PRODUCT_FORM as EMPTY_FORM,
  VERSION_CONFLICT_MESSAGE,
  isVersionConflict,
  productToFormValues as productToForm,
  toCreateProductPayload,
  toUpdateProductPayload,
  validateProductForm,
  type ProductFormValues as ProductForm,
} from '../../../../packages/types/src/inventory';

export function InventoryScreen() {
  const t = useTheme();
  const c = t.semanticColors;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    const currentSession = loadSession();

    if (!currentSession?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [productsResult, categoriesResult] = await Promise.all([
        inventoryApi.listProducts(currentSession.accessToken, {
          limit: 100,
        }),
        inventoryApi
          .listCategories(currentSession.accessToken)
          .catch(() => []),
      ]);

      setProducts(productsResult);
      setCategories(categoriesResult);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm(productToForm(product));
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  };

  const updateField = <K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveProduct = async () => {
    const currentSession = loadSession();

    if (!currentSession?.accessToken) {
      setError('No hay una sesión activa.');
      return;
    }

    // Same rules as Mobile and the API schema (packages/types/src/inventory.ts).
    const result = validateProductForm(form);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingProduct) {
        await inventoryApi.updateProduct(
          currentSession.accessToken,
          editingProduct._id,
          toUpdateProductPayload(result.fields, editingProduct.version),
        );
      } else {
        await inventoryApi.createProduct(
          currentSession.accessToken,
          toCreateProductPayload(result.fields),
        );
      }

      setShowForm(false);
      setEditingProduct(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      if (isVersionConflict(err) && editingProduct) {
        // Another client saved first: reload instead of overwriting silently.
        const fresh = await inventoryApi
          .getProduct(currentSession.accessToken, editingProduct._id)
          .catch(() => null);

        if (fresh) {
          setEditingProduct(fresh);
          setForm(productToForm(fresh));
        }

        await loadData();
        setError(VERSION_CONFLICT_MESSAGE);
      } else {
        setError(friendlyMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (product: Product) => {
    const currentSession = loadSession();

    if (!currentSession?.accessToken) {
      setError('No hay una sesión activa.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (product.status === 'ACTIVE') {
        // Logical delete (DELETE /products/:id): the product becomes INACTIVE.
        await inventoryApi.deactivateProduct(
          currentSession.accessToken,
          product._id,
        );
      } else {
        await inventoryApi.activateProduct(
          currentSession.accessToken,
          product._id,
          product.version,
        );
      }

      await loadData();
    } catch (err) {
      if (isVersionConflict(err)) {
        await loadData();
        setError(VERSION_CONFLICT_MESSAGE);
      } else {
        setError(friendlyMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>
          Cargando productos...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>
            Inventario
          </Text>

          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Productos y catálogo
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: c.primary }]}
          onPress={openCreate}
        >
          <Text style={styles.primaryButtonText}>
            + Nuevo producto
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: c.surface,
            borderColor: c.borderStrong,
          },
        ]}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o SKU..."
          placeholderTextColor={c.textMuted}
          style={[
            styles.search,
            {
              color: c.textPrimary,
              borderColor: c.borderStrong,
              backgroundColor: c.background,
            },
          ]}
        />

        <Text style={[styles.count, { color: c.textSecondary }]}>
          {filteredProducts.length} productos
        </Text>
      </View>

      {showForm ? (
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: c.surface,
              borderColor: c.borderStrong,
            },
          ]}
        >
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: c.textPrimary }]}>
              {editingProduct ? 'Editar producto' : 'Nuevo producto'}
            </Text>

            <TouchableOpacity
              onPress={closeForm}
              disabled={saving}
            >
              <Text style={[styles.close, { color: c.textSecondary }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            <Field
              label="SKU *"
              value={form.sku}
              onChange={(value) => updateField('sku', value)}
              theme={t}
            />

            <Field
              label="Nombre *"
              value={form.name}
              onChange={(value) => updateField('name', value)}
              theme={t}
            />

            <Field
              label="Unidad"
              value={form.unit}
              onChange={(value) => updateField('unit', value)}
              theme={t}
            />

            <Field
              label="Código de barras"
              value={form.barcode}
              onChange={(value) => updateField('barcode', value)}
              theme={t}
            />

            <Field
              label="Costo"
              value={form.cost}
              onChange={(value) => updateField('cost', value)}
              keyboardType="decimal-pad"
              theme={t}
            />

            <Field
              label="Precio"
              value={form.price}
              onChange={(value) => updateField('price', value)}
              keyboardType="decimal-pad"
              theme={t}
            />

            <Field
              label="Stock mínimo"
              value={form.minimumStock}
              onChange={(value) => updateField('minimumStock', value)}
              keyboardType="numeric"
              theme={t}
            />

            <Field
              label="Stock máximo"
              value={form.maximumStock}
              onChange={(value) => updateField('maximumStock', value)}
              keyboardType="numeric"
              theme={t}
            />

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                Categoría
              </Text>

              <select
                value={form.categoryId}
                onChange={(event) =>
                  updateField('categoryId', event.target.value)
                }
                style={{
                  ...styles.select,
                  color: c.textPrimary,
                  backgroundColor: c.background,
                  borderColor: c.borderStrong,
                }}
              >
                <option value="">Sin categoría</option>

                {categories.map((category) => (
                  <option
                    key={category._id}
                    value={category._id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                Control de inventario
              </Text>

              <TouchableOpacity
                style={[
                  styles.toggle,
                  {
                    backgroundColor: form.trackInventory
                      ? c.primary
                      : c.background,
                    borderColor: c.borderStrong,
                  },
                ]}
                onPress={() =>
                  updateField(
                    'trackInventory',
                    !form.trackInventory,
                  )
                }
              >
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: form.trackInventory
                        ? '#ffffff'
                        : c.textSecondary,
                    },
                  ]}
                >
                  {form.trackInventory ? 'Activado' : 'Desactivado'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldFull}>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                Descripción
              </Text>

              <TextInput
                value={form.description}
                onChangeText={(value: string) =>
                  updateField('description', value)
                }
                placeholder="Descripción del producto..."
                placeholderTextColor={c.textMuted}
                multiline
                style={[
                  styles.textarea,
                  {
                    color: c.textPrimary,
                    backgroundColor: c.background,
                    borderColor: c.borderStrong,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: c.borderStrong },
              ]}
              onPress={closeForm}
              disabled={saving}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: c.textSecondary },
                ]}
              >
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: c.primary },
                saving && styles.disabledButton,
              ]}
              onPress={() => void saveProduct()}
              disabled={saving}
            >
              {saving ? (
                <Text style={styles.primaryButtonText}>Guardando…</Text>
              ) : (
                <Text style={styles.primaryButtonText}>
                  {editingProduct ? 'Guardar cambios' : 'Crear producto'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {filteredProducts.length === 0 ? (
        <View
          style={[
            styles.empty,
            {
              backgroundColor: c.surface,
              borderColor: c.borderStrong,
            },
          ]}
        >
          <Text style={styles.emptyIcon}>📦</Text>

          <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>
            No hay productos
          </Text>

          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            Crea tu primer producto para comenzar a utilizar el inventario.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredProducts.map((product) => (
            <View
              key={product._id}
              style={[
                styles.productCard,
                {
                  backgroundColor: c.surface,
                  borderColor: c.borderStrong,
                },
              ]}
            >
              <View style={styles.productMain}>
                <View style={styles.productTitleRow}>
                  <Text
                    style={[
                      styles.productName,
                      { color: c.textPrimary },
                    ]}
                  >
                    {product.name}
                  </Text>

                  <View
                    style={[
                      styles.status,
                      product.status === 'ACTIVE'
                        ? styles.activeStatus
                        : styles.inactiveStatus,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {product.status === 'ACTIVE'
                        ? 'ACTIVO'
                        : 'INACTIVO'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.productMeta,
                    { color: c.textSecondary },
                  ]}
                >
                  SKU: {product.sku}
                  {'  '}•{'  '}
                  Unidad: {product.unit}
                </Text>

                <Text
                  style={[
                    styles.productMeta,
                    { color: c.textSecondary },
                  ]}
                >
                  Costo: ${Number(product.cost).toFixed(2)}
                  {'  '}•{'  '}
                  Precio: ${Number(product.price).toFixed(2)}
                </Text>
              </View>

              <View style={styles.productActions}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { borderColor: c.borderStrong },
                  ]}
                  onPress={() => openEdit(product)}
                >
                  <Text
                    style={[
                      styles.actionText,
                      { color: c.textPrimary },
                    ]}
                  >
                    Editar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      borderColor: c.borderStrong,
                    },
                  ]}
                  onPress={() => void changeStatus(product)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color:
                          product.status === 'ACTIVE'
                            ? '#ef4444'
                            : '#22c55e',
                      },
                    ]}
                  >
                    {product.status === 'ACTIVE'
                      ? 'Desactivar'
                      : 'Activar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  theme,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: ReturnType<typeof useTheme>;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  const c = theme.semanticColors;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textSecondary }]}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: c.textPrimary,
            backgroundColor: c.background,
            borderColor: c.borderStrong,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    padding: 28,
    gap: 20,
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
  },

  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.6,
  },

  toolbar: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  search: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    fontSize: 14,
    outlineStyle: 'none',
  },

  count: {
    fontSize: 14,
    fontWeight: '600',
  },

  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
  },

  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  formTitle: {
    fontSize: 20,
    fontWeight: '800',
  },

  close: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 8,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  field: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 220,
    gap: 7,
  },

  fieldFull: {
    width: '100%',
    gap: 7,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
  },

  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    outlineStyle: 'none',
  },

  select: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },

  textarea: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    outlineStyle: 'none',
    resize: 'vertical',
  },

  toggle: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleText: {
    fontSize: 14,
    fontWeight: '700',
  },

  formActions: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },

  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  errorBox: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#3a1518',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },

  errorText: {
    color: '#fecaca',
    fontSize: 14,
  },

  empty: {
    minHeight: 260,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 500,
  },

  list: {
    gap: 12,
  },

  productCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },

  productMain: {
    flex: 1,
    minWidth: 0,
  },

  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  productName: {
    fontSize: 16,
    fontWeight: '800',
  },

  productMeta: {
    marginTop: 7,
    fontSize: 13,
  },

  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  activeStatus: {
    backgroundColor: '#14532d',
  },

  inactiveStatus: {
    backgroundColor: '#3f3f46',
  },

  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  productActions: {
    flexDirection: 'row',
    gap: 8,
  },

  actionButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});