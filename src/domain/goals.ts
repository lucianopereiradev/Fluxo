import { accountBalance, accountDelta } from './balances';
import { addMonthsToMonth, diffMonths, monthOf, type LocalDate, type YearMonth } from './dates';
import type { Cents } from './money';
import type { Account, Goal, Transaction } from './types';

export interface GoalProgress {
  goal: Goal;
  currentCents: Cents;
  remainingCents: Cents;
  ratio: number;
  done: boolean;
  /** Average monthly contribution used for the projection. */
  paceCents: Cents;
  paceSource: 'history' | 'plan' | 'none';
  /** Month the goal is expected to be reached at the current pace. */
  etaMonth: YearMonth | null;
  /** Monthly amount needed to hit the target date, when there is one. */
  requiredMonthlyCents: Cents | null;
  onTrack: boolean | null;
}

const PACE_WINDOW_MONTHS = 3;

/** Net money moved into the goal's account per month over the last complete months. */
export function historicalPace(
  accountId: string,
  transactions: readonly Transaction[],
  today: LocalDate,
): Cents {
  const current = monthOf(today);
  const from = addMonthsToMonth(current, -PACE_WINDOW_MONTHS);
  let total = 0;
  for (const t of transactions) {
    const m = monthOf(t.date);
    if (m < from || m >= current) continue;
    total += accountDelta(t, accountId);
  }
  return Math.round(total / PACE_WINDOW_MONTHS);
}

export function goalProgress(
  goal: Goal,
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  today: LocalDate,
): GoalProgress {
  const account = goal.accountId ? accounts.find((a) => a.id === goal.accountId) : undefined;
  const currentCents = account ? accountBalance(account, transactions, today) : goal.savedCents;
  const remainingCents = Math.max(0, goal.targetCents - currentCents);
  const done = remainingCents === 0;
  const current = monthOf(today);

  let paceCents = 0;
  let paceSource: GoalProgress['paceSource'] = 'none';
  const history = account ? historicalPace(account.id, transactions, today) : 0;
  if (history > 0) {
    paceCents = history;
    paceSource = 'history';
  } else if (goal.monthlyContributionCents > 0) {
    paceCents = goal.monthlyContributionCents;
    paceSource = 'plan';
  }

  const etaMonth = done
    ? current
    : paceCents > 0
      ? addMonthsToMonth(current, Math.ceil(remainingCents / paceCents))
      : null;

  let requiredMonthlyCents: Cents | null = null;
  let onTrack: boolean | null = null;
  if (goal.targetDate) {
    const monthsLeft = Math.max(1, diffMonths(current, monthOf(goal.targetDate)));
    requiredMonthlyCents = Math.ceil(remainingCents / monthsLeft);
    onTrack = done || (etaMonth !== null && etaMonth <= monthOf(goal.targetDate));
  }

  return {
    goal,
    currentCents,
    remainingCents,
    ratio: goal.targetCents > 0 ? Math.min(1, currentCents / goal.targetCents) : 0,
    done,
    paceCents,
    paceSource,
    etaMonth,
    requiredMonthlyCents,
    onTrack,
  };
}
