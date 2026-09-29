/**
 * TramaTech ERP — Mobile (Fase 1)
 *
 * Pantalla inicial mínima. Solo valida que la app Android
 * generada por la plantilla oficial arranca correctamente.
 * Sin autenticación, sin API real, sin dashboard.
 */

import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      <Text style={styles.brand}>TramaTech ERP</Text>
      <Text style={styles.subtitle}>Centro de Operaciones</Text>
      <Text style={styles.status}>
        Android inicializado correctamente. Fase 1.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#00FFCC',
    fontSize: 16,
    marginTop: 8,
  },
  status: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default App;
