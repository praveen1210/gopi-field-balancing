import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDay, formatTime } from '../core/dates';
import { isUrgent, type Job } from '../core/jobs';
import { fontSize, makeStyles, radius, spacing, useAppTheme } from '../theme';
import { StatusBadge } from './StatusBadge';

/** One job in a list: who, what machine, where and when. Opens the job. */
export function JobCard({ job, showDate = true }: { job: Job; showDate?: boolean }) {
  const styles = useStyles();
  const theme = useAppTheme();
  const urgent = isUrgent(job);

  let when: string;
  if (job.scheduled_at && (job.status === 'scheduled' || job.status === 'in_progress')) {
    when = showDate ? `${formatDay(job.job_date)} · ${formatTime(job.scheduled_at)}` : formatTime(job.scheduled_at);
  } else if (job.status === 'new') {
    when = job.preferred_date ? `Wants ${formatDay(job.preferred_date)}` : `Received ${formatDay(job.job_date)}`;
  } else {
    when = formatDay(job.job_date);
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
      style={({ pressed }) => [styles.card, urgent && styles.urgent, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${job.reference}, ${job.customer_name}, ${job.machine_type}`}
    >
      <View style={styles.top}>
        <Text style={styles.reference}>{job.reference}</Text>
        <StatusBadge status={job.status} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {job.customer_name}
        {job.company ? <Text style={styles.company}> · {job.company}</Text> : null}
      </Text>
      <Text style={styles.machine} numberOfLines={1}>
        {job.machine_type}
        {job.quantity > 1 ? ` × ${job.quantity}` : ''}
        {job.rpm ? ` · ${job.rpm} RPM` : ''}
      </Text>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.meta} numberOfLines={1}>
          {job.location}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.meta}>{when}</Text>
        {job.assigned_name ? (
          <>
            <Ionicons name="person-outline" size={14} color={theme.colors.textMuted} style={styles.gap} />
            <Text style={styles.meta}>{job.assigned_name}</Text>
          </>
        ) : null}
      </View>
      {urgent ? <Text style={styles.urgentText}>⚠ {job.urgency}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
    padding: spacing.md,
  },
  urgent: {
    borderColor: t.colors.danger,
    borderLeftWidth: 4,
  },
  pressed: { opacity: 0.85 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  reference: { color: t.colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  name: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  company: { color: t.colors.textSecondary, fontSize: fontSize.md, fontWeight: '500' },
  machine: { color: t.colors.textSecondary, fontSize: fontSize.md },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  meta: { color: t.colors.textMuted, flexShrink: 1, fontSize: fontSize.sm },
  gap: { marginLeft: spacing.sm },
  urgentText: { color: t.colors.danger, fontSize: fontSize.sm, fontWeight: '700', marginTop: 2 },
}));
