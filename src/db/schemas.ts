import { z } from 'zod';
import { isValidLocalDate, isValidYearMonth } from '@/domain/dates';

const localDate = z.string().refine(isValidLocalDate, 'Invalid date');
const yearMonth = z.string().refine(isValidYearMonth, 'Invalid month');
const cents = z.number().int().refine(Number.isSafeInteger);
const id = z.string().min(1).max(64);
const isoTimestamp = z.string().min(10).max(40);
const color = z.string().max(32);
const shortText = z.string().max(200);

const base = {
  id,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  deletedAt: isoTimestamp.nullable(),
};

export const accountSchema = z.object({
  ...base,
  name: shortText,
  type: z.enum(['checking', 'savings', 'wallet', 'investment']),
  initialBalanceCents: cents,
  color,
  archived: z.boolean(),
});

export const cardSchema = z.object({
  ...base,
  name: shortText,
  limitCents: cents,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  paymentAccountId: id.nullable(),
  color,
  archived: z.boolean(),
});

export const categorySchema = z.object({
  ...base,
  name: shortText,
  systemKey: z.string().max(64).nullable(),
  kind: z.enum(['income', 'expense']),
  color,
  icon: z.string().max(64),
  parentId: id.nullable(),
});

export const transactionSchema = z.object({
  ...base,
  type: z.enum(['income', 'expense', 'transfer']),
  amountCents: cents,
  date: localDate,
  accountId: id.nullable(),
  cardId: id.nullable(),
  toAccountId: id.nullable(),
  toCardId: id.nullable(),
  categoryId: id.nullable(),
  description: z.string().max(500),
  notes: z.string().max(5000),
  tags: z.array(z.string().max(64)).max(50),
  installmentGroupId: id.nullable(),
  installmentIndex: z.number().int().min(1).nullable(),
  installmentCount: z.number().int().min(1).nullable(),
  recurrenceId: id.nullable(),
  importId: id.nullable(),
  externalId: z.string().max(200).nullable(),
  invoiceMonth: yearMonth.nullable(),
});

export const recurrenceSchema = z.object({
  ...base,
  type: z.enum(['income', 'expense']),
  amountCents: cents,
  description: z.string().max(500),
  categoryId: id.nullable(),
  accountId: id.nullable(),
  cardId: id.nullable(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(60),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  weekday: z.number().int().min(0).max(6).nullable(),
  startDate: localDate,
  endDate: localDate.nullable(),
  active: z.boolean(),
});

export const budgetSchema = z.object({
  ...base,
  categoryId: id,
  amountCents: cents,
  rollover: z.boolean(),
  startMonth: yearMonth,
});

export const goalSchema = z.object({
  ...base,
  name: shortText,
  targetCents: cents,
  targetDate: localDate.nullable(),
  accountId: id.nullable(),
  savedCents: cents,
  monthlyContributionCents: cents,
  color,
  icon: z.string().max(64),
});

export const ruleSchema = z.object({
  ...base,
  pattern: z.string().min(1).max(200),
  categoryId: id,
  hits: z.number().int().min(0),
});

export const settingSchema = z.object({
  ...base,
  value: z.unknown(),
});

export const snapshotSchema = z.object({
  accounts: z.array(accountSchema),
  cards: z.array(cardSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  recurrences: z.array(recurrenceSchema),
  budgets: z.array(budgetSchema),
  goals: z.array(goalSchema),
  rules: z.array(ruleSchema),
  settings: z.array(settingSchema),
});
