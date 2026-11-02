import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { enterDemo, startFresh } from '@/features/demo/demoMode';
import { Logo } from '@/ui/Logo';
import { Button } from '@/ui/primitives';

export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4">
      <Link to="/" aria-label={t('nav.home')}>
        <Logo />
      </Link>
      <h1 className="font-display mt-10 text-5xl font-medium tracking-tight">
        {t('landing.title')}
      </h1>
      <p className="text-muted mt-4 text-lg">{t('landing.subtitle')}</p>
      <div className="mt-8 flex gap-3">
        <Button variant="primary" size="lg" onClick={() => void enterDemo()}>
          {t('landing.tryDemo')}
        </Button>
        <Button size="lg" onClick={() => void startFresh()}>
          {t('landing.startFresh')}
        </Button>
      </div>
    </main>
  );
}
