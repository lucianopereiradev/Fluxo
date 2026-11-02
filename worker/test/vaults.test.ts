import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { allowRequest, FALLBACK_LIMIT, resetFallbackLimiter } from '../src/rateLimit';
import { sha256Hex, timingSafeEqualHex } from '../src/security';
import { MAX_BLOB_BYTES } from '../src/vaults';

const ORIGIN = 'https://fluxo.test';
let ipCounter = 0;
let ip = '';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function api(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return SELF.fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip, ...init.headers },
  });
}

async function newVault() {
  const id = random(16);
  const salt = random(16);
  const token = random(32);
  const res = await api('/api/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, salt, authHash: await sha256Hex(token) }),
  });
  return { id, salt, token, res };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  ip = `203.0.113.${++ipCounter}`;
  resetFallbackLimiter();
});

describe('vault creation', () => {
  it('creates a vault and exposes only its salt publicly', async () => {
    const { id, salt, res } = await newVault();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id, version: 0 });

    const saltRes = await api(`/api/vaults/${id}/salt`);
    expect(saltRes.status).toBe(200);
    expect(await saltRes.json()).toEqual({ salt });

    const row = await env.DB.prepare('SELECT * FROM vaults WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({ version: 0, size: 0, blob: null });
    expect(row!.auth_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to overwrite an existing vault id', async () => {
    const { id, salt } = await newVault();
    const again = await api('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, salt, authHash: 'f'.repeat(64) }),
    });
    expect(again.status).toBe(409);
  });

  it.each([
    [{ id: 'short', salt: random(16), authHash: 'a'.repeat(64) }],
    [{ id: random(16), salt: random(16), authHash: 'not-hex' }],
    [{ id: random(16) }],
    ['not json'],
  ])('validates input %#', async (body) => {
    const res = await api('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 404 for the salt of an unknown vault', async () => {
    expect((await api(`/api/vaults/${random(16)}/salt`)).status).toBe(404);
  });
});

describe('authentication', () => {
  it('requires the right bearer token to read', async () => {
    const { id, token } = await newVault();
    expect((await api(`/api/vaults/${id}`)).status).toBe(401);
    expect((await api(`/api/vaults/${id}`, { headers: auth(random(32)) })).status).toBe(401);
    expect(
      (await api(`/api/vaults/${id}`, { headers: { Authorization: 'Bearer nope' } })).status,
    ).toBe(401);
    const ok = await api(`/api/vaults/${id}`, { headers: auth(token) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('X-Vault-Version')).toBe('0');
    expect((await ok.arrayBuffer()).byteLength).toBe(0);
  });

  it('rejects writes and deletes with an invalid token', async () => {
    const { id } = await newVault();
    const put = await api(`/api/vaults/${id}`, {
      method: 'PUT',
      headers: { ...auth(random(32)), 'If-Match': '"0"' },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(put.status).toBe(401);
    const del = await api(`/api/vaults/${id}`, { method: 'DELETE', headers: auth(random(32)) });
    expect(del.status).toBe(401);
  });

  it('compares hashes in constant time', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false);
  });
});

describe('writes and versions', () => {
  it('stores the blob and bumps the version', async () => {
    const { id, token } = await newVault();
    const blob = crypto.getRandomValues(new Uint8Array(2048));
    const put = await api(`/api/vaults/${id}`, {
      method: 'PUT',
      headers: { ...auth(token), 'If-Match': '"0"', 'Content-Type': 'application/octet-stream' },
      body: blob,
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ version: 1 });

    const get = await api(`/api/vaults/${id}`, { headers: auth(token) });
    expect(get.headers.get('X-Vault-Version')).toBe('1');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(blob);
  });

  it('rejects a stale version with 409', async () => {
    const { id, token } = await newVault();
    const write = (version: number) =>
      api(`/api/vaults/${id}`, {
        method: 'PUT',
        headers: { ...auth(token), 'If-Match': `"${version}"` },
        body: new Uint8Array([version + 1]),
      });
    expect((await write(0)).status).toBe(200);
    const conflict = await write(0);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'version_conflict', version: 1 });
    expect((await write(1)).status).toBe(200);
  });

  it('requires If-Match', async () => {
    const { id, token } = await newVault();
    const res = await api(`/api/vaults/${id}`, {
      method: 'PUT',
      headers: auth(token),
      body: new Uint8Array([1]),
    });
    expect(res.status).toBe(428);
  });

  it('enforces the 5 MB size limit', async () => {
    const { id, token } = await newVault();
    const tooBig = await api(`/api/vaults/${id}`, {
      method: 'PUT',
      headers: { ...auth(token), 'If-Match': '"0"' },
      body: new Uint8Array(MAX_BLOB_BYTES + 1),
    });
    expect(tooBig.status).toBe(413);
    const exactly = await api(`/api/vaults/${id}`, {
      method: 'PUT',
      headers: { ...auth(token), 'If-Match': '"0"' },
      body: new Uint8Array(MAX_BLOB_BYTES),
    });
    expect(exactly.status).toBe(200);
  });

  it('deletes the vault', async () => {
    const { id, token } = await newVault();
    expect(
      (await api(`/api/vaults/${id}`, { method: 'DELETE', headers: auth(token) })).status,
    ).toBe(204);
    expect((await api(`/api/vaults/${id}/salt`)).status).toBe(404);
  });
});

describe('hardening', () => {
  it('rejects cross-origin requests', async () => {
    const { id, token } = await newVault();
    const res = await SELF.fetch(`${ORIGIN}/api/vaults/${id}`, {
      headers: { Origin: 'https://evil.example', ...auth(token) },
    });
    expect(res.status).toBe(403);
    const crossSite = await SELF.fetch(`${ORIGIN}/api/vaults/${id}`, {
      headers: { 'Sec-Fetch-Site': 'cross-site', ...auth(token) },
    });
    expect(crossSite.status).toBe(403);
    const noOrigin = await SELF.fetch(`${ORIGIN}/api/vaults`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(noOrigin.status).toBe(403);
  });

  it('sends security headers and no CORS headers', async () => {
    const res = await api(`/api/vaults/${random(16)}/salt`);
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers unknown routes and methods without details', async () => {
    expect(await (await api('/api/nope')).json()).toEqual({ error: 'not_found' });
    expect((await api('/api/vaults', { method: 'GET' })).status).toBe(405);
    expect((await api('/api/vaults/bad-id!')).status).toBe(400);
  });

  it('rate limits with the binding, or with the in-memory fallback', async () => {
    const denied = { limit: async () => ({ success: false }) } as unknown as RateLimit;
    expect(await allowRequest(denied, 'x')).toBe(false);
    for (let i = 0; i < FALLBACK_LIMIT; i++)
      expect(await allowRequest(undefined, 'y', 1000)).toBe(true);
    expect(await allowRequest(undefined, 'y', 1000)).toBe(false);
    expect(await allowRequest(undefined, 'y', 1000 + 61_000)).toBe(true);
  });
});
