import { isValidLocalDate } from '../dates';
import { parseMoney } from '../money';
import type { ImportedRow } from './types';

export interface OfxStatement {
  currency: string | null;
  accountId: string | null;
  rows: ImportedRow[];
}

/** Reads `<TAG>value` from a block. Works for SGML (unclosed tags) and XML alike. */
function field(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i').exec(block);
  const value = m?.[1]?.trim();
  return value ? decodeEntities(value) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** OFX dates look like 20261105, 20261105120000 or 20261105120000.000[-3:BRT]. */
function ofxDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidLocalDate(date) ? date : null;
}

/**
 * Parses OFX 1.x (SGML) and 2.x (XML) bank statements, the format most Brazilian banks
 * export. Each <STMTTRN> becomes a row; the bank's FITID is kept for duplicate detection.
 */
export function parseOfx(text: string): OfxStatement {
  const body = text.replace(/\r\n?/g, '\n');
  const blocks = body
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((b) => b.split(/<\/STMTTRN>/i)[0]!);
  const rows: ImportedRow[] = [];
  for (const block of blocks) {
    const date = ofxDate(field(block, 'DTPOSTED') ?? field(block, 'DTUSER'));
    const amount = parseMoney(field(block, 'TRNAMT') ?? '');
    if (!date || amount === null) continue;
    const name = field(block, 'NAME');
    const memo = field(block, 'MEMO');
    const description =
      name && memo && !memo.toLowerCase().includes(name.toLowerCase())
        ? `${name} ${memo}`
        : (memo ?? name ?? '');
    rows.push({
      date,
      description: description.replace(/\s+/g, ' ').trim(),
      amountCents: amount,
      externalId: field(block, 'FITID'),
    });
  }
  return {
    currency: field(body, 'CURDEF'),
    accountId: field(body, 'ACCTID'),
    rows,
  };
}

export function looksLikeOfx(text: string): boolean {
  return /OFXHEADER|<OFX>/i.test(text.slice(0, 2000));
}

/** Decodes a statement file: UTF-8 when valid, otherwise Windows-1252 (common in OFX). */
export function decodeStatement(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
