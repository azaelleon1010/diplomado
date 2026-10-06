import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { friendlyMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

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

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Text style={[styles.brand, { color: t.colors.text.primary }]}>Crear cuenta</Text>
          <Text style={[styles.slogan, { color: t.colors.text.muted }]}>Registra tu empresa en TramaTech ERP.</Text>

          <Input label="Nombre de empresa *" value={companyName} onChangeText={setCompanyName}
            placeholder="Mi Empresa S.A. de C.V." containerStyle={styles.field} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Input label="Nombre" value={firstName} onChangeText={setFirstName} placeholder="Nombre"
                containerStyle={styles.field} />
            </View>
            <View style={styles.half}>
              <Input label="Apellido" value={lastName} onChangeText={setLastName} placeholder="Apellido"
                containerStyle={styles.field} />
            </View>
          </View>

          <Input label="Username *" value={username} onChangeText={setUsername} placeholder="usuario.empresa"
            autoCapitalize="none" containerStyle={styles.field} />

          <Input label="Correo electrónico *" value={email} onChangeText={setEmail} placeholder="admin@miempresa.mx"
            autoCapitalize="none" keyboardType="email-address" containerStyle={styles.field} />

          <Input label="Contraseña *" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres"
            secureTextEntry onSubmitEditing={handleSubmit} containerStyle={styles.field} />

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
          ) : null}

          <Button
            label="Crear cuenta"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />

          <TouchableOpacity onPress={() => onNavigate('/login')}>
            <Text style={[styles.link, { color: t.colors.text.ai }]}>¿Ya tienes cuenta? Iniciar sesión</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
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
  field: { marginTop: 12 },
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
    marginTop: 20,
  },
  link: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
