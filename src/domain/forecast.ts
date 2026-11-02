import { accountDelta, isLiquid, liquidBalance } from './balances';
import { addDays, eachDay, type LocalDate } from './dates';
import { computeInvoices, type Invoice } from './invoices';
import type { Cents } from './money';
import { makeTransaction } from './records';
import { materializedKeys, pendingOccurrences } from './recurrences';
import type { Account, Card, Recurrence, Transaction } from './types';

export type ForecastEventKind = 'recurrence' | 'scheduled' | 'invoice';

export interface ForecastEvent {
  date: LocalDate;
  kind: ForecastEventKind;
  /** Signed effect on the liquid balance. */
  amountCents: Cents;
  label: string;
  refId: string;
  categoryId: string | null;
}

export interface ForecastDay {
  date: LocalDate;
  balanceCents: Cents;
  inflowCents: Cents;
  outflowCents: Cents;
  events: ForecastEvent[];
}

export interface ForecastInput {
  today: LocalDate;
  days?: number;
  accounts: readonly Account[];
  cards: readonly Card[];
  transactions: readonly Transaction[];
  recurrences: readonly Recurrence[];
}

export interface Forecast {
  days: ForecastDay[];
  startBalanceCents: Cents;
  endBalanceCents: Cents;
  minBalanceCents: Cents;
  minBalanceDate: LocalDate;
  firstNegativeDate: LocalDate | null;
  events: ForecastEvent[];
}

/**
 * Card recurrences (e.g. a streaming subscription) do not touch an account directly: they
 * become projected charges that flow into invoice totals, which are then paid on due dates.
 */
export function projectedCardCharges(
  recurrences: readonly Recurrence[],
  transactions: readonly Transaction[],
  from: LocalDate,
  to: LocalDate,
): Transaction[] {
  const keys = materializedKeys(transactions);
  return recurrences
    .filter((r) => r.cardId && r.type === 'expense')
    .flatMap((r) =>
      pendingOccurrences(r, transactions, from, to, keys).map((date) =>
        makeTransaction({
          id: `projected:${r.id}:${date}`,
          type: 'expense',
          amountCents: r.amountCents,
          date,
          cardId: r.cardId,
          categoryId: r.categoryId,
          description: r.description,
          recurrenceId: r.id,
        }),
      ),
    );
}

/** Unpaid invoices that hit the liquid balance between `from` and `to` (overdue ones on `from`). */
export function invoicesDue(
  cards: readonly Card[],
  transactions: readonly Transaction[],
  today: LocalDate,
  to: LocalDate,
): Invoice[] {
  return cards
    .filter((c) => c.deletedAt === null)
    .flatMap((card) => computeInvoices(card, transactions, today))
    .filter((inv) => inv.remainingCents > 0 && inv.dueDate <= to && inv.status !== 'paid');
}

export function forecastBalance(input: ForecastInput): Forecast {
  const { today, days = 90, accounts, cards, transactions, recurrences } = input;
  const end = addDays(today, days);
  const liquid = accounts.filter((a) => a.deletedAt === null && isLiquid(a));
  const liquidIds = liquid.map((a) => a.id);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const keys = materializedKeys(transactions);
  const events: ForecastEvent[] = [];

  // Already scheduled transactions dated after today.
  for (const t of transactions) {
    if (t.deletedAt !== null || t.date <= today || t.date > end) continue;
    const delta = liquidIds.reduce((s, id) => s + accountDelta(t, id), 0);
    if (delta !== 0) {
      events.push({
        date: t.date,
        kind: 'scheduled',
        amountCents: delta,
        label: t.description,
        refId: t.id,
        categoryId: t.categoryId,
      });
    }
  }

  // Recurrences on liquid accounts that have not been materialized yet.
  for (const r of recurrences) {
    if (!r.accountId || !liquidIds.includes(r.accountId)) continue;
    for (const date of pendingOccurrences(r, transactions, today, end, keys)) {
      events.push({
        date,
        kind: 'recurrence',
        amountCents: r.type === 'income' ? r.amountCents : -r.amountCents,
        label: r.description,
        refId: r.id,
        categoryId: r.categoryId,
      });
    }
  }

  // Invoices (with future installments and projected card subscriptions) on due dates.
  const withProjected = [
    ...transactions,
    ...projectedCardCharges(recurrences, transactions, today, end),
  ];
  for (const inv of invoicesDue(cards, withProjected, today, end)) {
    const card = cardById.get(inv.cardId);
    if (card?.paymentAccountId && !liquidIds.includes(card.paymentAccountId)) continue;
    events.push({
      date: inv.dueDate < today ? today : inv.dueDate,
      kind: 'invoice',
      amountCents: -inv.remainingCents,
      label: card?.name ?? '',
      refId: `${inv.cardId}:${inv.month}`,
      categoryId: null,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.amountCents - b.amountCents);

  const startBalanceCents = liquidBalance(accounts, transactions, today);
  const byDate = new Map<LocalDate, ForecastEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }

  let balance = startBalanceCents;
  let minBalanceCents = Infinity;
  let minBalanceDate = today;
  let firstNegativeDate: LocalDate | null = null;
  const series: ForecastDay[] = eachDay(today, end).map((date) => {
    const dayEvents = byDate.get(date) ?? [];
    let inflowCents = 0;
    let outflowCents = 0;
    for (const e of dayEvents) {
      if (e.amountCents >= 0) inflowCents += e.amountCents;
      else outflowCents -= e.amountCents;
    }
    balance += inflowCents - outflowCents;
    if (balance < minBalanceCents) {
      minBalanceCents = balance;
      minBalanceDate = date;
    }
    if (balance < 0 && firstNegativeDate === null) firstNegativeDate = date;
    return { date, balanceCents: balance, inflowCents, outflowCents, events: dayEvents };
  });

  return {
    days: series,
    startBalanceCents,
    endBalanceCents: balance,
    minBalanceCents,
    minBalanceDate,
    firstNegativeDate,
    events,
  };
}
