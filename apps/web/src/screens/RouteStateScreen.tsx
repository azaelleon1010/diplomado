import React from 'react';
import { StyleSheet, View } from 'react-native-web';
import { Button } from '../components/Button';
import { EmptyState } from '../components/States';
import { spacing } from '../theme/tokens';

interface RouteStateScreenProps {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}

export function RouteStateScreen({
  title,
  detail,
  actionLabel,
  onAction,
}: RouteStateScreenProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <EmptyState title={title} detail={detail} />
      <Button label={actionLabel} onPress={onAction} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
});
