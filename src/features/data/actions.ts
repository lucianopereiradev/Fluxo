import { getDb } from '@/db';
import { insert, nowIso, softDelete, update, updateMany } from '@/db/repo';
import type { LocalDate, YearMonth } from '@/domain/dates';
import { uuidv7 } from '@/domain/ids';
import {
  installmentsInScope,
  planInstallments,
  type InstallmentScope,
} from '@/domain/installments';
import { makeTransaction } from '@/domain/records';
import type { Card, Transaction, TransactionType } from '@/domain/types';

export interface TransactionDraft {
  type: TransactionType;
  amountCents: number;
  date: LocalDate;
  accountId: string | null;
  cardId: string | null;
  toAccountId: string | null;
  toCardId: string | null;
  categoryId: string | null;
  description: string;
  notes: string;
  tags: string[];
  /** Split into N monthly installments (new expenses only). */
  installments: number;
  invoiceMonth: YearMonth | null;
}

export function draftToTransactions(draft: TransactionDraft, card?: Card | null): Transaction[] {
  const common = {
    type: draft.type,
    accountId: draft.accountId,
    cardId: draft.type === 'transfer' ? null : draft.cardId,
    toAccountId: draft.type === 'transfer' ? draft.toAccountId : null,
    toCardId: draft.type === 'transfer' ? draft.toCardId : null,
    categoryId: draft.type === 'transfer' ? null : draft.categoryId,
    description: draft.description.trim(),
    notes: draft.notes.trim(),
    tags: draft.tags,
    invoiceMonth: draft.type === 'transfer' && draft.toCardId ? draft.invoiceMonth : null,
  };

  if (draft.type === 'expense' && draft.installments > 1) {
    const groupId = uuidv7();
    return planInstallments({
      totalCents: draft.amountCents,
      count: draft.installments,
      purchaseDate: draft.date,
      closingDay: card?.closingDay ?? null,
    }).map((p) =>
      makeTransaction({
        ...common,
        amountCents: p.amountCents,
        date: p.date,
        installmentGroupId: groupId,
        installmentIndex: p.index,
        installmentCount: p.count,
      }),
    );
  }

  return [makeTransaction({ ...common, amountCents: draft.amountCents, date: draft.date })];
}

export async function createTransactions(draft: TransactionDraft): Promise<Transaction[]> {
  const card = draft.cardId ? await getDb().cards.get(draft.cardId) : null;
  const txs = draftToTransactions(draft, card);
  await insert('transactions', txs);
  return txs;
}

type TransactionPatch = Partial<
  Pick<
    Transaction,
    | 'type'
    | 'amountCents'
    | 'date'
    | 'accountId'
    | 'cardId'
    | 'toAccountId'
    | 'toCardId'
    | 'categoryId'
    | 'description'
    | 'notes'
    | 'tags'
    | 'invoiceMonth'
  >
>;

/**
 * Edits a transaction. For installments, "this and next" applies the same changes to the
 * following installments, except the date, which stays per installment.
 */
export async function updateTransaction(
  tx: Transaction,
  patch: TransactionPatch,
  scope: InstallmentScope = 'this',
): Promise<void> {
  if (scope === 'this' || !tx.installmentGroupId) {
    await update('transactions', tx.id, patch);
    return;
  }
  const all = await getDb()
    .transactions.where('installmentGroupId')
    .equals(tx.installmentGroupId)
    .toArray();
  const targets = installmentsInScope(all, tx, scope);
  const { date, ...shared } = patch;
  await updateMany(
    'transactions',
    targets.map((t) => t.id),
    shared,
  );
  if (date && date !== tx.date) await update('transactions', tx.id, { date });
}

export async function deleteTransaction(tx: Transaction, scope: InstallmentScope = 'this') {
  if (scope === 'this' || !tx.installmentGroupId) return softDelete('transactions', [tx.id]);
  const all = await getDb()
    .transactions.where('installmentGroupId')
    .equals(tx.installmentGroupId)
    .toArray();
  return softDelete(
    'transactions',
    installmentsInScope(all, tx, scope).map((t) => t.id),
  );
}

export async function bulkUpdateTransactions(ids: string[], patch: TransactionPatch) {
  await updateMany('transactions', ids, patch);
}

export async function bulkAddTag(ids: string[], tag: string) {
  const db = getDb();
  const rows = (await db.transactions.bulkGet(ids)).filter((r): r is Transaction => !!r);
  const stamp = nowIso();
  await insert(
    'transactions',
    rows.map((r) => ({ ...r, tags: [...new Set([...r.tags, tag])], updatedAt: stamp })),
  );
}

export async function payInvoice(params: {
  card: Card;
  invoiceMonth: YearMonth;
  amountCents: number;
  fromAccountId: string;
  date: LocalDate;
  description: string;
}) {
  await insert(
    'transactions',
    makeTransaction({
      type: 'transfer',
      amountCents: params.amountCents,
      date: params.date,
      accountId: params.fromAccountId,
      toCardId: params.card.id,
      invoiceMonth: params.invoiceMonth,
      description: params.description,
    }),
  );
}

export async function saveSetting(key: string, value: unknown) {
  const db = getDb();
  const existing = await db.settings.get(key);
  const stamp = nowIso();
  await insert('settings', {
    id: key,
    value,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  });
}
