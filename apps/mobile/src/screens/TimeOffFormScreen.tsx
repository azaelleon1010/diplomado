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
                <ActivityIndicator size="small" color="#2563EB" />
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
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-DD" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Fecha fin *</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="AAAA-MM-DD" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Motivo</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="Motivo de la ausencia" placeholderTextColor="#98A2B3" style={[styles.input, styles.textArea]} multiline />

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
  textArea: { height: 90, textAlignVertical: 'top' },
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
  modalOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkmark: { fontSize: 20, color: '#2563EB', fontWeight: '700' },
});
