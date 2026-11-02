import { makeCategory } from './records';
import type { Category, CategoryKind } from './types';

/** Built-in categories. Names come from translations through `systemKey`. */
export const DEFAULT_CATEGORIES: readonly {
  key: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}[] = [
  { key: 'salary', kind: 'income', color: '#4f7a5a', icon: 'briefcase' },
  { key: 'freelance', kind: 'income', color: '#6b8f5e', icon: 'laptop' },
  { key: 'investmentIncome', kind: 'income', color: '#3f6e6a', icon: 'trending-up' },
  { key: 'otherIncome', kind: 'income', color: '#7d9a7a', icon: 'plus-circle' },
  { key: 'housing', kind: 'expense', color: '#b4532a', icon: 'home' },
  { key: 'food', kind: 'expense', color: '#c9822b', icon: 'utensils' },
  { key: 'groceries', kind: 'expense', color: '#a8762e', icon: 'shopping-basket' },
  { key: 'transport', kind: 'expense', color: '#6d6a8f', icon: 'car' },
  { key: 'health', kind: 'expense', color: '#a04a5a', icon: 'heart-pulse' },
  { key: 'education', kind: 'expense', color: '#4d6f8c', icon: 'graduation-cap' },
  { key: 'leisure', kind: 'expense', color: '#8a5a8c', icon: 'party-popper' },
  { key: 'shopping', kind: 'expense', color: '#b0693f', icon: 'shopping-bag' },
  { key: 'subscriptions', kind: 'expense', color: '#5a6f8a', icon: 'repeat' },
  { key: 'bills', kind: 'expense', color: '#7f6a4d', icon: 'receipt' },
  { key: 'travel', kind: 'expense', color: '#3f7f8a', icon: 'plane' },
  { key: 'pets', kind: 'expense', color: '#8f7a4a', icon: 'paw-print' },
  { key: 'personalCare', kind: 'expense', color: '#9a6a7a', icon: 'sparkles' },
  { key: 'taxes', kind: 'expense', color: '#6a6a6a', icon: 'landmark' },
  { key: 'otherExpense', kind: 'expense', color: '#8a8173', icon: 'circle-dashed' },
];

/**
 * Built-in categories get fixed UUIDs (v7 layout with a zero timestamp) so seeding is
 * idempotent and two devices that seed independently merge into the same records.
 */
export function systemCategoryId(index: number): string {
  return `00000000-0000-7000-8000-${String(index + 1).padStart(12, '0')}`;
}

export function createDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) =>
    makeCategory({
      id: systemCategoryId(i),
      systemKey: c.key,
      kind: c.kind,
      color: c.color,
      icon: c.icon,
    }),
  );
}

export function systemCategoryIdByKey(key: string): string | null {
  const index = DEFAULT_CATEGORIES.findIndex((c) => c.key === key);
  return index >= 0 ? systemCategoryId(index) : null;
}
