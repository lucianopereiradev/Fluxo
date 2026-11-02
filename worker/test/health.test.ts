import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('worker', () => {
  it('answers the health check', async () => {
    const res = await SELF.fetch('https://fluxo.test/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
