/**
 * Dates are shown and grouped in the phone's local time (the business runs in
 * India, matching the database's Asia/Kolkata grouping). Day keys are
 * YYYY-MM-DD strings so they compare and sort as text.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** Local midnight for a YYYY-MM-DD key. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function addMonths(key: string, months: number): string {
  const date = fromDayKey(monthStart(key));
  date.setMonth(date.getMonth() + months);
  return dayKey(date);
}

export function monthEnd(key: string): string {
  return addDays(addMonths(key, 1), -1);
}

/** "Mon, 17 Nov" — with the year when it is not this year. */
export function formatDay(key: string): string {
  const date = fromDayKey(key);
  const base = `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday" or the formatted day. */
export function relativeDay(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return formatDay(key);
}

export function formatMonth(key: string): string {
  const date = fromDayKey(key);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  return `${hours % 12 || 12}:${pad(date.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "Mon, 17 Nov · 10:30 AM" */
export function formatDateTime(iso: string): string {
  return `${relativeDay(dayKey(new Date(iso)))} · ${formatTime(iso)}`;
}

/** Weeks (Sunday first) covering the month, for the calendar grid. */
export function monthGrid(key: string): (string | null)[][] {
  const first = fromDayKey(monthStart(key));
  const last = fromDayKey(monthEnd(key)).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= last; day += 1) {
    cells.push(dayKey(new Date(first.getFullYear(), first.getMonth(), day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
