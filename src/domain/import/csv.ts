import { isValidLocalDate, toDate } from '../dates';
import type { Cents } from '../money';
import { normalizeText } from '../search';
import type { ImportedRow } from './types';

export type Delimiter = ',' | ';' | '\t' | '|';
export type DateFormat = 'dmy' | 'mdy' | 'ymd';
export type NumberFormat = 'br' | 'us';

/** RFC 4180 parsing: quoted fields, escaped quotes ("") and newlines inside quotes. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

/** Picks the delimiter that splits the first lines into the most consistent columns. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 10)
    .join('\n');
  let best: Delimiter = ',';
  let bestScore = -1;
  for (const d of [';', ',', '\t', '|'] as Delimiter[]) {
    const counts = parseCsv(sample, d).map((r) => r.length);
    if (counts.length === 0 || counts[0]! < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = consistent * 10 + counts[0]!;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export interface ColumnMapping {
  date: number;
  description: number;
  /** A single signed amount column, or separate debit and credit columns. */
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

const HEADER_HINTS = {
  date: ['data', 'date', 'dt', 'data lancamento', 'data da transacao', 'posted'],
  description: [
    'descricao',
    'historico',
    'description',
    'memo',
    'lancamento',
    'estabelecimento',
    'payee',
    'title',
    'detalhes',
    'details',
  ],
  amount: ['valor', 'amount', 'value', 'quantia', 'valor r$', 'montante'],
  debit: ['debito', 'debit', 'saida', 'saidas', 'withdrawal', 'out'],
  credit: ['credito', 'credit', 'entrada', 'entradas', 'deposit', 'in'],
};

/** Guesses which column is which from the header row. */
export function detectColumns(header: string[]): ColumnMapping {
  const norm = header.map((h) =>
    normalizeText(h)
      .replace(/[^a-z0-9 $]/g, '')
      .trim(),
  );
  const find = (hints: string[]) => {
    const exact = norm.findIndex((h) => hints.includes(h));
    if (exact >= 0) return exact;
    const partial = norm.findIndex((h) =>
      hints.some((hint) => hint.length > 3 && h.includes(hint)),
    );
    return partial >= 0 ? partial : null;
  };
  const debit = find(HEADER_HINTS.debit);
  const credit = find(HEADER_HINTS.credit);
  const amount = find(HEADER_HINTS.amount);
  return {
    date: find(HEADER_HINTS.date) ?? 0,
    description: find(HEADER_HINTS.description) ?? 1,
    amount: amount ?? (debit === null && credit === null ? 2 : null),
    debit: amount === null ? debit : null,
    credit: amount === null ? credit : null,
  };
}

/** True when the first row reads like a header rather than data. */
export function hasHeaderRow(rows: string[][]): boolean {
  const first = rows[0];
  if (!first) return false;
  return !first.some((cell) => /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(cell));
}

export function detectDateFormat(samples: string[]): DateFormat {
  let dmy = 0;
  let mdy = 0;
  for (const s of samples) {
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return 'ymd';
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(s);
    if (!m) continue;
    if (Number(m[1]) > 12) dmy++;
    if (Number(m[2]) > 12) mdy++;
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

export function parseDateWith(value: string, format: DateFormat): string | null {
  const s = value.trim();
  let y: number;
  let mo: number;
  let d: number;
  if (format === 'ymd') {
    const m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(s);
    if (!m) return null;
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
    if (!m) return null;
    const [a, b] = [Number(m[1]), Number(m[2])];
    [d, mo] = format === 'dmy' ? [a, b] : [b, a];
    y = Number(m[3]);
    if (y < 100) y += 2000;
  }
  const date = toDate(y, mo, d);
  return isValidLocalDate(date) ? date : null;
}

/** "1.234,56" style (Brazil) vs "1,234.56" style, judged by the decimal separator. */
export function detectNumberFormat(samples: string[]): NumberFormat {
  let br = 0;
  let us = 0;
  for (const s of samples) {
    if (/,\d{1,2}\)?-?$/.test(s.trim())) br++;
    else if (/\.\d{1,2}\)?-?$/.test(s.trim())) us++;
  }
  return br >= us ? 'br' : 'us';
}

/**
 * Parses an amount whose format is known, so "1.500" is 1500 in Brazilian files and 1.50
 * in US ones. Negative forms: "-10", "10-", "(10)".
 */
export function parseAmountWith(value: string, format: NumberFormat): Cents | null {
  let s = value.trim().replace(/\s+/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^(R\$|US\$|\$|€|£)/i, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/^(R\$|US\$|\$|€|£)/i, '');
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  const [thousands, decimal] = format === 'br' ? ['.', ','] : [',', '.'];
  const parts = s.split(thousands).join('').split(decimal);
  if (parts.length > 2) return null;
  const [intPart = '', fracPart = ''] = parts;
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(fracPart) || !(intPart + fracPart)) return null;
  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export interface CsvImportOptions {
  mapping: ColumnMapping;
  skipHeader: boolean;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  /** Flip signs (some card statements list purchases as positive). */
  invert: boolean;
}

export interface CsvImportResult {
  rows: ImportedRow[];
  /** 1-based line numbers that could not be read. */
  skipped: number[];
}

export function csvToRows(table: string[][], options: CsvImportOptions): CsvImportResult {
  const { mapping, skipHeader, dateFormat, numberFormat, invert } = options;
  const rows: ImportedRow[] = [];
  const skipped: number[] = [];
  table.forEach((cells, index) => {
    if (skipHeader && index === 0) return;
    const date = parseDateWith(cells[mapping.date] ?? '', dateFormat);
    let amount: Cents | null = null;
    if (mapping.amount !== null) {
      amount = parseAmountWith(cells[mapping.amount] ?? '', numberFormat);
    } else {
      const debit =
        mapping.debit !== null ? parseAmountWith(cells[mapping.debit] ?? '', numberFormat) : null;
      const credit =
        mapping.credit !== null ? parseAmountWith(cells[mapping.credit] ?? '', numberFormat) : null;
      if (debit !== null || credit !== null) amount = (credit ?? 0) - Math.abs(debit ?? 0);
    }
    const description = (cells[mapping.description] ?? '').replace(/\s+/g, ' ').trim();
    if (!date || amount === null || amount === 0) {
      skipped.push(index + 1);
      return;
    }
    rows.push({ date, description, amountCents: invert ? -amount : amount, externalId: null });
  });
  return { rows, skipped };
}
