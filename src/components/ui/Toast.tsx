import Ionicons from '@expo/vector-icons/Ionicons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, radius, spacing, useAppTheme, fontSize } from '../../theme';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show(text: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

const VISIBLE_MS = 2600;

/** Short, non-blocking confirmations ("Job scheduled"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const counter = useRef(0);

  const show = useCallback((text: string, tone: ToastTone = 'success') => {
    counter.current += 1;
    setMessage({ id: counter.current, text, tone });
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <ToastBanner key={message.id} message={message} onDone={() => setMessage(null)} />
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function ToastBanner({ message, onDone }: { message: ToastMessage; onDone(): void }) {
  const styles = useStyles();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        onDone(),
      );
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [opacity, onDone]);

  const icon =
    message.tone === 'error'
      ? 'alert-circle'
      : message.tone === 'info'
        ? 'information-circle'
        : 'checkmark-circle';
  const tint =
    message.tone === 'error'
      ? theme.colors.danger
      : message.tone === 'info'
        ? theme.colors.primary
        : theme.colors.success;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { bottom: insets.bottom + 72, opacity }]}
      testID="toast"
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '90%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  text: {
    color: t.colors.text,
    flexShrink: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
}));
