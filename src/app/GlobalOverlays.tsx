import { useEffect } from 'react';
import { useUi } from '@/stores/ui';

/** App-wide overlays (quick entry, command palette, shortcuts). */
export function GlobalOverlays() {
  const quickEntryOpen = useUi((s) => s.quickEntryOpen);
  const setQuickEntryOpen = useUi((s) => s.setQuickEntryOpen);
  const openEditor = useUi((s) => s.openEditor);

  useEffect(() => {
    if (!quickEntryOpen) return;
    setQuickEntryOpen(false);
    openEditor();
  }, [quickEntryOpen, setQuickEntryOpen, openEditor]);

  return null;
}
