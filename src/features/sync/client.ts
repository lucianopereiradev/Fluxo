/** Thin client for the Worker's /api/vaults endpoints. Only ciphertext ever goes over the wire. */

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = 'SyncHttpError';
  }
}

export interface RemoteState {
  version: number;
  blob: Uint8Array | null;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new SyncHttpError(res.status, body.error ?? 'http_error');
}

export interface SyncApi {
  create(vaultId: string, salt: string, authHash: string): Promise<void>;
  salt(vaultId: string): Promise<string>;
  pull(vaultId: string, token: string): Promise<RemoteState>;
  push(vaultId: string, token: string, version: number, blob: Uint8Array): Promise<number>;
  remove(vaultId: string, token: string): Promise<void>;
}

export function httpApi(base = '/api'): SyncApi {
  return {
    async create(id, salt, authHash) {
      const res = await fetch(`${base}/vaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, salt, authHash }),
      });
      if (!res.ok) await fail(res);
    },
    async salt(id) {
      const res = await fetch(`${base}/vaults/${encodeURIComponent(id)}/salt`);
      if (!res.ok) await fail(res);
      return ((await res.json()) as { salt: string }).salt;
    },
    async pull(id, token) {
      const res = await fetch(`${base}/vaults/${encodeURIComponent(id)}`, {
        headers: bearer(token),
        cache: 'no-store',
      });
      if (!res.ok) await fail(res);
      const version = Number(res.headers.get('X-Vault-Version') ?? '0');
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { version, blob: bytes.length ? bytes : null };
    },
    async push(id, token, version, blob) {
      const res = await fetch(`${base}/vaults/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          ...bearer(token),
          'If-Match': `"${version}"`,
          'Content-Type': 'application/octet-stream',
        },
        body: blob as BodyInit,
      });
      if (!res.ok) await fail(res);
      return ((await res.json()) as { version: number }).version;
    },
    async remove(id, token) {
      const res = await fetch(`${base}/vaults/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: bearer(token),
      });
      if (!res.ok && res.status !== 404) await fail(res);
    },
  };
}
