import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '@/ui/EmptyState';
import { Logo } from '@/ui/Logo';
import { buttonClasses } from '@/ui/primitives';

export function NotFoundPage({ inApp = false }: { inApp?: boolean }) {
  const { t } = useTranslation();
  const content = (
    <EmptyState
      art="search"
      title={t('notFound.title')}
      description={t('notFound.body')}
      action={
        <Link to={inApp ? '/app' : '/'} className={buttonClasses('primary')}>
          {inApp ? t('notFound.backToApp') : t('notFound.backHome')}
        </Link>
      }
    />
  );
  if (inApp) return content;
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Link to="/" aria-label={t('nav.home')}>
          <Logo />
        </Link>
        <p className="font-display text-faint mt-8 text-7xl font-medium" aria-hidden>
          {'404'}
        </p>
        {content}
      </div>
    </main>
  );
}
