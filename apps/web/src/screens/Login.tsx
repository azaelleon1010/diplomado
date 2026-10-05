import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { friendlyMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

interface LoginScreenProps {
  onNavigate: (path: string) => void;
}

export function LoginScreen({ onNavigate }: LoginScreenProps) {
  const t = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onNavigate('/dashboard');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={[styles.card, { backgroundColor: t.colors.surface.primary, borderColor: t.colors.border.secondary }]}>
        <Text style={[styles.brand, { color: t.colors.text.primary }]}>TramaTech ERP</Text>
        <Text style={[styles.slogan, { color: t.colors.text.muted }]}>La red que mueve tu producción.</Text>

        <Text style={[styles.label, { color: t.colors.text.secondary }]}>Correo electrónico</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="admin@miempresa.mx"
          placeholderTextColor={t.colors.text.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: t.colors.text.primary, borderColor: t.colors.border.secondary, backgroundColor: t.colors.background.secondary }]}
        />

        <Text style={[styles.label, { color: t.colors.text.secondary }]}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={t.colors.text.muted}
          secureTextEntry
          onSubmitEditing={handleSubmit}
          style={[styles.input, { color: t.colors.text.primary, borderColor: t.colors.border.secondary, backgroundColor: t.colors.background.secondary }]}
        />

        {error ? (
          <Text style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.button, { backgroundColor: t.colors.brand.primary, opacity: loading ? 0.7 : 1 }]}
        >
          {loading ? (
            <Text style={styles.buttonText}>Cargando…</Text>
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onNavigate('/register')}>
          <Text style={[styles.link, { color: t.colors.text.ai }]}>¿No tienes cuenta? Crear una cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F1A',
    padding: 24,
    minHeight: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    borderWidth: 1,
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    outlineStyle: 'none',
  } as never,
  error: {
    fontSize: 13,
    marginTop: 12,
  },
  button: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  link: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
