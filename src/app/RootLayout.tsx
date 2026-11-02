import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { resolveTheme, useUi } from '@/stores/ui';
import { UpdatePrompt } from './UpdatePrompt';

/** Keeps <html> in sync with theme and privacy preferences. */
function useDocumentPreferences() {
  const theme = useUi((s) => s.theme);
  const privacy = useUi((s) => s.privacy);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    if (theme !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('privacy-on', privacy);
  }, [privacy]);
}

/** Moves focus to the main region on navigation so screen readers announce the new page. */
function useRouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.getElementById('main');
    if (main && document.activeElement === document.body) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);
}

export function RootLayout() {
  const { t } = useTranslation();
  const theme = useUi((s) => s.theme);
  useDocumentPreferences();
  useRouteFocus();
  return (
    <>
      <Suspense fallback={<div className="min-h-dvh" aria-busy aria-label={t('common.loading')} />}>
        <Outlet />
      </Suspense>
      <UpdatePrompt />
      <Toaster
        theme={theme}
        position="bottom-center"
        offset={{ bottom: 88 }}
        mobileOffset={{ bottom: 88 }}
        toastOptions={{
          classNames: {
            toast: '!rounded-xl !border-border !bg-surface !text-text !shadow-soft !font-sans',
          },
        }}
      />
    </>
  );
}
