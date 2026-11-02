import { addDays, addMonths, addMonthsToMonth, type LocalDate } from './dates';
import { closingDateOf, invoiceMonthFor } from './invoices';
import { splitCents, type Cents } from './money';
import type { Transaction } from './types';

export interface PlannedInstallment {
  index: number;
  count: number;
  amountCents: Cents;
  date: LocalDate;
}

/**
 * Splits a purchase into monthly installments. The rounding remainder goes to the first
 * one. On a card, installment k always lands in the k-th invoice after the purchase's
 * invoice, even when clamping a day in a short month would otherwise push it past closing.
 */
export function planInstallments(params: {
  totalCents: Cents;
  count: number;
  purchaseDate: LocalDate;
  closingDay?: number | null;
}): PlannedInstallment[] {
  const { totalCents, count, purchaseDate, closingDay } = params;
  const amounts = splitCents(totalCents, count);
  const baseInvoice = closingDay != null ? invoiceMonthFor(purchaseDate, closingDay) : null;

  return amounts.map((amountCents, index) => {
    let date = addMonths(purchaseDate, index);
    if (closingDay != null && baseInvoice) {
      const target = addMonthsToMonth(baseInvoice, index);
      if (invoiceMonthFor(date, closingDay) !== target) {
        date = addDays(closingDateOf(target, closingDay), -1);
      }
    }
    return { index: index + 1, count, amountCents, date };
  });
}

export type InstallmentScope = 'this' | 'thisAndNext';

/** The installments affected by editing or deleting `tx` with the chosen scope. */
export function installmentsInScope(
  all: readonly Transaction[],
  tx: Transaction,
  scope: InstallmentScope,
): Transaction[] {
  if (scope === 'this' || !tx.installmentGroupId) return [tx];
  return all
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.installmentGroupId === tx.installmentGroupId &&
        (t.installmentIndex ?? 0) >= (tx.installmentIndex ?? 0),
    )
    .sort((a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0));
}
