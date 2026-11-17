import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { makeStyles, radius, spacing, useAppTheme, fontSize } from '../../theme';

interface IconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Read by screen readers; also shown as a small caption when `showLabel`. */
  label: string;
  onPress(): void;
  showLabel?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  testID?: string;
}

/** Compact icon action with a 44 dp touch target and an accessible label. */
export function IconButton({
  icon,
  label,
  onPress,
  showLabel = false,
  tone = 'default',
  testID,
}: IconButtonProps) {
  const styles = useStyles();
  const theme = useAppTheme();
  const color =
    tone === 'primary'
      ? theme.colors.primary
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Ionicons name={icon} size={22} color={color} />
      {showLabel ? <Text style={[styles.caption, { color }]}>{label}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  button: {
    alignItems: 'center',
    borderColor: t.colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    backgroundColor: t.colors.surface,
  },
  pressed: {
    backgroundColor: t.colors.surfaceAlt,
  },
  caption: {
    color: t.colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
}));
