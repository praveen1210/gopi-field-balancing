import React from 'react';
import { Text, View } from 'react-native';

import { STATUS_LABEL, type JobStatus } from '../core/jobs';
import { fontSize, radius, spacing, useAppTheme, type Theme } from '../theme';

export function statusColors(theme: Theme, status: JobStatus): { fg: string; bg: string } {
  const c = theme.colors;
  switch (status) {
    case 'new':
      return { fg: c.warning, bg: c.warningSoft };
    case 'scheduled':
      return { fg: c.primary, bg: c.primarySoft };
    case 'in_progress':
      return { fg: c.onAccent, bg: c.accent };
    case 'completed':
      return { fg: c.success, bg: c.successSoft };
    case 'paid':
      return { fg: c.textSecondary, bg: c.surfaceAlt };
    case 'cancelled':
      return { fg: c.danger, bg: c.dangerSoft };
  }
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const theme = useAppTheme();
  const { fg, bg } = statusColors(theme, status);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: fg, fontSize: fontSize.xs, fontWeight: '700' }}>
        {STATUS_LABEL[status].toUpperCase()}
      </Text>
    </View>
  );
}
