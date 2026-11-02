import { getDb } from '@/db';
import { insert } from '@/db/repo';
import { learnRule } from '@/domain/rules';

/** Remembers "description → category" so future imports and quick entries get it right. */
export async function rememberCategory(description: string, categoryId: string | null) {
  if (!categoryId || !description.trim()) return;
  const rules = await getDb().rules.toArray();
  const rule = learnRule(rules, description, categoryId);
  if (rule) await insert('rules', rule);
}
