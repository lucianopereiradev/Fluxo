import { describe, expect, it } from 'vitest';
import { createDefaultCategories, systemCategoryIdByKey } from '../defaultCategories';
import { makeRule } from '../records';
import { parseQuickEntry, type QuickEntryContext } from './parse';

const TODAY = '2026-11-15';
const cat = (key: string) => systemCategoryIdByKey(key);

const ctx: QuickEntryContext = {
  today: TODAY,
  accounts: [
    { id: 'acc-nubank', name: 'Nubank' },
    { id: 'acc-wallet', name: 'Carteira' },
    { id: 'acc-itau', name: 'Itaú Personnalité' },
  ],
  cards: [
    { id: 'card-inter', name: 'Inter' },
    { id: 'card-xp', name: 'XP Visa Infinite' },
    { id: 'card-nubank', name: 'Nubank' },
  ],
  categories: createDefaultCategories(),
  rules: [],
};

const parse = (text: string, extra: Partial<QuickEntryContext> = {}) =>
  parseQuickEntry(text, { ...ctx, ...extra });

describe('quick entry: examples from the spec', () => {
  it('almoço 32,50 ontem nubank', () => {
    expect(parse('almoço 32,50 ontem nubank')).toMatchObject({
      type: 'expense',
      amountCents: 3250,
      date: '2026-11-14',
      accountId: 'acc-nubank',
      description: 'Almoço',
      categoryId: cat('food'),
    });
  });

  it('salário 4500 dia 5', () => {
    expect(parse('salário 4500 dia 5')).toMatchObject({
      type: 'income',
      amountCents: 450000,
      date: '2026-11-05',
      description: 'Salário',
      categoryId: cat('salary'),
    });
  });

  it('tênis 600 em 3x cartão inter', () => {
    expect(parse('tênis 600 em 3x cartão inter')).toMatchObject({
      type: 'expense',
      amountCents: 60000,
      installments: 3,
      cardId: 'card-inter',
      accountId: null,
      description: 'Tênis',
      categoryId: cat('shopping'),
    });
  });

  it('aluguel 1800 todo dia 5', () => {
    const r = parse('aluguel 1800 todo dia 5');
    expect(r).toMatchObject({
      type: 'expense',
      amountCents: 180000,
      description: 'Aluguel',
      categoryId: cat('housing'),
      recurrence: { frequency: 'monthly', dayOfMonth: 5, weekday: null },
    });
    // Day 5 already passed this month, so the first occurrence is next month.
    expect(r.date).toBe('2026-12-05');
  });

  it('coffee 12.90 yesterday', () => {
    expect(parse('coffee 12.90 yesterday')).toMatchObject({
      type: 'expense',
      amountCents: 1290,
      date: '2026-11-14',
      description: 'Coffee',
      categoryId: cat('food'),
    });
  });
});

describe('quick entry: amounts', () => {
  it.each([
    ['mercado R$ 245,90', 24590],
    ['mercado R$245,90', 24590],
    ['mercado 1.234,56', 123456],
    ['groceries 1,234.56', 123456],
    ['uber 23', 2300],
    ['pizza 59,9', 5990],
    ['padaria 8 reais', 800],
    ['netflix 55.90', 5590],
  ])('%s → %d cents', (text, cents) => {
    expect(parse(text).amountCents).toBe(cents);
  });

  it('returns null when there is no amount', () => {
    expect(parse('almoço ontem').amountCents).toBeNull();
  });

  it('prefers the amount with decimals over other numbers', () => {
    const r = parse('uber 99 corrida 18,40');
    expect(r.amountCents).toBe(1840);
    expect(r.description).toBe('Uber 99 corrida');
  });

  it('treats a leading + as income', () => {
    expect(parse('pix +150 joão')).toMatchObject({ type: 'income', amountCents: 15000 });
  });
});

describe('quick entry: dates', () => {
  it.each([
    ['café 6 hoje', TODAY],
    ['lanche 12 today', TODAY],
    ['jantar 80 anteontem', '2026-11-13'],
    ['dinner 45 the day before yesterday', '2026-11-13'],
    ['farmácia 35 dia 3', '2026-11-03'],
    ['farmácia 35 03/11', '2026-11-03'],
    ['presente 120 25/12', '2026-12-25'],
    ['hotel 900 10/10/2026', '2026-10-10'],
    ['hotel 900 10/10/26', '2026-10-10'],
    ['books 60 on the 2nd', '2026-11-02'],
    ['gas 150 3rd', '2026-11-03'],
    ['taxi 30 2026-11-01', '2026-11-01'],
  ])('%s → %s', (text, date) => {
    expect(parse(text).date).toBe(date);
  });

  it('defaults to today', () => {
    expect(parse('sorvete 15').date).toBe(TODAY);
  });

  it('clamps "dia 31" to the end of short months', () => {
    expect(parse('internet 100 dia 31', { today: '2026-02-10' }).date).toBe('2026-02-28');
  });
});

describe('quick entry: accounts and cards', () => {
  it('matches account names regardless of case and accents', () => {
    expect(parse('cinema 40 CARTEIRA').accountId).toBe('acc-wallet');
    expect(parse('almoço 30 itau').accountId).toBe('acc-itau');
  });

  it('matches the first word of a multi-word card name', () => {
    expect(parse('tênis 300 no xp').cardId).toBe('card-xp');
  });

  it('tolerates a small typo', () => {
    expect(parse('almoço 30 nubnak').accountId).toBe('acc-nubank');
  });

  it('prefers the card when the text says "cartão"', () => {
    expect(parse('jantar 120 cartão nubank')).toMatchObject({
      cardId: 'card-nubank',
      accountId: null,
    });
  });

  it('prefers the card for installment purchases', () => {
    expect(parse('geladeira 3200 em 10x nubank')).toMatchObject({
      cardId: 'card-nubank',
      installments: 10,
    });
  });

  it('leaves the source empty when nothing matches', () => {
    expect(parse('almoço 30')).toMatchObject({ accountId: null, cardId: null });
  });
});

describe('quick entry: installments and recurrence', () => {
  it.each([
    ['notebook 4800 12x', 12],
    ['sofá 2000 em 5 vezes', 5],
    ['tv 3000 in 10 installments', 10],
    ['celular 2400 parcelado em 6x', 6],
  ])('%s → %d installments', (text, n) => {
    const r = parse(text);
    expect(r.installments).toBe(n);
    expect(r.description.toLowerCase()).not.toMatch(/\d|vezes|installments|parcelado/);
  });

  it('weekly on a weekday (PT)', () => {
    expect(parse('feira 80 toda segunda').recurrence).toEqual({
      frequency: 'weekly',
      dayOfMonth: null,
      weekday: 1,
    });
  });

  it('weekly on a weekday (EN)', () => {
    expect(parse('yoga 40 every friday').recurrence).toEqual({
      frequency: 'weekly',
      dayOfMonth: null,
      weekday: 5,
    });
  });

  it('every month uses the given date as the day', () => {
    expect(parse('spotify 21,90 every month on the 20th')).toMatchObject({
      date: '2026-11-20',
      recurrence: { frequency: 'monthly', dayOfMonth: 20 },
      description: 'Spotify',
      categoryId: cat('subscriptions'),
    });
  });

  it('yearly', () => {
    expect(parse('iptu 1200 anual').recurrence?.frequency).toBe('yearly');
  });

  it('monthly income', () => {
    expect(parse('salary 5000 every month')).toMatchObject({
      type: 'income',
      recurrence: { frequency: 'monthly', dayOfMonth: 15 },
    });
  });
});

describe('quick entry: income words and categories', () => {
  it.each(['recebi 200 do joão', 'refund 30', 'freela 1500', 'dividendos 87,30', 'received 100'])(
    '%s is income',
    (text) => {
      expect(parse(text).type).toBe('income');
    },
  );

  it('uses learned rules before the keyword dictionary', () => {
    const rule = makeRule({ pattern: 'padaria do ze', categoryId: cat('groceries')! });
    expect(parse('padaria do zé 12', { rules: [rule] })).toMatchObject({
      categoryId: cat('groceries'),
      categorySource: 'rule',
    });
  });

  it('falls back to keywords', () => {
    expect(parse('uber 23')).toMatchObject({
      categoryId: cat('transport'),
      categorySource: 'keyword',
    });
  });

  it('keeps unknown descriptions uncategorized', () => {
    expect(parse('xyzzy 10')).toMatchObject({ categoryId: null, description: 'Xyzzy' });
  });

  it('does not assign an expense category to income', () => {
    expect(parse('recebi reembolso uber 40').categoryId).not.toBe(cat('transport'));
  });
});
