import { z } from 'zod';
import { error, json, sha256Hex, timingSafeEqualHex } from './security';

export const MAX_BLOB_BYTES = 5 * 1024 * 1024;

const base64url128 = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
const createSchema = z.object({
  id: base64url128,
  salt: base64url128,
  authHash: z.string().regex(/^[0-9a-f]{64}$/),
});
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const ifMatchSchema = z
  .string()
  .regex(/^(W\/)?"?\d{1,12}"?$/)
  .transform((v) => Number(v.replace(/\D/g, '')));

interface VaultRow {
  id: string;
  salt: string;
  auth_hash: string;
  version: number;
  /** D1 returns BLOB columns as plain number arrays. */
  blob: number[] | ArrayBuffer | null;
  size: number;
}

export function isValidVaultId(id: string): boolean {
  return base64url128.safeParse(id).success;
}

export async function createVault(request: Request, db: D1Database): Promise<Response> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) {
    return error(415, 'unsupported_media_type');
  }
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > 1024) return error(413, 'payload_too_large');
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'invalid_request');
  const { id, salt, authHash } = parsed.data;
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      'INSERT INTO vaults (id, salt, auth_hash, version, blob, size, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, 0, ?, ?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(id, salt, authHash, now, now)
    .run();
  if (!result.meta.changes) return error(409, 'vault_exists');
  return json({ id, version: 0 }, 201);
}

/** The salt is not secret: a new device needs it to derive keys before it can authenticate. */
export async function getSalt(id: string, db: D1Database): Promise<Response> {
  const row = await db
    .prepare('SELECT salt FROM vaults WHERE id = ?')
    .bind(id)
    .first<{ salt: string }>();
  return row ? json({ salt: row.salt }) : error(404, 'not_found');
}

/** Verifies the bearer token against the stored SHA-256 hash, in constant time. */
async function authorize(
  request: Request,
  id: string,
  db: D1Database,
): Promise<VaultRow | Response> {
  const header = request.headers.get('Authorization') ?? '';
  const token = tokenSchema.safeParse(header.startsWith('Bearer ') ? header.slice(7).trim() : '');
  const row = await db
    .prepare('SELECT id, salt, auth_hash, version, blob, size FROM vaults WHERE id = ?')
    .bind(id)
    .first<VaultRow>();
  if (!row) return error(404, 'not_found');
  // Hash even an invalid token so timing does not reveal which check failed.
  const presented = await sha256Hex(token.success ? token.data : header);
  if (!token.success || !timingSafeEqualHex(presented, row.auth_hash)) {
    return error(401, 'unauthorized', { 'WWW-Authenticate': 'Bearer' });
  }
  return row;
}

export async function readVault(request: Request, id: string, db: D1Database): Promise<Response> {
  const row = await authorize(request, id, db);
  if (row instanceof Response) return row;
  const bytes = row.blob ? new Uint8Array(row.blob) : null;
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Vault-Version': String(row.version),
      ETag: `"${row.version}"`,
    },
  });
}

/** Optimistic concurrency: the write only lands if If-Match equals the current version. */
export async function writeVault(request: Request, id: string, db: D1Database): Promise<Response> {
  const row = await authorize(request, id, db);
  if (row instanceof Response) return row;
  const ifMatch = ifMatchSchema.safeParse(request.headers.get('If-Match') ?? '');
  if (!ifMatch.success) return error(428, 'precondition_required');
  const declared = Number(request.headers.get('Content-Length') ?? 'NaN');
  if (Number.isFinite(declared) && declared > MAX_BLOB_BYTES)
    return error(413, 'payload_too_large');
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BLOB_BYTES) return error(413, 'payload_too_large');
  if (body.byteLength === 0) return error(400, 'invalid_request');

  const now = new Date().toISOString();
  const result = await db
    .prepare(
      'UPDATE vaults SET blob = ?, size = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
    )
    .bind(new Uint8Array(body), body.byteLength, now, id, ifMatch.data)
    .run();
  if (!result.meta.changes) {
    const current = await db
      .prepare('SELECT version FROM vaults WHERE id = ?')
      .bind(id)
      .first<{ version: number }>();
    return json({ error: 'version_conflict', version: current?.version ?? null }, 409);
  }
  const version = ifMatch.data + 1;
  return json({ version }, 200, { ETag: `"${version}"` });
}

export async function deleteVault(request: Request, id: string, db: D1Database): Promise<Response> {
  const row = await authorize(request, id, db);
  if (row instanceof Response) return row;
  await db.prepare('DELETE FROM vaults WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}
