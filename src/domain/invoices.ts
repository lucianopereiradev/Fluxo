import {
  addDays,
  addMonthsToMonth,
  dateInMonth,
  monthOf,
  type LocalDate,
  type YearMonth,
} from './dates';
import type { Cents } from './money';
import type { Card, Transaction } from './types';

/**
 * Brazilian credit card cycle. An invoice is identified by the month in which it closes.
 * A purchase made on the closing day or later belongs to the next invoice. The invoice is
 * due in the closing month when dueDay > closingDay, otherwise in the following month.
 * Days are clamped to short months (closing on the 31st becomes the 28th/29th in February).
 */
export type CardCycle = Pick<Card, 'closingDay' | 'dueDay'>;

export type InvoiceStatus = 'future' | 'open' | 'closed' | 'paid';

export interface Invoice {
  cardId: string;
  month: YearMonth;
  /** First purchase day included (the previous closing date). */
  startDate: LocalDate;
  /** Last purchase day included (the day before this closing date). */
  endDate: LocalDate;
  closingDate: LocalDate;
  dueDate: LocalDate;
  status: InvoiceStatus;
  overdue: boolean;
  chargesCents: Cents;
  creditsCents: Cents;
  totalCents: Cents;
  paidCents: Cents;
  remainingCents: Cents;
  transactions: Transaction[];
  payments: Transaction[];
}

export function closingDateOf(month: YearMonth, closingDay: number): LocalDate {
  return dateInMonth(month, closingDay);
}

export function invoiceMonthFor(date: LocalDate, closingDay: number): YearMonth {
  const month = monthOf(date);
  return date >= closingDateOf(month, closingDay) ? addMonthsToMonth(month, 1) : month;
}

export function dueDateOf(month: YearMonth, cycle: CardCycle): LocalDate {
  const dueMonth = cycle.dueDay > cycle.closingDay ? month : addMonthsToMonth(month, 1);
  return dateInMonth(dueMonth, cycle.dueDay);
}

export function invoicePeriod(
  month: YearMonth,
  closingDay: number,
): { startDate: LocalDate; endDate: LocalDate; closingDate: LocalDate } {
  const closingDate = closingDateOf(month, closingDay);
  return {
    startDate: closingDateOf(addMonthsToMonth(month, -1), closingDay),
    endDate: addDays(closingDate, -1),
    closingDate,
  };
}

const isCharge = (t: Transaction, cardId: string) =>
  t.deletedAt === null && t.cardId === cardId && (t.type === 'expense' || t.type === 'income');

const isPayment = (t: Transaction, cardId: string) =>
  t.deletedAt === null && t.type === 'transfer' && t.toCardId === cardId;

/** Which invoice a bill payment settles: explicit, else the latest invoice closed by then. */
export function paymentInvoiceMonth(payment: Transaction, closingDay: number): YearMonth {
  return payment.invoiceMonth ?? addMonthsToMonth(invoiceMonthFor(payment.date, closingDay), -1);
}

export interface ComputeInvoicesOptions {
  /** Always include invoices up to this month (e.g. the currently open one). */
  throughMonth?: YearMonth;
}

/** Computes every invoice of a card from its transactions. Nothing here is stored. */
export function computeInvoices(
  card: Pick<Card, 'id' | 'closingDay' | 'dueDay'>,
  transactions: readonly Transaction[],
  today: LocalDate,
  options: ComputeInvoicesOptions = {},
): Invoice[] {
  const charges = new Map<YearMonth, Transaction[]>();
  const payments = new Map<YearMonth, Transaction[]>();
  const push = (map: Map<YearMonth, Transaction[]>, key: YearMonth, t: Transaction) => {
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  };

  for (const t of transactions) {
    if (isCharge(t, card.id)) push(charges, invoiceMonthFor(t.date, card.closingDay), t);
    else if (isPayment(t, card.id)) push(payments, paymentInvoiceMonth(t, card.closingDay), t);
  }

  const months = [...charges.keys(), ...payments.keys()];
  const current = invoiceMonthFor(today, card.closingDay);
  months.push(
    options.throughMonth && options.throughMonth > current ? options.throughMonth : current,
  );
  const first = months.reduce((a, b) => (a < b ? a : b));
  const last = months.reduce((a, b) => (a > b ? a : b));

  const invoices: Invoice[] = [];
  for (let month = first; month <= last; month = addMonthsToMonth(month, 1)) {
    const txs = (charges.get(month) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const pays = (payments.get(month) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const chargesCents = txs.reduce((s, t) => s + (t.type === 'expense' ? t.amountCents : 0), 0);
    const creditsCents = txs.reduce((s, t) => s + (t.type === 'income' ? t.amountCents : 0), 0);
    const totalCents = chargesCents - creditsCents;
    const paidCents = pays.reduce((s, t) => s + t.amountCents, 0);
    const remainingCents = Math.max(0, totalCents - paidCents);
    const period = invoicePeriod(month, card.closingDay);
    const dueDate = dueDateOf(month, card);

    let status: InvoiceStatus;
    if (today >= period.closingDate) status = remainingCents > 0 ? 'closed' : 'paid';
    else if (today >= period.startDate) status = 'open';
    else status = 'future';

    invoices.push({
      cardId: card.id,
      month,
      ...period,
      dueDate,
      status,
      overdue: status === 'closed' && today > dueDate,
      chargesCents,
      creditsCents,
      totalCents,
      paidCents,
      remainingCents,
      transactions: txs,
      payments: pays,
    });
  }
  return invoices;
}

/**
 * Everything still owed on the card, including future installments already committed.
 * This is what consumes the credit limit.
 */
export function cardOutstanding(cardId: string, transactions: readonly Transaction[]): Cents {
  let owed = 0;
  for (const t of transactions) {
    if (isCharge(t, cardId)) owed += t.type === 'expense' ? t.amountCents : -t.amountCents;
    else if (isPayment(t, cardId)) owed -= t.amountCents;
  }
  return owed;
}

export function availableLimit(
  card: Pick<Card, 'id' | 'limitCents'>,
  transactions: readonly Transaction[],
): Cents {
  return card.limitCents - Math.max(0, cardOutstanding(card.id, transactions));
}
