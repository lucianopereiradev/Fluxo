import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addMonthsToMonth,
  dateInMonth,
  daysInMonth,
  diffDays,
  diffMonths,
  eachDay,
  endOfMonth,
  formatDate,
  isValidLocalDate,
  isValidYearMonth,
  monthOf,
  today,
  weekday,
} from './dates';

describe('local dates', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('validates strings', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-1-01')).toBe(false);
    expect(isValidYearMonth('2026-11')).toBe(true);
    expect(isValidYearMonth('2026-00')).toBe(false);
  });

  it('clamps the day to the end of short months', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30');
    expect(dateInMonth('2026-01', 31)).toBe('2026-01-31');
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('is not affected by DST transitions', () => {
    // Brazil and the US both had DST changes around these dates historically.
    expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(eachDay('2026-10-30', '2026-11-03')).toHaveLength(5);
  });

  it('adds months keeping the day, clamped', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsToMonth('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToMonth('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToMonth('2026-01', -13)).toBe('2024-12');
    expect(diffMonths('2025-11', '2026-02')).toBe(3);
  });

  it('computes month boundaries and weekdays', () => {
    expect(monthOf('2026-11-01')).toBe('2026-11');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(weekday('2026-11-01')).toBe(0); // Sunday
    expect(weekday('2026-11-02')).toBe(1);
    expect(weekday('1970-01-01')).toBe(4); // Thursday
  });

  it('reads today from the local clock, not UTC', () => {
    // 23:30 local on Nov 1 is still Nov 1, whatever the UTC date is.
    expect(today(new Date(2026, 10, 1, 23, 30))).toBe('2026-11-01');
    expect(today(new Date(2026, 10, 2, 0, 5))).toBe('2026-11-02');
  });

  it('formats without shifting the day', () => {
    expect(
      formatDate('2026-01-01', 'en-US', { day: 'numeric', month: 'numeric', year: 'numeric' }),
    ).toBe('1/1/2026');
    expect(
      formatDate('2026-12-31', 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    ).toBe('31/12/2026');
  });
});
