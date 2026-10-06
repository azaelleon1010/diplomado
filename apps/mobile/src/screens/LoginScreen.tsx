import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';

export function LoginScreen(): React.JSX.Element {
   const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const { palette } = useTheme();
  const { signIn, loading, error, clearError } = useAuth();
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

        <Card style={styles.card}>
          <Input
            label="Usuario o correo"
            value={email}
            onChangeText={setEmail}
            placeholder="operador@tramatech.mx"
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            containerStyle={styles.field}
          />
          <Input
            label="Contraseña"
            containerStyle={styles.field}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            rightAccessory={(
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Text style={[styles.toggle, { color: palette.accent }]}>
                  {showPassword ? 'Ocultar' : 'Ver'}
                </Text>
              </Pressable>
            )}
          />

          <View style={styles.loginButton}>
            <Button
              label="Iniciar sesión"
              loading={loading}
              onPress={() => {
                clearError();
                void signIn(email, password);
              }}
            />
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              clearError();
              navigation.navigate('Register');
            }}
            accessibilityRole="button"
            accessibilityLabel="Crear una cuenta">
            <Text style={[styles.registerLink, { color: palette.accent }]}>
              ¿No tienes una cuenta? Crear una cuenta
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recuperar contraseña">
            <Text style={[styles.forgot, { color: palette.textSecondary }]}>
              ¿Olvidaste tu contraseña?
            </Text>
          </Pressable>
        </Card>

        <View style={styles.envRow}>
          <StatusBadge label="Entorno · Planta MX-01" tone="neutral" />
          <StatusBadge label="Mock · Fase 2" tone="info" />
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
    borderRadius: radii.xl,
    marginTop: spacing.xxl,
  },
  field: { marginTop: spacing.md },
  toggle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loginButton: {
    marginTop: spacing.xl,
  },
  forgot: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  registerLink: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.lg,
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
  error: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
