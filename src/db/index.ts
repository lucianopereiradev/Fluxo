import { DEMO_DB_NAME, FluxoDatabase, REAL_DB_NAME } from './schema';

export type DataMode = 'real' | 'demo';

const MODE_KEY = 'fluxo:mode';

export function readMode(): DataMode {
  try {
    return globalThis.localStorage?.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real';
  } catch {
    return 'real';
  }
}

export function writeMode(mode: DataMode): void {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); the mode then lasts for this page only.
  }
}

let current: { mode: DataMode; db: FluxoDatabase } | null = null;

/**
 * The active database. Demo data lives in a separate IndexedDB database so it can never mix
 * with the user's real records.
 */
export function getDb(): FluxoDatabase {
  const mode = readMode();
  if (!current || current.mode !== mode) {
    current?.db.close();
    current = { mode, db: new FluxoDatabase(mode === 'demo' ? DEMO_DB_NAME : REAL_DB_NAME) };
  }
  return current.db;
}

/** Switches databases. Callers reload the UI afterwards so every query re-subscribes. */
export function switchMode(mode: DataMode): FluxoDatabase {
  writeMode(mode);
  return getDb();
}

export { FluxoDatabase };
