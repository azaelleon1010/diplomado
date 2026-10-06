import React from 'react';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';

export function PermissionDeniedScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  return (
    <View accessibilityRole="alert" style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.textPrimary }]}>Sin permisos</Text>
      <Text style={[styles.detail, { color: palette.textSecondary }]}>
        Tu sesión no tiene acceso a esta sección.
      </Text>
      <Button
        label="Volver"
        variant="secondary"
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Main');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: typography.h2.fontSize, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, textAlign: 'center', marginBottom: spacing.sm },
});
