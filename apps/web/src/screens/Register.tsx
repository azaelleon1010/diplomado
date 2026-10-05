import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { friendlyMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

interface RegisterScreenProps {
  onNavigate: (path: string) => void;
}

export function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const t = useTheme();
  const { register } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!companyName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Completa los campos obligatorios: empresa, usuario, correo y contraseña.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        companyName: companyName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      onNavigate('/dashboard');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: t.colors.text.primary, borderColor: t.colors.border.secondary, backgroundColor: t.colors.background.secondary },
  ];

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: t.colors.surface.primary, borderColor: t.colors.border.secondary }]}>
          <Text style={[styles.brand, { color: t.colors.text.primary }]}>Crear cuenta</Text>
          <Text style={[styles.slogan, { color: t.colors.text.muted }]}>Registra tu empresa en TramaTech ERP.</Text>

          <Text style={[styles.label, { color: t.colors.text.secondary }]}>Nombre de empresa *</Text>
          <TextInput value={companyName} onChangeText={setCompanyName} placeholder="Mi Empresa S.A. de C.V."
            placeholderTextColor={t.colors.text.muted} style={inputStyle} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={[styles.label, { color: t.colors.text.secondary }]}>Nombre</Text>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="Nombre"
                placeholderTextColor={t.colors.text.muted} style={inputStyle} />
            </View>
            <View style={styles.half}>
              <Text style={[styles.label, { color: t.colors.text.secondary }]}>Apellido</Text>
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Apellido"
                placeholderTextColor={t.colors.text.muted} style={inputStyle} />
            </View>
          </View>

          <Text style={[styles.label, { color: t.colors.text.secondary }]}>Username *</Text>
          <TextInput value={username} onChangeText={setUsername} placeholder="usuario.empresa" autoCapitalize="none"
            placeholderTextColor={t.colors.text.muted} style={inputStyle} />

          <Text style={[styles.label, { color: t.colors.text.secondary }]}>Correo electrónico *</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="admin@miempresa.mx" autoCapitalize="none"
            keyboardType="email-address" placeholderTextColor={t.colors.text.muted} style={inputStyle} />

          <Text style={[styles.label, { color: t.colors.text.secondary }]}>Contraseña *</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres"
            placeholderTextColor={t.colors.text.muted} secureTextEntry onSubmitEditing={handleSubmit} style={inputStyle} />

          {error ? (
            <Text style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, { backgroundColor: t.colors.brand.primary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <Text style={styles.buttonText}>Creando cuenta…</Text>
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onNavigate('/login')}>
            <Text style={[styles.link, { color: t.colors.text.ai }]}>¿Ya tienes cuenta? Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    minHeight: '100%',
  },
  scroll: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    flexGrow: 1,
  },
  card: {
    width: '100%',
    maxWidth: 480,
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
    marginBottom: 16,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
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
