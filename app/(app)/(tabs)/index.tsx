import { router } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { AppButton } from '@/components/ui/AppButton';
import { StateView } from '@/components/ui/StateView';
import { useProfile } from '@/context/SessionContext';
import { formatDay, formatMoney, todayKey } from '@/core/dates';
import { useRemoteData } from '@/hooks/useRemoteData';
import { jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, radius, spacing } from '@/theme';

/** Home: today's visits, new requests waiting, and the numbers. */
export default function HomeScreen() {
  const styles = useStyles();
  const profile = useProfile();
  const today = todayKey();
  const admin = profile.role === 'admin';

  const { data, loading, refreshing, error, offline, refresh } = useRemoteData(async () => {
    const [counts, todayJobs, newJobs] = await Promise.all([
      jobsApi.counts(),
      jobsApi.list({ status: 'open', from: today, to: today }),
      admin ? jobsApi.list({ status: 'new' }) : Promise.resolve([]),
    ]);
    return { counts, todayJobs: todayJobs.filter((j) => j.status !== 'new'), newJobs };
  }, [today, admin]);

  if (loading && !data) return <StateView kind="loading" />;
  if (!data) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  const { counts, todayJobs, newJobs } = data;
  const tiles = [
    { label: 'New', value: counts.new, status: 'new' },
    { label: 'Scheduled', value: counts.scheduled, status: 'scheduled' },
    { label: 'On site', value: counts.in_progress, status: 'in_progress' },
    { label: 'To collect', value: counts.completed, status: 'completed' },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Text style={styles.hello}>Hi {profile.name.split(' ')[0]} 👋</Text>
      <Text style={styles.date}>{formatDay(today)}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.status}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/jobs', params: { status: tile.status } })}
            accessibilityRole="button"
            accessibilityLabel={`${tile.value} ${tile.label}`}
          >
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </Pressable>
        ))}
      </View>
      {admin && counts.unpaid_amount ? (
        <Text style={styles.money}>Payment to collect: {formatMoney(counts.unpaid_amount)}</Text>
      ) : null}

      {admin ? (
        <AppButton label="Add job (phone call)" icon="add-circle-outline" variant="secondary" onPress={() => router.push('/job/new')} />
      ) : null}

      <Text style={styles.section}>Today&apos;s visits ({todayJobs.length})</Text>
      {todayJobs.length === 0 ? <Text style={styles.empty}>No visits scheduled today.</Text> : null}
      <View style={styles.list}>
        {todayJobs.map((job) => (
          <JobCard key={job.id} job={job} showDate={false} />
        ))}
      </View>

      {admin ? (
        <>
          <Text style={styles.section}>New requests waiting ({newJobs.length})</Text>
          {newJobs.length === 0 ? <Text style={styles.empty}>All requests are scheduled. 👍</Text> : null}
          <View style={styles.list}>
            {newJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hello: { color: t.colors.text, fontSize: fontSize.xxl, fontWeight: '800' },
  date: { color: t.colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
  error: { color: t.colors.danger, marginBottom: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tile: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  tileValue: { color: t.colors.primary, fontSize: 28, fontWeight: '800' },
  tileLabel: { color: t.colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  money: { color: t.colors.warning, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.md },
  section: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.xl },
  empty: { color: t.colors.textMuted, fontSize: fontSize.md },
  list: { gap: spacing.sm },
}));
