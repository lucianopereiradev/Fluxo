import { CloudCheck, CloudOff, HardDrive, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { getDb, readMode } from '@/db';
import { cn } from '@/ui/primitives';
import { loadEngine, useSync, type SyncPhase } from './store';

const ICONS: Record<SyncPhase, typeof HardDrive> = {
  off: HardDrive,
  locked: Lock,
  idle: CloudCheck,
  syncing: RefreshCw,
  synced: CloudCheck,
  offline: CloudOff,
  error: TriangleAlert,
};

/** Starts the sync engine once per app load, and only on devices that joined a vault. */
export function useSyncBootstrap() {
  useEffect(() => {
    if (readMode() === 'demo') return;
    void getDb()
      .syncState.get('vault')
      .then(async (state) => {
        if (state) await (await loadEngine()).startSync();
      });
  }, []);
}

/** Where the data lives and, when sync is on, its status. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const phase = useSync((s) => s.phase);
  const Icon = ICONS[phase];
  const label = t(`sync.status.${phase}`);
  return (
    <Link
      to="/app/settings#sync"
      title={label}
      aria-label={label}
      className={cn(
        'text-muted hover:bg-surface-2 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs',
        phase === 'error' && 'text-negative',
        phase === 'locked' && 'text-warning',
      )}
    >
      <Icon className={cn('size-3.5', phase === 'syncing' && 'animate-spin')} aria-hidden />
      {!compact && <span>{t(`sync.statusShort.${phase}`)}</span>}
    </Link>
  );
}
