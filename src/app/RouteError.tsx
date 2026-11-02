import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router';
import { EmptyState } from '@/ui/EmptyState';
import { Button, buttonClasses } from '@/ui/primitives';

/** Shown instead of a blank page when a screen throws. The data in IndexedDB is untouched. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        art="search"
        title={t('routeError.title')}
        description={t('routeError.body')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => location.reload()}>
              {t('routeError.reload')}
            </Button>
            <Link to="/app" className={buttonClasses('secondary')}>
              {t('notFound.backToApp')}
            </Link>
          </div>
        }
      />
    </main>
  );
}
