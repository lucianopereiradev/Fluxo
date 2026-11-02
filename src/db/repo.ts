import type { Table } from 'dexie';
import type { BaseRecord, DataSnapshot, SyncedTable } from '@/domain/types';
import { SYNCED_TABLES } from '@/domain/types';
import { getDb, type FluxoDatabase } from './index';

/** Fired after every local write so the sync engine can schedule a push. */
export const dataEvents = new EventTarget();

function notify(table: SyncedTable) {
  dataEvents.dispatchEvent(new CustomEvent('change', { detail: { table } }));
}

export const nowIso = () => new Date().toISOString();

type RecordOf<K extends SyncedTable> = DataSnapshot[K][number];

function table<K extends SyncedTable>(db: FluxoDatabase, name: K): Table<RecordOf<K>, string> {
  return db.table(name);
}

export async function insert<K extends SyncedTable>(
  name: K,
  records: RecordOf<K> | RecordOf<K>[],
  db: FluxoDatabase = getDb(),
): Promise<void> {
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) return;
  await table(db, name).bulkPut(list);
  notify(name);
}

export async function update<K extends SyncedTable>(
  name: K,
  id: string,
  patch: Partial<Omit<RecordOf<K>, 'id' | 'createdAt'>>,
  db: FluxoDatabase = getDb(),
): Promise<void> {
  const t = table(db, name);
  const existing = await t.get(id);
  if (!existing) return;
  await t.put({ ...existing, ...patch, updatedAt: nowIso() } as RecordOf<K>);
  notify(name);
}

export async function updateMany<K extends SyncedTable>(
  name: K,
  ids: readonly string[],
  patch: Partial<Omit<RecordOf<K>, 'id' | 'createdAt'>>,
  db: FluxoDatabase = getDb(),
): Promise<void> {
  if (ids.length === 0) return;
  const t = table(db, name);
  const stamp = nowIso();
  await db.transaction('rw', t, async () => {
    const rows = (await t.bulkGet([...ids])).filter((r): r is RecordOf<K> => !!r);
    await t.bulkPut(rows.map((r) => ({ ...r, ...patch, updatedAt: stamp }) as RecordOf<K>));
  });
  notify(name);
}

/** Soft delete: keeps a tombstone so the deletion propagates through sync. */
export async function softDelete<K extends SyncedTable>(
  name: K,
  ids: readonly string[],
  db: FluxoDatabase = getDb(),
): Promise<void> {
  const stamp = nowIso();
  await updateMany(
    name,
    ids,
    { deletedAt: stamp } as Partial<Omit<RecordOf<K>, 'id' | 'createdAt'>>,
    db,
  );
}

export async function listAlive<K extends SyncedTable>(
  name: K,
  db: FluxoDatabase = getDb(),
): Promise<RecordOf<K>[]> {
  return (await table(db, name).toArray()).filter((r: BaseRecord) => r.deletedAt === null);
}

/** Every record, tombstones included (used by backup and sync). */
export async function readSnapshot(db: FluxoDatabase = getDb()): Promise<DataSnapshot> {
  const entries = await Promise.all(
    SYNCED_TABLES.map(async (name) => [name, await db.table(name).toArray()] as const),
  );
  return Object.fromEntries(entries) as unknown as DataSnapshot;
}

/** Replaces every synced table with the snapshot's contents, atomically. */
export async function replaceSnapshot(
  snapshot: DataSnapshot,
  db: FluxoDatabase = getDb(),
): Promise<void> {
  const tables = SYNCED_TABLES.map((n) => db.table(n));
  await db.transaction('rw', tables, async () => {
    for (const name of SYNCED_TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkPut(snapshot[name]);
    }
  });
  notify('transactions');
}

/** Writes merged records without notifying (used by sync to avoid push loops). */
export async function putSnapshotSilently(
  snapshot: Partial<DataSnapshot>,
  db: FluxoDatabase = getDb(),
): Promise<void> {
  const names = SYNCED_TABLES.filter((n) => snapshot[n]?.length);
  if (names.length === 0) return;
  await db.transaction(
    'rw',
    names.map((n) => db.table(n)),
    async () => {
      for (const name of names) await db.table(name).bulkPut(snapshot[name]!);
    },
  );
  dataEvents.dispatchEvent(new CustomEvent('remote-change'));
}

export async function clearAll(db: FluxoDatabase = getDb()): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
