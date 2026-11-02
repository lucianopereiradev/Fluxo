import { getDb, type FluxoDatabase } from '@/db';
import { insert } from '@/db/repo';
import { today } from '@/domain/dates';
import { createDefaultCategories } from '@/domain/defaultCategories';
import { materializeRecurrences } from '@/domain/recurrences';

/**
 * Runs on every app start: seeds built-in categories on a fresh database and turns due
 * recurring entries into real transactions. Both steps are idempotent.
 */
export async function bootstrap(db: FluxoDatabase = getDb()): Promise<void> {
  if ((await db.categories.count()) === 0) {
    await insert('categories', createDefaultCategories(), db);
  }
  const [recurrences, transactions] = await Promise.all([
    db.recurrences.toArray(),
    db.transactions.toArray(),
  ]);
  const due = materializeRecurrences(recurrences, transactions, today());
  if (due.length > 0) await insert('transactions', due, db);
}
