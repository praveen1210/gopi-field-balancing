import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { addMonths, formatMonth, monthGrid, todayKey, WEEKDAY_INITIALS } from '../core/dates';
import { fontSize, makeStyles, radius, spacing } from '../theme';
import { IconButton } from './ui/IconButton';

/**
 * Month grid. Days with jobs show how many; tap a day to see its jobs.
 * `counts` maps YYYY-MM-DD to the number of jobs that day.
 */
export function MonthCalendar({
  month,
  selected,
  counts,
  onSelect,
  onMonthChange,
}: {
  /** Any day in the month shown. */
  month: string;
  selected: string;
  counts: Record<string, number>;
  onSelect(day: string): void;
  onMonthChange(month: string): void;
}) {
  const styles = useStyles();
  const today = todayKey();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => onMonthChange(addMonths(month, -1))} />
        <Text style={styles.title} accessibilityRole="header">
          {formatMonth(month)}
        </Text>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => onMonthChange(addMonths(month, 1))} />
      </View>
      <View style={styles.row}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {monthGrid(month).map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const count = counts[day] ?? 0;
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <Pressable
                key={day}
                onPress={() => onSelect(day)}
                style={[styles.cell, styles.day, isToday && styles.today, isSelected && styles.selected]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${day}${count ? `, ${count} job${count > 1 ? 's' : ''}` : ''}`}
              >
                <Text style={[styles.dayText, isSelected && styles.selectedText]}>{Number(day.slice(8))}</Text>
                {count ? (
                  <View style={[styles.dot, isSelected && styles.dotSelected]}>
                    <Text style={[styles.dotText, isSelected && styles.dotTextSelected]}>{count}</Text>
                  </View>
                ) : (
                  <View style={styles.dotSpace} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: t.colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  row: { flexDirection: 'row' },
  weekday: {
    color: t.colors.textMuted,
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '700',
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  cell: { flex: 1, margin: 2, minHeight: 46 },
  day: { alignItems: 'center', borderRadius: radius.sm, justifyContent: 'center', paddingVertical: 4 },
  today: { borderColor: t.colors.accent, borderWidth: 2 },
  selected: { backgroundColor: t.colors.primary },
  dayText: { color: t.colors.text, fontSize: fontSize.md, fontWeight: '600' },
  selectedText: { color: t.colors.onPrimary },
  dot: {
    backgroundColor: t.colors.accent,
    borderRadius: radius.pill,
    marginTop: 2,
    minWidth: 18,
    paddingHorizontal: 4,
  },
  dotSelected: { backgroundColor: t.colors.onPrimary },
  dotText: { color: t.colors.onAccent, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  dotTextSelected: { color: t.colors.primary },
  dotSpace: { height: 16 },
}));
