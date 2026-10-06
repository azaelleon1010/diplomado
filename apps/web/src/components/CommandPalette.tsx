import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { colors, zIndex } from '../theme/tokens';
import { useTheme } from '../theme/Theme';
import { getCommandRoutes } from '../navigation/registry';

interface CommandPaletteProps {
  visible: boolean;
  permissions: readonly string[];
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function CommandPalette({ visible, permissions, onClose, onSelect }: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const { semanticColors: color } = useTheme();
  const commands = getCommandRoutes(permissions);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = query
    ? commands.filter((command) =>
        command.title.toLowerCase().includes(query.toLowerCase())
        || command.section.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const handleSelect = useCallback((path: string) => {
    onSelect(path);
    onClose();
  }, [onSelect, onClose]);

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { zIndex: zIndex.commandPalette, backgroundColor: colors.surface.overlay }]}>
      <View style={[styles.container, { backgroundColor: color.surface, borderColor: color.border }]}>
        <TextInput
          style={[styles.input, { color: color.textPrimary, borderBottomColor: color.border }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar módulos y pantallas…"
          placeholderTextColor={color.textMuted}
          autoFocus
          accessibilityLabel="Buscar en la paleta de comandos"
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderBottomColor: color.neutralSoft }]}
              onPress={() => handleSelect(item.path)}
              accessibilityRole="button"
              accessibilityLabel={item.title}>
              <Text style={[styles.itemLabel, { color: color.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.itemCategory, { color: color.textMuted }]}>{item.section}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: color.textMuted }]}>No se encontraron resultados.</Text>}
          keyboardShouldPersistTaps="handled"
        />
        <Text style={[styles.hint, { color: color.textMuted, borderTopColor: color.neutralSoft }]}>Ctrl+K / Cmd+K · Esc para cerrar</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-start',
    paddingTop: '15vh',
  },
  container: {
    borderRadius: 12,
    marginHorizontal: '10%',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderBottomWidth: 1,
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  itemLabel: { fontSize: 14 },
  itemCategory: { fontSize: 11 },
  empty: { fontSize: 13, padding: 16, textAlign: 'center' },
  hint: {
    fontSize: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
    borderTopWidth: 1,
  },
});
