import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { authApi, friendlyMessage } from '../lib/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

interface ForgotPasswordScreenProps {
  onNavigate: (path: string) => void;
}

export function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      // The API never reveals whether the email exists — the UI must not either.
      setSent(true);
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
        <Text style={[styles.slogan, { color: t.colors.text.muted }]}>Restablecer contraseña</Text>

        {sent ? (
          <>
            <Text style={[styles.message, { color: t.colors.text.primary }]}>
              Si <Text style={{ fontWeight: '700' }}>{email.trim()}</Text> está registrado, enviamos un correo con
              instrucciones para restablecer tu contraseña. El enlace es válido durante un tiempo limitado.
            </Text>
            <Button label="Volver a iniciar sesión" onPress={() => onNavigate('/login')} style={styles.button} />
          </>
        ) : (
          <>
            <Text style={[styles.message, { color: t.colors.text.muted }]}>
              Ingresa el correo con el que inició sesión tu cuenta. Te enviaremos un enlace para crear una nueva
              contraseña.
            </Text>

            <Input
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              placeholder="admin@miempresa.mx"
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={handleSubmit}
              containerStyle={styles.field}
            />

            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
            ) : null}

            <Button label="Enviar enlace" onPress={handleSubmit} loading={loading} style={styles.button} />

            <TouchableOpacity onPress={() => onNavigate('/login')}>
              <Text style={[styles.link, { color: t.colors.text.ai }]}>Volver a iniciar sesión</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100%' },
  card: { borderRadius: 8, width: '100%', maxWidth: 420, padding: 32 },
  brand: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  slogan: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  field: { marginTop: 16 },
  error: { fontSize: 13, marginTop: 12 },
  button: { marginTop: 20 },
  link: { fontSize: 13, textAlign: 'center', marginTop: 16 },
});
