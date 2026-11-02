import { create } from 'zustand';

/**
 * off: sync not set up · locked: set up, waiting for the passphrase on this device ·
 * idle/syncing/synced/offline/error: running.
 */
export type SyncPhase = 'off' | 'locked' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncUiState {
  phase: SyncPhase;
  vaultId: string | null;
  salt: string | null;
  lastSyncedAt: string | null;
  error: string | null;
  set: (patch: Partial<Omit<SyncUiState, 'set'>>) => void;
}

/** Lightweight status store; the crypto-heavy engine is loaded only when sync is used. */
export const useSync = create<SyncUiState>()((set) => ({
  phase: 'off',
  vaultId: null,
  salt: null,
  lastSyncedAt: null,
  error: null,
  set: (patch) => set(patch),
}));

export const loadEngine = () => import('./engine');
