import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { StateView } from '@/components/ui/StateView';
import { useProfile } from '@/context/SessionContext';
import { useRemoteData } from '@/hooks/useRemoteData';
import { jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, radius, spacing, useAppTheme } from '@/theme';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'new', label: 'New' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'On site' },
  { key: 'completed', label: 'Completed' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

/** Every job, by status, with search by name, phone, place or reference. */
export default function JobsScreen() {
  const styles = useStyles();
  const theme = useAppTheme();
  const profile = useProfile();
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<FilterKey>('open');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // Home screen tiles open this tab on a status.
  const [linkedStatus, setLinkedStatus] = useState<string | undefined>(undefined);
  if (params.status !== linkedStatus) {
    setLinkedStatus(params.status);
    if (params.status && FILTERS.some((f) => f.key === params.status)) {
      setFilter(params.status as FilterKey);
    }
  }

  // Search after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, refreshing, error, offline, refresh } = useRemoteData(
    () => jobsApi.list({ status: filter === 'all' ? undefined : filter, search: query }),
    [filter, query],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, place, GTG-…"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.search}
          accessibilityLabel="Search jobs"
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading && !data ? (
        <StateView kind="loading" />
      ) : !data ? (
        <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => <JobCard job={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          ListEmptyComponent={
            <StateView
              kind="empty"
              title="No jobs here"
              message={query ? 'Try a different search.' : profile.role === 'admin' ? undefined : 'Jobs assigned to you appear here.'}
            />
          }
          ListFooterComponent={
            profile.role === 'admin' ? (
              <Pressable onPress={() => router.push('/job/new')} style={styles.add} accessibilityRole="button">
                <Text style={styles.addText}>+ Add job from a phone call</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { backgroundColor: t.colors.background, flex: 1 },
  top: { backgroundColor: t.colors.surface, borderBottomColor: t.colors.border, borderBottomWidth: 1, paddingTop: spacing.md },
  search: {
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: radius.sm,
    color: t.colors.text,
    fontSize: fontSize.md,
    marginHorizontal: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  filters: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: {
    borderColor: t.colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  chipOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipText: { color: t.colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  chipTextOn: { color: t.colors.onPrimary },
  list: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xxl },
  add: { alignItems: 'center', padding: spacing.lg },
  addText: { color: t.colors.primary, fontSize: fontSize.md, fontWeight: '700' },
}));
