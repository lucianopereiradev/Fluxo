import { addDays, endOfMonth, weekday, type LocalDate, type YearMonth } from './dates';
import { computeInvoices } from './invoices';
import type { Cents } from './money';
import { materializedKeys, occurrences } from './recurrences';
import type { Card, Recurrence, Transaction } from './types';

export interface CalendarEvent {
  date: LocalDate;
  kind: 'recurrence' | 'invoice' | 'scheduled';
  direction: 'in' | 'out';
  amountCents: Cents;
  label: string;
  /** Already happened: the recurrence was recorded, or the invoice was paid. */
  done: boolean;
  refId: string;
}

/** Bills to pay and money to receive in a month, for the calendar view. */
export function monthEvents(params: {
  month: YearMonth;
  recurrences: readonly Recurrence[];
  cards: readonly Card[];
  transactions: readonly Transaction[];
  today: LocalDate;
}): Map<LocalDate, CalendarEvent[]> {
  const { month, recurrences, cards, transactions, today } = params;
  const from = `${month}-01`;
  const to = endOfMonth(from);
  const keys = materializedKeys(transactions);
  const events: CalendarEvent[] = [];

  for (const r of recurrences) {
    for (const date of occurrences(r, from, to)) {
      events.push({
        date,
        kind: 'recurrence',
        direction: r.type === 'income' ? 'in' : 'out',
        amountCents: r.amountCents,
        label: r.description,
        done: keys.has(`${r.id}|${date}`),
        refId: r.id,
      });
    }
  }

  for (const card of cards) {
    for (const inv of computeInvoices(card, transactions, today)) {
      if (inv.dueDate < from || inv.dueDate > to || inv.totalCents <= 0) continue;
      events.push({
        date: inv.dueDate,
        kind: 'invoice',
        direction: 'out',
        amountCents: inv.totalCents,
        label: card.name,
        done: inv.status === 'paid',
        refId: `${card.id}:${inv.month}`,
      });
    }
  }

  for (const t of transactions) {
    if (t.recurrenceId || t.date <= today || t.date < from || t.date > to) continue;
    if (t.type === 'transfer' || t.cardId) continue;
    events.push({
      date: t.date,
      kind: 'scheduled',
      direction: t.type === 'income' ? 'in' : 'out',
      amountCents: t.amountCents,
      label: t.description,
      done: false,
      refId: t.id,
    });
  }

  const map = new Map<LocalDate, CalendarEvent[]>();
  for (const e of events.sort((a, b) => a.date.localeCompare(b.date))) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

/** Weeks (Sunday-first by default) covering the month, padded with null days. */
export function monthGrid(month: YearMonth, weekStartsOn: 0 | 1 = 0): (LocalDate | null)[][] {
  const first = `${month}-01`;
  const last = endOfMonth(first);
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const cells: (LocalDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
