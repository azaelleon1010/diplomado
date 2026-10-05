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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export function RegisterScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { register, loading, error, clearError } = useAuth();
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

  const handleRegister = (): void => {
    clearError();
    setValidationError('');

    const normalizedCompany = companyName.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (
      !normalizedCompany ||
      !normalizedUsername ||
      !normalizedEmail ||
      !normalizedFirstName ||
      !normalizedLastName ||
      !password ||
      !confirmPassword
    ) {
      setValidationError('Completa todos los campos.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      setValidationError('Ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 8) {
      setValidationError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Las contraseñas no coinciden.');
      return;
    }

    void register({
      companyName: normalizedCompany,
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    });
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

        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderStrong,
            },
          ]}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Empresa
          </Text>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Nombre de la empresa
          </Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="TramaTech México"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="words"
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}
          />

          <Text style={[styles.sectionTitle, styles.userSection, { color: palette.textPrimary }]}>
            Usuario administrador
          </Text>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Nombre de usuario
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Correo electrónico
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="admin@empresa.mx"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Nombre
          </Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Alejandro"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="words"
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Apellido
          </Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="León"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="words"
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Contraseña
          </Text>
          <View
            style={[
              styles.passwordRow,
              {
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.passwordInput, { color: palette.textPrimary }]}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }>
              <Text style={[styles.toggle, { color: palette.accent }]}>
                {showPassword ? 'Ocultar' : 'Ver'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Confirmar contraseña
          </Text>
          <View
            style={[
              styles.passwordRow,
              {
                borderColor: palette.borderStrong,
                backgroundColor: palette.backgroundSecondary,
              },
            ]}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              style={[styles.passwordInput, { color: palette.textPrimary }]}
            />
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
          </View>

          {displayedError ? (
            <Text style={[styles.error, { color: palette.danger }]}>
              {displayedError}
            </Text>
          ) : null}

          <View style={styles.registerButton}>
            <Button
              label={loading ? 'Creando cuenta...' : 'Crear cuenta'}
              onPress={handleRegister}
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
        </View>
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
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
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
    borderWidth: 1,
    borderRadius: radii.lg,
    minHeight: 48,
    paddingHorizontal: spacing.md,
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