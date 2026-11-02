import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { readMode } from '@/db';
import { Button } from '@/ui/primitives';
import { leaveDemo } from './demoMode';

/** Fixed strip shown while browsing the demo database. */
export function DemoBanner() {
  const { t } = useTranslation();
  if (readMode() !== 'demo') return null;
  return (
    <div
      role="status"
      className="border-warning/30 bg-warning-soft text-warning flex flex-wrap items-center justify-center gap-3 border-b px-4 py-2 text-sm"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span className="font-medium">{t('demo.banner')}</span>
      <span className="text-warning/80 hidden sm:inline">{t('demo.bannerHint')}</span>
      <Button size="sm" variant="secondary" onClick={() => void leaveDemo()}>
        {t('demo.startFresh')}
      </Button>
    </div>
  );
}
