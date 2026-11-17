import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { MonthCalendar } from '@/components/MonthCalendar';
import { StateView } from '@/components/ui/StateView';
import { monthEnd, monthStart, relativeDay, todayKey } from '@/core/dates';
import { useRemoteData } from '@/hooks/useRemoteData';
import { jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, spacing } from '@/theme';

/**
 * Calendar of the month: scheduled visits on their day, new requests on the
 * customer's preferred day. Tap a day for its jobs in time order.
 */
export default function ScheduleScreen() {
  const styles = useStyles();
  const [selected, setSelected] = useState(todayKey());
  const [month, setMonth] = useState(monthStart(todayKey()));

  const { data, loading, refreshing, error, offline, refresh } = useRemoteData(
    () => jobsApi.list({ from: month, to: monthEnd(month) }),
    [month],
  );

  const active = useMemo(() => (data ?? []).filter((j) => j.status !== 'cancelled'), [data]);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const job of active) map[job.job_date] = (map[job.job_date] ?? 0) + 1;
    return map;
  }, [active]);
  const dayJobs = useMemo(
    () =>
      active
        .filter((j) => j.job_date === selected)
        .sort((a, b) => (a.scheduled_at ?? '9').localeCompare(b.scheduled_at ?? '9')),
    [active, selected],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <MonthCalendar
        month={month}
        selected={selected}
        counts={counts}
        onSelect={setSelected}
        onMonthChange={(next) => {
          setMonth(next);
          setSelected(next.slice(0, 7) === todayKey().slice(0, 7) ? todayKey() : next);
        }}
      />

      <Text style={styles.section}>
        {relativeDay(selected)} · {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
      </Text>
      {loading && !data ? <StateView kind="loading" /> : null}
      {!data && error ? (
        <StateView kind={offline ? 'offline' : 'error'} message={error} onRetry={refresh} />
      ) : null}
      {data && dayJobs.length === 0 ? <Text style={styles.empty}>Nothing on this day.</Text> : null}
      <View style={styles.list}>
        {dayJobs.map((job) => (
          <JobCard key={job.id} job={job} showDate={false} />
        ))}
      </View>
      <Text style={styles.legend}>
        Numbers show jobs per day. New requests appear on the customer&apos;s preferred day until scheduled.
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.lg },
  empty: { color: t.colors.textMuted, fontSize: fontSize.md },
  list: { gap: spacing.sm },
  legend: { color: t.colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.lg },
}));
