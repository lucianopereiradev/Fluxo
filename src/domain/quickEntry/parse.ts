import {
  addDays,
  addMonthsToMonth,
  dateInMonth,
  dayOf,
  isValidLocalDate,
  monthOf,
  parseDate,
  toDate,
  type LocalDate,
} from '../dates';
import { parseMoney, type Cents } from '../money';
import { findRule } from '../rules';
import { normalizeText } from '../search';
import type { Category, Frequency, Rule } from '../types';
import { CARD_WORDS, CATEGORY_KEYWORDS, CONNECTORS, INCOME_WORDS, WEEKDAYS } from './keywords';

export interface QuickEntryContext {
  today: LocalDate;
  accounts: readonly { id: string; name: string }[];
  cards: readonly { id: string; name: string }[];
  categories: readonly Pick<Category, 'id' | 'systemKey' | 'kind' | 'deletedAt'>[];
  rules: readonly Rule[];
}

export interface ParsedRecurrence {
  frequency: Frequency;
  dayOfMonth: number | null;
  weekday: number | null;
}

export interface ParsedEntry {
  type: 'income' | 'expense';
  amountCents: Cents | null;
  date: LocalDate;
  description: string;
  accountId: string | null;
  cardId: string | null;
  categoryId: string | null;
  categorySource: 'rule' | 'keyword' | null;
  installments: number;
  recurrence: ParsedRecurrence | null;
}

interface Token {
  raw: string;
  norm: string;
  used: boolean;
}

function tokenize(text: string): Token[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeText(raw).replace(/[.,;:!?]+$/, ''), used: false }));
}

const isInt = (s: string | undefined, min: number, max: number) =>
  !!s && /^\d{1,2}$/.test(s) && Number(s) >= min && Number(s) <= max;

/** "5", "5th", "1st", "22nd" → 5 / 1 / 22. */
function ordinalDay(s: string | undefined): number | null {
  const m = s ? /^(\d{1,2})(st|nd|rd|th|o|º)?$/.exec(s) : null;
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 31 ? Number(m[1]) : null;
}

/** Edit distance where swapping two adjacent letters counts as one typo ("nubnak"). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** Parses "15/11", "15/11/26", "15/11/2026" and ISO dates relative to today. */
function parseSlashDate(s: string, today: LocalDate): LocalDate | null {
  if (isValidLocalDate(s)) return s;
  const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(s);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : parseDate(today).year;
  if (year < 100) year += 2000;
  const date = toDate(year, month, day);
  return isValidLocalDate(date) ? date : null;
}

function consume(tokens: Token[], ...indexes: number[]) {
  for (const i of indexes) if (tokens[i]) tokens[i].used = true;
}

/** Drops a connector right before index i ("no nubank", "em 3x", "on the 5th"). */
function consumeConnectorBefore(tokens: Token[], i: number) {
  const prev = tokens[i - 1];
  if (prev && !prev.used && CONNECTORS.has(prev.norm)) prev.used = true;
}

function parseRecurrence(tokens: Token[]): ParsedRecurrence | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1]?.norm.replace(/-feira$/, '');
    const after = tokens[i + 2]?.norm;
    if (['todo', 'toda', 'todos', 'todas'].includes(t.norm)) {
      if ((next === 'dia' || next === 'dias') && ordinalDay(after) !== null) {
        consume(tokens, i, i + 1, i + 2);
        return { frequency: 'monthly', dayOfMonth: ordinalDay(after), weekday: null };
      }
      if (next !== undefined && next in WEEKDAYS) {
        consume(tokens, i, i + 1);
        return { frequency: 'weekly', dayOfMonth: null, weekday: WEEKDAYS[next]! };
      }
      if (next === 'mes' || next === 'meses') {
        consume(tokens, i, i + 1);
        return { frequency: 'monthly', dayOfMonth: null, weekday: null };
      }
      if (next === 'semana' || next === 'semanas') {
        consume(tokens, i, i + 1);
        return { frequency: 'weekly', dayOfMonth: null, weekday: null };
      }
      if (next === 'ano' || next === 'anos') {
        consume(tokens, i, i + 1);
        return { frequency: 'yearly', dayOfMonth: null, weekday: null };
      }
    }
    if (t.norm === 'every') {
      if (next === 'month') {
        consume(tokens, i, i + 1);
        return { frequency: 'monthly', dayOfMonth: null, weekday: null };
      }
      if (next === 'week') {
        consume(tokens, i, i + 1);
        return { frequency: 'weekly', dayOfMonth: null, weekday: null };
      }
      if (next === 'year') {
        consume(tokens, i, i + 1);
        return { frequency: 'yearly', dayOfMonth: null, weekday: null };
      }
      if (next !== undefined && next in WEEKDAYS) {
        consume(tokens, i, i + 1);
        return { frequency: 'weekly', dayOfMonth: null, weekday: WEEKDAYS[next]! };
      }
    }
    if (['mensal', 'mensalmente', 'monthly'].includes(t.norm)) {
      consume(tokens, i);
      return { frequency: 'monthly', dayOfMonth: null, weekday: null };
    }
    if (['semanal', 'semanalmente', 'weekly'].includes(t.norm)) {
      consume(tokens, i);
      return { frequency: 'weekly', dayOfMonth: null, weekday: null };
    }
    if (['anual', 'anualmente', 'yearly', 'annually'].includes(t.norm)) {
      consume(tokens, i);
      return { frequency: 'yearly', dayOfMonth: null, weekday: null };
    }
  }
  return null;
}

function parseInstallments(tokens: Token[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const x = /^(\d{1,2})x$/.exec(t.norm);
    if (x && Number(x[1]) >= 1) {
      consume(tokens, i);
      consumeConnectorBefore(tokens, i);
      if (tokens[i - 2]?.norm === 'parcelado') consume(tokens, i - 2);
      return Math.min(72, Number(x[1]));
    }
    const unit = tokens[i + 1]?.norm;
    if (
      isInt(t.norm, 1, 72) &&
      unit &&
      ['vezes', 'parcelas', 'installments', 'payments'].includes(unit)
    ) {
      consume(tokens, i, i + 1);
      consumeConnectorBefore(tokens, i);
      if (tokens[i - 2]?.norm === 'parcelado') consume(tokens, i - 2);
      return Number(t.norm);
    }
  }
  return 1;
}

function parseDateTokens(tokens: Token[], today: LocalDate): LocalDate | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const n = t.norm;
    if (n === 'hoje' || n === 'today') {
      consume(tokens, i);
      return today;
    }
    if (n === 'ontem' || n === 'yesterday') {
      consume(tokens, i);
      if (tokens[i - 1]?.norm === 'before' && tokens[i - 2]?.norm === 'day') {
        consume(tokens, i - 1, i - 2);
        consumeConnectorBefore(tokens, i - 2);
        return addDays(today, -2);
      }
      return addDays(today, -1);
    }
    if (n === 'anteontem') {
      consume(tokens, i);
      return addDays(today, -2);
    }
    if (n === 'dia' && ordinalDay(tokens[i + 1]?.norm) !== null && !tokens[i + 1]!.used) {
      consume(tokens, i, i + 1);
      consumeConnectorBefore(tokens, i);
      return dateInMonth(monthOf(today), ordinalDay(tokens[i + 1]!.norm)!);
    }
    if (n === 'the' && ordinalDay(tokens[i + 1]?.norm) !== null && !tokens[i + 1]!.used) {
      const day = ordinalDay(tokens[i + 1]!.norm)!;
      consume(tokens, i, i + 1);
      consumeConnectorBefore(tokens, i);
      return dateInMonth(monthOf(today), day);
    }
    if (/^\d{1,2}(st|nd|rd|th)$/.test(n)) {
      consume(tokens, i);
      consumeConnectorBefore(tokens, i);
      return dateInMonth(monthOf(today), ordinalDay(n)!);
    }
    const slash = /[/-]/.test(n) ? parseSlashDate(n, today) : null;
    if (slash) {
      consume(tokens, i);
      consumeConnectorBefore(tokens, i);
      return slash;
    }
  }
  return null;
}

/** Finds the amount; returns its sign hint too ("+50" → income, "-50" → expense). */
function parseAmount(tokens: Token[]): { cents: Cents | null; sign: 1 | -1 | 0 } {
  const candidates: {
    index: number;
    cents: Cents;
    strong: boolean;
    sign: 1 | -1 | 0;
    span: number[];
  }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    let raw = t.raw.replace(/(reais|real|brl|usd|eur)$/i, '');
    const span = [i];
    let strong = /[.,]\d{1,2}$/.test(raw) || /^[+-]?(r\$|\$|€)/i.test(raw);
    if (/^(r\$|\$|€)$/i.test(raw) && tokens[i + 1] && !tokens[i + 1]!.used) {
      raw = tokens[i + 1]!.raw;
      span.push(i + 1);
      strong = true;
    }
    if (!/\d/.test(raw) || /[/]/.test(raw) || /^\d{1,2}x$/i.test(raw)) continue;
    const cents = parseMoney(raw);
    if (cents === null) continue;
    const next = tokens[span[span.length - 1]! + 1]?.norm;
    if (next === 'reais' || next === 'real') span.push(span[span.length - 1]! + 1);
    candidates.push({
      index: i,
      cents,
      strong,
      sign: raw.startsWith('+') ? 1 : raw.startsWith('-') ? -1 : 0,
      span,
    });
  }
  const pick = candidates.find((c) => c.strong) ?? candidates[0];
  if (!pick) return { cents: null, sign: 0 };
  consume(tokens, ...pick.span);
  return { cents: Math.abs(pick.cents), sign: pick.sign };
}

function matchSource(
  tokens: Token[],
  ctx: QuickEntryContext,
  preferCard: boolean,
): { accountId: string | null; cardId: string | null } {
  type Candidate = { kind: 'account' | 'card'; id: string; score: number; indexes: number[] };
  const found: Candidate[] = [];
  const free = tokens.map((t, i) => ({ ...t, i })).filter((t) => !t.used);

  const consider = (kind: Candidate['kind'], id: string, name: string) => {
    const words = normalizeText(name).split(' ').filter(Boolean);
    if (words.length === 0) return;
    // Whole name in sequence.
    for (let s = 0; s < free.length; s++) {
      const slice = free.slice(s, s + words.length);
      if (slice.length === words.length && slice.every((t, k) => t.norm === words[k])) {
        found.push({ kind, id, score: 3 + words.length, indexes: slice.map((t) => t.i) });
        return;
      }
    }
    // First word of the name, or a close typo of it.
    for (const t of free) {
      if (t.norm === words[0] && t.norm.length >= 2) {
        found.push({ kind, id, score: 2, indexes: [t.i] });
        return;
      }
      if (t.norm.length >= 4 && words[0]!.length >= 4 && editDistance(t.norm, words[0]!) <= 1) {
        found.push({ kind, id, score: 1, indexes: [t.i] });
        return;
      }
    }
  };

  for (const a of ctx.accounts) consider('account', a.id, a.name);
  for (const c of ctx.cards) consider('card', c.id, c.name);
  if (found.length === 0) return { accountId: null, cardId: null };

  const cardHinted = (c: Candidate) => CARD_WORDS.has(tokens[c.indexes[0]! - 1]?.norm ?? '');
  found.sort((a, b) => {
    const ha = cardHinted(a) && a.kind === 'card' ? 2 : 0;
    const hb = cardHinted(b) && b.kind === 'card' ? 2 : 0;
    const pa = preferCard && a.kind === 'card' ? 1 : !preferCard && a.kind === 'account' ? 0.5 : 0;
    const pb = preferCard && b.kind === 'card' ? 1 : !preferCard && b.kind === 'account' ? 0.5 : 0;
    return b.score + hb + pb - (a.score + ha + pa);
  });
  const best = found[0]!;
  consume(tokens, ...best.indexes);
  const first = best.indexes[0]!;
  if (CARD_WORDS.has(tokens[first - 1]?.norm ?? '')) {
    consume(tokens, first - 1);
    if (tokens[first - 2]?.norm === 'de' && tokens[first - 3]?.norm === 'cartao')
      consume(tokens, first - 2, first - 3);
    consumeConnectorBefore(tokens, first - 1);
  } else {
    consumeConnectorBefore(tokens, first);
  }
  return best.kind === 'account'
    ? { accountId: best.id, cardId: null }
    : { accountId: null, cardId: best.id };
}

function guessCategory(
  description: string,
  type: 'income' | 'expense',
  ctx: QuickEntryContext,
): { categoryId: string | null; source: ParsedEntry['categorySource'] } {
  const rule = findRule(ctx.rules, description);
  if (rule && ctx.categories.some((c) => c.id === rule.categoryId && c.deletedAt === null)) {
    return { categoryId: rule.categoryId, source: 'rule' };
  }
  const words = normalizeText(description).split(' ');
  const text = ` ${words.join(' ')} `;
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!keywords.some((k) => text.includes(` ${k} `))) continue;
    const category = ctx.categories.find((c) => c.systemKey === key && c.deletedAt === null);
    if (category && category.kind === type) return { categoryId: category.id, source: 'keyword' };
  }
  return { categoryId: null, source: null };
}

/**
 * Rule-based parser for one-line entries in Portuguese or English, entirely local:
 * "almoço 32,50 ontem nubank", "tênis 600 em 3x cartão inter", "aluguel 1800 todo dia 5",
 * "coffee 12.90 yesterday". Order matters: recurrence and installment phrases are taken
 * first so their numbers are not mistaken for the amount or a date.
 */
export function parseQuickEntry(text: string, ctx: QuickEntryContext): ParsedEntry {
  const tokens = tokenize(text);
  const recurrence = parseRecurrence(tokens);
  const installments = parseInstallments(tokens);
  const explicitDate = parseDateTokens(tokens, ctx.today);
  const amount = parseAmount(tokens);

  const isIncome =
    amount.sign === 1 || (amount.sign === 0 && tokens.some((t) => INCOME_WORDS.has(t.norm)));
  const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';
  const source = matchSource(tokens, ctx, installments > 1);

  const rest = tokens.filter((t) => !t.used);
  while (rest.length && CONNECTORS.has(rest[0]!.norm)) rest.shift();
  while (rest.length && CONNECTORS.has(rest[rest.length - 1]!.norm)) rest.pop();
  const joined = rest
    .map((t) => t.raw)
    .join(' ')
    .replace(/[,;]+$/, '');
  const description = joined ? joined[0]!.toLocaleUpperCase() + joined.slice(1) : '';

  let date = explicitDate ?? ctx.today;
  if (recurrence?.frequency === 'monthly' && recurrence.dayOfMonth === null) {
    recurrence.dayOfMonth = dayOf(date);
  }
  if (recurrence?.frequency === 'monthly' && !explicitDate && recurrence.dayOfMonth) {
    // The first occurrence: this month's day if it has not passed yet, otherwise next month.
    const thisMonth = dateInMonth(monthOf(ctx.today), recurrence.dayOfMonth);
    date =
      thisMonth >= ctx.today
        ? thisMonth
        : dateInMonth(addMonthsToMonth(monthOf(ctx.today), 1), recurrence.dayOfMonth);
  }

  const { categoryId, source: categorySource } = guessCategory(description, type, ctx);
  return {
    type,
    amountCents: amount.cents,
    date,
    description,
    accountId: source.accountId,
    cardId: source.cardId,
    categoryId,
    categorySource,
    installments: recurrence ? 1 : installments,
    recurrence,
  };
}
