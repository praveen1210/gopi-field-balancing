import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { ChoiceChips, TextField } from '@/components/FormControls';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { PAYMENT_MODES } from '@/core/jobs';
import { useRemoteData } from '@/hooks/useRemoteData';
import { errorMessage, jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, spacing } from '@/theme';
import { backToJob } from '@/utils/navigation';

/** Records the payment and closes the job. Admin only. */
export default function PayJobScreen() {
  const styles = useStyles();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, loading, error, offline, refresh } = useRemoteData(() => jobsApi.get(id), [id]);
  const [amount, setAmount] = useState<string | null>(null);
  const [mode, setMode] = useState('UPI');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading && !job) return <StateView kind="loading" />;
  if (!job) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  const amountValue = amount ?? (job.amount != null ? String(job.amount) : '');

  const save = async () => {
    if (!/^\d+(\.\d{1,2})?$/.test(amountValue.trim())) {
      setFormError('Enter the amount received, e.g. 4500.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await jobsApi.markPaid(job.id, Number(amountValue), mode);
      toast.show('Payment recorded', 'success');
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
      <Card style={styles.card}>
        <TextField label="Amount received (₹)" required value={amountValue} onChangeText={setAmount} keyboardType="decimal-pad" />
        <ChoiceChips label="Paid by" options={PAYMENT_MODES} value={mode} onChange={setMode} />
      </Card>
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <AppButton label="Save payment" icon="cash" loading={busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  card: { marginVertical: spacing.lg },
  error: { color: t.colors.danger, fontSize: fontSize.md, marginBottom: spacing.md, textAlign: 'center' },
}));
