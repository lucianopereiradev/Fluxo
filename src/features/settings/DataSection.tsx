import { Download, FileJson, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getDb } from '@/db';
import { createBackup, parseBackup, type Backup } from '@/db/backup';
import { clearAll, readSnapshot, replaceSnapshot } from '@/db/repo';
import { bootstrap } from '@/features/data/bootstrap';
import { useFinance } from '@/features/data/hooks';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field, Input } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/primitives';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataSection() {
  const { t } = useTranslation();
  const { today } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const exportJson = async () => {
    const backup = createBackup(await readSnapshot());
    download(`fluxo-backup-${today}.json`, JSON.stringify(backup, null, 2), 'application/json');
    toast.success(t('settings.data.exported'));
  };

  const onFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error(t('settings.data.errors.tooLarge'));
    const result = parseBackup(await file.text());
    if (!result.ok) return toast.error(t(`settings.data.errors.${result.error}`));
    setPending(result.backup);
  };

  const wipeWord = t('settings.data.wipeWord');

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button icon={<FileJson className="size-4" />} onClick={() => void exportJson()}>
          {t('settings.data.export')}
        </Button>
        <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
          {t('settings.data.import')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </div>
      <p className="text-muted text-xs">
        <Download className="mr-1 inline size-3" aria-hidden />
        {t('settings.data.csvHint')}
      </p>
      <div className="border-negative/30 bg-negative-soft/40 mt-2 rounded-xl border p-4">
        <h3 className="text-negative text-sm font-medium">{t('settings.data.dangerZone')}</h3>
        <p className="text-muted mt-1 text-xs">{t('settings.data.wipeBody')}</p>
        <Button
          className="mt-3"
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-4" />}
          onClick={() => setWipeOpen(true)}
        >
          {t('settings.data.wipe')}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t('settings.data.restoreTitle')}
        body={t('settings.data.restoreBody', { count: pending?.data.transactions.length ?? 0 })}
        confirmLabel={t('settings.data.restore')}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await replaceSnapshot(pending.data);
          setPending(null);
          toast.success(t('settings.data.restored'));
        }}
      />

      <Modal
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        size="sm"
        title={t('settings.data.wipeTitle')}
        footer={
          <>
            <Button onClick={() => setWipeOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toUpperCase() !== wipeWord.toUpperCase()}
              onClick={async () => {
                await clearAll(getDb());
                await bootstrap();
                setWipeOpen(false);
                setConfirmText('');
                toast.success(t('settings.data.wiped'));
              }}
            >
              {t('settings.data.wipe')}
            </Button>
          </>
        }
      >
        <p className="text-muted mb-4 text-sm">{t('settings.data.wipeConfirm')}</p>
        <Field label={t('settings.data.typeToConfirm', { word: wipeWord })}>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </Modal>
    </div>
  );
}
