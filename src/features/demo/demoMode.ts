import Dexie from 'dexie';
import { switchMode } from '@/db';
import { DEMO_DB_NAME } from '@/db/schema';

/** Loads the deterministic demo dataset into its own database and opens the app. */
export async function enterDemo(): Promise<void> {
  const db = switchMode('demo');
  const { loadDemoData } = await import('./loadDemo');
  await loadDemoData(db);
  window.location.assign('/app');
}

/** Leaves the demo, discarding its database, and starts with the real (empty) one. */
export async function leaveDemo(): Promise<void> {
  const db = switchMode('real');
  void db;
  await Dexie.delete(DEMO_DB_NAME).catch(() => undefined);
  window.location.assign('/app');
}

export async function startFresh(): Promise<void> {
  switchMode('real');
  window.location.assign('/app');
}
