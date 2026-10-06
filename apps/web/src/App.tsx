import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native-web';
import { ThemeProvider } from './theme/Theme';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useNavigation, renderRoute } from './navigation/routes';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { getAuthRedirectTarget } from './navigation/registry';
import { LoadingState } from './components/States';
import { semanticColors } from './theme/tokens';
import "./styles/global.css";

function displayNameOf(user: { username: string; firstName?: string; lastName?: string }): string {
  const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return full || user.username;
}

function AuthenticatedShell() {
  const { path, navigate } = useNavigation();
  const { visible, open, close } = useCommandPalette();
  const { user, tenant, permissions, loading, logout } = useAuth();

  const handleNavigate = (target: string) => {
    navigate(target);
    close();
  };

  useEffect(() => {
    if (loading) return;
    const redirect = getAuthRedirectTarget(path, Boolean(user));
    if (redirect) navigate(redirect);
  }, [loading, user, path, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return <View style={styles.splash}><LoadingState label="Cargando sesión…" /></View>;
  }

  if (!user) {
    const target = ['/login', '/register'].includes(path) ? path : '/login';
    if (target !== path) return <View style={styles.splash}><LoadingState label="Volviendo al inicio de sesión…" /></View>;
    return (
      <View style={styles.root}>
        {renderRoute(target, handleNavigate)}
      </View>
    );
  }

  if (getAuthRedirectTarget(path, true)) {
    return <View style={styles.splash}><LoadingState label="Abriendo la aplicación…" /></View>;
  }

  const userName = displayNameOf(user);
  const tenantName = tenant?.name ?? user.tenantId;

  return (
    <View style={styles.root}>
      <AppShell
        currentPath={path}
        permissions={permissions}
        userName={userName}
        email={user.email}
        tenantName={tenantName}
        onNavigate={handleNavigate}
        onOpenCommandPalette={open}
        onLogout={handleLogout}>
        {renderRoute(path, handleNavigate, permissions)}
      </AppShell>
      <CommandPalette visible={visible} permissions={permissions} onClose={close} onSelect={handleNavigate} />
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
    backgroundColor: semanticColors.background,
    height: '100%',
    width: '100%',
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.background,
    height: '100%',
    width: '100%',
  },
});
