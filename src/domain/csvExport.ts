import { centsToDecimalString } from './money';
import type { Transaction } from './types';

const escape = (value: string) =>
  /[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Exports transactions as RFC 4180 CSV with signed decimal amounts (expenses negative). */
export function transactionsToCsv(
  transactions: readonly Transaction[],
  names: {
    category: (t: Transaction) => string;
    source: (t: Transaction) => string;
    target: (t: Transaction) => string;
  },
): string {
  const header = [
    'date',
    'type',
    'description',
    'amount',
    'category',
    'account',
    'to',
    'tags',
    'installment',
    'notes',
  ];
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      t.date,
      t.type,
      t.description,
      centsToDecimalString(t.type === 'expense' ? -t.amountCents : t.amountCents),
      t.type === 'transfer' ? '' : names.category(t),
      names.source(t),
      names.target(t),
      t.tags.join(' '),
      t.installmentIndex ? `${t.installmentIndex}/${t.installmentCount}` : '',
      t.notes,
    ]);
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}
