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
  financeApi,
  friendlyMessage,
  loadSession,
  type Account,
  type FinanceCategory,
} from '../lib/api';
import { pushAlert } from '../data/alerts';

const KINDS = [
  { id: 'INCOME', label: 'Ingreso' },
  { id: 'EXPENSE', label: 'Gasto' },
] as const;

const METHODS = [
  { id: 'CASH', label: 'Efectivo' },
  { id: 'TRANSFER', label: 'Transferencia' },
  { id: 'CARD', label: 'Tarjeta' },
  { id: 'OTHER', label: 'Otro' },
] as const;

function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function FinanceMovementFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'OTHER'>('TRANSFER');
  const [concept, setConcept] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCatalogs();
  }, []);

  async function loadCatalogs(): Promise<void> {
    try {
      setLoadingCatalogs(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const [fetchedAccounts, fetchedCategories] = await Promise.all([
        financeApi.listAccounts(session.accessToken),
        financeApi.listCategories(session.accessToken).catch(() => [] as FinanceCategory[]),
      ]);
      setAccounts((Array.isArray(fetchedAccounts) ? fetchedAccounts : []).filter((a) => a.status === 'ACTIVE'));
      setCategories((Array.isArray(fetchedCategories) ? fetchedCategories : []).filter((c) => c.status === 'ACTIVE'));
    } catch (error) {
      setAccounts([]);
      setCategories([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingCatalogs(false);
    }
  }

  const kindCategories = categories.filter((c) => c.kind === kind);

  async function handleSubmit(): Promise<void> {
    if (!accountId) {
      Alert.alert('Falta información', 'Selecciona la cuenta del movimiento.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Dato inválido', 'El monto debe ser mayor a 0.');
      return;
    }
    if (!concept.trim()) {
      Alert.alert('Falta información', 'Ingresa el concepto del movimiento.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Falta información', 'Ingresa la fecha del movimiento (AAAA-MM-DD).');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await financeApi.createMovement(session.accessToken, {
        accountId,
        categoryId: categoryId || undefined,
        kind,
        amount: parsedAmount,
        method,
        concept: concept.trim(),
        reference: reference.trim() || undefined,
        date: date.trim(),
      });
      pushAlert(
        'system',
        kind === 'INCOME' ? 'Ingreso registrado' : 'Gasto registrado',
        `${created.concept} · $${created.amount.toFixed(2)}`,
        kind === 'INCOME' ? 'success' : 'info',
      );
      Alert.alert('Movimiento creado', 'El movimiento quedó publicado correctamente.', [
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
          <Text style={styles.title}>Nuevo movimiento</Text>
          <Text style={styles.subtitle}>Ingreso o gasto real</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Tipo *</Text>
        <View style={styles.optionRow}>
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k.id}
              onPress={() => {
                setKind(k.id);
                setCategoryId('');
                setCategoryName('');
              }}
              style={[styles.option, kind === k.id && styles.optionSelected]}>
              <Text style={[styles.optionText, kind === k.id && styles.optionTextSelected]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Cuenta *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setAccountModalVisible(true)} disabled={loadingCatalogs}>
          <View style={styles.selectorContent}>
            {loadingCatalogs ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>Cargando cuentas…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !accountName && styles.selectorPlaceholder]}>
                {accountName || 'Seleccionar cuenta'}
              </Text>
            )}
          </View>
          {!loadingCatalogs ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        {!loadingCatalogs && accounts.length === 0 ? (
          <Text style={styles.hint}>No hay cuentas activas. Pide a tu administrador que cree el catálogo contable.</Text>
        ) : null}

        <Text style={styles.label}>Categoría</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setCategoryModalVisible(true)} disabled={loadingCatalogs}>
          <Text style={[styles.selectorText, !categoryName && styles.selectorPlaceholder]}>
            {categoryName || 'Seleccionar categoría (opcional)'}
          </Text>
          <Text style={styles.selectorArrow}>⌄</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Monto *</Text>
        <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={darkPalette.textMuted} style={styles.input} keyboardType="decimal-pad" />
        <Text style={styles.label}>Método *</Text>
        <View style={styles.optionRow}>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setMethod(m.id)}
              style={[styles.option, method === m.id && styles.optionSelected]}>
              <Text style={[styles.optionText, method === m.id && styles.optionTextSelected]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Concepto *</Text>
        <TextInput value={concept} onChangeText={setConcept} placeholder="Ej. Cobro factura F-102" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Referencia</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Folio, factura, etc." placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Fecha *</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={darkPalette.textMuted} style={styles.input} />

        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Registrar movimiento'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={accountModalVisible} transparent animationType="slide" onRequestClose={() => setAccountModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar cuenta</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account._id}
                  onPress={() => {
                    setAccountId(account._id);
                    setAccountName(`${account.code} · ${account.name}`);
                    setAccountModalVisible(false);
                  }}
                  style={[styles.mOption, accountId === account._id && styles.mOptionSelected]}>
                  <Text style={[styles.mOptionText, accountId === account._id && styles.mOptionTextSelected]}>
                    {account.code} · {account.name}
                  </Text>
                  {accountId === account._id ? <Text style={styles.mCheckmark}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={categoryModalVisible} transparent animationType="slide" onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar categoría</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              <TouchableOpacity
                onPress={() => {
                  setCategoryId('');
                  setCategoryName('');
                  setCategoryModalVisible(false);
                }}
                style={styles.mOption}>
                <Text style={styles.mOptionText}>Sin categoría</Text>
              </TouchableOpacity>
              {kindCategories.map((category) => (
                <TouchableOpacity
                  key={category._id}
                  onPress={() => {
                    setCategoryId(category._id);
                    setCategoryName(category.name);
                    setCategoryModalVisible(false);
                  }}
                  style={[styles.mOption, categoryId === category._id && styles.mOptionSelected]}>
                  <Text style={[styles.mOptionText, categoryId === category._id && styles.mOptionTextSelected]}>
                    {category.name}
                  </Text>
                  {categoryId === category._id ? <Text style={styles.mCheckmark}>✓</Text> : null}
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
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  option: { borderWidth: 1, borderColor: darkPalette.borderStrong, backgroundColor: darkPalette.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { borderColor: darkPalette.brand, backgroundColor: darkPalette.brandSoft },
  optionText: { fontSize: 14, color: darkPalette.textPrimary, fontWeight: '600' },
  optionTextSelected: { color: darkPalette.brand, fontWeight: '700' },
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
  mOption: { minHeight: 54, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: darkPalette.borderStrong, backgroundColor: darkPalette.surface, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mOptionSelected: { borderColor: darkPalette.brand, backgroundColor: darkPalette.brandSoft },
  mOptionText: { fontSize: 16, color: darkPalette.textPrimary },
  mOptionTextSelected: { color: darkPalette.brand, fontWeight: '700' },
  mCheckmark: { fontSize: 20, color: darkPalette.brand, fontWeight: '700' },
});
