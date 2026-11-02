/**
 * Calendar dates are plain local strings ('YYYY-MM-DD') and months are 'YYYY-MM'.
 * A transaction date is a calendar day, not an instant, so it must never go through UTC
 * conversions. Arithmetic is done on numeric parts; Date.UTC is only used internally as a
 * day counter, where time zones cannot leak in.
 */
export type LocalDate = string;
export type YearMonth = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isValidYearMonth(value: string): value is YearMonth {
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function parseDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid local date: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseMonth(ym: YearMonth): { year: number; month: number } {
  const m = MONTH_RE.exec(ym);
  if (!m) throw new RangeError(`Invalid month: ${ym}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function toDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function toMonth(year: number, month: number): YearMonth {
  return `${pad(year, 4)}-${pad(month)}`;
}

/** Builds a date in the given month, clamping the day to the month's last day (31 → 28/29/30). */
export function dateInMonth(ym: YearMonth, day: number): LocalDate {
  const { year, month } = parseMonth(ym);
  return toDate(year, month, Math.min(Math.max(day, 1), daysInMonth(year, month)));
}

/** Today's calendar date in the device's local time zone. */
export function today(now: Date = new Date()): LocalDate {
  return toDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7);
}

export function dayOf(date: LocalDate): number {
  return parseDate(date).day;
}

function toSerial(date: LocalDate): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromSerial(serial: number): LocalDate {
  const d = new Date(serial * DAY_MS);
  return toDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromSerial(toSerial(date) + days);
}

/** Days from `a` to `b` (positive when b is later). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toSerial(b) - toSerial(a);
}

export function addMonthsToMonth(ym: YearMonth, months: number): YearMonth {
  const { year, month } = parseMonth(ym);
  const index = year * 12 + (month - 1) + months;
  return toMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

/** Months from `a` to `b` (positive when b is later). */
export function diffMonths(a: YearMonth, b: YearMonth): number {
  const pa = parseMonth(a);
  const pb = parseMonth(b);
  return pb.year * 12 + pb.month - (pa.year * 12 + pa.month);
}

/** Adds months keeping the day (or `day` when given), clamped to the target month's length. */
export function addMonths(date: LocalDate, months: number, day = dayOf(date)): LocalDate {
  return dateInMonth(addMonthsToMonth(monthOf(date), months), day);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${monthOf(date)}-01`;
}

export function endOfMonth(date: LocalDate): LocalDate {
  return dateInMonth(monthOf(date), 31);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  return (((toSerial(date) + 4) % 7) + 7) % 7;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function eachMonth(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  for (let m = from; m <= to; m = addMonthsToMonth(m, 1)) out.push(m);
  return out;
}

/** A Date pinned to UTC midnight, safe to hand to Intl formatters with timeZone 'UTC'. */
export function toDisplayDate(date: LocalDate): Date {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(
  date: LocalDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    toDisplayDate(date),
  );
}

export function formatMonth(
  ym: YearMonth,
  locale: string,
  options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' },
): string {
  return formatDate(`${ym}-01`, locale, options);
}
