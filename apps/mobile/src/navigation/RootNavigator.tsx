import React from 'react';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from './types';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { ProductionDetailScreen } from '../screens/ProductionDetailScreen';
import { AlertDetailScreen } from '../screens/AlertDetailScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme/tokens';
import { MODULE_ACCESS } from './moduleAccess';
import { withModulePermission } from './withModulePermission';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ProductionDetailScreenAccess = withModulePermission(ProductionDetailScreen, MODULE_ACCESS.productionRead);

export function RootNavigator(): React.JSX.Element {
  const { palette } = useTheme();
  const { signedIn, loading } = useAuth();

  const navTheme: Theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.backgroundSecondary,
      text: palette.textPrimary,
      border: palette.borderStrong,
      notification: palette.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {loading ? (
        <View accessibilityRole="progressbar" style={[styles.loading, { backgroundColor: palette.background }]}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Cargando sesión…</Text>
        </View>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {signedIn ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="ProductionDetail" component={ProductionDetailScreenAccess} />
              <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.body.fontSize },
});
