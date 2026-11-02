import { accountDelta, isLiquid, liquidBalance } from './balances';
import { diffDays, endOfMonth, startOfMonth, type LocalDate } from './dates';
import { invoicesDue } from './forecast';
import type { Cents } from './money';
import { materializedKeys, pendingOccurrences } from './recurrences';
import type { Account, Card, Goal, Recurrence, Transaction } from './types';

export interface SafeToSpendInput {
  today: LocalDate;
  accounts: readonly Account[];
  cards: readonly Card[];
  transactions: readonly Transaction[];
  recurrences: readonly Recurrence[];
  goals: readonly Goal[];
}

export interface SafeToSpendLine {
  kind: 'recurring' | 'scheduled' | 'invoice' | 'goal';
  label: string;
  date: LocalDate | null;
  amountCents: Cents;
  refId: string;
}

export interface SafeToSpend {
  liquidBalanceCents: Cents;
  upcomingExpensesCents: Cents;
  unpaidInvoicesCents: Cents;
  goalContributionsCents: Cents;
  /** What is left for the rest of the month (may be negative). */
  availableCents: Cents;
  daysLeft: number;
  /** Never negative: when there is a deficit, nothing is safe to spend. */
  perDayCents: Cents;
  deficitCents: Cents;
  lines: SafeToSpendLine[];
}

/** How much has already gone into a goal's linked account this month (net transfers in). */
export function goalContributedThisMonth(
  goal: Goal,
  transactions: readonly Transaction[],
  today: LocalDate,
): Cents {
  if (!goal.accountId) return 0;
  const from = startOfMonth(today);
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'transfer' || t.date < from || t.date > today) continue;
    total += accountDelta(t, goal.accountId);
  }
  return Math.max(0, total);
}

/**
 * safe to spend per day =
 *   (checking + wallet balances)
 *   − recurring and scheduled expenses still due this month
 *   − unpaid card invoices due by the end of the month
 *   − planned monthly goal contributions not yet made
 *   ÷ days left in the month, today included.
 */
export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  const { today, accounts, cards, transactions, recurrences, goals } = input;
  const monthEnd = endOfMonth(today);
  const liquidIds = new Set(
    accounts.filter((a) => a.deletedAt === null && isLiquid(a)).map((a) => a.id),
  );
  const lines: SafeToSpendLine[] = [];
  const keys = materializedKeys(transactions);

  for (const r of recurrences) {
    if (r.type !== 'expense' || !r.accountId || !liquidIds.has(r.accountId)) continue;
    for (const date of pendingOccurrences(r, transactions, today, monthEnd, keys)) {
      lines.push({
        kind: 'recurring',
        label: r.description,
        date,
        amountCents: r.amountCents,
        refId: r.id,
      });
    }
  }

  for (const t of transactions) {
    if (t.deletedAt !== null || t.date <= today || t.date > monthEnd) continue;
    if (t.accountId && liquidIds.has(t.accountId) && t.type !== 'income') {
      // A transfer between two liquid accounts does not reduce what can be spent.
      if (t.type === 'transfer' && t.toAccountId && liquidIds.has(t.toAccountId)) continue;
      if (t.type === 'transfer' && t.toCardId) continue; // counted through invoices
      lines.push({
        kind: 'scheduled',
        label: t.description,
        date: t.date,
        amountCents: t.amountCents,
        refId: t.id,
      });
    }
  }

  const cardById = new Map(cards.map((c) => [c.id, c]));
  for (const inv of invoicesDue(cards, transactions, today, monthEnd)) {
    lines.push({
      kind: 'invoice',
      label: cardById.get(inv.cardId)?.name ?? '',
      date: inv.dueDate,
      amountCents: inv.remainingCents,
      refId: `${inv.cardId}:${inv.month}`,
    });
  }

  for (const g of goals) {
    if (g.deletedAt !== null || g.monthlyContributionCents <= 0) continue;
    const left = g.monthlyContributionCents - goalContributedThisMonth(g, transactions, today);
    if (left > 0)
      lines.push({ kind: 'goal', label: g.name, date: null, amountCents: left, refId: g.id });
  }

  const sum = (kinds: SafeToSpendLine['kind'][]) =>
    lines.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + l.amountCents, 0);

  const liquidBalanceCents = liquidBalance(accounts, transactions, today);
  const upcomingExpensesCents = sum(['recurring', 'scheduled']);
  const unpaidInvoicesCents = sum(['invoice']);
  const goalContributionsCents = sum(['goal']);
  const availableCents =
    liquidBalanceCents - upcomingExpensesCents - unpaidInvoicesCents - goalContributionsCents;
  const daysLeft = diffDays(today, monthEnd) + 1;

  return {
    liquidBalanceCents,
    upcomingExpensesCents,
    unpaidInvoicesCents,
    goalContributionsCents,
    availableCents,
    daysLeft,
    perDayCents: availableCents > 0 ? Math.floor(availableCents / daysLeft) : 0,
    deficitCents: availableCents < 0 ? -availableCents : 0,
    lines: lines.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')),
  };
}
