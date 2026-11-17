import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { fontSize, makeStyles, radius, spacing } from '../theme';
import { TextField } from './FormControls';
import { AppButton } from './ui/AppButton';

/** Asks for one line of text (cancel reason, note) before an action. */
export function PromptModal({
  visible,
  title,
  label,
  placeholder,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm(text: string): Promise<void>;
  onClose(): void;
}) {
  const styles = useStyles();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setText('');
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!text.trim()) {
      setError(`Please enter ${label.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(text.trim());
      setText('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={close} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <TextField
            label={label}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            multiline
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <AppButton label="Back" variant="ghost" onPress={close} style={styles.action} />
            <AppButton
              label={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              loading={busy}
              onPress={() => void confirm()}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { backgroundColor: t.colors.overlay, flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { color: t.colors.text, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.md },
  error: { color: t.colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
}));
