import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

interface PersistedUi {
  theme: ThemePreference;
  privacy: boolean;
}

interface UiState extends PersistedUi {
  quickEntryOpen: boolean;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** Incremented to ask the current page to focus its search box. */
  searchRequest: number;
  /** Transaction editor: null = closed, 'new' = blank form, otherwise the id being edited. */
  editor: { id: string | 'new'; type?: 'income' | 'expense' | 'transfer' } | null;
  openEditor: (id?: string, type?: 'income' | 'expense' | 'transfer') => void;
  closeEditor: () => void;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
  togglePrivacy: () => void;
  setQuickEntryOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  requestSearch: () => void;
}

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

/** UI-only state. Financial data never lives here; it lives in IndexedDB. */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      privacy: false,
      quickEntryOpen: false,
      paletteOpen: false,
      shortcutsOpen: false,
      searchRequest: 0,
      editor: null,
      openEditor: (id, type) => set({ editor: { id: id ?? 'new', type } }),
      closeEditor: () => set({ editor: null }),
      setTheme: (theme) => set({ theme }),
      cycleTheme: () =>
        set((s) => ({
          theme: THEME_ORDER[(THEME_ORDER.indexOf(s.theme) + 1) % THEME_ORDER.length]!,
        })),
      togglePrivacy: () => set((s) => ({ privacy: !s.privacy })),
      setQuickEntryOpen: (quickEntryOpen) => set({ quickEntryOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      requestSearch: () => set((s) => ({ searchRequest: s.searchRequest + 1 })),
    }),
    {
      name: 'fluxo:ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedUi => ({ theme: s.theme, privacy: s.privacy }),
    },
  ),
);

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
