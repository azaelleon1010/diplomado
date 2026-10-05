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
                <ActivityIndicator size="small" color="#2563EB" />
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
        <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#98A2B3" style={styles.input} keyboardType="decimal-pad" />
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
        <TextInput value={concept} onChangeText={setConcept} placeholder="Ej. Cobro factura F-102" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Referencia</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Folio, factura, etc." placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Fecha *</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor="#98A2B3" style={styles.input} />

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
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { backgroundColor: '#FFFFFF', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#E1E5EA', flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backButtonText: { fontSize: 32, color: '#111827', lineHeight: 36 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 15, color: '#667085', marginTop: 5 },
  content: { padding: 20, paddingBottom: 50 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 7 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#111827', marginBottom: 18 },
  selector: { minHeight: 51, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingHorizontal: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  selectorText: { fontSize: 16, color: '#111827' },
  selectorPlaceholder: { color: '#98A2B3' },
  selectorLoading: { marginLeft: 10, fontSize: 15, color: '#667085' },
  selectorArrow: { fontSize: 24, color: '#667085', marginLeft: 10 },
  hint: { fontSize: 13, color: '#667085', marginBottom: 18, marginTop: -10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  option: { borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  optionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 14, color: '#344054', fontWeight: '600' },
  optionTextSelected: { color: '#2563EB', fontWeight: '700' },
  saveButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#98A2B3' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '75%', paddingBottom: 30 },
  modalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E1E5EA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 27, color: '#344054', lineHeight: 30 },
  optionList: { padding: 20 },
  mOption: { minHeight: 54, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5EA', backgroundColor: '#FFFFFF', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mOptionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  mOptionText: { fontSize: 16, color: '#111827' },
  mOptionTextSelected: { color: '#2563EB', fontWeight: '700' },
  mCheckmark: { fontSize: 20, color: '#2563EB', fontWeight: '700' },
});
