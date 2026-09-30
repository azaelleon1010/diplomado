import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { Icon } from './Icon';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  filterActive?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar…',
  onFilterPress,
  filterActive = false,
}: SearchBarProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: palette.surface, borderColor: palette.borderStrong },
        ]}>
        <Icon name="search" size="md" color={palette.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          style={[styles.input, { color: palette.textPrimary }]}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda">
            <Icon name="close" size="sm" color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {onFilterPress !== undefined ? (
        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filterActive ? palette.brandSoft : palette.surface,
              borderColor: filterActive ? palette.brand : palette.borderStrong,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Icon name="filter" size="sm" color={filterActive ? palette.accent : palette.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Re-exported helper text style for filter result counts.
export function ResultCount({ text }: { text: string }): React.JSX.Element {
  const { palette } = useTheme();
  return <Text style={{ color: palette.textMuted, fontSize: typography.caption.fontSize }}>{text}</Text>;
}
