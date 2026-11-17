import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/FormControls';
import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/context/SessionContext';
import { fontSize, makeStyles, spacing } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

export default function LoginScreen() {
  const styles = useStyles();
  const { signIn, signUp, error: sessionError } = useSession();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter your email address.');
      return;
    }
    if (password.length < (mode === 'sign-up' ? 8 : 1)) {
      setError(mode === 'sign-up' ? 'Choose a password of at least 8 characters.' : 'Enter your password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else if ((await signUp(email, password)) === 'confirm-email') {
        setNotice('Check your email and tap the confirmation link, then sign in here.');
        setMode('sign-in');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const shownError = error ?? sessionError;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>GTG Vibral</Text>
            <Text style={styles.tagline}>Field balancing jobs</Text>
          </View>

          <Card>
            <Text style={styles.title}>{mode === 'sign-in' ? 'Sign in' : 'Create your login'}</Text>
            {mode === 'sign-up' ? (
              <Text style={styles.help}>
                Use the email the admin added for you in the Team tab.
              </Text>
            ) : null}
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
              onSubmitEditing={() => void submit()}
            />
            {shownError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {shownError}
              </Text>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <AppButton
              label={mode === 'sign-in' ? 'Sign in' : 'Create login'}
              loading={busy}
              loadingLabel={mode === 'sign-in' ? 'Signing in…' : 'Creating…'}
              onPress={() => void submit()}
            />
          </Card>

          <Pressable
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
            }}
            style={styles.switch}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              {mode === 'sign-in' ? 'First time? Create your login' : 'Already have a login? Sign in'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  safe: { backgroundColor: t.colors.background, flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { color: t.colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: t.colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
  title: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.md },
  help: { color: t.colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md },
  error: { color: t.colors.danger, fontSize: fontSize.sm, marginBottom: spacing.md },
  notice: { color: t.colors.success, fontSize: fontSize.sm, marginBottom: spacing.md },
  switch: { alignItems: 'center', padding: spacing.lg },
  switchText: { color: t.colors.primary, fontSize: fontSize.md, fontWeight: '600' },
}));
