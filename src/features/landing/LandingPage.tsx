import {
  ArrowRight,
  CalendarRange,
  CloudOff,
  CreditCard,
  FileUp,
  FlaskConical,
  Gauge,
  KeyRound,
  LockKeyhole,
  PieChart,
  ShieldCheck,
  Sparkles,
  UserX,
  Wand2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LANGUAGES, normalizeLanguage } from '@/i18n';
import { Logo } from '@/ui/Logo';
import { Button } from '@/ui/primitives';

const REPO_URL = 'https://github.com/lucianopereiradev/Fluxo';

// The demo loader (and the database) are fetched only when a button is pressed.
const enterDemo = async () => (await import('@/features/demo/demoMode')).enterDemo();
const startFresh = async () => (await import('@/features/demo/demoMode')).startFresh();

const PILLARS = [
  { key: 'local', icon: ShieldCheck },
  { key: 'noAccount', icon: UserX },
  { key: 'offline', icon: CloudOff },
  { key: 'sync', icon: LockKeyhole },
] as const;

const FEATURES = [
  { key: 'cards', icon: CreditCard },
  { key: 'safeToSpend', icon: Gauge },
  { key: 'forecast', icon: CalendarRange },
  { key: 'quickEntry', icon: Wand2 },
  { key: 'import', icon: FileUp },
  { key: 'budgets', icon: PieChart },
] as const;

/** A static, themed miniature of the Overview screen (no screenshot needed). */
function AppPreview() {
  const { t } = useTranslation();
  const bars = [
    { w: 92, c: 'var(--c-chart-1)' },
    { w: 64, c: 'var(--c-chart-3)' },
    { w: 41, c: 'var(--c-chart-2)' },
    { w: 27, c: 'var(--c-chart-4)' },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <div className="bg-accent-soft absolute -inset-6 -z-10 rounded-[2rem] blur-2xl" />
      <div className="border-border bg-surface shadow-soft rotate-[-1.5deg] rounded-2xl border p-5">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">
          {t('landing.preview.safe')}
        </p>
        <p className="tnum font-display mt-2 text-5xl font-medium tracking-tight">
          {t('landing.preview.amount')}
        </p>
        <p className="text-muted mt-1 text-xs">{t('landing.preview.perDay')}</p>
        <svg viewBox="0 0 300 70" className="mt-4 h-16 w-full" preserveAspectRatio="none">
          <path
            d="M0 40 C40 30, 60 20, 90 28 S140 50, 170 36 S230 10, 260 22 S290 30, 300 26"
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2.5"
          />
          <path
            d="M0 40 C40 30, 60 20, 90 28 S140 50, 170 36 S230 10, 260 22 S290 30, 300 26 L300 70 L0 70 Z"
            fill="var(--c-accent)"
            opacity=".12"
          />
        </svg>
        <div className="mt-4 space-y-2.5">
          {bars.map((b, i) => (
            <div key={i} className="bg-surface-3 h-2 overflow-hidden rounded-full">
              <div className="h-full rounded-full" style={{ width: `${b.w}%`, background: b.c }} />
            </div>
          ))}
        </div>
      </div>
      <div className="border-border bg-surface shadow-soft absolute -right-2 -bottom-6 rotate-[2deg] rounded-xl border px-4 py-3 text-sm sm:-right-8">
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="text-accent size-4" />
          {t('landing.preview.quick')}
        </p>
        <p className="text-muted mt-0.5 font-mono text-xs">{t('landing.preview.quickExample')}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-8">
        <Link to="/" aria-label={t('nav.home')}>
          <Logo />
        </Link>
        <nav aria-label={t('landing.nav')} className="flex items-center gap-1 text-sm sm:gap-3">
          <Link to="/privacy" className="text-muted hover:text-text rounded-lg px-2 py-1.5">
            {t('landing.privacyLink')}
          </Link>
          <a
            href={REPO_URL}
            className="text-muted hover:text-text hidden rounded-lg px-2 py-1.5 sm:inline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('landing.github')}
          </a>
          <label className="sr-only" htmlFor="landing-lang">
            {t('settings.language')}
          </label>
          <select
            id="landing-lang"
            value={normalizeLanguage(i18n.resolvedLanguage)}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
            className="border-border bg-surface rounded-lg border px-2 py-1.5 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code === 'en' ? 'EN' : 'PT'}
              </option>
            ))}
          </select>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-8 pb-20 md:grid-cols-[1.1fr_1fr] md:px-8 md:pt-16">
          <div className="animate-rise">
            <p className="border-border bg-surface text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <KeyRound className="text-accent size-3.5" aria-hidden />
              {t('landing.eyebrow')}
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
              {t('landing.title')}
            </h1>
            <p className="text-muted mt-5 max-w-xl text-lg">{t('landing.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                icon={<FlaskConical className="size-5" />}
                onClick={() => void enterDemo()}
              >
                {t('landing.tryDemo')}
              </Button>
              <Button size="lg" onClick={() => void startFresh()}>
                {t('landing.startFresh')}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="text-faint mt-4 text-sm">{t('landing.trust')}</p>
          </div>
          <AppPreview />
        </section>

        <section aria-labelledby="pillars-title" className="border-border bg-surface/60 border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <h2
              id="pillars-title"
              className="font-display max-w-2xl text-3xl font-medium tracking-tight md:text-4xl"
            >
              {t('landing.pillarsTitle')}
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map(({ key, icon: Icon }) => (
                <li key={key}>
                  <span className="bg-accent-soft text-accent-strong grid size-11 place-items-center rounded-xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-medium">{t(`landing.pillars.${key}.title`)}</h3>
                  <p className="text-muted mt-1.5 text-sm leading-relaxed">
                    {t(`landing.pillars.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <h2
            id="features-title"
            className="font-display text-3xl font-medium tracking-tight md:text-4xl"
          >
            {t('landing.featuresTitle')}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="border-border bg-surface shadow-soft rounded-2xl border p-5">
                <Icon className="text-accent size-5" aria-hidden />
                <h3 className="mt-3 font-medium">{t(`landing.features.${key}.title`)}</h3>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">
                  {t(`landing.features.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sync-title" className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
          <div className="border-border bg-surface rounded-3xl border p-6 md:p-10">
            <h2
              id="sync-title"
              className="font-display text-2xl font-medium tracking-tight md:text-3xl"
            >
              {t('landing.syncTitle')}
            </h2>
            <p className="text-muted mt-2 max-w-2xl">{t('landing.syncBody')}</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {(['device', 'cipher', 'server'] as const).map((step, i) => (
                <li key={step} className="bg-surface-2 relative rounded-2xl p-5">
                  <span className="font-display text-accent text-3xl font-medium">{i + 1}</span>
                  <h3 className="mt-2 font-medium">{t(`landing.syncSteps.${step}.title`)}</h3>
                  <p className="text-muted mt-1 text-sm">{t(`landing.syncSteps.${step}.body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-24 text-center md:px-8">
          <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-muted mt-3">{t('landing.ctaBody')}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="lg" onClick={() => void enterDemo()}>
              {t('landing.tryDemo')}
            </Button>
            <Button size="lg" onClick={() => void startFresh()}>
              {t('landing.startFresh')}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="text-muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm md:px-8">
          <span>{t('landing.footer')}</span>
          <nav aria-label={t('landing.footerNav')} className="flex gap-4">
            <Link to="/privacy" className="hover:text-text">
              {t('landing.privacyLink')}
            </Link>
            <a
              href={REPO_URL}
              className="hover:text-text"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('landing.github')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
