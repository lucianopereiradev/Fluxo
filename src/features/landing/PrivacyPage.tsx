import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Logo } from '@/ui/Logo';

export default function PrivacyPage() {
  const { t } = useTranslation();
  const sections = ['local', 'noAccount', 'sync', 'server', 'analytics', 'control'] as const;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Link to="/" aria-label={t('nav.home')}>
          <Logo />
        </Link>
        <Link to="/app" className="text-accent text-sm hover:underline">
          {t('landing.openApp')}
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 focus:outline-none">
        <h1 className="font-display text-4xl font-medium tracking-tight md:text-5xl">
          {t('privacyPage.title')}
        </h1>
        <p className="text-muted mt-4 text-lg">{t('privacyPage.lead')}</p>
        <div className="mt-10 space-y-8">
          {sections.map((key) => (
            <section key={key}>
              <h2 className="font-display text-xl font-medium">{t(`privacyPage.${key}.title`)}</h2>
              <p className="text-muted mt-2 leading-relaxed">{t(`privacyPage.${key}.body`)}</p>
            </section>
          ))}
        </div>
        <p className="text-faint mt-12 text-sm">{t('privacyPage.updated')}</p>
      </main>
    </div>
  );
}
