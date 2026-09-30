import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface ListItemProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  icon?: IconName;
  avatarName?: string;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  showChevron?: boolean;
  onPress?: () => void;
}

export function ListItem({
  title,
  subtitle,
  rightText,
  icon,
  avatarName,
  badgeLabel,
  badgeTone = 'neutral',
  showChevron = false,
  onPress,
}: ListItemProps): React.JSX.Element {
  const { palette } = useTheme();
  const content = (
    <View style={[styles.row, { borderBottomColor: palette.borderStrong }]}>
      {avatarName !== undefined ? (
        <Avatar name={avatarName} size={40} />
      ) : icon !== undefined ? (
        <View style={[styles.iconWrap, { backgroundColor: palette.surfaceSecondary }]}>
          <Icon name={icon} size="md" color={palette.accent} />
        </View>
      ) : null}
      <View style={styles.middle}>
        <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {badgeLabel !== undefined ? <StatusBadge label={badgeLabel} tone={badgeTone} /> : null}
      </View>
      <View style={styles.right}>
        {rightText !== undefined ? (
          <Text style={[styles.rightText, { color: palette.textPrimary }]}>{rightText}</Text>
        ) : null}
        {showChevron ? <Icon name="next" size="md" color={palette.textMuted} /> : null}
      </View>
    </View>
  );

  if (onPress === undefined) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typography.bodySmall.fontSize,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  rightText: {
    fontSize: typography.numeric.fontSize,
    fontWeight: typography.numeric.fontWeight,
  },
});
