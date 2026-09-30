import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { IconButton } from './Button';

interface TopBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  unreadAlerts?: number;
  onAlertsPress?: () => void;
  userName?: string;
}

export function TopBar({
  title,
  subtitle,
  showBack = false,
  onBack,
  unreadAlerts = 0,
  onAlertsPress,
  userName = 'Operador',
}: TopBarProps): React.JSX.Element {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: palette.background,
          borderBottomColor: palette.borderStrong,
        },
      ]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}>
            <Icon name="back" size={26} color={palette.textPrimary} />
          </Pressable>
        ) : (
          <Text style={[styles.brand, { color: palette.textPrimary }]}>TramaTech</Text>
        )}
        <View style={styles.titleWrap}>
          {showBack ? (
            <>
              <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle !== undefined ? (
                <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle !== undefined ? (
                <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {onAlertsPress !== undefined ? (
          <IconButton icon="bell" label="Abrir alertas" onPress={onAlertsPress} badgeCount={unreadAlerts} />
        ) : null}
        <Avatar name={userName} size={36} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  brand: {
    fontSize: 17,
    fontWeight: '700',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
  },
  back: {
    paddingRight: spacing.xs,
  },
});
