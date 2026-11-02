import {
  ArrowLeftRight,
  Eye,
  FlaskConical,
  Keyboard,
  Monitor,
  Moon,
  Plus,
  Search,
  Sun,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NAV_ITEMS } from '@/app/nav';
import { readMode } from '@/db';
import { matchesQuery } from '@/domain/search';
import { enterDemo, leaveDemo } from '@/features/demo/demoMode';
import { useUi } from '@/stores/ui';
import { Modal } from '@/ui/Modal';
import { cn, Kbd } from '@/ui/primitives';

interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
}

/** Ctrl/Cmd+K: jump anywhere or run an action, entirely from the keyboard. */
export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const close = () => ui.setPaletteOpen(false);

  const commands = useMemo<Command[]>(() => {
    const go = t('palette.groups.go');
    const act = t('palette.groups.actions');
    const list: Command[] = [
      {
        id: 'quick',
        label: t('palette.quickEntry'),
        group: act,
        icon: Wand2,
        shortcut: 'N',
        run: () => ui.setQuickEntryOpen(true),
      },
      {
        id: 'new',
        label: t('transactions.new'),
        group: act,
        icon: Plus,
        run: () => ui.openEditor(),
      },
      {
        id: 'transfer',
        label: t('transactions.newTransfer'),
        group: act,
        icon: ArrowLeftRight,
        run: () => ui.openEditor(undefined, 'transfer'),
      },
      {
        id: 'search',
        label: t('palette.searchTransactions'),
        group: act,
        icon: Search,
        shortcut: '/',
        run: () => {
          navigate('/app/transactions');
          setTimeout(ui.requestSearch, 50);
        },
      },
      {
        id: 'privacy',
        label: ui.privacy ? t('privacy.show') : t('privacy.hide'),
        group: act,
        icon: Eye,
        shortcut: 'P',
        run: ui.togglePrivacy,
      },
      {
        id: 'theme-light',
        label: t('palette.theme', { theme: t('theme.light') }),
        group: act,
        icon: Sun,
        run: () => ui.setTheme('light'),
      },
      {
        id: 'theme-dark',
        label: t('palette.theme', { theme: t('theme.dark') }),
        group: act,
        icon: Moon,
        run: () => ui.setTheme('dark'),
      },
      {
        id: 'theme-system',
        label: t('palette.theme', { theme: t('theme.system') }),
        group: act,
        icon: Monitor,
        run: () => ui.setTheme('system'),
      },
      {
        id: 'shortcuts',
        label: t('shortcuts.title'),
        group: act,
        icon: Keyboard,
        shortcut: '?',
        run: () => ui.setShortcutsOpen(true),
      },
      readMode() === 'demo'
        ? {
            id: 'demo',
            label: t('demo.startFresh'),
            group: act,
            icon: FlaskConical,
            run: () => void leaveDemo(),
          }
        : {
            id: 'demo',
            label: t('landing.tryDemo'),
            group: act,
            icon: FlaskConical,
            run: () => void enterDemo(),
          },
      ...NAV_ITEMS.map((n) => ({
        id: `nav-${n.key}`,
        label: t(`nav.${n.key}`),
        group: go,
        icon: n.icon,
        run: () => navigate(n.to),
      })),
    ];
    return list;
  }, [t, ui, navigate]);

  const filtered = commands.filter((c) => matchesQuery(`${c.label} ${c.group}`, query));
  const current = Math.min(active, Math.max(0, filtered.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  return (
    <Modal open onClose={close} title={t('palette.title')} size="md" initialFocusRef={inputRef}>
      <div className="relative">
        <Search
          className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={
            filtered[current] ? `${listId}-${filtered[current].id}` : undefined
          }
          aria-label={t('palette.placeholder')}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(filtered[current]);
            }
          }}
          className="border-border bg-surface focus:border-accent h-12 w-full rounded-xl border pl-9 text-base focus:outline-none"
        />
      </div>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('palette.title')}
        className="mt-3 max-h-80 overflow-y-auto"
      >
        {filtered.length === 0 && (
          <li className="text-muted px-3 py-6 text-center text-sm">{t('palette.empty')}</li>
        )}
        {filtered.map((c, i) => (
          // Keyboard selection happens in the combobox input (arrows + Enter).
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={c.id}
            id={`${listId}-${c.id}`}
            role="option"
            aria-selected={i === current}
            data-index={i}
            onMouseMove={() => setActive(i)}
            onClick={() => run(c)}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
              i === current ? 'bg-accent-soft text-accent-strong' : 'text-text',
            )}
          >
            <c.icon className="text-muted size-4 shrink-0" aria-hidden />
            <span className="flex-1">{c.label}</span>
            <span className="text-faint text-xs">{c.group}</span>
            {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
