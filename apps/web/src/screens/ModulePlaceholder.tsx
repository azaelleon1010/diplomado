import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';

interface ModulePlaceholderProps {
  moduleName: string;
}

export function ModulePlaceholder({ moduleName }: ModulePlaceholderProps) {

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>📦</Text>
      </View>
      <Text style={styles.moduleName}>{moduleName}</Text>
      <Text style={styles.status}>Módulo en construcción</Text>
      <Text style={styles.hint}>
        Este módulo estará disponible en una fase posterior.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F1A',
    padding: 32,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: { fontSize: 28 },
  moduleName: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  status: {
    color: '#00FFCC',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
