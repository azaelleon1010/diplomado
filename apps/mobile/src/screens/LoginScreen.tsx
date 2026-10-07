import React, { useEffect, useState } from 'react';
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
import { loadLastCompany } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

export function LoginScreen(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const { palette } = useTheme();
  const { signIn, error, clearError } = useAuth();
  const insets = useSafeAreaInsets();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    let active = true;
    void loadLastCompany().then((slug) => {
      if (active && slug) {
        setCompany((current) => current || slug);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (): Promise<void> => {
    if (submitting) {
      return;
    }

    clearError();
    setValidationError('');

    if (!company.trim() || !email.trim() || !password) {
      setValidationError('Ingresa tu empresa, correo y contraseña.');
      return;
    }

    setSubmitting(true);

    try {
      await signIn(company, email, password);
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
            label="Empresa"
            value={company}
            onChangeText={setCompany}
            placeholder="mi-empresa"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            hint="Identificador de tu empresa (el mismo que usas en la Web)."
            containerStyle={styles.field}
          />
          <Input
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="admin@miempresa.mx"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
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
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
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
              loading={submitting}
              onPress={() => void handleSubmit()}
            />
          </View>

          {displayedError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
              {displayedError}
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              clearError();
              setValidationError('');
              navigation.navigate('Register');
            }}
            accessibilityRole="button"
            accessibilityLabel="Crear una cuenta">
            <Text style={[styles.registerLink, { color: palette.accent }]}>
              ¿No tienes una cuenta? Crear una cuenta
            </Text>
          </Pressable>
        </Card>
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
  registerLink: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  error: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
