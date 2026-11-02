import type { FluxoDatabase } from '@/db';
import { clearAll } from '@/db/repo';

/** Placeholder until the demo generator lands; replaced in a later phase. */
export async function loadDemoData(db: FluxoDatabase): Promise<void> {
  await clearAll(db);
}
