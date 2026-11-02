import { useTranslation } from 'react-i18next';

/** Encrypted sync setup. Filled in when the sync feature lands. */
export function SyncSection() {
  const { t } = useTranslation();
  return <p className="text-muted text-sm">{t('sync.status.local')}</p>;
}
