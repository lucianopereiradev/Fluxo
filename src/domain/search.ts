/** Lowercases and strips accents so "Almoço" matches "almoco". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every whitespace-separated term of the query must appear in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const text = normalizeText(haystack);
  return terms.every((term) => text.includes(term));
}
