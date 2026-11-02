import { snapshotSchema } from '@/db/schemas';
import { mergeSnapshots } from '@/domain/merge';
import type { DataSnapshot } from '@/domain/types';
import { SyncHttpError, type SyncApi } from './client';
import { decryptPayload, encryptPayload, type VaultKeys } from './crypto';

export const SYNC_FORMAT = 'fluxo-sync';
export const MAX_ATTEMPTS = 5;

export interface SyncDeps {
  api: SyncApi;
  vaultId: string;
  token: string;
  keys: VaultKeys;
  readLocal: () => Promise<DataSnapshot>;
  writeLocal: (changes: Partial<DataSnapshot>) => Promise<void>;
}

export interface SyncOutcome {
  version: number;
  pulled: number;
  pushed: boolean;
  attempts: number;
}

/** Decrypts and validates a remote blob. A blob that fails validation is never merged. */
export async function openPayload(
  keys: VaultKeys,
  vaultId: string,
  blob: Uint8Array,
): Promise<DataSnapshot> {
  const payload = (await decryptPayload(keys.encKey, vaultId, blob)) as {
    format?: string;
    snapshot?: unknown;
  };
  if (payload?.format !== SYNC_FORMAT) throw new Error('invalid_payload');
  return snapshotSchema.parse(payload.snapshot) as DataSnapshot;
}

/**
 * One sync cycle: pull → decrypt → merge per record (newest updatedAt wins, tombstones
 * included) → encrypt → push with If-Match. A 409 means another device pushed in between,
 * so the whole cycle starts again on top of that newer version.
 */
export async function runSyncCycle(deps: SyncDeps): Promise<SyncOutcome> {
  const { api, vaultId, token, keys } = deps;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remote = await api.pull(vaultId, token);
    const remoteSnapshot = remote.blob ? await openPayload(keys, vaultId, remote.blob) : null;
    const local = await deps.readLocal();
    const { merged, toLocal, remoteChanged } = mergeSnapshots(local, remoteSnapshot);
    const pulled = Object.values(toLocal).reduce((s, rows) => s + (rows?.length ?? 0), 0);
    if (pulled) await deps.writeLocal(toLocal);
    if (!remoteChanged)
      return { version: remote.version, pulled, pushed: false, attempts: attempt };
    const blob = await encryptPayload(keys.encKey, vaultId, {
      format: SYNC_FORMAT,
      schemaVersion: 1,
      snapshot: merged,
    });
    try {
      const version = await api.push(vaultId, token, remote.version, blob);
      return { version, pulled, pushed: true, attempts: attempt };
    } catch (error) {
      if (error instanceof SyncHttpError && error.status === 409) continue;
      throw error;
    }
  }
  throw new Error('sync_conflict_retries_exhausted');
}
