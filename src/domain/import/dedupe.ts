import { makeTransaction } from '../records';
import { findRule } from '../rules';
import { normalizeText } from '../search';
import type { Rule, Transaction } from '../types';
import type { ImportedRow } from './types';

export interface ImportTarget {
  accountId: string | null;
  cardId: string | null;
}

export interface PreviewRow extends ImportedRow {
  duplicate: boolean;
  categoryId: string | null;
  /** Category suggested by a learned rule (used to know whether the user corrected it). */
  suggestedCategoryId: string | null;
}

const key = (date: string, cents: number, description: string) =>
  `${date}|${cents}|${normalizeText(description)}`;

const signed = (t: Transaction) => (t.type === 'income' ? t.amountCents : -t.amountCents);

/**
 * Flags rows that already exist on the same account or card: by the bank id (FITID) when
 * there is one, otherwise by date + amount + normalized description.
 */
export function markDuplicates(
  rows: readonly ImportedRow[],
  existing: readonly Transaction[],
  target: ImportTarget,
): (ImportedRow & { duplicate: boolean })[] {
  const onTarget = existing.filter(
    (t) =>
      t.deletedAt === null &&
      t.type !== 'transfer' &&
      ((target.accountId && t.accountId === target.accountId) ||
        (target.cardId && t.cardId === target.cardId)),
  );
  const ids = new Set(onTarget.map((t) => t.externalId).filter(Boolean));
  const keys = new Set(onTarget.map((t) => key(t.date, signed(t), t.description)));
  return rows.map((r) => ({
    ...r,
    duplicate: r.externalId
      ? ids.has(r.externalId)
      : keys.has(key(r.date, r.amountCents, r.description)),
  }));
}

export function buildPreview(
  rows: readonly ImportedRow[],
  existing: readonly Transaction[],
  target: ImportTarget,
  rules: readonly Rule[],
): PreviewRow[] {
  return markDuplicates(rows, existing, target).map((r) => {
    const suggested = findRule(rules, r.description)?.categoryId ?? null;
    return { ...r, categoryId: suggested, suggestedCategoryId: suggested };
  });
}

export function previewToTransactions(
  rows: readonly PreviewRow[],
  target: ImportTarget,
  importId: string,
): Transaction[] {
  return rows.map((r) =>
    makeTransaction({
      type: r.amountCents < 0 ? 'expense' : 'income',
      amountCents: Math.abs(r.amountCents),
      date: r.date,
      accountId: target.accountId,
      cardId: target.cardId,
      categoryId: r.categoryId,
      description: r.description,
      importId,
      externalId: r.externalId,
    }),
  );
}
