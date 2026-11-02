import { HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/ui/primitives';

/** Shows where the data lives and, once sync is enabled, its status. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn('text-muted inline-flex items-center gap-1.5 text-xs', compact && 'sr-only')}
      title={t('sync.status.local')}
    >
      <HardDrive className="size-3.5" aria-hidden />
      {t('sync.status.localShort')}
    </span>
  );
}
