import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { addMonthsToMonth, monthOf } from '@/domain/dates';
import { forecastBalance } from '@/domain/forecast';
import { formatMoney } from '@/domain/money';
import {
  categoryTotals,
  categoryTrend,
  monthlyTotals,
  sankeyGraph,
  SANKEY_DEFICIT,
  SANKEY_HUB,
  SANKEY_SAVINGS,
  SANKEY_UNCATEGORIZED,
} from '@/domain/reports';
import { Chart, type ChartTheme } from '@/features/charts/Chart';
import { useCategoryName, useFinance, useFormat } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Segmented, Select } from '@/ui/Field';
import { Money } from '@/ui/Money';
import { Badge, PageHeader, Panel, PanelHeader } from '@/ui/primitives';

type Range = '3' | '6' | '12';

export default function ReportsPage() {
  const { t } = useTranslation();
  const data = useFinance();
  const { money, month: formatMonth, date, locale, currency } = useFormat();
  const categoryName = useCategoryName();
  const privacy = useUi((s) => s.privacy);
  const location = useLocation();
  const [range, setRange] = useState<Range>('6');
  const to = monthOf(data.today);
  const from = addMonthsToMonth(to, -(Number(range) - 1));

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  const axisMoney = useCallback(
    (value: number) => (privacy ? '•••' : formatMoney(value, { locale, currency, compact: true })),
    [privacy, locale, currency],
  );
  const tipMoney = useCallback(
    (value: number) => (privacy ? '•••' : money(value)),
    [privacy, money],
  );

  const totals = useMemo(
    () => monthlyTotals(data.transactions, from, to),
    [data.transactions, from, to],
  );
  const graph = useMemo(
    () => sankeyGraph(data.transactions, data.categories, from, to),
    [data.transactions, data.categories, from, to],
  );
  const expenseCats = useMemo(
    () =>
      categoryTotals(data.transactions, data.categories, 'expense', from, to).filter(
        (c) => c.categoryId,
      ),
    [data.transactions, data.categories, from, to],
  );
  const [trendCat, setTrendCat] = useState<string>('');
  const trendCategory = trendCat || expenseCats[0]?.categoryId || '';
  const trend = useMemo(
    () =>
      trendCategory
        ? categoryTrend(data.transactions, data.categories, trendCategory, from, to)
        : [],
    [data.transactions, data.categories, trendCategory, from, to],
  );
  const forecast = useMemo(
    () =>
      forecastBalance({
        today: data.today,
        accounts: data.accounts,
        cards: data.cards,
        transactions: data.transactions,
        recurrences: data.recurrences,
        days: 90,
      }),
    [data.today, data.accounts, data.cards, data.transactions, data.recurrences],
  );

  const income = totals.reduce((s, m) => s + m.incomeCents, 0);
  const expense = totals.reduce((s, m) => s + m.expenseCents, 0);
  const savingsRate = income > 0 ? (income - expense) / income : null;
  const monthLabel = (m: string) => formatMonth(m, { month: 'short' });

  const nodeLabel = useCallback(
    (id: string) => {
      if (id === SANKEY_HUB) return t('reports.sankey.hub');
      if (id === SANKEY_SAVINGS) return t('reports.sankey.savings');
      if (id === SANKEY_DEFICIT) return t('reports.sankey.deficit');
      const catId = id.slice(id.indexOf(':') + 1);
      return catId === SANKEY_UNCATEGORIZED
        ? t('categories.uncategorized')
        : categoryName(data.categoryById.get(catId));
    },
    [t, categoryName, data.categoryById],
  );

  const sankeyOption = useCallback(
    (theme: ChartTheme) => ({
      tooltip: { trigger: 'item', valueFormatter: (v: unknown) => tipMoney(Number(v)) },
      series: [
        {
          type: 'sankey',
          left: 8,
          right: 120,
          top: 8,
          bottom: 8,
          nodeGap: 10,
          nodeWidth: 12,
          draggable: false,
          emphasis: { focus: 'adjacency' },
          label: {
            color: theme.text,
            fontSize: 12,
            formatter: (p: { name: string }) => nodeLabel(p.name),
          },
          lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
          data: graph.nodes.map((n) => {
            const catId = n.id.slice(n.id.indexOf(':') + 1);
            const cat = data.categoryById.get(catId);
            const color =
              n.kind === 'hub'
                ? theme.accent
                : n.kind === 'savings'
                  ? theme.positive
                  : n.kind === 'deficit'
                    ? theme.negative
                    : (cat?.color ?? theme.faint);
            return { name: n.id, itemStyle: { color, borderWidth: 0 } };
          }),
          links: graph.links.map((l) => ({ source: l.source, target: l.target, value: l.cents })),
        },
      ],
    }),
    [graph, nodeLabel, tipMoney, data.categoryById],
  );

  const barsOption = useCallback(
    (theme: ChartTheme) => ({
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: theme.muted }, icon: 'roundRect' },
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => tipMoney(Number(v)) },
      xAxis: {
        type: 'category',
        data: totals.map((m) => monthLabel(m.month)),
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.muted },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
        axisLabel: { color: theme.muted, formatter: axisMoney },
      },
      series: [
        {
          name: t('reports.income'),
          type: 'bar',
          data: totals.map((m) => m.incomeCents),
          itemStyle: { color: theme.series[1], borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 28,
        },
        {
          name: t('reports.expenses'),
          type: 'bar',
          data: totals.map((m) => m.expenseCents),
          itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 28,
        },
        {
          name: t('reports.net'),
          type: 'line',
          data: totals.map((m) => m.netCents),
          symbolSize: 6,
          lineStyle: { color: theme.text, width: 1.5 },
          itemStyle: { color: theme.text },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totals, tipMoney, axisMoney, t],
  );

  const trendOption = useCallback(
    (theme: ChartTheme) => ({
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => tipMoney(Number(v)) },
      xAxis: {
        type: 'category',
        data: trend.map((m) => monthLabel(m.month)),
        axisLabel: { color: theme.muted },
        axisLine: { lineStyle: { color: theme.border } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.muted, formatter: axisMoney },
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: trend.map((m) => m.cents),
          lineStyle: {
            color: data.categoryById.get(trendCategory)?.color ?? theme.accent,
            width: 2,
          },
          itemStyle: { color: data.categoryById.get(trendCategory)?.color ?? theme.accent },
          areaStyle: { opacity: 0.12 },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trend, trendCategory, tipMoney, axisMoney, data.categoryById],
  );

  const savingsOption = useCallback(
    (theme: ChartTheme) => ({
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: unknown) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`),
      },
      xAxis: {
        type: 'category',
        data: totals.map((m) => monthLabel(m.month)),
        axisLabel: { color: theme.muted },
        axisLine: { lineStyle: { color: theme.border } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.muted, formatter: (v: number) => `${Math.round(v * 100)}%` },
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
      },
      series: [
        {
          type: 'bar',
          data: totals.map((m) => ({
            value: m.savingsRate,
            itemStyle: {
              color: (m.savingsRate ?? 0) < 0 ? theme.negative : theme.positive,
              borderRadius: 4,
            },
          })),
          barMaxWidth: 24,
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0 }],
            lineStyle: { color: theme.faint },
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totals],
  );

  const forecastOption = useCallback(
    (theme: ChartTheme) => ({
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: unknown) => tipMoney(Number(v)),
      },
      xAxis: {
        type: 'category',
        data: forecast.days.map((d) => date(d.date, { day: '2-digit', month: 'short' })),
        axisLabel: { color: theme.muted, interval: 14 },
        axisLine: { lineStyle: { color: theme.border } },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.muted, formatter: axisMoney },
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
      },
      // Below zero is drawn in the negative color *and* marked with a dashed zero line.
      visualMap: {
        show: false,
        dimension: 1,
        pieces: [
          { lt: 0, color: theme.negative },
          { gte: 0, color: theme.accent },
        ],
      },
      series: [
        {
          type: 'line',
          name: t('reports.balance'),
          data: forecast.days.map((d) => d.balanceCents),
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.1 },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0 }],
            lineStyle: { color: theme.negative, type: 'dashed' },
            label: { show: false },
          },
        },
      ],
    }),
    [forecast, tipMoney, axisMoney, date, t],
  );

  const hasData = income > 0 || expense > 0;

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        actions={
          <Segmented
            label={t('reports.range')}
            value={range}
            onChange={setRange}
            options={[
              { value: '3', label: t('reports.months', { count: 3 }) },
              { value: '6', label: t('reports.months', { count: 6 }) },
              { value: '12', label: t('reports.months', { count: 12 }) },
            ]}
          />
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label={t('reports.income')}>
          <Money cents={income} tone="income" icon />
        </Stat>
        <Stat label={t('reports.expenses')}>
          <Money cents={expense} tone="expense" icon />
        </Stat>
        <Stat label={t('reports.savingsRate')}>
          {savingsRate === null ? (
            '—'
          ) : (
            <span
              className={savingsRate < 0 ? 'text-negative' : ''}
            >{`${savingsRate < 0 ? '−' : ''}${Math.abs(Math.round(savingsRate * 100))}%`}</span>
          )}
        </Stat>
      </div>

      {!hasData ? (
        <Panel>
          <EmptyState
            art="chart"
            title={t('reports.empty.title')}
            description={t('reports.empty.body')}
          />
        </Panel>
      ) : (
        <div className="grid gap-4">
          <Panel aria-labelledby="sankey-title">
            <PanelHeader id="sankey-title" title={t('reports.sankey.title')} />
            <div className="px-3 pb-4">
              <Chart
                build={sankeyOption}
                label={t('reports.sankey.label')}
                height={Math.max(300, graph.nodes.length * 28)}
              />
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel aria-labelledby="mom-title">
              <PanelHeader id="mom-title" title={t('reports.monthOverMonth')} />
              <div className="px-3 pb-4">
                <Chart build={barsOption} label={t('reports.monthOverMonth')} height={280} />
              </div>
              <DataTable
                caption={t('reports.monthOverMonth')}
                head={[
                  t('reports.month'),
                  t('reports.income'),
                  t('reports.expenses'),
                  t('reports.net'),
                ]}
                rows={totals.map((m) => [
                  formatMonth(m.month),
                  tipMoney(m.incomeCents),
                  tipMoney(m.expenseCents),
                  tipMoney(m.netCents),
                ])}
              />
            </Panel>
            <Panel aria-labelledby="savings-title">
              <PanelHeader id="savings-title" title={t('reports.savingsRateTitle')} />
              <div className="px-3 pb-4">
                <Chart build={savingsOption} label={t('reports.savingsRateTitle')} height={280} />
              </div>
            </Panel>
          </div>

          <Panel aria-labelledby="trend-title">
            <PanelHeader
              id="trend-title"
              title={t('reports.trend')}
              action={
                <Field
                  label={<span className="sr-only">{t('transactions.category')}</span>}
                  className="w-48"
                >
                  <Select value={trendCategory} onChange={(e) => setTrendCat(e.target.value)}>
                    {expenseCats.map((c) => (
                      <option key={c.categoryId} value={c.categoryId!}>
                        {categoryName(data.categoryById.get(c.categoryId!))}
                      </option>
                    ))}
                  </Select>
                </Field>
              }
            />
            <div className="px-3 pb-4">
              <Chart build={trendOption} label={t('reports.trend')} height={240} />
            </div>
          </Panel>
        </div>
      )}

      <Panel id="forecast" className="mt-4 scroll-mt-20" aria-labelledby="forecast-title">
        <PanelHeader
          id="forecast-title"
          title={t('reports.forecastTitle')}
          action={
            forecast.firstNegativeDate ? (
              <Badge tone="negative">
                <AlertTriangle className="size-3" aria-hidden />
                {t('overview.negativeOn', {
                  date: date(forecast.firstNegativeDate, { day: '2-digit', month: 'short' }),
                })}
              </Badge>
            ) : undefined
          }
        />
        <div className="px-3 pb-2">
          <Chart build={forecastOption} label={t('overview.forecastLabel')} height={280} />
        </div>
        <div className="tnum text-muted flex flex-wrap gap-x-6 gap-y-1 px-5 pb-5 text-sm">
          <span>
            {t('reports.today')}{' '}
            <Money cents={forecast.startBalanceCents} className="text-text font-medium" />
          </span>
          <span>
            {t('overview.in90days')}{' '}
            <Money cents={forecast.endBalanceCents} className="text-text font-medium" />
          </span>
          <span>
            {t('overview.lowest')}{' '}
            <Money cents={forecast.minBalanceCents} className="text-text font-medium" />
          </span>
        </div>
      </Panel>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <p className="text-muted text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="tnum font-display mt-1 text-2xl font-medium">{children}</p>
    </Panel>
  );
}

/** Numbers behind a chart, for screen readers and anyone who prefers a table. */
function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="border-border border-t px-5 py-3 text-sm">
      <summary className="text-muted cursor-pointer">{caption}</summary>
      <table className="tnum mt-2 w-full text-left">
        <thead>
          <tr className="text-muted text-xs">
            {head.map((h) => (
              <th key={h} scope="col" className="py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-border border-t">
              {r.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-1.5 font-normal capitalize">
                    {c}
                  </th>
                ) : (
                  <td key={i}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
