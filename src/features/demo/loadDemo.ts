import type { FluxoDatabase } from '@/db';
import { clearAll, replaceSnapshot } from '@/db/repo';
import { today } from '@/domain/dates';
import { generateDemo } from '@/domain/demo/generate';
import i18n from '@/i18n';

/** Fills the separate demo database with freshly generated sample data. */
export async function loadDemoData(db: FluxoDatabase): Promise<void> {
  await clearAll(db);
  await replaceSnapshot(generateDemo({ today: today(), language: i18n.language }), db);
}
