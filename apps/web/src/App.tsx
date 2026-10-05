import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native-web';
import { ThemeProvider } from './theme/Theme';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useNavigation, renderRoute, PUBLIC_ROUTES } from './navigation/routes';
import { AuthProvider, useAuth } from './auth/AuthContext';
import "./styles/global.css";

function displayNameOf(user: { username: string; firstName?: string; lastName?: string }): string {
  const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return full || user.username;
}

function AuthenticatedShell() {
  const { path, navigate } = useNavigation();
  const { visible, close } = useCommandPalette();
  const { user, tenant, loading, logout } = useAuth();

  const handleNavigate = (target: string) => {
    navigate(target);
    close();
  };

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC_ROUTES.includes(path) && path !== '/') {
      navigate('/login');
    } else if (user && (path === '/login' || path === '/register' || path === '/')) {
      navigate('/dashboard');
    }
  }, [loading, user, path, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>TramaTech ERP</Text>
      </View>
    );
  }

  if (!user) {
    const target = PUBLIC_ROUTES.includes(path) ? path : '/login';
    return (
      <View style={styles.root}>
        {renderRoute(target, handleNavigate)}
      </View>
    );
  }

  const session = {
    userName: displayNameOf(user),
    email: user.email,
    tenantName: tenant ? tenant.name : user.tenantId,
  };

  return (
    <View style={styles.root}>
      <AppShell currentPath={path} onNavigate={handleNavigate} userName={session.userName} onLogout={handleLogout}>
        {renderRoute(path, handleNavigate, session)}
      </AppShell>
      <CommandPalette visible={visible} onClose={close} onSelect={handleNavigate} />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthenticatedShell />
      </AuthProvider>
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
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F1A',
    height: '100%',
    width: '100%',
  },
  splashText: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
  },
});
