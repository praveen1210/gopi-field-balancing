import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { dayKey, formatDateTime } from '../core/dates';
import { fontSize, makeStyles, radius, spacing, useAppTheme } from '../theme';

/** Labelled text box. */
export function TextField({
  label,
  required,
  hint,
  ...input
}: TextInputProps & { label: string; required?: boolean; hint?: string }) {
  const styles = useStyles();
  const theme = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={theme.colors.placeholder}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, input.multiline && styles.multiline]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** One choice from a short list, as tappable chips. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  renderLabel,
}: {
  label: string;
  options: readonly T[];
  value: T | '';
  onChange(value: T): void;
  required?: boolean;
  renderLabel?(value: T): string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {renderLabel ? renderLabel(option) : option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Visit date and time: the phone's own pickers (a browser input on web). */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange(value: Date): void;
}) {
  const styles = useStyles();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'datetime-local',
          'aria-label': label,
          value: toLocalInput(value),
          onChange: (event: { target: { value: string } }) => {
            const next = new Date(event.target.value);
            if (!Number.isNaN(next.getTime())) onChange(next);
          },
          style: { fontSize: 16, padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' },
        })}
      </View>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <DateTimePicker
          value={value}
          mode="datetime"
          minuteInterval={15}
          onValueChange={(_event, date) => onChange(date)}
        />
      </View>
    );
  }

  // Android: pick the day, then the time.
  const openPicker = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onValueChange: (_event, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: false,
          onValueChange: (_e, time) => {
            const next = new Date(day);
            next.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(next);
          },
        });
      },
    });
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        style={styles.input}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateTime(value.toISOString())}. Tap to change.`}
      >
        <Text style={styles.value}>{formatDateTime(value.toISOString())}</Text>
      </Pressable>
    </View>
  );
}

/**
 * A sensible first suggestion: 10 AM on the customer's preferred day; else
 * the next quarter-hour today during working hours (8 AM–6 PM); else 10 AM
 * tomorrow.
 */
export function defaultVisitTime(preferredDay?: string | null): Date {
  const now = new Date();
  if (preferredDay && preferredDay > dayKey(now)) {
    const [y, m, d] = preferredDay.split('-').map(Number);
    return new Date(y, m - 1, d, 10, 0);
  }
  const next = new Date(now);
  next.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15, 0, 0);
  if (next.getHours() >= 8 && next.getHours() < 18 && dayKey(next) === dayKey(now)) {
    return next;
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getHours() < 8 ? 0 : 1), 10, 0);
  return tomorrow;
}

const useStyles = makeStyles((t) => ({
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { color: t.colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  required: { color: t.colors.danger },
  input: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: t.colors.text,
    fontSize: fontSize.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  value: { color: t.colors.text, fontSize: fontSize.md },
  hint: { color: t.colors.textMuted, fontSize: fontSize.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipText: { color: t.colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  chipTextSelected: { color: t.colors.onPrimary },
}));
