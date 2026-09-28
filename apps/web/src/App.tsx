import React from 'react';
import { View, StyleSheet } from 'react-native-web';
import { ThemeProvider } from './theme/Theme';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useNavigation, renderRoute } from './navigation/routes';
import "./styles/global.css";

function AppContent() {
  const { path, navigate } = useNavigation();
  const { visible, open, close } = useCommandPalette();

  const handleNavigate = (target: string) => {
    navigate(target);
    close();
  };

  return (
    <View style={styles.root}>
      <AppShell currentPath={path} onNavigate={handleNavigate}>
        {renderRoute(path)}
      </AppShell>
      <CommandPalette visible={visible} onClose={close} onSelect={handleNavigate} />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    height: '100%',
    width: '100%',
  },
});
