import { describe, expect, it } from 'vitest';
import type { Cents } from './money';

describe('money', () => {
  it('uses integer cents', () => {
    const value: Cents = 1050;
    expect(Number.isInteger(value)).toBe(true);
  });
});
