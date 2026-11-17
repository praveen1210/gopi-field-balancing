import React, { useState } from 'react';
import { Text } from 'react-native';

import {
  MACHINE_TYPES,
  URGENCY_OPTIONS,
  validateDetails,
  type JobDetailsInput,
} from '../core/jobs';
import { fontSize, makeStyles, spacing } from '../theme';
import { ChoiceChips, TextField } from './FormControls';
import { AppButton } from './ui/AppButton';
import { Card } from './ui/Card';

/** Customer and machine details, for a phone-call job or editing a request. */
export function JobDetailsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: JobDetailsInput;
  submitLabel: string;
  onSubmit(input: JobDetailsInput): Promise<void>;
}) {
  const styles = useStyles();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof JobDetailsInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const problem = validateDetails(form);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.section}>Customer</Text>
        <TextField label="Contact name" required value={form.customer_name} onChangeText={set('customer_name')} />
        <TextField label="Company / plant" value={form.company} onChangeText={set('company')} />
        <TextField
          label="Phone"
          required
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          placeholder="98765 43210"
        />
        <TextField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label="Site address / city" required value={form.location} onChangeText={set('location')} multiline />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Machine</Text>
        <ChoiceChips
          label="Machine type"
          required
          options={MACHINE_TYPES}
          value={form.machine_type}
          onChange={set('machine_type')}
        />
        <TextField label="Number of machines" value={form.quantity} onChangeText={set('quantity')} keyboardType="number-pad" />
        <TextField label="Speed (RPM)" value={form.rpm} onChangeText={set('rpm')} keyboardType="number-pad" />
        <TextField label="Motor power" value={form.power} onChangeText={set('power')} placeholder="75 kW" />
        <TextField label="Rotor weight" value={form.rotor_weight} onChangeText={set('rotor_weight')} placeholder="250 kg" />
        <TextField label="Rotor diameter" value={form.rotor_diameter} onChangeText={set('rotor_diameter')} placeholder="1.2 m" />
        <TextField label="Mounting" value={form.mounting} onChangeText={set('mounting')} placeholder="Overhung / between bearings" />
        <TextField label="Brand / model" value={form.brand_model} onChangeText={set('brand_model')} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Problem</Text>
        <TextField
          label="Vibration reading"
          value={form.vibration_reading}
          onChangeText={set('vibration_reading')}
          placeholder="9 mm/s at DE bearing"
        />
        <TextField label="Service" value={form.service} onChangeText={set('service')} />
        <ChoiceChips label="Urgency" options={URGENCY_OPTIONS} value={form.urgency} onChange={set('urgency')} />
        <TextField label="Notes" value={form.notes} onChangeText={set('notes')} multiline />
      </Card>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <AppButton label={submitLabel} loading={busy} loadingLabel="Saving…" onPress={() => void submit()} />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  card: { marginBottom: spacing.md },
  section: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.md },
  error: { color: t.colors.danger, fontSize: fontSize.md, marginBottom: spacing.md, textAlign: 'center' },
}));
