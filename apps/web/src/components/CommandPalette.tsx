import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { zIndex } from '../theme/tokens';

interface Command {
  label: string;
  path: string;
  category: string;
  shortcut?: string;
}

const commands: Command[] = [
  { label: 'Dashboard', path: '/dashboard', category: 'Inicio', shortcut: 'Ctrl+/' },
  { label: 'Inventario', path: '/operations/inventory', category: 'Operaciones' },
  { label: 'Producción', path: '/operations/production', category: 'Operaciones' },
  { label: 'Mantenimiento', path: '/operations/maintenance', category: 'Operaciones' },
  { label: 'Compras', path: '/procurement/purchases', category: 'Abastecimiento' },
  { label: 'RRHH', path: '/people/employees', category: 'Personas' },
  { label: 'Asistente', path: '/assistant', category: 'ConvOps' },
];

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function CommandPalette({ visible, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const t = useTheme();

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleSelect = useCallback(
    (path: string) => {
      onSelect(path);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { zIndex: zIndex.commandPalette }]}>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar módulos, acciones, comandos..."
          placeholderTextColor="#64748B"
          autoFocus
          accessibilityLabel="Command palette search"
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item.path)}
              accessible
              accessibilityLabel={item.label}
            >
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemCategory}>{item.category}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No se encontraron resultados.</Text>
          }
          keyboardShouldPersistTaps="handled"
        />
        <Text style={styles.hint}>Ctrl+K / Cmd+K · Esc para cerrar</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0F1A80',
    justifyContent: 'flex-start',
    paddingTop: '15vh',
    zIndex: 200,
  },
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: '10%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2F4F4F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F1F5F9',
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2F4F4F',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#253347',
  },
  itemLabel: {
    color: '#F1F5F9',
    fontSize: 14,
  },
  itemCategory: {
    color: '#64748B',
    fontSize: 11,
  },
  empty: {
    color: '#64748B',
    fontSize: 13,
    padding: 16,
    textAlign: 'center',
  },
  hint: {
    color: '#4B5563',
    fontSize: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#253347',
  },
});
