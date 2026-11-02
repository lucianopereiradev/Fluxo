import { describe, expect, it } from 'vitest';
import {
  centsToDecimalString,
  formatAmountInput,
  formatMoney,
  parseMoney,
  splitCents,
  sumCents,
} from './money';

// Intl inserts narrow/non-breaking spaces; normalize them for readable assertions.
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('parseMoney', () => {
  it.each([
    ['32,50', 3250],
    ['32.50', 3250],
    ['12.90', 1290],
    ['4500', 450000],
    ['R$ 1.234,56', 123456],
    ['R$1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.500', 150000],
    ['1.500.000', 150000000],
    ['1,5', 150],
    ['0,99', 99],
    ['-10', -1000],
    ['-R$ 10,00', -1000],
    ['R$ -10,00', -1000],
    ['(10,00)', -1000],
    ['10,00-', -1000],
    ['+7', 700],
    ['$ 3.99', 399],
    [' 1 234,50 ', 123450],
    ['.5', 50],
  ])('parses %s as %d cents', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it('treats a single separator followed by three digits as thousands', () => {
    expect(parseMoney('1,999')).toBe(199900);
  });

  it.each(['', 'abc', '12,345,6', '1.2.3', 'R$', '1.23.456,00', '1,2345'])(
    'rejects %s',
    (input) => {
      expect(parseMoney(input)).toBeNull();
    },
  );

  it('never produces floats', () => {
    for (const s of ['0,1', '0,01', '19,99', '33,33', '1.000,10']) {
      expect(Number.isInteger(parseMoney(s))).toBe(true);
    }
  });
});

describe('formatMoney', () => {
  it('formats BRL in pt-BR by default', () => {
    expect(norm(formatMoney(123456))).toBe('R$ 1.234,56');
  });

  it('formats negative values', () => {
    expect(norm(formatMoney(-500))).toBe('-R$ 5,00');
  });

  it('formats other currencies and locales', () => {
    expect(formatMoney(123456, { currency: 'USD', locale: 'en-US' })).toBe('$1,234.56');
    expect(norm(formatMoney(99, { currency: 'EUR', locale: 'pt-BR' }))).toBe('€ 0,99');
  });

  it('can always show the sign', () => {
    expect(norm(formatMoney(1000, { signDisplay: 'always' }))).toBe('+R$ 10,00');
  });

  it('formats input values without currency', () => {
    expect(formatAmountInput(3250, 'pt-BR')).toBe('32,50');
    expect(formatAmountInput(3250, 'en')).toBe('32.50');
  });
});

describe('splitCents', () => {
  it('puts the rounding remainder in the first part', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitCents(60000, 3)).toEqual([20000, 20000, 20000]);
    expect(splitCents(1001, 4)).toEqual([251, 250, 250, 250]);
  });

  it('always adds up to the total', () => {
    for (const total of [1, 99, 12345, 99999, 1000003]) {
      for (let n = 1; n <= 24; n++) {
        const parts = splitCents(total, n);
        expect(parts).toHaveLength(n);
        expect(sumCents(parts)).toBe(total);
        expect(parts.every(Number.isInteger)).toBe(true);
      }
    }
  });

  it('rejects invalid input', () => {
    expect(() => splitCents(10.5, 2)).toThrow();
    expect(() => splitCents(100, 0)).toThrow();
  });
});

describe('centsToDecimalString', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [123456, '1234.56'],
    [-1050, '-10.50'],
  ])('%d → %s', (cents, out) => expect(centsToDecimalString(cents)).toBe(out));
});
