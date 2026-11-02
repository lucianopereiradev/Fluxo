import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );
}

const stripPlural = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('translations', () => {
  const enKeys = new Set(flatten(en as Tree).map(stripPlural));
  const ptKeys = new Set(flatten(ptBR as Tree).map(stripPlural));

  it('have the same keys in English and Portuguese', () => {
    expect([...enKeys].filter((k) => !ptKeys.has(k))).toEqual([]);
    expect([...ptKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('cover every static key used in the source', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((k) => !enKeys.has(k)).sort()).toEqual([]);
  });

  it('have no empty strings', () => {
    const empty = (tree: Tree): string[] =>
      flatten(tree).filter((k) => {
        const value = k.split('.').reduce<unknown>((o, p) => (o as Tree)[p], tree);
        return typeof value === 'string' && value.trim() === '';
      });
    expect(empty(en as Tree)).toEqual([]);
    expect(empty(ptBR as Tree)).toEqual([]);
  });
});
