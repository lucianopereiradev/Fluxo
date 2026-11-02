import { Eye, EyeOff, Menu, Monitor, Moon, Plus, Search, Sun } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DemoBanner } from '@/features/demo/DemoBanner';
import { SyncIndicator } from '@/features/sync/SyncIndicator';
import { TransactionEditor } from '@/features/transactions/TransactionEditor';
import { useUi } from '@/stores/ui';
import { Logo, LogoMark } from '@/ui/Logo';
import { Modal } from '@/ui/Modal';
import { Button, cn, IconButton, Kbd, Skeleton } from '@/ui/primitives';
import { GlobalOverlays } from './GlobalOverlays';
import { NAV_ITEMS } from './nav';

function ThemeIcon() {
  const theme = useUi((s) => s.theme);
  if (theme === 'light') return <Sun className="size-[18px]" />;
  if (theme === 'dark') return <Moon className="size-[18px]" />;
  return <Monitor className="size-[18px]" />;
}

function QuickActions({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { privacy, togglePrivacy, cycleTheme, theme, setPaletteOpen } = useUi();
  return (
    <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
      <IconButton label={t('palette.open')} onClick={() => setPaletteOpen(true)}>
        <Search className="size-[18px]" />
      </IconButton>
      <IconButton
        label={privacy ? t('privacy.show') : t('privacy.hide')}
        aria-pressed={privacy}
        onClick={togglePrivacy}
      >
        {privacy ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </IconButton>
      <IconButton label={t('theme.toggle', { theme: t(`theme.${theme}`) })} onClick={cycleTheme}>
        <ThemeIcon />
      </IconButton>
    </div>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const openQuickEntry = useUi((s) => s.setQuickEntryOpen);
  return (
    <aside className="border-border bg-surface/60 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-4 py-5 md:flex">
      <Link to="/app" className="mb-6 px-2" aria-label={t('nav.home')}>
        <Logo />
      </Link>
      <Button
        variant="primary"
        className="mb-5 w-full justify-between"
        onClick={() => openQuickEntry(true)}
        icon={<Plus className="size-4" />}
      >
        <span className="flex-1 text-left">{t('quickEntry.button')}</span>
        <Kbd>{'N'}</Kbd>
      </Button>
      <nav aria-label={t('nav.main')} className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-soft text-accent-strong'
                  : 'text-muted hover:bg-surface-2 hover:text-text',
              )
            }
          >
            <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
      <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
        <SyncIndicator />
        <QuickActions compact />
      </div>
    </aside>
  );
}

function MobileHeader({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="border-border bg-bg/85 sticky top-0 z-20 flex items-center justify-between border-b px-3 py-2 backdrop-blur md:hidden">
      <Link to="/app" aria-label={t('nav.home')} className="flex items-center gap-2 px-1">
        <LogoMark className="size-7" />
        <SyncIndicator compact />
      </Link>
      <div className="flex items-center">
        <QuickActions compact />
        <IconButton label={t('nav.more')} onClick={onMore}>
          <Menu className="size-[18px]" />
        </IconButton>
      </div>
    </header>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation();
  const openQuickEntry = useUi((s) => s.setQuickEntryOpen);
  const primary = NAV_ITEMS.filter((n) => n.primary);
  const location = useLocation();
  const moreActive = !primary.some((n) =>
    n.to === '/app' ? location.pathname === '/app' : location.pathname.startsWith(n.to),
  );
  const item = (to: string, key: string, Icon: (typeof NAV_ITEMS)[number]['icon']) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
          isActive ? 'text-accent' : 'text-muted',
        )
      }
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
      {t(`nav.${key}`)}
    </NavLink>
  );
  return (
    <nav
      aria-label={t('nav.main')}
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {item(primary[0]!.to, primary[0]!.key, primary[0]!.icon)}
      {item(primary[1]!.to, primary[1]!.key, primary[1]!.icon)}
      <div className="flex flex-1 items-start justify-center">
        <button
          type="button"
          onClick={() => openQuickEntry(true)}
          aria-label={t('quickEntry.button')}
          className="bg-accent text-on-accent shadow-soft ring-bg -mt-5 grid size-14 place-items-center rounded-2xl ring-4 transition-transform active:scale-95"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {item(primary[2]!.to, primary[2]!.key, primary[2]!.icon)}
      <button
        type="button"
        onClick={onMore}
        className={cn(
          'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
          moreActive ? 'text-accent' : 'text-muted',
        )}
      >
        <Menu className="size-5" strokeWidth={1.8} aria-hidden />
        {t('nav.more')}
      </button>
    </nav>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t('nav.more')} size="sm">
      <nav aria-label={t('nav.more')} className="grid grid-cols-3 gap-2">
        {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium',
                isActive
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-border text-muted',
              )
            }
          >
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
    </Modal>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const editor = useUi((s) => s.editor);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-accent text-on-accent sr-only z-50 rounded-lg px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('nav.skip')}
      </a>
      <DemoBanner />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader onMore={() => setMoreOpen(true)} />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 focus:outline-none md:px-8 md:pt-10 md:pb-12"
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      {editor && <TransactionEditor key={editor.id} />}
      <GlobalOverlays />
    </div>
  );
}
