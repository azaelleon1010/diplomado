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
  hrApi,
  loadSession,
  type Employee,
} from '../lib/api';
import { pushAlert } from '../data/alerts';

const TYPES = [
  { id: 'VACATION', label: 'Vacaciones' },
  { id: 'SICK', label: 'Incapacidad' },
  { id: 'PERMISSION', label: 'Permiso' },
] as const;

export function TimeOffFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [type, setType] = useState<'VACATION' | 'SICK' | 'PERMISSION'>('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function loadEmployees(): Promise<void> {
    try {
      setLoadingEmployees(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const list = await hrApi.listEmployees(session.accessToken, { limit: 100 });
      setEmployees((Array.isArray(list) ? list : []).filter((e) => e.status === 'ACTIVE'));
    } catch (error) {
      setEmployees([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!employeeId) {
      Alert.alert('Falta información', 'Selecciona el empleado.');
      return;
    }
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert('Falta información', 'Ingresa las fechas de inicio y fin (AAAA-MM-DD).');
      return;
    }
    if (startDate.trim() > endDate.trim()) {
      Alert.alert('Dato inválido', 'La fecha de inicio no puede ser posterior a la de fin.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await hrApi.createTimeOff(session.accessToken, {
        employeeId,
        type,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        reason: reason.trim() || undefined,
      });
      pushAlert('system', 'Solicitud registrada', `${employeeName} · ${created.startDate} → ${created.endDate}`, 'info');
      Alert.alert('Solicitud creada', 'La solicitud quedó registrada como Pendiente.', [
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
          <Text style={styles.title}>Nueva ausencia</Text>
          <Text style={styles.subtitle}>Vacaciones, incapacidad o permiso</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Empleado *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setEmployeeModalVisible(true)} disabled={loadingEmployees}>
          <View style={styles.selectorContent}>
            {loadingEmployees ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>Cargando personal…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !employeeName && styles.selectorPlaceholder]}>
                {employeeName || 'Seleccionar empleado'}
              </Text>
            )}
          </View>
          {!loadingEmployees ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        {!loadingEmployees && employees.length === 0 ? (
          <Text style={styles.hint}>No hay empleados activos. Registra personal primero.</Text>
        ) : null}

        <Text style={styles.label}>Tipo *</Text>
        <View style={styles.optionRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setType(t.id)}
              style={[styles.option, type === t.id && styles.optionSelected]}>
              <Text style={[styles.optionText, type === t.id && styles.optionTextSelected]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Fecha inicio *</Text>
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-DD" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Fecha fin *</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="AAAA-MM-DD" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Motivo</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="Motivo de la ausencia" placeholderTextColor={darkPalette.textMuted} style={[styles.input, styles.textArea]} multiline />

        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Crear solicitud'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={employeeModalVisible} transparent animationType="slide" onRequestClose={() => setEmployeeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar empleado</Text>
              <TouchableOpacity onPress={() => setEmployeeModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {employees.map((employee) => (
                <TouchableOpacity
                  key={employee._id}
                  onPress={() => {
                    setEmployeeId(employee._id);
                    setEmployeeName(`${employee.firstName} ${employee.lastName}`);
                    setEmployeeModalVisible(false);
                  }}
                  style={[styles.option, styles.modalOption, employeeId === employee._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, employeeId === employee._id && styles.optionTextSelected]}>
                    {employee.firstName} {employee.lastName}
                  </Text>
                  {employeeId === employee._id ? <Text style={styles.checkmark}>✓</Text> : null}
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
  modalOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkmark: { fontSize: 20, color: darkPalette.brand, fontWeight: '700' },
});
