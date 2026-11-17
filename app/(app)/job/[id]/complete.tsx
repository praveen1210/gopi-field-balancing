import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { ChoiceChips, TextField } from '@/components/FormControls';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/context/SessionContext';
import { BALANCE_GRADES } from '@/core/jobs';
import { useRemoteData } from '@/hooks/useRemoteData';
import { errorMessage, jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, spacing } from '@/theme';
import { backToJob } from '@/utils/navigation';

/** Work done: before/after readings, grade and what was corrected. */
export default function CompleteJobScreen() {
  const styles = useStyles();
  const toast = useToast();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, loading, error, offline, refresh } = useRemoteData(() => jobsApi.get(id), [id]);

  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState('');
  const [grade, setGrade] = useState('');
  const [correction, setCorrection] = useState('');
  const [summary, setSummary] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading && !job) return <StateView kind="loading" />;
  if (!job) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  const beforeValue = before ?? job.vibration_reading ?? '';
  const admin = profile.role === 'admin';

  const save = async () => {
    if (!after.trim()) {
      setFormError('Enter the vibration reading after balancing.');
      return;
    }
    if (amount.trim() && !/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setFormError('Amount must be a number, e.g. 4500.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await jobsApi.complete(job.id, {
        vibration_before: beforeValue.trim(),
        vibration_after: after.trim(),
        balance_grade: grade,
        correction_details: correction.trim(),
        work_summary: summary.trim(),
        amount: amount.trim(),
      });
      toast.show('Job completed', 'success');
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
      <Text style={styles.meta}>{job.machine_type}</Text>

      <Card style={styles.card}>
        <TextField label="Vibration before" value={beforeValue} onChangeText={setBefore} placeholder="9.2 mm/s at DE bearing" />
        <TextField label="Vibration after" required value={after} onChangeText={setAfter} placeholder="1.1 mm/s" />
        <ChoiceChips label="Balance grade achieved" options={BALANCE_GRADES} value={grade} onChange={setGrade} />
        <TextField
          label="Correction weights"
          value={correction}
          onChangeText={setCorrection}
          placeholder="Plane 1: 45 g at 120°, Plane 2: 30 g at 300°"
          multiline
        />
        <TextField label="Work summary / advice" value={summary} onChangeText={setSummary} multiline />
        {admin ? (
          <TextField
            label="Amount to charge (₹)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            hint="Optional now; you can enter it when the payment comes in."
          />
        ) : null}
      </Card>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <AppButton label="Mark as completed" icon="checkmark-done" loading={busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  meta: { color: t.colors.textMuted, fontSize: fontSize.md },
  card: { marginVertical: spacing.lg },
  error: { color: t.colors.danger, fontSize: fontSize.md, marginBottom: spacing.md, textAlign: 'center' },
}));
