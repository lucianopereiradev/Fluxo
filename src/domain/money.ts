/**
 * Money is always an integer number of cents. Floats never touch a stored amount:
 * parsing works on the string digits and formatting divides only at display time.
 */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`Not an integer amount of cents: ${value}`);
}

const CURRENCY_PREFIX = /^(R\$|US\$|\$|€|£|BRL|USD|EUR)/i;

/**
 * Parses user or bank input into cents. Accepts "R$ 1.234,56", "32,50", "12.90", "4500",
 * "1,234.56", "-10" and "(10,00)". Returns null when the text is not a number.
 *
 * Separator rules: when both '.' and ',' appear, the last one is the decimal separator.
 * When only one kind appears, it is a thousands separator if it repeats or is followed by
 * exactly three digits ("1.500" → 1500); otherwise it is the decimal separator ("12.9").
 */
export function parseMoney(input: string): Cents | null {
  let text = input.trim().replace(/\s+/g, '');
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(CURRENCY_PREFIX, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  text = text.replace(CURRENCY_PREFIX, '');
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let intPart = text;
  let fracPart = '';

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const idx = text.lastIndexOf(decimal);
    const head = text.slice(0, idx);
    if (head.includes(decimal)) return null;
    const groups = head.split(thousands);
    if (groups.slice(1).some((g) => g.length !== 3)) return null;
    intPart = groups.join('');
    fracPart = text.slice(idx + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = text.split(sep);
    const tail = parts[parts.length - 1]!;
    const isThousands = parts.length > 2 || (tail.length === 3 && parts[0]!.length > 0);
    if (isThousands) {
      if (parts.slice(1).some((p) => p.length !== 3)) return null;
      intPart = parts.join('');
    } else {
      intPart = parts[0]!;
      fracPart = tail;
    }
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (fracPart.length > 2) return null;
  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  compact?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(
  locale: string,
  currency: string,
  signDisplay: NonNullable<FormatMoneyOptions['signDisplay']>,
  compact: boolean,
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${signDisplay}|${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      signDisplay,
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    formatterCache.set(key, f);
  }
  return f;
}

export function formatMoney(cents: Cents, options: FormatMoneyOptions = {}): string {
  const { currency = 'BRL', locale = 'pt-BR', signDisplay = 'auto', compact = false } = options;
  return getFormatter(locale, currency, signDisplay, compact).format(cents / 100);
}

/** Formats cents as a plain number in the locale (no currency symbol), e.g. for inputs. */
export function formatAmountInput(cents: Cents, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100);
}

/** Plain decimal string with a dot ("1234.56"), used for CSV export. */
export function centsToDecimalString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Splits a total into `count` integer parts that add up exactly to the total.
 * The rounding remainder goes to the first part (Brazilian installment convention).
 */
export function splitCents(total: Cents, count: number): Cents[] {
  assertCents(total);
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be >= 1');
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / count);
  const remainder = abs - base * count;
  return Array.from({ length: count }, (_, i) => sign * (i === 0 ? base + remainder : base));
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** part / whole, guarding against division by zero. */
export function ratio(part: Cents, whole: Cents): number {
  if (whole === 0) return part > 0 ? Infinity : 0;
  return part / whole;
}
