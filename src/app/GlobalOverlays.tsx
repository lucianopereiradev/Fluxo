import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { QuickEntryDialog } from '@/features/quick-entry/QuickEntryDialog';
import { useUi } from '@/stores/ui';
import { Modal } from '@/ui/Modal';
import { Kbd } from '@/ui/primitives';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Global keyboard shortcuts: N, /, P, ? and Ctrl/Cmd+K. */
function useShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // Single-key shortcuts never fire while a dialog is open.
      if (document.querySelector('dialog[open]')) return;
      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault();
          ui.setQuickEntryOpen(true);
          break;
        case '/':
          e.preventDefault();
          if (!location.pathname.startsWith('/app/transactions')) navigate('/app/transactions');
          setTimeout(ui.requestSearch, 50);
          break;
        case 'p':
        case 'P':
          ui.togglePrivacy();
          break;
        case '?':
          ui.setShortcutsOpen(true);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

function ShortcutsDialog() {
  const { t } = useTranslation();
  const close = () => useUi.getState().setShortcutsOpen(false);
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const rows: [string[], string][] = [
    [['N'], t('shortcuts.newEntry')],
    [['/'], t('shortcuts.search')],
    [['P'], t('shortcuts.privacy')],
    [[mod, 'K'], t('shortcuts.palette')],
    [['?'], t('shortcuts.help')],
    [['Esc'], t('shortcuts.close')],
  ];
  return (
    <Modal open onClose={close} size="sm" title={t('shortcuts.title')}>
      <dl className="divide-border divide-y">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm">
            <dt>{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

export function GlobalOverlays() {
  useShortcuts();
  const quickEntryOpen = useUi((s) => s.quickEntryOpen);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  return (
    <>
      {quickEntryOpen && <QuickEntryDialog />}
      {paletteOpen && <CommandPalette />}
      {shortcutsOpen && <ShortcutsDialog />}
    </>
  );
}
