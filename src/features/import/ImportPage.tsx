import { CheckCircle2, Copy, FileUp, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { insert } from '@/db/repo';
import { uuidv7 } from '@/domain/ids';
import type { ColumnMapping, DateFormat, Delimiter, NumberFormat } from '@/domain/import/csv';
import type { PreviewRow } from '@/domain/import/dedupe';
import type { ImportedRow } from '@/domain/import/types';
import { learnRule } from '@/domain/rules';
import type { Rule } from '@/domain/types';
import { useFinance, useFormat } from '@/features/data/hooks';
import { parseSource } from '@/features/transactions/form';
import { CategoryOptions, SourceOptions } from '@/features/transactions/options';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Select, Switch } from '@/ui/Field';
import { Money } from '@/ui/Money';
import { Badge, Button, PageHeader, Panel } from '@/ui/primitives';

// Statement parsers are only downloaded when someone actually imports a file.
const loadParsers = () =>
  Promise.all([
    import('@/domain/import/ofx'),
    import('@/domain/import/csv'),
    import('@/domain/import/dedupe'),
  ]);

interface CsvState {
  table: string[][];
  delimiter: Delimiter;
  mapping: ColumnMapping;
  skipHeader: boolean;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  invert: boolean;
}

type Step =
  { kind: 'pick' } | { kind: 'map'; csv: CsvState } | { kind: 'preview'; rows: PreviewRow[] };

export default function ImportPage() {
  const { t } = useTranslation();
  const data = useFinance();
  const { date } = useFormat();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState(() =>
    data.accounts[0] ? `account:${data.accounts[0].id}` : '',
  );
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);

  const toPreview = async (rows: ImportedRow[]) => {
    const [, , dedupe] = await loadParsers();
    const preview = dedupe.buildPreview(rows, data.transactions, parseSource(target), data.rules);
    if (preview.length === 0) toast.error(t('import.noRows'));
    else setStep({ kind: 'preview', rows: preview.map((r) => ({ ...r })) });
  };

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error(t('import.tooLarge'));
    setFileName(file.name);
    setBusy(true);
    try {
      const [ofx, csv] = await loadParsers();
      const text = ofx.decodeStatement(await file.arrayBuffer());
      if (ofx.looksLikeOfx(text)) {
        await toPreview(ofx.parseOfx(text).rows);
        return;
      }
      const delimiter = csv.detectDelimiter(text);
      const table = csv.parseCsv(text, delimiter);
      if (table.length === 0) return toast.error(t('import.noRows'));
      const skipHeader = csv.hasHeaderRow(table);
      const mapping = skipHeader
        ? csv.detectColumns(table[0]!)
        : { date: 0, description: 1, amount: 2, debit: null, credit: null };
      const body = table.slice(skipHeader ? 1 : 0, 30);
      setStep({
        kind: 'map',
        csv: {
          table,
          delimiter,
          mapping,
          skipHeader,
          dateFormat: csv.detectDateFormat(body.map((r) => r[mapping.date] ?? '')),
          numberFormat: csv.detectNumberFormat(
            body.flatMap((r) =>
              [mapping.amount, mapping.debit, mapping.credit]
                .filter((i): i is number => i !== null)
                .map((i) => r[i] ?? ''),
            ),
          ),
          invert: false,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (rows: PreviewRow[]) => {
    const [, , dedupe] = await loadParsers();
    const chosen = rows.filter((r) => !r.duplicate);
    const importId = uuidv7();
    await insert(
      'transactions',
      dedupe.previewToTransactions(chosen, parseSource(target), importId),
    );
    // Every category the user corrected becomes (or updates) a rule for next time.
    const rules: Rule[] = [...data.rules];
    const learned: Rule[] = [];
    for (const r of chosen) {
      if (!r.categoryId || r.categoryId === r.suggestedCategoryId) continue;
      const rule = learnRule([...rules, ...learned], r.description, r.categoryId);
      if (rule) {
        const i = learned.findIndex((x) => x.id === rule.id);
        if (i >= 0) learned[i] = rule;
        else learned.push(rule);
      }
    }
    if (learned.length) await insert('rules', learned);
    toast.success(t('import.done', { count: chosen.length }));
    if (learned.length) toast.message(t('import.learned', { count: learned.length }));
    navigate('/app/transactions');
  };

  return (
    <>
      <PageHeader title={t('import.title')} subtitle={t('import.subtitle')} />
      {data.accounts.length === 0 && data.cards.length === 0 ? (
        <Panel>
          <EmptyState art="inbox" title={t('transactions.needAccount')} />
        </Panel>
      ) : step.kind === 'pick' ? (
        <Panel className="p-5">
          <div className="grid gap-4 sm:max-w-md">
            <Field label={t('import.target')} hint={t('import.targetHint')}>
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <SourceOptions />
              </Select>
            </Field>
          </div>
          <button
            type="button"
            disabled={busy || !target}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void onFile(file);
            }}
            className="border-border-strong hover:border-accent hover:bg-accent-soft/40 mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors"
          >
            <FileUp className="text-accent size-8" aria-hidden />
            <span className="font-medium">{t('import.drop')}</span>
            <span className="text-muted text-sm">{t('import.formats')}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }}
          />
          <p className="text-muted mt-4 text-xs">{t('import.privacy')}</p>
        </Panel>
      ) : step.kind === 'map' ? (
        <CsvMapper
          csv={step.csv}
          fileName={fileName}
          onBack={() => setStep({ kind: 'pick' })}
          onChange={(csv) => setStep({ kind: 'map', csv })}
          onNext={async (rows) => toPreview(rows)}
        />
      ) : (
        <Preview
          rows={step.rows}
          fileName={fileName}
          date={date}
          onChange={(rows) => setStep({ kind: 'preview', rows })}
          onBack={() => setStep({ kind: 'pick' })}
          onConfirm={(rows) => void confirm(rows)}
        />
      )}
    </>
  );
}

function CsvMapper({
  csv,
  fileName,
  onChange,
  onBack,
  onNext,
}: {
  csv: CsvState;
  fileName: string;
  onChange: (csv: CsvState) => void;
  onBack: () => void;
  onNext: (rows: ImportedRow[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const header = csv.skipHeader
    ? csv.table[0]!
    : csv.table[0]!.map((_, i) => t('import.column', { n: i + 1 }));
  const columns = header.map((h, i) => ({
    value: i,
    label: h || t('import.column', { n: i + 1 }),
  }));
  const sample = csv.table.slice(csv.skipHeader ? 1 : 0, csv.skipHeader ? 6 : 5);
  const mode = csv.mapping.amount !== null ? 'single' : 'split';
  const setMapping = (patch: Partial<ColumnMapping>) =>
    onChange({ ...csv, mapping: { ...csv.mapping, ...patch } });
  const colSelect = (
    label: string,
    value: number | null,
    set: (v: number | null) => void,
    optional = false,
  ) => (
    <Field label={label}>
      <Select
        value={value ?? ''}
        onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
      >
        {optional && <option value="">{t('common.none')}</option>}
        {columns.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <Panel className="p-5">
      <h2 className="font-display text-xl font-medium">{t('import.mapTitle')}</h2>
      <p className="text-muted mt-1 text-sm">{t('import.mapBody', { file: fileName })}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {colSelect(t('transactions.date'), csv.mapping.date, (v) => setMapping({ date: v ?? 0 }))}
        {colSelect(t('transactions.description'), csv.mapping.description, (v) =>
          setMapping({ description: v ?? 0 }),
        )}
        <Field label={t('import.amountMode')}>
          <Select
            value={mode}
            onChange={(e) =>
              setMapping(
                e.target.value === 'single'
                  ? { amount: csv.mapping.debit ?? 2, debit: null, credit: null }
                  : {
                      amount: null,
                      debit: csv.mapping.amount ?? 2,
                      credit: (csv.mapping.amount ?? 2) + 1,
                    },
              )
            }
          >
            <option value="single">{t('import.singleColumn')}</option>
            <option value="split">{t('import.splitColumns')}</option>
          </Select>
        </Field>
        {mode === 'single' ? (
          colSelect(t('transactions.amount'), csv.mapping.amount, (v) =>
            setMapping({ amount: v ?? 0 }),
          )
        ) : (
          <>
            {colSelect(t('import.debit'), csv.mapping.debit, (v) => setMapping({ debit: v }), true)}
            {colSelect(
              t('import.credit'),
              csv.mapping.credit,
              (v) => setMapping({ credit: v }),
              true,
            )}
          </>
        )}
        <Field label={t('import.dateFormat')}>
          <Select
            value={csv.dateFormat}
            onChange={(e) => onChange({ ...csv, dateFormat: e.target.value as DateFormat })}
          >
            <option value="dmy">{'DD/MM/YYYY'}</option>
            <option value="mdy">{'MM/DD/YYYY'}</option>
            <option value="ymd">{'YYYY-MM-DD'}</option>
          </Select>
        </Field>
        <Field label={t('import.numberFormat')}>
          <Select
            value={csv.numberFormat}
            onChange={(e) => onChange({ ...csv, numberFormat: e.target.value as NumberFormat })}
          >
            <option value="br">{'1.234,56'}</option>
            <option value="us">{'1,234.56'}</option>
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 sm:max-w-md">
        <Switch
          checked={csv.skipHeader}
          onChange={(v) => onChange({ ...csv, skipHeader: v })}
          label={t('import.hasHeader')}
        />
        <Switch
          checked={csv.invert}
          onChange={(v) => onChange({ ...csv, invert: v })}
          label={t('import.invert')}
          description={t('import.invertHint')}
        />
      </div>
      <div className="border-border mt-5 overflow-x-auto rounded-xl border">
        <table className="tnum w-full text-left text-xs">
          <caption className="sr-only">{t('import.sample')}</caption>
          <thead className="bg-surface-2 text-muted">
            <tr>
              {header.map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((row, ri) => (
              <tr key={ri} className="border-border border-t">
                {row.map((cell, ci) => (
                  <td key={ci} className="max-w-48 truncate px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onBack}>{t('common.back')}</Button>
        <Button
          variant="primary"
          onClick={async () => {
            const { csvToRows } = await import('@/domain/import/csv');
            const result = csvToRows(csv.table, csv);
            if (result.skipped.length)
              toast.message(t('import.skipped', { count: result.skipped.length }));
            await onNext(result.rows);
          }}
        >
          {t('import.next')}
        </Button>
      </div>
    </Panel>
  );
}

function Preview({
  rows,
  fileName,
  date,
  onChange,
  onBack,
  onConfirm,
}: {
  rows: PreviewRow[];
  fileName: string;
  date: ReturnType<typeof useFormat>['date'];
  onChange: (rows: PreviewRow[]) => void;
  onBack: () => void;
  onConfirm: (rows: PreviewRow[]) => void;
}) {
  const { t } = useTranslation();
  const counts = useMemo(
    () => ({ total: rows.length, duplicates: rows.filter((r) => r.duplicate).length }),
    [rows],
  );
  const update = (i: number, patch: Partial<PreviewRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Panel>
      <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-medium">{t('import.previewTitle')}</h2>
          <p className="text-muted text-sm">
            {t('import.previewBody', { file: fileName, count: counts.total - counts.duplicates })}
            {counts.duplicates > 0 &&
              ` ${t('import.duplicatesFound', { count: counts.duplicates })}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onBack}>{t('common.back')}</Button>
          <Button
            variant="primary"
            icon={<Upload className="size-4" />}
            disabled={counts.total === counts.duplicates}
            onClick={() => onConfirm(rows)}
          >
            {t('import.confirm', { count: counts.total - counts.duplicates })}
          </Button>
        </div>
      </header>
      <ul className="divide-border divide-y">
        {rows.map((r, i) => (
          <li
            key={i}
            className={`grid items-center gap-3 px-5 py-3 sm:grid-cols-[auto_1fr_200px_auto] ${r.duplicate ? 'opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={!r.duplicate}
              onChange={(e) => update(i, { duplicate: !e.target.checked })}
              aria-label={t('import.include', { name: r.description })}
              className="size-4 accent-[var(--c-accent)]"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.description || '—'}</p>
              <p className="text-muted flex items-center gap-2 text-xs">
                {date(r.date)}
                {r.duplicate && (
                  <Badge tone="warning">
                    <Copy className="size-3" aria-hidden />
                    {t('import.duplicate')}
                  </Badge>
                )}
                {r.suggestedCategoryId && r.categoryId === r.suggestedCategoryId && (
                  <Badge>
                    <CheckCircle2 className="size-3" aria-hidden />
                    {t('quickEntry.learned')}
                  </Badge>
                )}
              </p>
            </div>
            <Select
              value={r.categoryId ?? ''}
              onChange={(e) => update(i, { categoryId: e.target.value || null })}
              aria-label={t('import.categoryFor', { name: r.description })}
              className="h-9"
            >
              <option value="">{t('categories.uncategorized')}</option>
              <CategoryOptions kind={r.amountCents < 0 ? 'expense' : 'income'} />
            </Select>
            <Money cents={r.amountCents} tone="signed" className="text-right text-sm font-medium" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
