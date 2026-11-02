import { describe, expect, it } from 'vitest';
import { emptySnapshot, mergeSnapshots, pickWinner } from './merge';
import { makeAccount, makeTransaction } from './records';
import type { DataSnapshot } from './types';

const at = (minute: number) => `2026-11-15T10:${String(minute).padStart(2, '0')}:00.000Z`;
const snap = (patch: Partial<DataSnapshot>): DataSnapshot => ({ ...emptySnapshot(), ...patch });
const tx = (id: string, minute: number, extra: Partial<ReturnType<typeof makeTransaction>> = {}) =>
  makeTransaction({
    id,
    type: 'expense',
    amountCents: 100,
    date: '2026-11-15',
    createdAt: at(0),
    updatedAt: at(minute),
    ...extra,
  });

describe('merge', () => {
  it('pushes everything when the server is empty', () => {
    const local = snap({ transactions: [tx('a', 1)] });
    const r = mergeSnapshots(local, null);
    expect(r.remoteChanged).toBe(true);
    expect(r.toLocal).toEqual({});
    expect(r.merged.transactions).toHaveLength(1);
  });

  it('unions records created on different devices', () => {
    const r = mergeSnapshots(
      snap({ transactions: [tx('a', 1)] }),
      snap({ transactions: [tx('b', 2)] }),
    );
    expect(r.merged.transactions.map((t) => t.id)).toEqual(['a', 'b']);
    expect(r.toLocal.transactions?.map((t) => t.id)).toEqual(['b']);
    expect(r.remoteChanged).toBe(true);
  });

  it('keeps the most recent edit of a conflicting record', () => {
    const local = snap({ transactions: [tx('a', 5, { description: 'local, newer' })] });
    const remote = snap({ transactions: [tx('a', 3, { description: 'remote, older' })] });
    const r = mergeSnapshots(local, remote);
    expect(r.merged.transactions[0]!.description).toBe('local, newer');
    expect(r.toLocal.transactions).toBeUndefined();
    expect(r.remoteChanged).toBe(true);

    const r2 = mergeSnapshots(remote, local);
    expect(r2.toLocal.transactions?.[0]!.description).toBe('local, newer');
    expect(r2.remoteChanged).toBe(false);
  });

  it('propagates deletions (tombstones) that are newer', () => {
    const alive = tx('a', 1);
    const deleted = tx('a', 2, { deletedAt: at(2) });
    const r = mergeSnapshots(snap({ transactions: [alive] }), snap({ transactions: [deleted] }));
    expect(r.merged.transactions[0]!.deletedAt).toBe(at(2));
    expect(r.toLocal.transactions?.[0]!.deletedAt).toBe(at(2));
  });

  it('lets a newer edit win over an older deletion', () => {
    const deleted = tx('a', 2, { deletedAt: at(2) });
    const edited = tx('a', 4, { description: 'edited after' });
    const r = mergeSnapshots(snap({ transactions: [edited] }), snap({ transactions: [deleted] }));
    expect(r.merged.transactions[0]!.deletedAt).toBeNull();
  });

  it('breaks exact ties deterministically, preferring the deletion', () => {
    const a = tx('a', 3, { description: 'x' });
    const b = tx('a', 3, { deletedAt: at(3) });
    expect(pickWinner(a, b)).toBe(b);
    expect(pickWinner(b, a)).toBe(b);
    const c = tx('a', 3, { description: 'y' });
    expect(pickWinner(a, c)).toEqual(pickWinner(c, a));
  });

  it('reports no change when both sides are identical', () => {
    const s = snap({
      transactions: [tx('a', 1)],
      accounts: [makeAccount({ id: 'acc', name: 'A', type: 'checking', updatedAt: at(1) })],
    });
    const r = mergeSnapshots(s, structuredClone(s));
    expect(r.remoteChanged).toBe(false);
    expect(r.toLocal).toEqual({});
  });

  it('is convergent: merging in either order gives the same state', () => {
    const left = snap({ transactions: [tx('a', 1), tx('b', 5, { deletedAt: at(5) }), tx('c', 2)] });
    const right = snap({
      transactions: [tx('a', 3, { amountCents: 999 }), tx('b', 4), tx('d', 1)],
    });
    expect(mergeSnapshots(left, right).merged).toEqual(mergeSnapshots(right, left).merged);
  });
});
