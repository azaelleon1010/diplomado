import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';

interface SidebarGroupProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
  children: React.ReactNode;
}

export function SidebarGroup({ title, expanded, onToggle, collapsed, children }: SidebarGroupProps) {
  const t = useTheme();

  if (collapsed) {
    return <>{children}</>;
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={onToggle}
        accessible
        accessibilityLabel={`${title} menu`}
        accessibilityRole="button"
      >
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupArrow}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.groupContent}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  groupArrow: {
    color: '#64748B',
    fontSize: 10,
  },
  groupContent: {
    overflow: 'hidden',
  },
});
