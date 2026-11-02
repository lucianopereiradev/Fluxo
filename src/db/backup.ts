import { z } from 'zod';
import type { DataSnapshot } from '@/domain/types';
import { DB_VERSION } from './schema';
import { snapshotSchema } from './schemas';

export const BACKUP_SCHEMA_VERSION = 1;

export const backupSchema = z.object({
  app: z.literal('fluxo'),
  schemaVersion: z.number().int().min(1).max(BACKUP_SCHEMA_VERSION),
  dbVersion: z.number().int().optional(),
  exportedAt: z.string(),
  data: snapshotSchema,
});

export type Backup = z.infer<typeof backupSchema>;

export function createBackup(snapshot: DataSnapshot, now = new Date()): Backup {
  return {
    app: 'fluxo',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    dbVersion: DB_VERSION,
    exportedAt: now.toISOString(),
    data: snapshot,
  };
}

export type ParseBackupResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: 'invalid_json' | 'invalid_format' | 'unsupported_version' };

/** Validates a backup file before anything touches the database. */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'unsupported_version' };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) return { ok: false, error: 'invalid_format' };
  return { ok: true, backup: result.data as Backup };
}
