import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { makeCategory } from '@/domain/records';
import type { Category, CategoryKind } from '@/domain/types';
import { useCategoryName, useFinance } from '@/features/data/hooks';
import { CATEGORY_ICONS, CategoryIcon } from '@/ui/CategoryIcon';
import { ColorPicker, SWATCHES } from '@/ui/ColorPicker';
import { Field, Input, Segmented, Select } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button, cn, IconButton } from '@/ui/primitives';

export function CategoryManager() {
  const { t } = useTranslation();
  const { categories } = useFinance();
  const name = useCategoryName();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const list = categories.filter((c) => c.kind === kind);
  const roots = list.filter((c) => !c.parentId).sort((a, b) => name(a).localeCompare(name(b)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label={t('settings.categories.kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: t('settings.categories.expense') },
            { value: 'income', label: t('settings.categories.income') },
          ]}
        />
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
          {t('settings.categories.add')}
        </Button>
      </div>
      <ul className="divide-border border-border divide-y rounded-xl border">
        {roots.flatMap((root) => [
          <CategoryRow
            key={root.id}
            category={root}
            label={name(root)}
            onEdit={() => setEditing(root)}
          />,
          ...list
            .filter((c) => c.parentId === root.id)
            .map((child) => (
              <CategoryRow
                key={child.id}
                category={child}
                label={name(child)}
                child
                onEdit={() => setEditing(child)}
              />
            )),
        ])}
      </ul>
      {editing && (
        <CategoryEditor
          category={editing === 'new' ? undefined : editing}
          kind={kind}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CategoryRow({
  category,
  label,
  child = false,
  onEdit,
}: {
  category: Category;
  label: string;
  child?: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className={cn('flex items-center gap-3 px-3 py-2', child && 'pl-10')}>
      <CategoryIcon category={category} className="size-8" />
      <span className="flex-1 text-sm">{label}</span>
      <IconButton
        size="sm"
        label={t('settings.categories.editNamed', { name: label })}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </IconButton>
    </li>
  );
}

function CategoryEditor({
  category,
  kind,
  onClose,
}: {
  category?: Category;
  kind: CategoryKind;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { categories } = useFinance();
  const displayName = useCategoryName();
  const [name, setName] = useState(category ? displayName(category) : '');
  const [icon, setIcon] = useState(category?.icon ?? 'circle');
  const [color, setColor] = useState(category?.color ?? SWATCHES[0]!);
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [error, setError] = useState<string>();
  const effectiveKind = category?.kind ?? kind;
  const parents = categories.filter(
    (c) => c.kind === effectiveKind && !c.parentId && c.id !== category?.id,
  );
  const hasChildren = !!category && categories.some((c) => c.parentId === category.id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t('common.required'));
    // Renaming a built-in category stores the custom name; the translation is no longer used.
    const fields = { name: name.trim(), icon, color, parentId: parentId || null };
    if (category) await update('categories', category.id, fields);
    else await insert('categories', makeCategory({ ...fields, kind: effectiveKind }));
    toast.success(t('settings.categories.saved'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? t('settings.categories.edit') : t('settings.categories.add')}
      footer={
        <>
          {category && (
            <Button
              variant="ghost"
              className="text-negative mr-auto"
              onClick={async () => {
                const children = categories
                  .filter((c) => c.parentId === category.id)
                  .map((c) => c.id);
                await softDelete('categories', [category.id, ...children]);
                toast.success(t('settings.categories.deleted'));
                onClose();
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="category-form">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="category-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('settings.categories.name')} error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        {!hasChildren && (
          <Field label={t('settings.categories.parent')}>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t('settings.categories.noParent')}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t('settings.categories.icon')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(CATEGORY_ICONS).map((key) => (
              <label
                key={key}
                className={cn(
                  'cursor-pointer rounded-xl p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--c-focus)]',
                  icon === key && 'ring-accent ring-2',
                )}
              >
                <input
                  type="radio"
                  name="category-icon"
                  value={key}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                  className="sr-only"
                  aria-label={key}
                />
                <CategoryIcon category={{ icon: key, color }} />
              </label>
            ))}
          </div>
        </fieldset>
        <ColorPicker label={t('common.color')} value={color} onChange={setColor} />
      </form>
    </Modal>
  );
}
