import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

/** Mirrors registerSchema in apps/api/src/modules/identity/presentation/schemas.ts. */
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { register, error, clearError } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (): Promise<void> => {
    // Registration creates a company; a double tap must not create two.
    if (submitting) {
      return;
    }

    clearError();
    setValidationError('');

    const normalizedCompany = companyName.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (!normalizedCompany || !normalizedUsername || !normalizedEmail || !password) {
      setValidationError('Completa los campos obligatorios: empresa, usuario, correo y contraseña.');
      return;
    }

    if (normalizedCompany.length < 2 || normalizedCompany.length > 200) {
      setValidationError('El nombre de la empresa debe tener entre 2 y 200 caracteres.');
      return;
    }

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 64 ||
      !USERNAME_RE.test(normalizedUsername)
    ) {
      setValidationError('El usuario debe tener de 3 a 64 caracteres: letras, números, puntos, guiones o guiones bajos.');
      return;
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      setValidationError('Ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setValidationError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    try {
      const tenant = await register({
        companyName: normalizedCompany,
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        firstName: normalizedFirstName || undefined,
        lastName: normalizedLastName || undefined,
      });

      if (tenant) {
        Alert.alert(
          'Empresa registrada',
          `Para iniciar sesión en Web o Mobile usa la empresa "${tenant.slug}" con tu correo y contraseña.`,
        );
      }
    } catch {
      // The auth context exposes the backend message through `error`.
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = validationError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.logo, { backgroundColor: palette.brand }]}>
          <Text style={styles.logoText}>TT</Text>
        </View>

        <Text style={[styles.brand, { color: palette.textPrimary }]}>
          Crear cuenta
        </Text>

        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Configura tu empresa para comenzar a utilizar TramaTech ERP.
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Empresa
          </Text>

          <Input
            label="Nombre de la empresa"
            containerStyle={styles.field}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="TramaTech México"
            autoCapitalize="words"
          />

          <Text style={[styles.sectionTitle, styles.userSection, { color: palette.textPrimary }]}>
            Usuario administrador
          </Text>

          <Input
            label="Nombre de usuario"
            containerStyle={styles.field}
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            autoCapitalize="none"
          />

          <Input
            label="Correo electrónico"
            containerStyle={styles.field}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@empresa.mx"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Input
            label="Nombre (opcional)"
            containerStyle={styles.field}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Alejandro"
            autoCapitalize="words"
          />

          <Input
            label="Apellido (opcional)"
            containerStyle={styles.field}
            value={lastName}
            onChangeText={setLastName}
            placeholder="León"
            autoCapitalize="words"
          />

          <Input
            label="Contraseña"
            containerStyle={styles.field}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
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

          <Input
            label="Confirmar contraseña"
            containerStyle={styles.field}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repite tu contraseña"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            rightAccessory={(
              <Pressable
                onPress={() => setShowConfirmPassword((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? 'Ocultar confirmación de contraseña'
                    : 'Mostrar confirmación de contraseña'
                }>
                <Text style={[styles.toggle, { color: palette.accent }]}>
                  {showConfirmPassword ? 'Ocultar' : 'Ver'}
                </Text>
              </Pressable>
            )}
          />

          {displayedError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
              {displayedError}
            </Text>
          ) : null}

          <View style={styles.registerButton}>
            <Button
              label="Crear cuenta"
              loading={submitting}
              onPress={() => void handleRegister()}
            />
          </View>

          <Pressable
            onPress={() => {
              clearError();
              setValidationError('');
              navigation.navigate('Login');
            }}
            accessibilityRole="button"
            accessibilityLabel="Volver a iniciar sesión">
            <Text style={[styles.backLink, { color: palette.accent }]}>
              ¿Ya tienes una cuenta? Inicia sesión
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    alignItems: 'stretch',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  brand: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: radii.xl,
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  userSection: {
    marginTop: spacing.xl,
  },
  field: { marginTop: spacing.md },
  toggle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
  registerButton: {
    marginTop: spacing.xl,
  },
  error: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  backLink: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
