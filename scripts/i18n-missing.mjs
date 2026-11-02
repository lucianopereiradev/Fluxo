// Lists translation keys used in src/ that are missing from the English locale.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8'));
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${p}${k}`] : flat(v, `${p}${k}.`),
  );
const keys = new Set(flat(en).map((k) => k.replace(/_(one|other)$/, '')));
const files = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx?$/.test(n) && !n.includes('.test.')
        ? [p]
        : [];
  });
const missing = new Set();
for (const f of files('src'))
  for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g))
    if (!keys.has(m[1])) missing.add(m[1]);
console.log([...missing].sort().join('\n'));
