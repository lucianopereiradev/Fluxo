import { SYNCED_TABLES, type BaseRecord, type DataSnapshot } from './types';

/** Last writer wins per record; on an exact tie a deletion wins, then a stable comparison. */
export function pickWinner<T extends BaseRecord>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if ((a.deletedAt === null) !== (b.deletedAt === null)) return a.deletedAt !== null ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export interface MergeResult {
  merged: DataSnapshot;
  /** Records that must be written locally (remote won or was new). */
  toLocal: Partial<DataSnapshot>;
  /** True when the merged state differs from what the server holds. */
  remoteChanged: boolean;
}

export const emptySnapshot = (): DataSnapshot => ({
  accounts: [],
  cards: [],
  categories: [],
  transactions: [],
  recurrences: [],
  budgets: [],
  goals: [],
  rules: [],
  settings: [],
});

/**
 * Merges two full snapshots record by record. Deletions are tombstones (deletedAt set), so
 * they travel like any other edit and win whenever they are the newer change.
 */
export function mergeSnapshots(local: DataSnapshot, remote: DataSnapshot | null): MergeResult {
  const merged = emptySnapshot();
  const toLocal: Partial<DataSnapshot> = {};
  let remoteChanged = remote === null;

  for (const table of SYNCED_TABLES) {
    const localRows = new Map<string, BaseRecord>(local[table].map((r) => [r.id, r]));
    const remoteRows = new Map<string, BaseRecord>((remote?.[table] ?? []).map((r) => [r.id, r]));
    const out: BaseRecord[] = [];
    const writeLocal: BaseRecord[] = [];

    for (const id of new Set([...localRows.keys(), ...remoteRows.keys()])) {
      const l = localRows.get(id);
      const r = remoteRows.get(id);
      const winner = l && r ? pickWinner(l, r) : (l ?? r)!;
      out.push(winner);
      if (winner !== l && JSON.stringify(winner) !== JSON.stringify(l)) writeLocal.push(winner);
      if (winner !== r && JSON.stringify(winner) !== JSON.stringify(r)) remoteChanged = true;
    }

    (merged as unknown as Record<string, BaseRecord[]>)[table] = out.sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    if (writeLocal.length) (toLocal as unknown as Record<string, BaseRecord[]>)[table] = writeLocal;
  }
  return { merged, toLocal, remoteChanged };
}
