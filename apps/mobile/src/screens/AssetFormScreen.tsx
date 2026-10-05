import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { friendlyMessage, loadSession, maintenanceApi } from '../lib/api';
import { pushAlert } from '../data/alerts';

export function AssetFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!code.trim()) {
      Alert.alert('Falta información', 'Ingresa el código del activo.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Falta información', 'Ingresa el nombre del activo.');
      return;
    }
    if (!type.trim()) {
      Alert.alert('Falta información', 'Ingresa el tipo de activo (ej. Hiladora, Torno).');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await maintenanceApi.createAsset(session.accessToken, {
        code: code.trim(),
        name: name.trim(),
        type: type.trim(),
        location: location.trim() || undefined,
        responsible: responsible.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      pushAlert('maintenance', 'Activo registrado', `${created.code} · ${created.name}`, 'success');
      Alert.alert('Activo creado', 'El activo se registró correctamente.', [
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
          <Text style={styles.title}>Nuevo activo</Text>
          <Text style={styles.subtitle}>Registra un equipo de planta</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Código *</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="Ej. HIL-04" placeholderTextColor="#98A2B3" style={styles.input} autoCapitalize="characters" />
        <Text style={styles.label}>Nombre *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Ej. Hiladora 4" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Tipo *</Text>
        <TextInput value={type} onChangeText={setType} placeholder="Ej. Hiladora, Torno, Compresor" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Ubicación</Text>
        <TextInput value={location} onChangeText={setLocation} placeholder="Ej. Planta A · Línea 2" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Responsable</Text>
        <TextInput value={responsible} onChangeText={setResponsible} placeholder="Nombre del responsable" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Notas</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notas adicionales" placeholderTextColor="#98A2B3" style={[styles.input, styles.textArea]} multiline />
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Guardar activo'}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  saveButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#98A2B3' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
