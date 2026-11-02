import { describe, expect, it } from 'vitest';
import { makeRule } from './records';
import { findRule, learnRule, normalizeDescription } from './rules';

describe('categorization rules', () => {
  it('normalizes bank descriptions into stable patterns', () => {
    expect(normalizeDescription('COMPRA CARTAO 12/03 IFOOD *RESTAURANTE 123')).toBe(
      'ifood restaurante',
    );
    expect(normalizeDescription('Pix enviado - Padaria Pão Quente')).toBe('padaria pao quente');
    expect(normalizeDescription('UBER *TRIP 2611')).toBe('uber trip');
  });

  it('finds the most specific matching rule', () => {
    const general = makeRule({ pattern: 'uber', categoryId: 'transport' });
    const eats = makeRule({ pattern: 'uber eats', categoryId: 'food' });
    expect(findRule([general, eats], 'UBER EATS 123')?.categoryId).toBe('food');
    expect(findRule([general, eats], 'UBER *TRIP')?.categoryId).toBe('transport');
    expect(findRule([general, eats], 'Netflix')).toBeUndefined();
  });

  it('ignores deleted rules and partial-word matches', () => {
    const deleted = makeRule({
      pattern: 'uber',
      categoryId: 'x',
      deletedAt: '2026-01-01T00:00:00Z',
    });
    expect(findRule([deleted], 'uber')).toBeUndefined();
    const bar = makeRule({ pattern: 'bar', categoryId: 'leisure' });
    expect(findRule([bar], 'Barbearia')).toBeUndefined();
  });

  it('creates a rule when learning a new correction', () => {
    const rule = learnRule([], 'COMPRA IFOOD *RESTAURANTE', 'food');
    expect(rule).toMatchObject({ pattern: 'ifood restaurante', categoryId: 'food', hits: 1 });
  });

  it('updates the existing rule on a new correction', () => {
    const existing = makeRule({ pattern: 'ifood restaurante', categoryId: 'shopping', hits: 2 });
    const rule = learnRule([existing], 'IFOOD RESTAURANTE', 'food', '2026-11-15T10:00:00.000Z');
    expect(rule).toMatchObject({
      id: existing.id,
      categoryId: 'food',
      hits: 3,
      updatedAt: '2026-11-15T10:00:00.000Z',
    });
  });

  it('refuses descriptions with no usable pattern', () => {
    expect(learnRule([], '12/03 123', 'food')).toBeNull();
  });
});
