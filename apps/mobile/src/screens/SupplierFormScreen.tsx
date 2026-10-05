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
import { friendlyMessage, loadSession, purchasingApi } from '../lib/api';
import { pushAlert } from '../data/alerts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupplierFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!code.trim()) {
      Alert.alert('Falta información', 'Ingresa el código del proveedor.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Falta información', 'Ingresa el nombre del proveedor.');
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      Alert.alert('Dato inválido', 'El correo del proveedor no es válido.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await purchasingApi.createSupplier(session.accessToken, {
        code: code.trim(),
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        taxId: taxId.trim() || undefined,
      });
      pushAlert('purchasing', 'Proveedor registrado', `${created.code} · ${created.name}`, 'success');
      Alert.alert('Proveedor creado', 'El proveedor se registró correctamente.', [
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
          <Text style={styles.title}>Nuevo proveedor</Text>
          <Text style={styles.subtitle}>Catálogo de abastecimiento</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Código *</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="Ej. PROV-01" placeholderTextColor="#98A2B3" style={styles.input} autoCapitalize="characters" />
        <Text style={styles.label}>Nombre *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Ej. Aceros del Norte" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Contacto</Text>
        <TextInput value={contactName} onChangeText={setContactName} placeholder="Nombre del contacto" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Correo</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="contacto@proveedor.mx" placeholderTextColor="#98A2B3" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Ej. 55 1234 5678" placeholderTextColor="#98A2B3" style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.label}>Dirección</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder="Dirección fiscal" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>RFC / Tax ID</Text>
        <TextInput value={taxId} onChangeText={setTaxId} placeholder="Ej. XAXX010101000" placeholderTextColor="#98A2B3" style={styles.input} autoCapitalize="characters" />
        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Guardar proveedor'}</Text>
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
  saveButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#98A2B3' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
