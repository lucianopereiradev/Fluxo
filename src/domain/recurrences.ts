import {
  addDays,
  addMonthsToMonth,
  dateInMonth,
  dayOf,
  diffDays,
  diffMonths,
  monthOf,
  parseDate,
  toDate,
  daysInMonth,
  weekday as weekdayOf,
  type LocalDate,
} from './dates';
import { makeTransaction } from './records';
import type { Recurrence, Transaction } from './types';

/** Every occurrence date of a recurrence within [from, to] (inclusive). */
export function occurrences(rec: Recurrence, from: LocalDate, to: LocalDate): LocalDate[] {
  if (rec.deletedAt !== null || !rec.active) return [];
  const start = rec.startDate > from ? rec.startDate : from;
  const end = rec.endDate && rec.endDate < to ? rec.endDate : to;
  if (start > end) return [];
  const interval = Math.max(1, Math.floor(rec.interval || 1));
  const out: LocalDate[] = [];

  if (rec.frequency === 'weekly') {
    const wd = rec.weekday ?? weekdayOf(rec.startDate);
    const first = addDays(rec.startDate, (wd - weekdayOf(rec.startDate) + 7) % 7);
    const step = 7 * interval;
    const skip = first < start ? Math.ceil(diffDays(first, start) / step) : 0;
    for (let d = addDays(first, skip * step); d <= end; d = addDays(d, step)) out.push(d);
    return out;
  }

  if (rec.frequency === 'monthly') {
    const day = rec.dayOfMonth ?? dayOf(rec.startDate);
    const firstMonth = monthOf(rec.startDate);
    const skip = Math.max(0, Math.floor(diffMonths(firstMonth, monthOf(start)) / interval));
    for (
      let m = addMonthsToMonth(firstMonth, skip * interval);
      ;
      m = addMonthsToMonth(m, interval)
    ) {
      const d = dateInMonth(m, day);
      if (d > end) break;
      if (d >= start && d >= rec.startDate) out.push(d);
    }
    return out;
  }

  // yearly: same month as the start date
  const { year: startYear, month } = parseDate(rec.startDate);
  const day = rec.dayOfMonth ?? dayOf(rec.startDate);
  const fromYear = parseDate(start).year;
  const skip = Math.max(0, Math.floor((fromYear - startYear) / interval));
  for (let y = startYear + skip * interval; ; y += interval) {
    const d = toDate(y, month, Math.min(day, daysInMonth(y, month)));
    if (d > end) break;
    if (d >= start && d >= rec.startDate) out.push(d);
  }
  return out;
}

/** Key identifying an occurrence that has (or had) a real transaction. */
const occurrenceKey = (recurrenceId: string, date: LocalDate) => `${recurrenceId}|${date}`;

export function materializedKeys(transactions: readonly Transaction[]): Set<string> {
  const keys = new Set<string>();
  // Deleted occurrences count too: deleting one must not bring it back.
  for (const t of transactions) if (t.recurrenceId) keys.add(occurrenceKey(t.recurrenceId, t.date));
  return keys;
}

/** Occurrences in [from, to] that do not have a transaction yet. */
export function pendingOccurrences(
  rec: Recurrence,
  transactions: readonly Transaction[],
  from: LocalDate,
  to: LocalDate,
  keys: Set<string> = materializedKeys(transactions),
): LocalDate[] {
  return occurrences(rec, from, to).filter((d) => !keys.has(occurrenceKey(rec.id, d)));
}

export function transactionFromOccurrence(rec: Recurrence, date: LocalDate): Transaction {
  return makeTransaction({
    type: rec.type,
    amountCents: rec.amountCents,
    date,
    accountId: rec.accountId,
    cardId: rec.cardId,
    categoryId: rec.categoryId,
    description: rec.description,
    recurrenceId: rec.id,
  });
}

/**
 * Turns every due occurrence (up to and including today) into a real transaction.
 * Idempotent: occurrences that already have a transaction are skipped.
 */
export function materializeRecurrences(
  recurrences: readonly Recurrence[],
  transactions: readonly Transaction[],
  today: LocalDate,
): Transaction[] {
  const keys = materializedKeys(transactions);
  return recurrences.flatMap((rec) =>
    pendingOccurrences(rec, transactions, rec.startDate, today, keys).map((d) =>
      transactionFromOccurrence(rec, d),
    ),
  );
}

/** The next occurrence on or after `from`, if any within ~2 years. */
export function nextOccurrence(rec: Recurrence, from: LocalDate): LocalDate | null {
  return occurrences(rec, from, addDays(from, 800))[0] ?? null;
}
