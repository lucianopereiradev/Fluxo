export const FALLBACK_LIMIT = 60;
export const FALLBACK_WINDOW_MS = 60_000;

const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Per-IP rate limiting with the Workers Rate Limiting binding. When the binding is missing
 * (local dev, tests), a simple fixed-window counter per isolate is used instead.
 */
export async function allowRequest(
  limiter: RateLimit | undefined,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  if (limiter) {
    try {
      const { success } = await limiter.limit({ key });
      return success;
    } catch {
      // Fall through to the in-memory limiter if the binding misbehaves.
    }
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + FALLBACK_WINDOW_MS });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return true;
  }
  entry.count++;
  return entry.count <= FALLBACK_LIMIT;
}

export function resetFallbackLimiter() {
  hits.clear();
}
