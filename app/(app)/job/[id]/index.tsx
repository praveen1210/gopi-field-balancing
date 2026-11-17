import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';

import { PromptModal } from '@/components/PromptModal';
import { StatusBadge, statusColors } from '@/components/StatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/context/SessionContext';
import { formatDateTime, formatDay, formatMoney } from '@/core/dates';
import {
  availableActions,
  EVENT_LABEL,
  STATUS_FLOW,
  STATUS_LABEL,
  type Job,
} from '@/core/jobs';
import { useRemoteData } from '@/hooks/useRemoteData';
import { errorMessage, jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, radius, spacing, useAppTheme } from '@/theme';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  const styles = useStyles();
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {String(value)}
      </Text>
    </View>
  );
}

/** Where the job is in the normal flow. */
function Progress({ job }: { job: Job }) {
  const styles = useStyles();
  const theme = useAppTheme();
  if (job.status === 'cancelled') {
    return (
      <View style={[styles.cancelled, { backgroundColor: statusColors(theme, 'cancelled').bg }]}>
        <Text style={styles.cancelledText}>Cancelled{job.cancelled_reason ? ` — ${job.cancelled_reason}` : ''}</Text>
      </View>
    );
  }
  const current = STATUS_FLOW.indexOf(job.status);
  return (
    <View style={styles.progress} accessibilityLabel={`Status: ${STATUS_LABEL[job.status]}`}>
      {STATUS_FLOW.map((status, i) => (
        <View key={status} style={styles.step}>
          <View style={[styles.stepBar, i <= current && styles.stepBarOn]} />
          <Text style={[styles.stepText, i === current && styles.stepTextOn]} numberOfLines={1}>
            {STATUS_LABEL[status].replace(' request', '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function JobScreen() {
  const styles = useStyles();
  const theme = useAppTheme();
  const toast = useToast();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, loading, refreshing, error, offline, refresh, setData } = useRemoteData(() => jobsApi.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<'cancel' | 'note' | null>(null);

  if (loading && !job) return <StateView kind="loading" />;
  if (!job) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  const actions = availableActions(job, profile.role);
  const admin = profile.role === 'admin';
  const digits = job.phone.replace(/[^0-9]/g, '');
  const waNumber = digits.length === 10 ? `91${digits}` : digits;

  const run = async (action: () => Promise<Job>, message: string) => {
    setBusy(true);
    try {
      await action();
      setData(await jobsApi.get(job.id));
      toast.show(message, 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'error');
    } finally {
      setBusy(false);
    }
  };

  const open = (path: 'schedule' | 'complete' | 'pay' | 'edit') =>
    router.push({ pathname: `/job/[id]/${path}`, params: { id: job.id } });

  return (
    <>
      <Stack.Screen options={{ title: job.reference }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.head}>
          <StatusBadge status={job.status} />
          <Text style={styles.source}>{job.source === 'website' ? 'From website' : 'Added in app'}</Text>
        </View>
        <Text style={styles.title}>{job.customer_name}</Text>
        {job.company ? <Text style={styles.subtitle}>{job.company}</Text> : null}
        <Progress job={job} />

        {job.scheduled_at && job.status !== 'new' ? (
          <Card style={styles.visit}>
            <Ionicons name="calendar" size={22} color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.visitWhen}>{formatDateTime(job.scheduled_at)}</Text>
              <Text style={styles.meta}>{job.assigned_name ? `Assigned to ${job.assigned_name}` : 'Not assigned'}</Text>
            </View>
          </Card>
        ) : null}

        {/* Next steps */}
        {actions.length ? (
          <View style={styles.actions}>
            {actions.includes('schedule') ? (
              <AppButton label="Schedule visit" icon="calendar-outline" onPress={() => open('schedule')} />
            ) : null}
            {actions.includes('start') ? (
              <AppButton
                label="Start work (on site)"
                icon="play-outline"
                loading={busy}
                onPress={() => void run(() => jobsApi.start(job.id), 'Work started')}
              />
            ) : null}
            {actions.includes('complete') ? (
              <AppButton
                label="Complete job"
                icon="checkmark-done-outline"
                variant={actions.includes('start') ? 'secondary' : 'primary'}
                onPress={() => open('complete')}
              />
            ) : null}
            {actions.includes('pay') ? (
              <AppButton label="Payment received" icon="cash-outline" onPress={() => open('pay')} />
            ) : null}
            {actions.includes('reopen') ? (
              <AppButton
                label="Reopen as new request"
                icon="refresh-outline"
                loading={busy}
                onPress={() => void run(() => jobsApi.reopen(job.id), 'Job reopened')}
              />
            ) : null}
            <View style={styles.secondaryRow}>
              {actions.includes('reschedule') ? (
                <AppButton label="Reschedule" variant="ghost" onPress={() => open('schedule')} style={styles.flex} />
              ) : null}
              {actions.includes('edit') ? (
                <AppButton label="Edit" variant="ghost" onPress={() => open('edit')} style={styles.flex} />
              ) : null}
              {actions.includes('cancel') ? (
                <AppButton label="Cancel job" variant="ghost" onPress={() => setPrompt('cancel')} style={styles.flex} />
              ) : null}
            </View>
          </View>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Row label="Phone" value={job.phone} />
          <Row label="Email" value={job.email} />
          <Row label="Site" value={job.location} />
          <View style={styles.contact}>
            <IconButton icon="call" label="Call" showLabel tone="primary" onPress={() => void Linking.openURL(`tel:${job.phone}`)} />
            <IconButton
              icon="logo-whatsapp"
              label="WhatsApp"
              showLabel
              tone="primary"
              onPress={() =>
                void Linking.openURL(
                  `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${job.customer_name}, this is GTG Vibral about your field balancing request ${job.reference}.`)}`,
                )
              }
            />
            <IconButton
              icon="navigate"
              label="Map"
              showLabel
              tone="primary"
              onPress={() =>
                void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`)
              }
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Machine</Text>
          <Row label="Type" value={job.machine_type} />
          <Row label="Quantity" value={job.quantity > 1 ? job.quantity : null} />
          <Row label="Speed" value={job.rpm ? `${job.rpm} RPM` : null} />
          <Row label="Power" value={job.power} />
          <Row label="Rotor weight" value={job.rotor_weight} />
          <Row label="Rotor diameter" value={job.rotor_diameter} />
          <Row label="Mounting" value={job.mounting} />
          <Row label="Brand / model" value={job.brand_model} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Request</Text>
          <Row label="Problem" value={job.symptoms.join(', ')} />
          <Row label="Reading" value={job.vibration_reading} />
          <Row label="Service" value={job.service} />
          <Row label="Urgency" value={job.urgency} />
          <Row label="Preferred" value={job.preferred_date ? formatDay(job.preferred_date) : null} />
          <Row label="Notes" value={job.notes} />
        </Card>

        {job.completed_at ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Result</Text>
            <Row label="Before" value={job.vibration_before} />
            <Row label="After" value={job.vibration_after} />
            <Row label="Grade" value={job.balance_grade} />
            <Row label="Correction" value={job.correction_details} />
            <Row label="Summary" value={job.work_summary} />
            {admin ? <Row label="Amount" value={job.amount != null ? formatMoney(job.amount) : null} /> : null}
            {admin ? <Row label="Paid by" value={job.payment_mode} /> : null}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.timelineHead}>
            <Text style={styles.cardTitle}>Timeline</Text>
            <AppButton label="Add note" variant="ghost" icon="create-outline" onPress={() => setPrompt('note')} />
          </View>
          {(job.events ?? []).map((event, i) => (
            <View key={i} style={styles.event}>
              <View style={styles.eventDot} />
              <View style={styles.flex}>
                <Text style={styles.eventTitle}>
                  {EVENT_LABEL[event.event]}
                  {event.actor_name ? <Text style={styles.meta}> · {event.actor_name}</Text> : null}
                </Text>
                {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
                <Text style={styles.meta}>{formatDateTime(event.created_at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      <PromptModal
        visible={prompt === 'cancel'}
        title={`Cancel ${job.reference}?`}
        label="Reason"
        placeholder="Customer postponed, machine replaced…"
        confirmLabel="Cancel job"
        danger
        onClose={() => setPrompt(null)}
        onConfirm={async (reason) => {
          await jobsApi.cancel(job.id, reason);
          setData(await jobsApi.get(job.id));
          setPrompt(null);
          toast.show('Job cancelled', 'info');
        }}
      />
      <PromptModal
        visible={prompt === 'note'}
        title="Add a note"
        label="Note"
        placeholder="Customer asked to come after 2 PM"
        confirmLabel="Save note"
        onClose={() => setPrompt(null)}
        onConfirm={async (note) => {
          setData(await jobsApi.addNote(job.id, note));
          setPrompt(null);
        }}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  source: { color: t.colors.textMuted, fontSize: fontSize.xs },
  title: { color: t.colors.text, fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.sm },
  subtitle: { color: t.colors.textSecondary, fontSize: fontSize.md },
  progress: { flexDirection: 'row', gap: 4, marginVertical: spacing.lg },
  step: { flex: 1, gap: 4 },
  stepBar: { backgroundColor: t.colors.border, borderRadius: radius.pill, height: 6 },
  stepBarOn: { backgroundColor: t.colors.accent },
  stepText: { color: t.colors.textSubtle, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  stepTextOn: { color: t.colors.text, fontWeight: '800' },
  cancelled: { borderRadius: radius.sm, marginVertical: spacing.lg, padding: spacing.md },
  cancelledText: { color: t.colors.danger, fontWeight: '700' },
  visit: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  visitWhen: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  secondaryRow: { flexDirection: 'row', gap: spacing.xs },
  card: { marginBottom: spacing.md },
  cardTitle: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: 5 },
  rowLabel: { color: t.colors.textMuted, fontSize: fontSize.sm, width: 100 },
  rowValue: { color: t.colors.text, flex: 1, fontSize: fontSize.md },
  contact: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  meta: { color: t.colors.textMuted, fontSize: fontSize.sm, fontWeight: '400' },
  timelineHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  event: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  eventDot: { backgroundColor: t.colors.accent, borderRadius: 6, height: 12, marginTop: 4, width: 12 },
  eventTitle: { color: t.colors.text, fontSize: fontSize.md, fontWeight: '700' },
  eventNote: { color: t.colors.textSecondary, fontSize: fontSize.md },
}));
