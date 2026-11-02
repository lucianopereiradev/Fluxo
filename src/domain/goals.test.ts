import { describe, expect, it } from 'vitest';
import { goalProgress } from './goals';
import { makeAccount, makeGoal, makeTransaction } from './records';

const savings = makeAccount({ name: 'Savings', type: 'savings', initialBalanceCents: 100000 });

describe('goalProgress', () => {
  it('uses the planned contribution when there is no history', () => {
    const goal = makeGoal({
      name: 'Trip',
      targetCents: 400000,
      monthlyContributionCents: 50000,
      accountId: savings.id,
    });
    const p = goalProgress(goal, [savings], [], '2026-11-15');
    expect(p.currentCents).toBe(100000);
    expect(p.remainingCents).toBe(300000);
    expect(p.paceSource).toBe('plan');
    expect(p.etaMonth).toBe('2027-05');
  });

  it('projects from the recent pace of contributions', () => {
    const goal = makeGoal({
      name: 'Trip',
      targetCents: 400000,
      monthlyContributionCents: 10000,
      accountId: savings.id,
    });
    const txs = ['2026-08-05', '2026-09-05', '2026-10-05'].map((date) =>
      makeTransaction({
        type: 'transfer',
        amountCents: 100000,
        date,
        accountId: 'checking',
        toAccountId: savings.id,
      }),
    );
    const p = goalProgress(goal, [savings], txs, '2026-11-15');
    expect(p.currentCents).toBe(400000);
    expect(p.done).toBe(true);
    expect(p.etaMonth).toBe('2026-11');
  });

  it('says whether a target date is on track', () => {
    const goal = makeGoal({
      name: 'Laptop',
      targetCents: 600000,
      savedCents: 0,
      monthlyContributionCents: 100000,
      targetDate: '2027-03-01',
    });
    const p = goalProgress(goal, [], [], '2026-11-15');
    expect(p.requiredMonthlyCents).toBe(150000);
    expect(p.etaMonth).toBe('2027-05');
    expect(p.onTrack).toBe(false);
  });

  it('has no ETA without any pace', () => {
    const goal = makeGoal({ name: 'Someday', targetCents: 100000 });
    const p = goalProgress(goal, [], [], '2026-11-15');
    expect(p.etaMonth).toBeNull();
    expect(p.ratio).toBe(0);
  });
});
