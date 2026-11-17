import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { makeStyles, spacing, useAppTheme, fontSize } from '../../theme';
import { AppButton } from './AppButton';

type StateKind = 'loading' | 'empty' | 'error' | 'offline';

interface StateViewProps {
  kind: StateKind;
  title?: string;
  message?: string;
  onRetry?(): void;
  testID?: string;
}

const ICONS: Record<Exclude<StateKind, 'loading'>, React.ComponentProps<typeof Ionicons>['name']> = {
  empty: 'file-tray-outline',
  error: 'alert-circle-outline',
  offline: 'cloud-offline-outline',
};

const DEFAULT_TITLES: Record<StateKind, string> = {
  loading: 'Loading…',
  empty: 'Nothing here yet',
  error: 'Something went wrong',
  offline: 'No internet connection',
};

/** One consistent look for loading, empty, error and offline states. */
export function StateView({ kind, title, message, onRetry, testID }: StateViewProps) {
  const styles = useStyles();
  const theme = useAppTheme();

  return (
    <View style={styles.container} testID={testID} accessibilityLiveRegion="polite">
      {kind === 'loading' ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : (
        <Ionicons
          name={ICONS[kind]}
          size={44}
          color={kind === 'error' ? theme.colors.danger : theme.colors.textSubtle}
        />
      )}
      <Text style={styles.title}>{title ?? DEFAULT_TITLES[kind]}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry && kind !== 'loading' ? (
        <AppButton label="Try Again" icon="refresh" variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: {
    color: t.colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: t.colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
}));
