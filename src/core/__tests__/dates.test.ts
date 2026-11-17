import { describe, expect, it } from '@jest/globals';

import { addDays, addMonths, formatMoney, monthEnd, monthGrid, relativeDay, todayKey } from '../dates';

describe('dates', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
  });

  it('builds full Sunday-first weeks for the calendar', () => {
    const weeks = monthGrid('2026-11-17');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toBe('2026-11-01'); // 1 Nov 2026 is a Sunday
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('names nearby days', () => {
    expect(relativeDay(todayKey())).toBe('Today');
    expect(relativeDay(addDays(todayKey(), 1))).toBe('Tomorrow');
  });

  it('formats rupees Indian style', () => {
    expect(formatMoney(125000)).toBe('₹1,25,000');
    expect(formatMoney(null)).toBe('—');
  });
});
