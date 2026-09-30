import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, typography } from '../theme/tokens';

interface AvatarProps {
  name: string;
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${second}`.toUpperCase();
}

export function Avatar({ name, size = 40 }: AvatarProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Avatar de ${name}`}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.brand },
      ]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: typography.h3.fontWeight,
  },
});
