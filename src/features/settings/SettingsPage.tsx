import { CreditCard, Landmark, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { softDelete } from '@/db/repo';
import { saveSetting } from '@/features/data/actions';
import { DEFAULT_CURRENCY, useCategoryName, useFinance, useSetting } from '@/features/data/hooks';
import { SyncSection } from '@/features/sync/SyncSection';
import { LANGUAGES, normalizeLanguage } from '@/i18n';
import { useUi, type ThemePreference } from '@/stores/ui';
import { Field, Segmented, Select } from '@/ui/Field';
import { buttonClasses, IconButton, PageHeader, Panel } from '@/ui/primitives';
import { CategoryManager } from './CategoryManager';
import { DataSection } from './DataSection';

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP', 'MXN', 'CAD', 'AUD', 'JPY', 'CHF'];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Panel id={id} className="scroll-mt-20 p-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-xl font-medium">
        {title}
      </h2>
      {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const currency = useSetting('currency', DEFAULT_CURRENCY);
  const { theme, setTheme } = useUi();
  const { rules, categoryById } = useFinance();
  const categoryName = useCategoryName();

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-4">
        <Section id="preferences" title={t('settings.preferences')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.language')}>
              <Select
                value={normalizeLanguage(i18n.resolvedLanguage)}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} lang={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('settings.currency')} hint={t('settings.currencyHint')}>
              <Select
                value={currency}
                onChange={(e) => void saveSetting('currency', e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Segmented<ThemePreference>
              className="sm:col-span-2"
              label={t('settings.theme')}
              value={theme}
              onChange={setTheme}
              options={[
                {
                  value: 'system',
                  label: t('theme.system'),
                  icon: <Monitor className="size-4" aria-hidden />,
                },
                {
                  value: 'light',
                  label: t('theme.light'),
                  icon: <Sun className="size-4" aria-hidden />,
                },
                {
                  value: 'dark',
                  label: t('theme.dark'),
                  icon: <Moon className="size-4" aria-hidden />,
                },
              ]}
            />
          </div>
        </Section>

        <Section id="accounts" title={t('settings.accountsAndCards')}>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/accounts" className={buttonClasses('secondary')}>
              <Landmark className="size-4" aria-hidden />
              {t('nav.accounts')}
            </Link>
            <Link to="/app/cards" className={buttonClasses('secondary')}>
              <CreditCard className="size-4" aria-hidden />
              {t('nav.cards')}
            </Link>
          </div>
        </Section>

        <Section id="categories" title={t('settings.categories.title')}>
          <CategoryManager />
        </Section>

        <Section
          id="rules"
          title={t('settings.rules.title')}
          description={t('settings.rules.description')}
        >
          {rules.length === 0 ? (
            <p className="text-muted text-sm">{t('settings.rules.empty')}</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-xl border">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <code className="bg-surface-2 min-w-0 flex-1 truncate rounded px-1.5 py-0.5">
                    {r.pattern}
                  </code>
                  <span aria-hidden>{'→'}</span>
                  <span className="truncate">{categoryName(categoryById.get(r.categoryId))}</span>
                  <IconButton
                    size="sm"
                    label={t('settings.rules.delete', { pattern: r.pattern })}
                    onClick={async () => {
                      await softDelete('rules', [r.id]);
                      toast.success(t('settings.rules.deleted'));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="sync" title={t('settings.sync')} description={t('settings.syncDescription')}>
          <SyncSection />
        </Section>

        <Section
          id="data"
          title={t('settings.data.title')}
          description={t('settings.data.description')}
        >
          <DataSection />
        </Section>
      </div>
    </>
  );
}
