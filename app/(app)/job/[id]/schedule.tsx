import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { ChoiceChips, DateTimeField, defaultVisitTime, TextField } from '@/components/FormControls';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/context/SessionContext';
import { formatDay } from '@/core/dates';
import { useRemoteData } from '@/hooks/useRemoteData';
import { errorMessage, jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, spacing } from '@/theme';
import { backToJob } from '@/utils/navigation';

/** Fix the visit date and time and who goes (also reschedules). */
export default function ScheduleJobScreen() {
  const styles = useStyles();
  const toast = useToast();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, offline, refresh } = useRemoteData(
    async () => ({ job: await jobsApi.get(id), staff: (await jobsApi.staff()).filter((s) => s.active) }),
    [id],
  );
  // Until changed: the current schedule, else the customer's preferred day.
  const [pickedWhen, setWhen] = useState<Date | null>(null);
  const [pickedAssignee, setAssignee] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading && !data) return <StateView kind="loading" />;
  if (!data) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  const { job, staff } = data;
  const when =
    pickedWhen ?? (job.scheduled_at ? new Date(job.scheduled_at) : defaultVisitTime(job.preferred_date));
  const assignee = pickedAssignee ?? job.assigned_to ?? profile.id;
  const names = Object.fromEntries(staff.map((s) => [s.id, s.id === profile.id ? `${s.name} (me)` : s.name]));

  const save = async () => {
    if (when.getTime() < Date.now() - 60 * 60_000) {
      setFormError('The visit time is in the past.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await jobsApi.schedule(job.id, when, assignee, note);
      toast.show(job.status === 'scheduled' ? 'Visit rescheduled' : 'Visit scheduled', 'success');
      backToJob(job.id);
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {job.reference} · {job.customer_name}
      </Text>
      <Text style={styles.meta}>
        {job.machine_type} · {job.location}
      </Text>
      {job.preferred_date ? <Text style={styles.meta}>Customer prefers {formatDay(job.preferred_date)}</Text> : null}
      {job.urgency ? <Text style={styles.meta}>Urgency: {job.urgency}</Text> : null}

      <Card style={styles.card}>
        <DateTimeField label="Visit date and time" value={when} onChange={setWhen} />
        <ChoiceChips
          label="Who will go"
          required
          options={staff.map((s) => s.id)}
          value={assignee}
          onChange={setAssignee}
          renderLabel={(sid) => names[sid] ?? sid}
        />
        <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Bring 2-plane kit, call before leaving" multiline />
      </Card>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <AppButton
        label={job.status === 'scheduled' ? 'Save new time' : 'Schedule visit'}
        icon="calendar"
        loading={busy}
        onPress={() => void save()}
      />
      <Text style={styles.hint}>The person assigned gets a notification on their phone.</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  meta: { color: t.colors.textMuted, fontSize: fontSize.md, marginTop: 2 },
  card: { marginVertical: spacing.lg },
  error: { color: t.colors.danger, fontSize: fontSize.md, marginBottom: spacing.md, textAlign: 'center' },
  hint: { color: t.colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, textAlign: 'center' },
}));
