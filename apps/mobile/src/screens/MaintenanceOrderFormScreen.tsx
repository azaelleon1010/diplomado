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
  loadSession,
  maintenanceApi,
  type Asset,
} from '../lib/api';
import { pushAlert } from '../data/alerts';

const TYPES = [
  { id: 'PREVENTIVE', label: 'Preventivo' },
  { id: 'CORRECTIVE', label: 'Correctivo' },
] as const;

const PRIORITIES = [
  { id: 'LOW', label: 'Baja' },
  { id: 'MEDIUM', label: 'Media' },
  { id: 'HIGH', label: 'Alta' },
  { id: 'CRITICAL', label: 'Crítica' },
] as const;

export function MaintenanceOrderFormScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [type, setType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('CORRECTIVE');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [cost, setCost] = useState('0');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadAssets();
  }, []);

  async function loadAssets(): Promise<void> {
    try {
      setLoadingAssets(true);
      const session = await loadSession();
      if (!session?.accessToken) {
        Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const list = await maintenanceApi.listAssets(session.accessToken);
      setAssets(Array.isArray(list) ? list.filter((a) => a.status === 'ACTIVE') : []);
    } catch (error) {
      setAssets([]);
      Alert.alert('Error', friendlyMessage(error));
    } finally {
      setLoadingAssets(false);
    }
  }

  function selectAsset(asset: Asset): void {
    if (!asset._id) {
      Alert.alert('Activo inválido', 'El activo recibido no tiene un identificador válido.');
      return;
    }
    setAssetId(asset._id);
    setAssetName(`${asset.code} · ${asset.name}`);
    setAssetModalVisible(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!assetId) {
      Alert.alert('Falta información', 'Selecciona el activo a intervenir.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Falta información', 'Ingresa el título de la orden.');
      return;
    }
    const parsedCost = Number(cost || '0');
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      Alert.alert('Dato inválido', 'Ingresa un costo válido mayor o igual a 0.');
      return;
    }
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setSaving(true);
    try {
      const created = await maintenanceApi.createOrder(session.accessToken, {
        assetId,
        type,
        priority,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledFor: scheduledFor.trim() || undefined,
        cost: parsedCost,
        assignedTo: assignedTo.trim() || undefined,
      });
      pushAlert('maintenance', 'Orden de mantenimiento creada', `${created.title} · Prioridad ${created.priority}`, created.priority === 'HIGH' || created.priority === 'CRITICAL' ? 'danger' : 'info');
      Alert.alert('Orden creada', 'La orden de mantenimiento se registró correctamente.', [
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
          <Text style={styles.title}>Nueva orden</Text>
          <Text style={styles.subtitle}>Mantenimiento preventivo o correctivo</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Activo *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setAssetModalVisible(true)} disabled={loadingAssets}>
          <View style={styles.selectorContent}>
            {loadingAssets ? (
              <>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.selectorLoading}>Cargando activos…</Text>
              </>
            ) : (
              <Text style={[styles.selectorText, !assetName && styles.selectorPlaceholder]}>
                {assetName || 'Seleccionar activo'}
              </Text>
            )}
          </View>
          {!loadingAssets ? <Text style={styles.selectorArrow}>⌄</Text> : null}
        </TouchableOpacity>
        {!loadingAssets && assets.length === 0 ? (
          <Text style={styles.noAssetsHint}>No hay activos disponibles. Registra un activo antes de crear la orden.</Text>
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

        <Text style={styles.label}>Prioridad *</Text>
        <View style={styles.optionRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setPriority(p.id)}
              style={[styles.option, priority === p.id && styles.optionSelected]}>
              <Text style={[styles.optionText, priority === p.id && styles.optionTextSelected]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Título *</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Ej. Banda rota en hiladora" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Descripción</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Detalle de la falla o trabajo" placeholderTextColor="#98A2B3" style={[styles.input, styles.textArea]} multiline />
        <Text style={styles.label}>Programada para</Text>
        <TextInput value={scheduledFor} onChangeText={setScheduledFor} placeholder="Ej. 2026-10-10" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={styles.label}>Costo estimado</Text>
        <TextInput value={cost} onChangeText={setCost} placeholder="0.00" placeholderTextColor="#98A2B3" style={styles.input} keyboardType="decimal-pad" />
        <Text style={styles.label}>Asignado a</Text>
        <TextInput value={assignedTo} onChangeText={setAssignedTo} placeholder="Nombre del técnico" placeholderTextColor="#98A2B3" style={styles.input} />

        <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Crear orden'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={assetModalVisible} transparent animationType="slide" onRequestClose={() => setAssetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Seleccionar activo</Text>
                <Text style={styles.modalSubtitle}>Solo equipos activos</Text>
              </View>
              <TouchableOpacity onPress={() => setAssetModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            {assets.length === 0 ? (
              <View style={styles.emptyAssets}>
                <Text style={styles.emptyTitle}>No hay activos</Text>
                <Text style={styles.emptyDescription}>Primero debes registrar un activo para poder asignarle la orden.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.assetList}>
                {assets.map((asset) => {
                  const selected = asset._id === assetId;
                  return (
                    <TouchableOpacity
                      key={asset._id}
                      onPress={() => selectAsset(asset)}
                      style={[styles.assetOption, selected && styles.assetOptionSelected]}>
                      <Text style={[styles.assetOptionText, selected && styles.assetOptionTextSelected]}>
                        {asset.code} · {asset.name}
                      </Text>
                      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
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
  noAssetsHint: { fontSize: 13, color: '#667085', marginBottom: 18, marginTop: -10 },
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
  modalSubtitle: { fontSize: 14, color: '#667085', marginTop: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 27, color: '#344054', lineHeight: 30 },
  emptyAssets: { padding: 30, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyDescription: { fontSize: 14, lineHeight: 21, color: '#667085', textAlign: 'center' },
  assetList: { padding: 20 },
  assetOption: { minHeight: 54, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5EA', backgroundColor: '#FFFFFF', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assetOptionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  assetOptionText: { fontSize: 16, color: '#111827' },
  assetOptionTextSelected: { color: '#2563EB', fontWeight: '700' },
  checkmark: { fontSize: 20, color: '#2563EB', fontWeight: '700' },
});
