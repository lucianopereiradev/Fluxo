import { makeRule } from './records';
import { normalizeText } from './search';
import type { Rule } from './types';

/** Bank noise that says nothing about the merchant. */
const NOISE = new Set([
  'compra',
  'compras',
  'pagamento',
  'pagto',
  'pag',
  'pgto',
  'pix',
  'transf',
  'transferencia',
  'debito',
  'credito',
  'cartao',
  'ted',
  'doc',
  'boleto',
  'autorizado',
  'aut',
  'enviado',
  'recebido',
  'nacional',
  'internacional',
  'parcela',
  'purchase',
  'payment',
  'pos',
  'visa',
  'master',
  'mastercard',
  'elo',
  'debit',
  'credit',
  'card',
  'br',
  'sao',
  'paulo',
  'rio',
  'janeiro',
]);

/**
 * Turns a raw bank description into a stable pattern: no accents, digits, punctuation,
 * dates or bank noise. "COMPRA CARTAO 12/03 IFOOD *RESTAURANTE 123" → "ifood restaurante".
 */
export function normalizeDescription(description: string): string {
  return normalizeText(description)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .join(' ')
    .trim();
}

/** The most specific rule whose pattern matches the description, if any. */
export function findRule(rules: readonly Rule[], description: string): Rule | undefined {
  const normalized = normalizeDescription(description);
  if (!normalized) return undefined;
  let best: Rule | undefined;
  for (const rule of rules) {
    if (rule.deletedAt !== null) continue;
    const hit =
      rule.pattern === normalized ||
      (rule.pattern.length >= 3 && ` ${normalized} `.includes(` ${rule.pattern} `));
    if (hit && (!best || rule.pattern.length > best.pattern.length)) best = rule;
  }
  return best;
}

/**
 * Creates or updates the rule for a description after the user corrects its category.
 * Returns the record to store, or null when the description has no usable pattern.
 */
export function learnRule(
  rules: readonly Rule[],
  description: string,
  categoryId: string,
  now: string = new Date().toISOString(),
): Rule | null {
  const pattern = normalizeDescription(description);
  if (pattern.length < 2) return null;
  const existing = rules.find((r) => r.deletedAt === null && r.pattern === pattern);
  if (existing) return { ...existing, categoryId, hits: existing.hits + 1, updatedAt: now };
  return makeRule({ pattern, categoryId });
}
