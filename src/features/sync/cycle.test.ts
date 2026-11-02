import { describe, expect, it } from 'vitest';
import { emptySnapshot, mergeSnapshots } from '@/domain/merge';
import { makeTransaction } from '@/domain/records';
import type { DataSnapshot } from '@/domain/types';
import { SyncHttpError, type SyncApi } from './client';
import { deriveKeys, newSalt } from './crypto';
import { runSyncCycle } from './cycle';

/** In-memory stand-in for the Worker, including optimistic concurrency. */
function fakeServer() {
  const state = {
    version: 0,
    blob: null as Uint8Array | null,
    pushes: 0,
    beforePush: null as null | (() => Promise<unknown>),
  };
  const api: SyncApi = {
    create: async () => undefined,
    salt: async () => '',
    pull: async () => ({ version: state.version, blob: state.blob }),
    push: async (_id, _token, version, blob) => {
      const hook = state.beforePush;
      state.beforePush = null;
      if (hook) await hook();
      if (version !== state.version) throw new SyncHttpError(409, 'version_conflict');
      state.pushes++;
      state.version++;
      state.blob = blob;
      return state.version;
    },
    remove: async () => undefined,
  };
  return { api, state };
}

function device(initial: Partial<DataSnapshot> = {}) {
  let data: DataSnapshot = { ...emptySnapshot(), ...initial };
  return {
    get data() {
      return data;
    },
    readLocal: async () => structuredClone(data),
    writeLocal: async (changes: Partial<DataSnapshot>) => {
      data = mergeSnapshots(data, { ...emptySnapshot(), ...changes }).merged;
    },
    edit: (fn: (d: DataSnapshot) => void) => fn(data),
  };
}

const tx = (id: string, updatedAt: string, extra = {}) =>
  makeTransaction({
    id,
    type: 'expense',
    amountCents: 100,
    date: '2026-11-15',
    updatedAt,
    ...extra,
  });

describe('sync cycle', async () => {
  const keys = await deriveKeys('shared passphrase for tests', newSalt(), 1000);
  const base = { vaultId: 'vault', token: 't', keys };

  it('converges two devices through the server', async () => {
    const { api, state } = fakeServer();
    const phone = device({ transactions: [tx('p1', '2026-11-15T10:00:00Z')] });
    const laptop = device({ transactions: [tx('l1', '2026-11-15T10:01:00Z')] });

    await runSyncCycle({ ...base, api, ...phone });
    await runSyncCycle({ ...base, api, ...laptop });
    const last = await runSyncCycle({ ...base, api, ...phone });

    expect(phone.data.transactions.map((t) => t.id).sort()).toEqual(['l1', 'p1']);
    expect(laptop.data.transactions.map((t) => t.id).sort()).toEqual(['l1', 'p1']);
    expect(last.pushed).toBe(false);
    expect(state.version).toBe(2);
  });

  it('propagates a deletion to the other device', async () => {
    const { api } = fakeServer();
    const a = device({ transactions: [tx('x', '2026-11-15T10:00:00Z')] });
    const b = device();
    await runSyncCycle({ ...base, api, ...a });
    await runSyncCycle({ ...base, api, ...b });
    a.edit((d) => {
      d.transactions[0] = {
        ...d.transactions[0]!,
        deletedAt: '2026-11-15T11:00:00Z',
        updatedAt: '2026-11-15T11:00:00Z',
      };
    });
    await runSyncCycle({ ...base, api, ...a });
    await runSyncCycle({ ...base, api, ...b });
    expect(b.data.transactions[0]!.deletedAt).toBe('2026-11-15T11:00:00Z');
  });

  it('retries the whole cycle after a 409 conflict', async () => {
    const { api, state } = fakeServer();
    const other = device({ transactions: [tx('other', '2026-11-15T09:00:00Z')] });
    const me = device({ transactions: [tx('mine', '2026-11-15T09:30:00Z')] });
    // Another device pushes right before our push lands.
    state.beforePush = () => runSyncCycle({ ...base, api, ...other });
    const result = await runSyncCycle({ ...base, api, ...me });
    expect(result.attempts).toBeGreaterThan(1);
    expect(me.data.transactions.map((t) => t.id).sort()).toEqual(['mine', 'other']);
  });

  it('refuses to merge data encrypted with another passphrase', async () => {
    const { api } = fakeServer();
    await runSyncCycle({
      ...base,
      api,
      ...device({ transactions: [tx('a', '2026-11-15T10:00:00Z')] }),
    });
    const wrong = await deriveKeys('a different passphrase', newSalt(), 1000);
    const victim = device();
    await expect(runSyncCycle({ ...base, keys: wrong, api, ...victim })).rejects.toThrow(
      'decryption_failed',
    );
    expect(victim.data.transactions).toEqual([]);
  });

  it('gives up after repeated conflicts', async () => {
    const api: SyncApi = {
      ...fakeServer().api,
      pull: async () => ({ version: 0, blob: null }),
      push: async () => {
        throw new SyncHttpError(409, 'version_conflict');
      },
    };
    await expect(runSyncCycle({ ...base, api, ...device() })).rejects.toThrow('retries_exhausted');
  });
});
