import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

export function LoginScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.logo, { backgroundColor: palette.brand }]}>
          <Text style={styles.logoText}>TT</Text>
        </View>
        <Text style={[styles.brand, { color: palette.textPrimary }]}>TramaTech ERP</Text>
        <Text style={[styles.slogan, { color: palette.accent }]}>La red que mueve tu producción.</Text>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]}>
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Usuario o correo</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="operador@tramatech.mx"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            accessibilityLabel="Usuario o correo"
            style={[styles.input, { color: palette.textPrimary, borderColor: palette.borderStrong, backgroundColor: palette.backgroundSecondary }]}
          />
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Contraseña</Text>
          <View style={[styles.input, styles.passwordRow, { borderColor: palette.borderStrong, backgroundColor: palette.backgroundSecondary }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              accessibilityLabel="Contraseña"
              style={[styles.passwordInput, { color: palette.textPrimary }]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <Text style={[styles.toggle, { color: palette.accent }]}>
                {showPassword ? 'Ocultar' : 'Ver'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.loginButton}>
            <Button label="Iniciar sesión" onPress={signIn} />
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Recuperar contraseña">
            <Text style={[styles.forgot, { color: palette.textSecondary }]}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </View>

        <View style={styles.envRow}>
          <StatusBadge label="Entorno · Planta MX-01" tone="neutral" />
          <StatusBadge label="Mock · Fase 2" tone="accent" />
        </View>

        <View style={styles.hintRow}>
          <Icon name="info" size="sm" color={palette.textMuted} />
          <Text style={[styles.hint, { color: palette.textMuted }]}>
            Acceso de demostración: el botón entra directo al inicio.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xxl,
    alignItems: 'stretch',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  brand: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  slogan: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginTop: spacing.xxl,
  },
  fieldLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontSize: typography.body.fontSize,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.sm,
  },
  toggle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    paddingLeft: spacing.sm,
  },
  loginButton: {
    marginTop: spacing.xl,
  },
  forgot: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  envRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  hint: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
});
