import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultCategories } from '@/domain/defaultCategories';
import { makeAccount, makeTransaction } from '@/domain/records';
import { createBackup, parseBackup } from './backup';
import { insert, listAlive, readSnapshot, replaceSnapshot, softDelete, update } from './repo';
import { FluxoDatabase } from './schema';

let db: FluxoDatabase;
let counter = 0;
const open = () => (db = new FluxoDatabase(`test-${counter++}`));

afterEach(async () => {
  db?.close();
  await Dexie.delete(db.name);
});

describe('repository', () => {
  it('soft deletes and hides tombstones from queries', async () => {
    open();
    const a = makeAccount({ name: 'A', type: 'checking' });
    const b = makeAccount({ name: 'B', type: 'wallet' });
    await insert('accounts', [a, b], db);
    await softDelete('accounts', [a.id], db);
    expect((await listAlive('accounts', db)).map((x) => x.name)).toEqual(['B']);
    const raw = await db.accounts.get(a.id);
    expect(raw?.deletedAt).not.toBeNull();
    expect(raw!.updatedAt >= a.updatedAt).toBe(true);
  });

  it('stamps updatedAt on update', async () => {
    open();
    const a = makeAccount({ name: 'A', type: 'checking', updatedAt: '2020-01-01T00:00:00.000Z' });
    await insert('accounts', a, db);
    await update('accounts', a.id, { name: 'Renamed' }, db);
    const row = await db.accounts.get(a.id);
    expect(row?.name).toBe('Renamed');
    expect(row!.updatedAt > '2020-01-01T00:00:00.000Z').toBe(true);
  });

  it('migrates v1 rows to v2', async () => {
    const name = `migration-${counter++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ transactions: 'id, date' });
    await v1.table('transactions').add({ id: 't1', date: '2026-01-01' });
    v1.close();

    db = new FluxoDatabase(name);
    const row = await db.transactions.get('t1');
    expect(row).toMatchObject({ externalId: null, invoiceMonth: null });
  });
});

describe('backup', () => {
  it('round-trips through JSON with validation', async () => {
    open();
    await insert('categories', createDefaultCategories(), db);
    const acc = makeAccount({ name: 'Main', type: 'checking', initialBalanceCents: 1000 });
    await insert('accounts', acc, db);
    await insert(
      'transactions',
      makeTransaction({
        type: 'expense',
        amountCents: 3250,
        date: '2026-11-01',
        accountId: acc.id,
        tags: ['lunch'],
      }),
      db,
    );
    const backup = createBackup(await readSnapshot(db));
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const other = new FluxoDatabase(`restore-${counter++}`);
    await replaceSnapshot(parsed.backup.data, other);
    expect(await other.transactions.count()).toBe(1);
    expect((await other.transactions.toArray())[0]?.amountCents).toBe(3250);
    other.close();
    await Dexie.delete(other.name);
  });

  it('rejects invalid files', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'invalid_json' });
    expect(parseBackup('{"app":"other"}')).toEqual({ ok: false, error: 'invalid_format' });
    expect(parseBackup('{"app":"fluxo","schemaVersion":99}')).toEqual({
      ok: false,
      error: 'unsupported_version',
    });
    const bad = createBackup({
      accounts: [],
      cards: [],
      categories: [],
      transactions: [makeTransaction({ type: 'expense', amountCents: 10.5, date: '2026-11-01' })],
      recurrences: [],
      budgets: [],
      goals: [],
      rules: [],
      settings: [],
    });
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});
