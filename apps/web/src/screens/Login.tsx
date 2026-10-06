import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { authApi, friendlyMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

interface LoginScreenProps {
  onNavigate: (path: string) => void;
}

export function LoginScreen({ onNavigate }: LoginScreenProps) {
  const t = useTheme();
  const { login } = useAuth();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!company.trim() || !email.trim() || !password) {
      setError('Ingresa tu empresa, correo y contraseña.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tenant = await authApi.resolveTenant(company.trim());

      await login(email.trim(), password, tenant.tenantId);
      onNavigate('/dashboard');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <Text style={[styles.brand, { color: t.colors.text.primary }]}>TramaTech ERP</Text>
        <Text style={[styles.slogan, { color: t.colors.text.muted }]}>La red que mueve tu producción.</Text>

        <Input
          label="Empresa"
          value={company}
          onChangeText={setCompany}
          placeholder="mi-empresa"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.field}
        />

        <Input
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          placeholder="admin@miempresa.mx"
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={styles.field}
        />

        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          onSubmitEditing={handleSubmit}
          containerStyle={styles.field}
        />

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
        ) : null}

        <Button
          label="Iniciar sesión"
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />

        <TouchableOpacity onPress={() => onNavigate('/register')}>
          <Text style={[styles.link, { color: t.colors.text.ai }]}>¿No tienes cuenta? Crear una cuenta</Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  card: {
    borderRadius: 8,
    width: '100%',
    maxWidth: 420,
    padding: 32,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  slogan: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  field: { marginTop: 12 },
  error: {
    fontSize: 13,
    marginTop: 12,
  },
  button: {
    marginTop: 20,
  },
  link: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
