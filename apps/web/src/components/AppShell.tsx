import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native-web';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useTheme } from '../theme/Theme';

interface AppShellProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  userName?: string;
  onLogout?: () => void;
}

export function AppShell({ children, currentPath, onNavigate, userName, onLogout }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((c) => !c), []);

  return (
    <View style={styles.container}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
      <View style={[styles.main, sidebarCollapsed && styles.mainCollapsed]}>
        <TopBar collapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} userName={userName} onLogout={onLogout} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0B0F1A',
    height: '100%',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 260,
    transition: 'margin-left 0.2s ease',
  },
  mainCollapsed: {
    marginLeft: 64,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
