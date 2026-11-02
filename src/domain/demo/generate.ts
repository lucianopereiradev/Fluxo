import { categoryFamily } from '../budgets';
import {
  addDays,
  addMonthsToMonth,
  dateInMonth,
  dayOf,
  monthOf,
  parseDate,
  type LocalDate,
} from '../dates';
import { createDefaultCategories, systemCategoryIdByKey } from '../defaultCategories';
import { planInstallments } from '../installments';
import { computeInvoices } from '../invoices';
import { normalizeDescription } from '../rules';
import type {
  Account,
  BaseRecord,
  Budget,
  Card,
  DataSnapshot,
  Goal,
  Recurrence,
  Rule,
  SettingRecord,
  Transaction,
} from '../types';
import { occurrences } from '../recurrences';

/** Small, fast, seedable PRNG (mulberry32). Same seed → same sequence everywhere. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Lang = 'en' | 'pt-BR';

const TEXT: Record<Lang, Record<string, string[]>> = {
  en: {
    checking: ['Everyday checking'],
    wallet: ['Wallet'],
    savings: ['Savings'],
    salary: ['Salary — Acme Corp'],
    rent: ['Rent'],
    internet: ['Home internet'],
    gym: ['Gym membership'],
    streaming: ['Netflix'],
    music: ['Spotify'],
    electricity: ['Electricity bill'],
    groceries: ['Whole Foods', 'Trader Joe’s', 'Farmers market', 'Corner grocery'],
    food: [
      'Lunch at the café',
      'Sushi place',
      'Pizza night',
      'Coffee',
      'Bakery',
      'Burger joint',
      'Takeout',
    ],
    transport: ['Uber', 'Uber', 'Lyft', 'Metro card'],
    fuel: ['Gas station'],
    leisure: ['Cinema', 'Concert tickets', 'Board game café', 'Bowling'],
    health: ['Pharmacy', 'Dentist copay'],
    shopping: ['Amazon', 'Bookstore', 'Clothing store'],
    personalCare: ['Haircut'],
    freelance: ['Freelance project'],
    notebook: ['Laptop'],
    shoes: ['Running shoes'],
    goalTransfer: ['Monthly savings'],
    cash: ['ATM withdrawal'],
    birthday: ['Birthday dinner'],
    emergency: ['Emergency fund'],
    trip: ['Trip to Lisbon'],
  },
  'pt-BR': {
    checking: ['Conta Nubank'],
    wallet: ['Carteira'],
    savings: ['Reserva'],
    salary: ['Salário — Acme Ltda'],
    rent: ['Aluguel'],
    internet: ['Internet de casa'],
    gym: ['Academia'],
    streaming: ['Netflix'],
    music: ['Spotify'],
    electricity: ['Conta de luz'],
    groceries: ['Pão de Açúcar', 'Feira de domingo', 'Hortifruti', 'Mercado do bairro'],
    food: ['Almoço no restaurante', 'iFood', 'Pizza', 'Café', 'Padaria', 'Hambúrguer', 'Sushi'],
    transport: ['Uber', 'Uber', '99', 'Bilhete único'],
    fuel: ['Posto de gasolina'],
    leisure: ['Cinema', 'Show', 'Barzinho', 'Teatro'],
    health: ['Farmácia', 'Consulta dentista'],
    shopping: ['Amazon', 'Livraria', 'Loja de roupas'],
    personalCare: ['Barbeiro'],
    freelance: ['Projeto freela'],
    notebook: ['Notebook'],
    shoes: ['Tênis de corrida'],
    goalTransfer: ['Aporte mensal'],
    cash: ['Saque'],
    birthday: ['Jantar de aniversário'],
    emergency: ['Reserva de emergência'],
    trip: ['Viagem para Lisboa'],
  },
};

export interface DemoOptions {
  /** The demo is generated relative to this day so it always looks current. */
  today: LocalDate;
  language?: string;
  seed?: number;
}

export const DEMO_SEED = 20261101;

/**
 * Builds ~6 months of realistic finances: salary, rent, groceries, subscriptions, a credit
 * card with installments and paid invoices, goals and budgets (one of them over the limit).
 * Pure and deterministic: the same options always produce exactly the same records.
 */
export function generateDemo({
  today,
  language = 'en',
  seed = DEMO_SEED,
}: DemoOptions): DataSnapshot {
  const lang: Lang = language.startsWith('pt') ? 'pt-BR' : 'en';
  const rand = mulberry32(seed);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const chance = (p: number) => rand() < p;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const text = (key: string) => pick(TEXT[lang][key]!);
  /** Random amount in [min, max] reais, rounded to 10 cents. */
  const money = (min: number, max: number) => int(min * 10, max * 10) * 10;

  const startMonth = addMonthsToMonth(monthOf(today), -5);
  const start = `${startMonth}-01`;
  const baseMs = Date.parse(`${start}T00:00:00.000Z`);
  let counter = 0;
  const id = () => {
    const ts = (baseMs + counter++).toString(16).padStart(12, '0');
    const hex = () => Math.floor(rand() * 16).toString(16);
    const r = (n: number) => Array.from({ length: n }, hex).join('');
    return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${r(3)}-${'89ab'[int(0, 3)]}${r(3)}-${r(12)}`;
  };
  const stamp = (date: LocalDate): BaseRecord => {
    const at = `${date}T12:00:00.000Z`;
    return { id: id(), createdAt: at, updatedAt: at, deletedAt: null };
  };
  const cat = (key: string) => systemCategoryIdByKey(key);

  const categories = createDefaultCategories().map((c) => ({
    ...c,
    createdAt: `${start}T09:00:00.000Z`,
    updatedAt: `${start}T09:00:00.000Z`,
  }));

  const checking: Account = {
    ...stamp(start),
    name: text('checking'),
    type: 'checking',
    initialBalanceCents: 320000,
    color: '#5f7d4f',
    archived: false,
  };
  const wallet: Account = {
    ...stamp(start),
    name: text('wallet'),
    type: 'wallet',
    initialBalanceCents: 18000,
    color: '#c9822b',
    archived: false,
  };
  const savings: Account = {
    ...stamp(start),
    name: text('savings'),
    type: 'savings',
    initialBalanceCents: 650000,
    color: '#3f6e6a',
    archived: false,
  };
  const card: Card = {
    ...stamp(start),
    name: 'Inter Gold',
    limitCents: 600000,
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: checking.id,
    color: '#a84c26',
    archived: false,
  };

  const recurrence = (
    r: Omit<
      Recurrence,
      keyof BaseRecord | 'interval' | 'weekday' | 'endDate' | 'active' | 'startDate'
    >,
  ): Recurrence => ({
    ...stamp(start),
    interval: 1,
    weekday: null,
    endDate: null,
    active: true,
    startDate: start,
    ...r,
  });
  const recurrences: Recurrence[] = [
    recurrence({
      type: 'income',
      amountCents: 650000,
      description: text('salary'),
      categoryId: cat('salary'),
      accountId: checking.id,
      cardId: null,
      frequency: 'monthly',
      dayOfMonth: 5,
    }),
    recurrence({
      type: 'expense',
      amountCents: 195000,
      description: text('rent'),
      categoryId: cat('housing'),
      accountId: checking.id,
      cardId: null,
      frequency: 'monthly',
      dayOfMonth: 10,
    }),
    recurrence({
      type: 'expense',
      amountCents: 11990,
      description: text('internet'),
      categoryId: cat('bills'),
      accountId: checking.id,
      cardId: null,
      frequency: 'monthly',
      dayOfMonth: 15,
    }),
    recurrence({
      type: 'expense',
      amountCents: 9990,
      description: text('gym'),
      categoryId: cat('health'),
      accountId: checking.id,
      cardId: null,
      frequency: 'monthly',
      dayOfMonth: 7,
    }),
    recurrence({
      type: 'expense',
      amountCents: 5590,
      description: text('streaming'),
      categoryId: cat('subscriptions'),
      accountId: null,
      cardId: card.id,
      frequency: 'monthly',
      dayOfMonth: 12,
    }),
    recurrence({
      type: 'expense',
      amountCents: 2190,
      description: text('music'),
      categoryId: cat('subscriptions'),
      accountId: null,
      cardId: card.id,
      frequency: 'monthly',
      dayOfMonth: 20,
    }),
  ];

  const transactions: Transaction[] = [];
  const tx = (
    t: Partial<Transaction> & Pick<Transaction, 'type' | 'amountCents' | 'date'>,
  ): Transaction => {
    const record: Transaction = {
      ...stamp(t.date),
      accountId: null,
      cardId: null,
      toAccountId: null,
      toCardId: null,
      categoryId: null,
      description: '',
      notes: '',
      tags: [],
      installmentGroupId: null,
      installmentIndex: null,
      installmentCount: null,
      recurrenceId: null,
      importId: null,
      externalId: null,
      invoiceMonth: null,
      ...t,
    };
    transactions.push(record);
    return record;
  };

  // Recurring items that already happened are real transactions.
  for (const r of recurrences) {
    for (const date of occurrences(r, start, today)) {
      tx({
        type: r.type,
        amountCents: r.amountCents,
        date,
        accountId: r.accountId,
        cardId: r.cardId,
        categoryId: r.categoryId,
        description: r.description,
        recurrenceId: r.id,
      });
    }
  }

  // Day-to-day spending.
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const cardOr = (pCard: number, fallback = checking.id) =>
      chance(pCard) ? { cardId: card.id } : { accountId: fallback };
    if (chance(0.13))
      tx({
        type: 'expense',
        amountCents: money(80, 380),
        date: d,
        categoryId: cat('groceries'),
        description: text('groceries'),
        ...cardOr(0.6),
      });
    if (chance(0.3))
      tx({
        type: 'expense',
        amountCents: money(18, 95),
        date: d,
        categoryId: cat('food'),
        description: text('food'),
        ...(chance(0.12) ? { accountId: wallet.id } : cardOr(0.7)),
      });
    if (chance(0.25))
      tx({
        type: 'expense',
        amountCents: money(12, 48),
        date: d,
        categoryId: cat('transport'),
        description: text('transport'),
        ...cardOr(0.5),
      });
    if (chance(0.03))
      tx({
        type: 'expense',
        amountCents: money(150, 250),
        date: d,
        categoryId: cat('transport'),
        description: text('fuel'),
        cardId: card.id,
      });
    if (chance(0.06))
      tx({
        type: 'expense',
        amountCents: money(35, 160),
        date: d,
        categoryId: cat('leisure'),
        description: text('leisure'),
        cardId: card.id,
        tags: chance(0.3) ? ['friends'] : [],
      });
    if (chance(0.04))
      tx({
        type: 'expense',
        amountCents: money(20, 140),
        date: d,
        categoryId: cat('health'),
        description: text('health'),
        ...cardOr(0.4),
      });
    if (chance(0.03))
      tx({
        type: 'expense',
        amountCents: money(60, 400),
        date: d,
        categoryId: cat('shopping'),
        description: text('shopping'),
        cardId: card.id,
      });
    if (chance(0.02))
      tx({
        type: 'expense',
        amountCents: money(40, 70),
        date: d,
        categoryId: cat('personalCare'),
        description: text('personalCare'),
        accountId: wallet.id,
      });
    if (dayOf(d) === 18)
      tx({
        type: 'expense',
        amountCents: money(140, 260),
        date: d,
        categoryId: cat('bills'),
        description: text('electricity'),
        accountId: checking.id,
      });
    if (dayOf(d) === 6)
      tx({
        type: 'transfer',
        amountCents: 50000,
        date: d,
        accountId: checking.id,
        toAccountId: savings.id,
        description: text('goalTransfer'),
      });
    if (dayOf(d) === 8)
      tx({
        type: 'transfer',
        amountCents: 20000,
        date: d,
        accountId: checking.id,
        toAccountId: wallet.id,
        description: text('cash'),
      });
  }

  const freelanceDate = dateInMonth(addMonthsToMonth(startMonth, 2), 22);
  if (freelanceDate <= today)
    tx({
      type: 'income',
      amountCents: 180000,
      date: freelanceDate,
      categoryId: cat('freelance'),
      description: text('freelance'),
      accountId: checking.id,
    });

  // Installment purchases on the card (some installments still in the future).
  const installmentPurchase = (
    date: LocalDate,
    total: number,
    count: number,
    description: string,
    categoryKey: string,
  ) => {
    const groupId = id();
    for (const p of planInstallments({
      totalCents: total,
      count,
      purchaseDate: date,
      closingDay: card.closingDay,
    })) {
      tx({
        type: 'expense',
        amountCents: p.amountCents,
        date: p.date,
        cardId: card.id,
        categoryId: cat(categoryKey),
        description,
        installmentGroupId: groupId,
        installmentIndex: p.index,
        installmentCount: p.count,
      });
    }
  };
  installmentPurchase(addDays(start, 19), 480000, 10, text('notebook'), 'shopping');
  installmentPurchase(addDays(today, -35), 60000, 3, text('shoes'), 'shopping');

  // Make sure this month's dining budget is visibly over (and leisure close to its limit).
  const thisMonth = monthOf(today);
  const spentIn = (key: string) => {
    const family = categoryFamily(cat(key)!, categories);
    return transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.date <= today &&
          monthOf(t.date) === thisMonth &&
          t.categoryId &&
          family.has(t.categoryId),
      )
      .reduce((s, t) => s + t.amountCents, 0);
  };
  const foodBudget = 60000;
  const food = spentIn('food');
  if (food < 68000) {
    const birthday = parseDate(today).day > 2 ? addDays(today, -1) : today;
    tx({
      type: 'expense',
      amountCents: 68000 - food + money(10, 60),
      date: birthday,
      cardId: card.id,
      categoryId: cat('food'),
      description: text('birthday'),
      tags: ['celebration'],
    });
  }
  const leisure = spentIn('leisure');
  let leisureBudget = 40000;
  if (leisure < 33000) {
    tx({
      type: 'expense',
      amountCents: 34500 - leisure,
      date: today,
      cardId: card.id,
      categoryId: cat('leisure'),
      description: text('leisure'),
    });
  } else if (leisure > 36000) {
    // Keep it in the 80–100% "warning" band rather than over.
    leisureBudget = Math.ceil(leisure / 0.88 / 1000) * 1000;
  }

  // Past invoices are paid on their due date; the ones still due stay open.
  for (const inv of computeInvoices(card, transactions, today)) {
    if (inv.dueDate < today && inv.totalCents > 0) {
      tx({
        type: 'transfer',
        amountCents: inv.totalCents,
        date: inv.dueDate,
        accountId: checking.id,
        toCardId: card.id,
        invoiceMonth: inv.month,
        description: `${card.name} · ${inv.month}`,
      });
    }
  }

  const budget = (key: string, amountCents: number, rollover = false): Budget => ({
    ...stamp(start),
    categoryId: cat(key)!,
    amountCents,
    rollover,
    startMonth,
  });
  const budgets = [
    budget('groceries', 130000),
    budget('food', foodBudget),
    budget('transport', 45000, true),
    budget('leisure', leisureBudget),
    budget('subscriptions', 10000),
    budget('health', 30000),
  ];

  const goals: Goal[] = [
    {
      ...stamp(start),
      name: text('emergency'),
      targetCents: 2000000,
      targetDate: null,
      accountId: savings.id,
      savedCents: 0,
      monthlyContributionCents: 50000,
      color: '#3f6e6a',
      icon: 'piggy-bank',
    },
    {
      ...stamp(start),
      name: text('trip'),
      targetCents: 900000,
      targetDate: dateInMonth(addMonthsToMonth(thisMonth, 10), 1),
      accountId: null,
      savedCents: 230000,
      monthlyContributionCents: 60000,
      color: '#c9822b',
      icon: 'plane',
    },
  ];

  const rules: Rule[] = [
    { ...stamp(start), pattern: normalizeDescription('iFood'), categoryId: cat('food')!, hits: 4 },
    {
      ...stamp(start),
      pattern: normalizeDescription('Uber'),
      categoryId: cat('transport')!,
      hits: 6,
    },
  ];

  const settings: SettingRecord[] = [
    {
      id: 'currency',
      value: lang === 'pt-BR' ? 'BRL' : 'USD',
      createdAt: `${start}T09:00:00.000Z`,
      updatedAt: `${start}T09:00:00.000Z`,
      deletedAt: null,
    },
  ];

  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return {
    accounts: [checking, wallet, savings],
    cards: [card],
    categories,
    transactions,
    recurrences,
    budgets,
    goals,
    rules,
    settings,
  };
}
