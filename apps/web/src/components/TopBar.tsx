import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  userName?: string;
  onLogout?: () => void;
}

export function TopBar({ collapsed, onToggleSidebar, userName, onLogout }: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.left}>
        <TouchableOpacity
          onPress={onToggleSidebar}
          style={styles.menuButton}
          accessible
          accessibilityLabel="Toggle sidebar"
          accessibilityRole="button"
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Centro de Operaciones</Text>
      </View>
      <View style={styles.right}>
        <TouchableOpacity
          style={styles.statusDot}
          accessible
          accessibilityLabel="Status: connected"
        >
          <Text style={styles.statusDotGreen}>●</Text>
        </TouchableOpacity>
        <Text style={styles.userName}>{userName ?? 'Operador'}</Text>
        {onLogout ? (
          <TouchableOpacity
            onPress={onLogout}
            style={styles.logoutButton}
            accessible
            accessibilityLabel="Cerrar sesión"
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 52,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 20,
    color: '#94A3B8',
  },
  pageTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusDot: {
    padding: 4,
  },
  statusDotGreen: {
    color: '#22C55E',
    fontSize: 12,
  },
  userName: {
    color: '#94A3B8',
    fontSize: 13,
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  logoutText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
});
