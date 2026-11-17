import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, useAppTheme, fontSize, type Theme } from '../../theme';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress(): void;
  variant?: AppButtonVariant;
  loading?: boolean;
  /** Label shown while `loading`, e.g. "Saving…". */
  loadingLabel?: string;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function foreground(theme: Theme, variant: AppButtonVariant): string {
  switch (variant) {
    case 'primary':
      return theme.colors.onPrimary;
    case 'danger':
      return theme.colors.onDanger;
    case 'secondary':
      return theme.colors.primary;
    default:
      return theme.colors.textSecondary;
  }
}

/** Standard button: 48 dp touch target, loading state, disabled state. */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled = false,
  icon,
  accessibilityLabel,
  testID,
  style,
}: AppButtonProps) {
  const styles = useStyles();
  const theme = useAppTheme();
  const color = foreground(theme, variant);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={color} />
        ) : icon ? (
          <Ionicons name={icon} size={18} color={color} />
        ) : null}
        <Text style={[styles.label, { color }]}>{loading && loadingLabel ? loadingLabel : label}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: t.colors.primary,
  },
  secondary: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primaryBorder,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: t.colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: t.colors.border,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  inactive: {
    opacity: 0.55,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    color: t.colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
}));
