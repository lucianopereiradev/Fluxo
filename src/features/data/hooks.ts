import { useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMonth, type LocalDate, type YearMonth } from '@/domain/dates';
import { formatMoney, type Cents, type FormatMoneyOptions } from '@/domain/money';
import type { Category } from '@/domain/types';
import { normalizeLanguage } from '@/i18n';
import { FinanceContext } from './FinanceProvider';

export function useFinance() {
  return useContext(FinanceContext);
}

export const DEFAULT_CURRENCY = 'BRL';

export function useSetting<T>(key: string, fallback: T): T {
  const { settings } = useFinance();
  return (settings.has(key) ? settings.get(key) : fallback) as T;
}

export function useLocale(): string {
  const { i18n } = useTranslation();
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** Formatting bound to the chosen language and currency. */
export function useFormat() {
  const locale = useLocale();
  const currency = useSetting('currency', DEFAULT_CURRENCY);
  const money = useCallback(
    (cents: Cents, options: Omit<FormatMoneyOptions, 'locale' | 'currency'> = {}) =>
      formatMoney(cents, { ...options, locale, currency }),
    [locale, currency],
  );
  const date = useCallback(
    (d: LocalDate, options?: Intl.DateTimeFormatOptions) => formatDate(d, locale, options),
    [locale],
  );
  const month = useCallback(
    (ym: YearMonth, options?: Intl.DateTimeFormatOptions) => formatMonth(ym, locale, options),
    [locale],
  );
  return useMemo(
    () => ({ money, date, month, locale, currency }),
    [money, date, month, locale, currency],
  );
}

export function useCategoryName() {
  const { t } = useTranslation();
  return useCallback(
    (category: Pick<Category, 'name' | 'systemKey'> | undefined | null) => {
      if (!category) return t('categories.uncategorized');
      if (category.name) return category.name;
      return category.systemKey ? t(`categories.system.${category.systemKey}`) : '';
    },
    [t],
  );
}
