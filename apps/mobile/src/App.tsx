/**
 * TramaTech ERP — Mobile (Fase 2: Mobile UI Foundation).
 *
 * UI + navegación + datos mock. Sin API real todavía.
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './theme/Theme';
import { AuthProvider } from './auth/AuthContext';
import { RootNavigator } from './navigation/RootNavigator';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar barStyle="light-content" />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
