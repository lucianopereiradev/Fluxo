import { describe, expect, it } from 'vitest';
import { makeRule, makeTransaction } from '../records';
import {
  csvToRows,
  detectColumns,
  detectDateFormat,
  detectDelimiter,
  detectNumberFormat,
  hasHeaderRow,
  parseAmountWith,
  parseCsv,
  parseDateWith,
} from './csv';
import { buildPreview, markDuplicates, previewToTransactions } from './dedupe';
import { decodeStatement, looksLikeOfx, parseOfx } from './ofx';

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261110120000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>0260<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261110
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261103000000[-3:BRT]
<TRNAMT>-32.50
<FITID>abc-001
<MEMO>Compra no débito - Padaria Pão Quente
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105
<TRNAMT>4500.00
<FITID>abc-002
<NAME>EMPRESA LTDA
<MEMO>Salario
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261107120000
<TRNAMT>-1.234,56
<FITID>abc-003
<MEMO>Aluguel &amp; condominio
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <BANKMSGSRSV1><STMTTRNRS><STMTRS>
    <CURDEF>USD</CURDEF>
    <BANKACCTFROM><ACCTID>999</ACCTID></BANKACCTFROM>
    <BANKTRANLIST>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20261102</DTPOSTED>
        <TRNAMT>-12.90</TRNAMT>
        <FITID>x1</FITID>
        <NAME>BLUE BOTTLE COFFEE</NAME>
      </STMTTRN>
      <STMTTRN>
        <TRNTYPE>CREDIT</TRNTYPE>
        <DTPOSTED>20261104</DTPOSTED>
        <TRNAMT>100.00</TRNAMT>
        <FITID>x2</FITID>
        <NAME>REFUND</NAME>
        <MEMO>Order 123</MEMO>
      </STMTTRN>
    </BANKTRANLIST>
  </STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe('OFX', () => {
  it('parses the SGML variant', () => {
    const s = parseOfx(OFX_SGML);
    expect(s.currency).toBe('BRL');
    expect(s.accountId).toBe('12345-6');
    expect(s.rows).toEqual([
      {
        date: '2026-11-03',
        description: 'Compra no débito - Padaria Pão Quente',
        amountCents: -3250,
        externalId: 'abc-001',
      },
      {
        date: '2026-11-05',
        description: 'EMPRESA LTDA Salario',
        amountCents: 450000,
        externalId: 'abc-002',
      },
      {
        date: '2026-11-07',
        description: 'Aluguel & condominio',
        amountCents: -123456,
        externalId: 'abc-003',
      },
    ]);
  });

  it('parses the XML variant', () => {
    const s = parseOfx(OFX_XML);
    expect(s.currency).toBe('USD');
    expect(s.rows).toEqual([
      {
        date: '2026-11-02',
        description: 'BLUE BOTTLE COFFEE',
        amountCents: -1290,
        externalId: 'x1',
      },
      { date: '2026-11-04', description: 'REFUND Order 123', amountCents: 10000, externalId: 'x2' },
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(parseOfx(OFX_SGML.replace(/\n/g, '\r\n')).rows).toHaveLength(3);
  });

  it('detects OFX files', () => {
    expect(looksLikeOfx(OFX_SGML)).toBe(true);
    expect(looksLikeOfx(OFX_XML)).toBe(true);
    expect(looksLikeOfx('date,description,amount')).toBe(false);
  });

  it('decodes Windows-1252 files', () => {
    const bytes = new Uint8Array([0x50, 0xe3, 0x6f]); // "Pão" in Windows-1252
    expect(decodeStatement(bytes.buffer)).toBe('Pão');
    expect(decodeStatement(new TextEncoder().encode('Pão').buffer)).toBe('Pão');
  });
});

const CSV_BR = `Data;Descrição;Valor
03/11/2026;"Padaria; Pão Quente";-32,50
05/11/2026;Salário;4.500,00
07/11/2026;"Loja ""Boa"" Compra";-1.234,56
`;

const CSV_US = `Date,Description,Debit,Credit
2026-11-02,Coffee,12.90,
2026-11-04,Refund,,100.00
2026-11-05,Rent,"1,500.00",
`;

describe('CSV', () => {
  it('detects the delimiter', () => {
    expect(detectDelimiter(CSV_BR)).toBe(';');
    expect(detectDelimiter(CSV_US)).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('parses quoted fields and escaped quotes', () => {
    const rows = parseCsv(CSV_BR, ';');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toEqual(['03/11/2026', 'Padaria; Pão Quente', '-32,50']);
    expect(rows[3]![1]).toBe('Loja "Boa" Compra');
  });

  it('ignores a UTF-8 BOM', () => {
    expect(parseCsv(`${String.fromCharCode(0xfeff)}a,b\n1,2`, ',')[0]).toEqual(['a', 'b']);
  });

  it('detects columns from headers', () => {
    expect(detectColumns(['Data', 'Descrição', 'Valor'])).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      debit: null,
      credit: null,
    });
    expect(detectColumns(['Date', 'Description', 'Debit', 'Credit'])).toEqual({
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
    expect(detectColumns(['Data Lançamento', 'Histórico', 'Valor (R$)'])).toMatchObject({
      date: 0,
      description: 1,
      amount: 2,
    });
  });

  it('detects header rows', () => {
    expect(hasHeaderRow(parseCsv(CSV_BR, ';'))).toBe(true);
    expect(hasHeaderRow([['03/11/2026', 'x', '1']])).toBe(false);
  });

  it('detects date formats', () => {
    expect(detectDateFormat(['03/11/2026', '25/11/2026'])).toBe('dmy');
    expect(detectDateFormat(['11/03/2026', '11/25/2026'])).toBe('mdy');
    expect(detectDateFormat(['2026-11-03'])).toBe('ymd');
    expect(parseDateWith('03/11/26', 'dmy')).toBe('2026-11-03');
    expect(parseDateWith('11/03/2026', 'mdy')).toBe('2026-11-03');
    expect(parseDateWith('31/02/2026', 'dmy')).toBeNull();
  });

  it('detects Brazilian and US number formats', () => {
    expect(detectNumberFormat(['-32,50', '4.500,00'])).toBe('br');
    expect(detectNumberFormat(['12.90', '1,500.00'])).toBe('us');
    expect(parseAmountWith('1.500', 'br')).toBe(150000);
    expect(parseAmountWith('1.50', 'us')).toBe(150);
    expect(parseAmountWith('R$ -1.234,56', 'br')).toBe(-123456);
    expect(parseAmountWith('(10.00)', 'us')).toBe(-1000);
    expect(parseAmountWith('10,00-', 'br')).toBe(-1000);
    expect(parseAmountWith('abc', 'br')).toBeNull();
  });

  it('maps rows with a signed amount column', () => {
    const table = parseCsv(CSV_BR, ';');
    const { rows, skipped } = csvToRows(table, {
      mapping: detectColumns(table[0]!),
      skipHeader: true,
      dateFormat: 'dmy',
      numberFormat: 'br',
      invert: false,
    });
    expect(skipped).toEqual([]);
    expect(rows.map((r) => [r.date, r.amountCents])).toEqual([
      ['2026-11-03', -3250],
      ['2026-11-05', 450000],
      ['2026-11-07', -123456],
    ]);
  });

  it('maps separate debit and credit columns', () => {
    const table = parseCsv(CSV_US, ',');
    const { rows } = csvToRows(table, {
      mapping: detectColumns(table[0]!),
      skipHeader: true,
      dateFormat: 'ymd',
      numberFormat: 'us',
      invert: false,
    });
    expect(rows.map((r) => r.amountCents)).toEqual([-1290, 10000, -150000]);
  });

  it('can invert signs and reports unreadable lines', () => {
    const table = [
      ['01/11/2026', 'Card purchase', '50,00'],
      ['bad', 'x', '1'],
      ['02/11/2026', 'zero', '0'],
    ];
    const { rows, skipped } = csvToRows(table, {
      mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null },
      skipHeader: false,
      dateFormat: 'dmy',
      numberFormat: 'br',
      invert: true,
    });
    expect(rows[0]!.amountCents).toBe(-5000);
    expect(skipped).toEqual([2, 3]);
  });
});

describe('duplicate detection', () => {
  const target = { accountId: 'acc', cardId: null };
  const existing = [
    makeTransaction({
      type: 'expense',
      amountCents: 3250,
      date: '2026-11-03',
      accountId: 'acc',
      description: 'Padaria Pão Quente',
      externalId: null,
    }),
    makeTransaction({
      type: 'income',
      amountCents: 450000,
      date: '2026-11-05',
      accountId: 'acc',
      description: 'x',
      externalId: 'abc-002',
    }),
    makeTransaction({
      type: 'expense',
      amountCents: 999,
      date: '2026-11-03',
      accountId: 'other',
      description: 'Other account',
      externalId: 'abc-003',
    }),
  ];

  it('matches by FITID first', () => {
    const rows = parseOfx(OFX_SGML).rows;
    const marked = markDuplicates(rows, existing, target);
    expect(marked.map((r) => r.duplicate)).toEqual([false, true, false]);
  });

  it('falls back to date + amount + normalized description', () => {
    const marked = markDuplicates(
      [
        {
          date: '2026-11-03',
          description: 'PADARIA PAO QUENTE',
          amountCents: -3250,
          externalId: null,
        },
        {
          date: '2026-11-03',
          description: 'Padaria Pão Quente',
          amountCents: -3251,
          externalId: null,
        },
      ],
      existing,
      target,
    );
    expect(marked.map((r) => r.duplicate)).toEqual([true, false]);
  });

  it('suggests categories from rules and builds transactions', () => {
    const rule = makeRule({ pattern: 'padaria pao quente', categoryId: 'cat-food' });
    const preview = buildPreview(parseOfx(OFX_SGML).rows, [], target, [rule]);
    expect(preview[0]).toMatchObject({ categoryId: 'cat-food', suggestedCategoryId: 'cat-food' });
    const txs = previewToTransactions(preview, target, 'imp-1');
    expect(txs[0]).toMatchObject({
      type: 'expense',
      amountCents: 3250,
      importId: 'imp-1',
      externalId: 'abc-001',
      accountId: 'acc',
    });
    expect(txs[1]).toMatchObject({ type: 'income', amountCents: 450000 });
  });
});
