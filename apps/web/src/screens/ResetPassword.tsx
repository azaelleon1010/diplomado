import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { authApi, friendlyMessage } from '../lib/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

interface ResetPasswordScreenProps {
  onNavigate: (path: string) => void;
}

/** rid + token come from the link in the password-reset email (see authApi.forgotPassword). */
function readLinkParams(): { resetId: string; token: string } {
  const params = new URLSearchParams(window.location.search);
  return { resetId: params.get('rid') ?? '', token: params.get('token') ?? '' };
}

export function ResetPasswordScreen({ onNavigate }: ResetPasswordScreenProps) {
  const t = useTheme();
  const [{ resetId, token }] = useState(readLinkParams);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const linkMissing = !resetId || !token;

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(resetId, token, newPassword);
      setDone(true);
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
        <Text style={[styles.slogan, { color: t.colors.text.muted }]}>Crear nueva contraseña</Text>

        {linkMissing ? (
          <>
            <Text style={[styles.message, { color: t.colors.status.danger }]}>
              Este enlace no es válido. Solicita un nuevo correo de restablecimiento.
            </Text>
            <Button label="Solicitar nuevo enlace" onPress={() => onNavigate('/forgot-password')} style={styles.button} />
          </>
        ) : done ? (
          <>
            <Text style={[styles.message, { color: t.colors.text.primary }]}>
              Tu contraseña se actualizó correctamente. Por seguridad, cerramos las sesiones activas de tu cuenta.
            </Text>
            <Button label="Iniciar sesión" onPress={() => onNavigate('/login')} style={styles.button} />
          </>
        ) : (
          <>
            <Input
              label="Nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              secureTextEntry
              containerStyle={styles.field}
            />
            <Input
              label="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              onSubmitEditing={handleSubmit}
              containerStyle={styles.field}
            />

            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: t.colors.status.danger }]}>{error}</Text>
            ) : null}

            <Button label="Guardar contraseña" onPress={handleSubmit} loading={loading} style={styles.button} />

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
  field: { marginTop: 12 },
  error: { fontSize: 13, marginTop: 12 },
  button: { marginTop: 20 },
  link: { fontSize: 13, textAlign: 'center', marginTop: 16 },
});
