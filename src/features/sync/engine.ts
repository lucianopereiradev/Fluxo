import { getDb, readMode } from '@/db';
import { dataEvents, putSnapshotSilently, readSnapshot } from '@/db/repo';
import type { SyncStateRecord } from '@/domain/types';
import { httpApi, SyncHttpError, type SyncApi } from './client';
import { authToken, deriveKeys, newSalt, newVaultId, sha256Hex, type VaultKeys } from './crypto';
import { runSyncCycle } from './cycle';
import { useSync } from './store';

const DEBOUNCE_MS = 4000;

let api: SyncApi = httpApi();
let session: { vaultId: string; salt: string; token: string; keys: VaultKeys } | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

/** For tests: swap the HTTP client. */
export function setApi(next: SyncApi) {
  api = next;
}

const status = useSync.getState().set;

async function loadState(): Promise<SyncStateRecord | undefined> {
  return getDb().syncState.get('vault');
}

async function saveState(patch: Partial<SyncStateRecord>) {
  const db = getDb();
  const current = await db.syncState.get('vault');
  await db.syncState.put({ ...(current as SyncStateRecord), ...patch, id: 'vault' });
}

async function openSession(vaultId: string, salt: string, keys: VaultKeys) {
  session = { vaultId, salt, keys, token: await authToken(keys.authKey, vaultId) };
  status({ vaultId, salt, phase: 'idle', error: null });
  listen();
}

function listen() {
  if (listening) return;
  listening = true;
  dataEvents.addEventListener('change', () => scheduleSync());
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => status({ phase: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500);
  });
}

/** Starts sync on app load: resumes with remembered keys, or waits for the passphrase. */
export async function startSync(): Promise<void> {
  if (readMode() === 'demo') return status({ phase: 'off' });
  const state = await loadState();
  if (!state) return status({ phase: 'off', vaultId: null, salt: null });
  status({ vaultId: state.vaultId, salt: state.salt, lastSyncedAt: state.lastSyncedAt });
  if (state.remember && state.encKey && state.authKey) {
    await openSession(state.vaultId, state.salt, { encKey: state.encKey, authKey: state.authKey });
    await syncNow();
  } else {
    status({ phase: 'locked' });
  }
}

export function scheduleSync(delay = DEBOUNCE_MS) {
  if (!session) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Runs one sync cycle; overlapping calls are coalesced into one follow-up run. */
export function syncNow(): Promise<void> {
  if (!session) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (!navigator.onLine) {
        status({ phase: 'offline' });
        return;
      }
      const current = session;
      if (!current) return;
      status({ phase: 'syncing' });
      try {
        const outcome = await runSyncCycle({
          api,
          vaultId: current.vaultId,
          token: current.token,
          keys: current.keys,
          readLocal: () => readSnapshot(),
          writeLocal: (changes) => putSnapshotSilently(changes),
        });
        const lastSyncedAt = new Date().toISOString();
        await saveState({ version: outcome.version, lastSyncedAt });
        status({ phase: 'synced', lastSyncedAt, error: null });
      } catch (error) {
        const code =
          error instanceof SyncHttpError
            ? error.status === 401
              ? 'unauthorized'
              : error.status === 404
                ? 'vault_missing'
                : error.status === 413
                  ? 'too_large'
                  : error.status === 429
                    ? 'rate_limited'
                    : 'server'
            : error instanceof Error && error.message === 'decryption_failed'
              ? 'decryption'
              : navigator.onLine
                ? 'unknown'
                : 'offline';
        status({ phase: code === 'offline' ? 'offline' : 'error', error: code });
        return;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function persist(vaultId: string, salt: string, keys: VaultKeys, remember: boolean) {
  await getDb().syncState.put({
    id: 'vault',
    vaultId,
    salt,
    version: 0,
    lastSyncedAt: null,
    remember,
    // Non-extractable CryptoKeys can be stored in IndexedDB but never read back as bytes.
    ...(remember ? { encKey: keys.encKey, authKey: keys.authKey } : {}),
  });
}

/** Creates a new vault on the server and uploads this device's data, encrypted. */
export async function createVault(passphrase: string, remember: boolean): Promise<void> {
  const vaultId = newVaultId();
  const salt = newSalt();
  const keys = await deriveKeys(passphrase, salt);
  await api.create(vaultId, salt, await sha256Hex(await authToken(keys.authKey, vaultId)));
  await persist(vaultId, salt, keys, remember);
  await openSession(vaultId, salt, keys);
  await syncNow();
}

export class JoinError extends Error {}

/** Joins an existing vault: the salt is public; the passphrase proves access and decrypts. */
export async function joinVault(
  vaultId: string,
  passphrase: string,
  remember: boolean,
  knownSalt?: string,
): Promise<void> {
  let salt = knownSalt;
  if (!salt) {
    try {
      salt = await api.salt(vaultId);
    } catch (error) {
      throw new JoinError(
        error instanceof SyncHttpError && error.status === 404 ? 'vault_missing' : 'network',
      );
    }
  }
  const keys = await deriveKeys(passphrase, salt);
  const token = await authToken(keys.authKey, vaultId);
  try {
    await api.pull(vaultId, token);
  } catch (error) {
    if (error instanceof SyncHttpError && error.status === 401)
      throw new JoinError('wrong_passphrase');
    if (error instanceof SyncHttpError && error.status === 404)
      throw new JoinError('vault_missing');
    throw new JoinError('network');
  }
  await persist(vaultId, salt, keys, remember);
  await openSession(vaultId, salt, keys);
  await syncNow();
}

/** Re-enters the passphrase on a device that did not remember the key. */
export async function unlock(passphrase: string): Promise<void> {
  const state = await loadState();
  if (!state) throw new JoinError('vault_missing');
  const keys = await deriveKeys(passphrase, state.salt);
  try {
    await api.pull(state.vaultId, await authToken(keys.authKey, state.vaultId));
  } catch (error) {
    if (error instanceof SyncHttpError && error.status === 401)
      throw new JoinError('wrong_passphrase');
    throw new JoinError('network');
  }
  await openSession(state.vaultId, state.salt, keys);
  await syncNow();
}

/** Stops syncing on this device. Local data and the server copy are both kept. */
export async function disconnect(): Promise<void> {
  clearTimeout(timer);
  session = null;
  await getDb().syncState.delete('vault');
  status({ phase: 'off', vaultId: null, salt: null, lastSyncedAt: null, error: null });
}

/** Deletes the encrypted copy from the server, then disconnects. */
export async function deleteRemoteVault(): Promise<void> {
  if (session) await api.remove(session.vaultId, session.token);
  await disconnect();
}

export function pairingLink(vaultId: string, salt: string, origin = location.origin): string {
  // The fragment never reaches the server: it stays in the browser.
  return `${origin}/app/settings#pair&v=${encodeURIComponent(vaultId)}&s=${encodeURIComponent(salt)}`;
}

export function parsePairing(text: string): { vaultId: string; salt?: string } | null {
  const trimmed = text.trim();
  const hash = trimmed.includes('#') ? trimmed.slice(trimmed.indexOf('#') + 1) : '';
  const params = new URLSearchParams(hash.replace(/^pair&?/, ''));
  const v = params.get('v') ?? (/^[A-Za-z0-9_-]{22}$/.test(trimmed) ? trimmed : null);
  if (!v || !/^[A-Za-z0-9_-]{22}$/.test(v)) return null;
  const s = params.get('s');
  return { vaultId: v, salt: s && /^[A-Za-z0-9_-]{22}$/.test(s) ? s : undefined };
}
