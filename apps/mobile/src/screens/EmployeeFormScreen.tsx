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
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAppNavigation } from '../hooks/useAppNavigation';
import {
  friendlyMessage,
  hrApi,
  loadSession,
  type Department,
} from '../lib/api';
import { pushAlert } from '../data/alerts';
import type { OperationsStackParamList } from '../navigation/types';

type FormRoute = RouteProp<OperationsStackParamList, 'EmployeeForm'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmployeeFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = useRoute<FormRoute>();
  const editingId = route.params?.employeeId;
  const isEditing = editingId !== undefined;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [position, setPosition] = useState('');
  const [location, setLocation] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCatalogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCatalogs(): Promise<void> {
    try {
      setLoadingCatalogs(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const [fetchedDepartments] = await Promise.all([
        hrApi.listDepartments(session.accessToken).catch(() => [] as Department[]),
      ]);
      const depList = Array.isArray(fetchedDepartments) ? fetchedDepartments : [];
      setDepartments(depList);
      if (isEditing) {
        const found = (await hrApi.listEmployees(session.accessToken, { limit: 100 })).find((e) => e._id === editingId);
        if (found) {
          setCode(found.code);
          setFirstName(found.firstName);
          setLastName(found.lastName);
          setEmail(found.email ?? '');
          setPhone(found.phone ?? '');
          setDepartmentId(found.departmentId ?? '');
          setDepartmentName(depList.find((d) => d._id === found.departmentId)?.name ?? '');
          setPosition(found.position ?? '');
          setLocation(found.location ?? '');
          setExpectedVersion(found.version);
        }
      }
    } catch (error) {
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingCatalogs(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!code.trim()) {
      Alert.alert('Falta información', 'Ingresa el código del empleado.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Falta información', 'Ingresa nombre y apellido del empleado.');
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      Alert.alert('Dato inválido', 'El correo del empleado no es válido.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await hrApi.updateEmployee(session.accessToken, editingId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          departmentId: departmentId || null,
          position: position.trim() || null,
          location: location.trim() || null,
          expectedVersion,
        });
        pushAlert('system', 'Empleado actualizado', `${firstName.trim()} ${lastName.trim()}`, 'info');
        Alert.alert('Empleado actualizado', 'Los datos se guardaron correctamente.', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
      } else {
        const created = await hrApi.createEmployee(session.accessToken, {
          code: code.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          departmentId: departmentId || undefined,
          position: position.trim() || undefined,
          location: location.trim() || undefined,
        });
        pushAlert('system', 'Empleado registrado', `${created.code} · ${created.firstName} ${created.lastName}`, 'success');
        Alert.alert('Empleado creado', 'El empleado se registró correctamente.', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
      }
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
          <Text style={styles.title}>{isEditing ? 'Editar empleado' : 'Nuevo empleado'}</Text>
          <Text style={styles.subtitle}>Datos del personal</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Código *</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="Ej. EMP-001" placeholderTextColor={darkPalette.textMuted} style={styles.input} autoCapitalize="characters" editable={!isEditing} />
        <Text style={styles.label}>Nombre *</Text>
        <TextInput value={firstName} onChangeText={setFirstName} placeholder="Nombre" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Apellido *</Text>
        <TextInput value={lastName} onChangeText={setLastName} placeholder="Apellido" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Correo</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="empleado@empresa.mx" placeholderTextColor={darkPalette.textMuted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Ej. 55 1234 5678" placeholderTextColor={darkPalette.textMuted} style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.label}>Departamento</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setDepartmentModalVisible(true)} disabled={loadingCatalogs}>
          <View style={styles.selectorContent}>
            {loadingCatalogs ? (
              <>
                <ActivityIndicator size="small" color={darkPalette.brand} />
                <Text style={styles.selectorLoading}>Cargando departamentos…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !departmentName && styles.selectorPlaceholder]}>
                {departmentName || 'Seleccionar departamento'}
              </Text>
            )}
          </View>
          {!loadingCatalogs ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        <Text style={styles.label}>Puesto</Text>
        <TextInput value={position} onChangeText={setPosition} placeholder="Ej. Operador" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <Text style={styles.label}>Ubicación</Text>
        <TextInput value={location} onChangeText={setLocation} placeholder="Ej. Planta A" placeholderTextColor={darkPalette.textMuted} style={styles.input} />
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear empleado'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={departmentModalVisible} transparent animationType="slide" onRequestClose={() => setDepartmentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar departamento</Text>
              <TouchableOpacity onPress={() => setDepartmentModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              <TouchableOpacity
                onPress={() => {
                  setDepartmentId('');
                  setDepartmentName('');
                  setDepartmentModalVisible(false);
                }}
                style={styles.option}>
                <Text style={styles.optionText}>Sin departamento</Text>
              </TouchableOpacity>
              {departments.map((department) => (
                <TouchableOpacity
                  key={department._id}
                  onPress={() => {
                    setDepartmentId(department._id);
                    setDepartmentName(department.name);
                    setDepartmentModalVisible(false);
                  }}
                  style={[styles.option, departmentId === department._id && styles.optionSelected]}>
                  <Text style={[styles.optionText, departmentId === department._id && styles.optionTextSelected]}>
                    {department.name}
                  </Text>
                  {departmentId === department._id ? <Text style={styles.checkmark}>✓</Text> : null}
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
