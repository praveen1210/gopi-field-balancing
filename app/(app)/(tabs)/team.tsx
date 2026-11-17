import React, { useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ChoiceChips, TextField } from '@/components/FormControls';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { useProfile, useSession } from '@/context/SessionContext';
import type { StaffMember, StaffRole } from '@/core/jobs';
import { useRemoteData } from '@/hooks/useRemoteData';
import { errorMessage, jobsApi } from '@/services/jobsApi';
import { fontSize, makeStyles, spacing } from '@/theme';

const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Admin', technician: 'Technician' };

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Back', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes },
  ]);
}

/** You, the team, and (for the admin) adding helpers. */
export default function TeamScreen() {
  const styles = useStyles();
  const profile = useProfile();
  const { signOut } = useSession();
  const toast = useToast();
  const admin = profile.role === 'admin';

  const { data, loading, refreshing, error, offline, refresh, setData } = useRemoteData(() => jobsApi.staff(), []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('technician');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setFormError(null);
    try {
      setData(await jobsApi.addStaff(email, name, phone, role));
      toast.show(`${name.trim()} added. Ask them to install the app and create their login.`, 'success');
      setName('');
      setEmail('');
      setPhone('');
      setRole('technician');
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (member: StaffMember) => {
    const run = async () => {
      try {
        setData(await jobsApi.setStaffActive(member.id, !member.active));
      } catch (cause) {
        toast.show(errorMessage(cause), 'error');
      }
    };
    if (member.active) {
      confirm(`Remove ${member.name}?`, 'They can no longer sign in or see jobs. You can add them back later.', () => void run());
    } else {
      void run();
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Card style={styles.card}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.meta}>
          {profile.email} · {ROLE_LABEL[profile.role]}
        </Text>
        <AppButton
          label="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={() => confirm('Sign out?', 'You will need your email and password next time.', () => void signOut())}
        />
      </Card>

      <Text style={styles.section}>Team</Text>
      {loading && !data ? <StateView kind="loading" /> : null}
      {!data && error ? <StateView kind={offline ? 'offline' : 'error'} message={error} onRetry={refresh} /> : null}
      <View style={styles.list}>
        {(data ?? []).map((member) => (
          <Card key={member.id} style={[styles.member, !member.active && styles.inactive]}>
            <View style={styles.memberText}>
              <Text style={styles.memberName}>
                {member.name} <Text style={styles.role}>· {ROLE_LABEL[member.role]}</Text>
              </Text>
              <Text style={styles.meta}>{member.email}</Text>
              {member.phone ? <Text style={styles.meta}>{member.phone}</Text> : null}
              <Text style={styles.meta}>
                {!member.active ? 'Removed' : member.signed_up ? 'Using the app' : 'Not signed up yet'}
              </Text>
            </View>
            {admin && member.id !== profile.id ? (
              <AppButton
                label={member.active ? 'Remove' : 'Add back'}
                variant={member.active ? 'ghost' : 'secondary'}
                onPress={() => toggle(member)}
              />
            ) : null}
          </Card>
        ))}
      </View>

      {admin ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Add a helper</Text>
          <Text style={styles.help}>
            They install the GTG Vibral app, tap &quot;Create your login&quot; and use this same email.
            Technicians see only the jobs you assign to them.
          </Text>
          <TextField label="Name" required value={name} onChangeText={setName} />
          <TextField
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <ChoiceChips<StaffRole>
            label="Role"
            options={['technician', 'admin']}
            value={role}
            onChange={setRole}
            renderLabel={(r) => ROLE_LABEL[r]}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <AppButton label="Add to team" icon="person-add-outline" loading={busy} onPress={() => void add()} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs, marginBottom: spacing.lg },
  name: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  meta: { color: t.colors.textMuted, fontSize: fontSize.sm },
  section: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  list: { gap: spacing.sm, marginBottom: spacing.lg },
  member: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  inactive: { opacity: 0.6 },
  memberText: { flex: 1 },
  memberName: { color: t.colors.text, fontSize: fontSize.md, fontWeight: '700' },
  role: { color: t.colors.textMuted, fontWeight: '500' },
  cardTitle: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  help: { color: t.colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md },
  error: { color: t.colors.danger, fontSize: fontSize.sm, marginBottom: spacing.md },
}));
