import { allowRequest } from './rateLimit';
import { error, isSameOrigin, json, withSecurityHeaders } from './security';
import { createVault, deleteVault, getSalt, isValidVaultId, readVault, writeVault } from './vaults';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RATE_LIMITER?: RateLimit;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/api/health') return json({ ok: true });
  if (!isSameOrigin(request)) return error(403, 'forbidden');

  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await allowRequest(env.RATE_LIMITER, ip)))
    return error(429, 'rate_limited', { 'Retry-After': '60' });

  if (path === '/api/vaults') {
    return request.method === 'POST'
      ? createVault(request, env.DB)
      : error(405, 'method_not_allowed');
  }

  const match = /^\/api\/vaults\/([^/]+)(\/salt)?$/.exec(path);
  if (!match) return error(404, 'not_found');
  const id = decodeURIComponent(match[1]!);
  if (!isValidVaultId(id)) return error(400, 'invalid_request');

  if (match[2])
    return request.method === 'GET' ? getSalt(id, env.DB) : error(405, 'method_not_allowed');
  switch (request.method) {
    case 'GET':
      return readVault(request, id, env.DB);
    case 'PUT':
      return writeVault(request, id, env.DB);
    case 'DELETE':
      return deleteVault(request, id, env.DB);
    default:
      return error(405, 'method_not_allowed');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return withSecurityHeaders(await handleApi(request, env));
    } catch (e) {
      // Log only the error type; request bodies are ciphertext but are still never logged.
      console.error('api_error', e instanceof Error ? e.name : 'unknown');
      return withSecurityHeaders(error(500, 'internal_error'));
    }
  },
} satisfies ExportedHandler<Env>;
