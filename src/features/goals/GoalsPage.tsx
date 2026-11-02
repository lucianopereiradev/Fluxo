import { CalendarCheck, CheckCircle2, Clock, Pencil, PiggyBank, Plus, Target } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { goalProgress, type GoalProgress } from '@/domain/goals';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { makeGoal } from '@/domain/records';
import type { Goal } from '@/domain/types';
import { useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { ColorPicker, SWATCHES } from '@/ui/ColorPicker';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Input, Select } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Money } from '@/ui/Money';
import { Badge, Button, IconButton, PageHeader, Panel, ProgressBar } from '@/ui/primitives';

export default function GoalsPage() {
  const { t } = useTranslation();
  const { goals, accounts, transactions, today } = useFinance();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const openEditor = useUi((s) => s.openEditor);

  const progress = useMemo(
    () => goals.map((g) => goalProgress(g, accounts, transactions, today)),
    [goals, accounts, transactions, today],
  );

  return (
    <>
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing('new')}
          >
            {t('goals.add')}
          </Button>
        }
      />
      {progress.length === 0 ? (
        <Panel>
          <EmptyState
            art="target"
            title={t('goals.empty.title')}
            description={t('goals.empty.body')}
            action={
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setEditing('new')}
              >
                {t('goals.add')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {progress.map((p) => (
            <GoalCard
              key={p.goal.id}
              progress={p}
              onEdit={() => setEditing(p.goal)}
              onContribute={() =>
                p.goal.accountId ? openEditor(undefined, 'transfer') : setContributing(p.goal)
              }
            />
          ))}
        </ul>
      )}
      {editing && (
        <GoalEditor
          goal={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {contributing && (
        <ContributeDialog goal={contributing} onClose={() => setContributing(null)} />
      )}
    </>
  );
}

function GoalCard({
  progress: p,
  onEdit,
  onContribute,
}: {
  progress: GoalProgress;
  onEdit: () => void;
  onContribute: () => void;
}) {
  const { t } = useTranslation();
  const { month, date } = useFormat();
  const { accountById } = useFinance();
  const account = p.goal.accountId ? accountById.get(p.goal.accountId) : undefined;
  return (
    <Panel as="li" className="animate-rise relative overflow-hidden p-5">
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: p.goal.color }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-xl"
            style={{
              background: `color-mix(in oklab, ${p.goal.color} 16%, transparent)`,
              color: p.goal.color,
            }}
          >
            <Target className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-medium">{p.goal.name}</h2>
            <p className="text-muted text-xs">
              {account ? t('goals.linkedTo', { account: account.name }) : t('goals.manual')}
            </p>
          </div>
        </div>
        <IconButton size="sm" label={t('goals.editNamed', { name: p.goal.name })} onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      </div>

      <p className="font-display mt-4 text-3xl font-medium">
        <Money cents={p.currentCents} />
        <span className="text-muted ml-2 font-sans text-sm font-normal">
          {t('budgets.of')} <Money cents={p.goal.targetCents} />
        </span>
      </p>
      <ProgressBar
        className="mt-3"
        value={p.ratio}
        max={1}
        tone={p.done ? 'positive' : 'accent'}
        label={t('goals.progressLabel', { name: p.goal.name })}
      />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted text-xs">{t('goals.monthly')}</dt>
          <dd>
            <Money cents={p.goal.monthlyContributionCents} />
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">{t('goals.eta')}</dt>
          <dd className="flex items-center gap-1.5">
            {p.done ? (
              <>
                <CheckCircle2 className="text-positive size-4" aria-hidden />
                {t('goals.reached')}
              </>
            ) : p.etaMonth ? (
              <>
                <Clock className="text-muted size-4" aria-hidden />
                <span className="cap-first">
                  {month(p.etaMonth, { month: 'short', year: 'numeric' })}
                </span>
              </>
            ) : (
              <span className="text-muted">{t('goals.noPace')}</span>
            )}
          </dd>
        </div>
        {p.goal.targetDate && (
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            <CalendarCheck className="text-muted size-4" aria-hidden />
            <span>{t('goals.targetDate', { date: date(p.goal.targetDate) })}</span>
            {p.onTrack !== null &&
              (p.onTrack ? (
                <Badge tone="positive">{t('goals.onTrack')}</Badge>
              ) : (
                <Badge tone="warning">
                  {t('goals.needPerMonth')} <Money cents={p.requiredMonthlyCents ?? 0} />
                </Badge>
              ))}
          </div>
        )}
      </dl>
      <p className="text-faint mt-3 text-xs">
        {p.paceSource === 'history'
          ? t('goals.paceHistory')
          : p.paceSource === 'plan'
            ? t('goals.pacePlan')
            : ''}
      </p>
      {!p.done && (
        <Button
          className="mt-4 w-full"
          icon={<PiggyBank className="size-4" />}
          onClick={onContribute}
        >
          {t('goals.contribute')}
        </Button>
      )}
    </Panel>
  );
}

function GoalEditor({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { accounts } = useFinance();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? formatAmountInput(goal.targetCents, locale) : '');
  const [monthly, setMonthly] = useState(
    goal ? formatAmountInput(goal.monthlyContributionCents, locale) : '',
  );
  const [saved, setSaved] = useState(goal ? formatAmountInput(goal.savedCents, locale) : '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [accountId, setAccountId] = useState(goal?.accountId ?? '');
  const [color, setColor] = useState(goal?.color ?? SWATCHES[4]!);
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const targetCents = parseMoney(target);
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (!targetCents || targetCents <= 0) next.target = t('transactions.errors.amount');
    setErrors(next);
    if (Object.keys(next).length) return;
    const fields = {
      name: name.trim(),
      targetCents: targetCents!,
      monthlyContributionCents: Math.max(0, parseMoney(monthly) ?? 0),
      savedCents: Math.max(0, parseMoney(saved) ?? 0),
      targetDate: targetDate || null,
      accountId: accountId || null,
      color,
    };
    if (goal) await update('goals', goal.id, fields);
    else await insert('goals', makeGoal(fields));
    toast.success(t('goals.saved'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? t('goals.edit') : t('goals.add')}
      footer={
        <>
          {goal && (
            <Button
              variant="ghost"
              className="text-negative mr-auto"
              onClick={async () => {
                await softDelete('goals', [goal.id]);
                toast.success(t('goals.deleted'));
                onClose();
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="goal-form">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="goal-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('goals.name')} error={errors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={t('goals.namePlaceholder')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('goals.target')} error={errors.target}>
            <Input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label={t('goals.targetDateLabel')}>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t('goals.monthly')} hint={t('goals.monthlyHint')}>
          <Input
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="tnum"
          />
        </Field>
        <Field label={t('goals.account')} hint={t('goals.accountHint')}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t('goals.noAccount')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        {!accountId && (
          <Field label={t('goals.saved')}>
            <Input
              inputMode="decimal"
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
              className="tnum"
            />
          </Field>
        )}
        <ColorPicker label={t('common.color')} value={color} onChange={setColor} />
      </form>
    </Modal>
  );
}

function ContributeDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [amount, setAmount] = useState(formatAmountInput(goal.monthlyContributionCents, locale));
  const [error, setError] = useState<string>();
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={t('goals.contributeTo', { name: goal.name })}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="contribute-form">
            {t('goals.contribute')}
          </Button>
        </>
      }
    >
      <form
        id="contribute-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const cents = parseMoney(amount);
          if (!cents || cents <= 0) return setError(t('transactions.errors.amount'));
          await update('goals', goal.id, { savedCents: goal.savedCents + cents });
          toast.success(t('goals.contributed'));
          onClose();
        }}
      >
        <Field label={t('transactions.amount')} error={error}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum text-lg"
          />
        </Field>
      </form>
    </Modal>
  );
}
