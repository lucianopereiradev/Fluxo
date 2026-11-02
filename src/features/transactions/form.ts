import { z } from 'zod';
import { isValidLocalDate } from '@/domain/dates';
import { parseMoney } from '@/domain/money';

/** Encodes "where the money came from/went" as one select value: "account:<id>" / "card:<id>". */
export type SourceValue = `account:${string}` | `card:${string}` | '';

export function parseSource(value: string): { accountId: string | null; cardId: string | null } {
  if (value.startsWith('account:')) return { accountId: value.slice(8), cardId: null };
  if (value.startsWith('card:')) return { accountId: null, cardId: value.slice(5) };
  return { accountId: null, cardId: null };
}

export function toSource(accountId: string | null, cardId: string | null): SourceValue {
  if (accountId) return `account:${accountId}`;
  if (cardId) return `card:${cardId}`;
  return '';
}

export const transactionFormSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.string(),
    date: z.string(),
    source: z.string(),
    target: z.string(),
    categoryId: z.string(),
    description: z.string().max(500),
    notes: z.string().max(5000),
    tags: z.string().max(500),
    installments: z.number().int().min(1).max(72),
    invoiceMonth: z.string(),
  })
  .superRefine((v, ctx) => {
    const cents = parseMoney(v.amount);
    if (cents === null || cents <= 0)
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amount' });
    if (!isValidLocalDate(v.date))
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'date' });
    if (!v.source) ctx.addIssue({ code: 'custom', path: ['source'], message: 'source' });
    if (v.type === 'transfer') {
      if (!v.source.startsWith('account:'))
        ctx.addIssue({ code: 'custom', path: ['source'], message: 'transferSource' });
      if (!v.target) ctx.addIssue({ code: 'custom', path: ['target'], message: 'target' });
      else if (v.target === v.source)
        ctx.addIssue({ code: 'custom', path: ['target'], message: 'sameAccount' });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const parseTags = (text: string) =>
  [
    ...new Set(
      text
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ].slice(0, 50);
