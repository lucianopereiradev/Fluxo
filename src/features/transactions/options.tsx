import { useTranslation } from 'react-i18next';
import type { CategoryKind } from '@/domain/types';
import { useCategoryName, useFinance } from '@/features/data/hooks';

/** <option>s for accounts (and optionally cards), grouped. */
export function SourceOptions({
  cards = true,
  accounts = true,
}: {
  cards?: boolean;
  accounts?: boolean;
}) {
  const { t } = useTranslation();
  const data = useFinance();
  return (
    <>
      {accounts && data.accounts.length > 0 && (
        <optgroup label={t('nav.accounts')}>
          {data.accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <option key={a.id} value={`account:${a.id}`}>
                {a.name}
              </option>
            ))}
        </optgroup>
      )}
      {cards && data.cards.length > 0 && (
        <optgroup label={t('nav.cards')}>
          {data.cards
            .filter((c) => !c.archived)
            .map((c) => (
              <option key={c.id} value={`card:${c.id}`}>
                {c.name}
              </option>
            ))}
        </optgroup>
      )}
    </>
  );
}

/** <option>s for categories of a kind, children indented under their parent. */
export function CategoryOptions({ kind }: { kind?: CategoryKind }) {
  const { categories } = useFinance();
  const name = useCategoryName();
  const list = categories.filter((c) => !kind || c.kind === kind);
  const roots = list.filter((c) => !c.parentId).sort((a, b) => name(a).localeCompare(name(b)));
  return (
    <>
      {roots.map((root) => (
        <CategoryBranch key={root.id} id={root.id} depth={0} list={list} name={name} />
      ))}
    </>
  );
}

function CategoryBranch({
  id,
  depth,
  list,
  name,
}: {
  id: string;
  depth: number;
  list: ReturnType<typeof useFinance>['categories'];
  name: ReturnType<typeof useCategoryName>;
}) {
  const cat = list.find((c) => c.id === id)!;
  const children = list.filter((c) => c.parentId === id);
  return (
    <>
      <option value={cat.id}>{`${'  '.repeat(depth)}${name(cat)}`}</option>
      {depth < 3 &&
        children.map((c) => (
          <CategoryBranch key={c.id} id={c.id} depth={depth + 1} list={list} name={name} />
        ))}
    </>
  );
}
