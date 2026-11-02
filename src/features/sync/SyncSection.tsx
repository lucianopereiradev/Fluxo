import {
  Copy,
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { readMode } from '@/db';
import { useFormat } from '@/features/data/hooks';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field, Input, Switch } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Badge, Button, cn } from '@/ui/primitives';
import { loadEngine, useSync } from './store';

type Strength = { score: 0 | 1 | 2 | 3 | 4; acceptable: boolean };

/** Strength comes from the lazily loaded crypto module; null until it arrives. */
function useStrength(passphrase: string): Strength | null {
  const [strength, setStrength] = useState<Strength | null>(null);
  useEffect(() => {
    let alive = true;
    void import('./crypto').then((m) => alive && setStrength(m.passphraseStrength(passphrase)));
    return () => {
      alive = false;
    };
  }, [passphrase]);
  return strength;
}

function StrengthMeter({ passphrase }: { passphrase: string }) {
  const { t } = useTranslation();
  const strength = useStrength(passphrase);
  const score = passphrase ? (strength?.score ?? 0) : 0;
  const tone = score <= 1 ? 'bg-negative' : score === 2 ? 'bg-warning' : 'bg-positive';
  return (
    <div aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full', i < score ? tone : 'bg-surface-3')}
          />
        ))}
      </div>
      <p className="text-muted mt-1 text-xs">
        {passphrase ? t(`sync.strength.${score}`) : t('sync.strength.hint')}
      </p>
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const strength = useStrength(passphrase);
  const canSubmit = !!strength?.acceptable && passphrase === confirm && understood && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(undefined);
    try {
      await (await loadEngine()).createVault(passphrase, remember);
      toast.success(t('sync.created'));
      onClose();
    } catch {
      setError(t('sync.errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('sync.createTitle')}
      description={t('sync.createBody')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="create-vault" disabled={!canSubmit}>
            {busy ? t('sync.deriving') : t('sync.create')}
          </Button>
        </>
      }
    >
      <form id="create-vault" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('sync.passphrase')} error={error}>
          <Input
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </Field>
        <StrengthMeter passphrase={passphrase} />
        <Field
          label={t('sync.confirmPassphrase')}
          error={confirm && confirm !== passphrase ? t('sync.mismatch') : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Switch
          checked={remember}
          onChange={setRemember}
          label={t('sync.remember')}
          description={t('sync.rememberHint')}
        />
        <div className="border-warning/40 bg-warning-soft text-warning rounded-xl border p-3 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('sync.lossWarning')}
          </p>
          <label className="text-text mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--c-accent)]"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            {t('sync.understood')}
          </label>
        </div>
      </form>
    </Modal>
  );
}

function JoinDialog({
  initial,
  onClose,
}: {
  initial?: { vaultId: string; salt?: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [link, setLink] = useState(initial?.vaultId ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const engine = await loadEngine();
    const target = initial?.salt && link === initial.vaultId ? initial : engine.parsePairing(link);
    if (!target) return setError(t('sync.errors.invalid_link'));
    setBusy(true);
    setError(undefined);
    try {
      await engine.joinVault(target.vaultId, passphrase, remember, target.salt);
      toast.success(t('sync.joined'));
      onClose();
    } catch (err) {
      setError(t(`sync.errors.${err instanceof engine.JoinError ? err.message : 'network'}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('sync.joinTitle')}
      description={t('sync.joinBody')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form="join-vault"
            disabled={busy || !passphrase || !link}
          >
            {busy ? t('sync.deriving') : t('sync.join')}
          </Button>
        </>
      }
    >
      <form id="join-vault" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('sync.vaultLink')} hint={t('sync.vaultLinkHint')}>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label={t('sync.passphrase')} error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </Field>
        <Switch
          checked={remember}
          onChange={setRemember}
          label={t('sync.remember')}
          description={t('sync.rememberHint')}
        />
        <p className="text-muted text-xs">{t('sync.joinMergeNote')}</p>
      </form>
    </Modal>
  );
}

function PairingCard({ vaultId, salt }: { vaultId: string; salt: string }) {
  const { t } = useTranslation();
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => {
    void (async () => {
      const engine = await loadEngine();
      const url = engine.pairingLink(vaultId, salt);
      setLink(url);
      const QRCode = await import('qrcode');
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' }));
    })();
  }, [vaultId, salt]);
  return (
    <div className="border-border grid gap-4 rounded-xl border p-4 sm:grid-cols-[auto_1fr]">
      {qr ? (
        <img
          src={qr}
          alt={t('sync.qrAlt')}
          width={160}
          height={160}
          className="rounded-lg bg-white p-1"
        />
      ) : (
        <div className="bg-surface-2 size-40 animate-pulse rounded-lg" aria-hidden />
      )}
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-medium">
          <Link2 className="size-4" aria-hidden />
          {t('sync.pairTitle')}
        </h3>
        <p className="text-muted mt-1 text-sm">{t('sync.pairBody')}</p>
        <div className="mt-3 flex gap-2">
          <Input
            readOnly
            value={link}
            aria-label={t('sync.vaultLink')}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            icon={<Copy className="size-4" />}
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast.success(t('sync.copied'));
            }}
          >
            {t('sync.copy')}
          </Button>
        </div>
        <p className="text-faint mt-2 text-xs">{t('sync.pairPrivacy')}</p>
      </div>
    </div>
  );
}

function UnlockForm({ onDisconnect }: { onDisconnect: () => void }) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        const engine = await loadEngine();
        try {
          await engine.unlock(passphrase);
          setPassphrase('');
        } catch (err) {
          setError(t(`sync.errors.${err instanceof engine.JoinError ? err.message : 'network'}`));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-muted text-sm">{t('sync.lockedBody')}</p>
      <Field label={t('sync.passphrase')} error={error}>
        <Input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy || !passphrase}>
          {busy ? t('sync.deriving') : t('sync.unlock')}
        </Button>
        <Button variant="ghost" onClick={onDisconnect}>
          {t('sync.disconnect')}
        </Button>
      </div>
    </form>
  );
}

/** Settings → Sync: create or join an end-to-end encrypted vault. */
export function SyncSection() {
  const { t } = useTranslation();
  const { date } = useFormat();
  const { phase, vaultId, salt, lastSyncedAt, error } = useSync();
  const [dialog, setDialog] = useState<null | 'create' | 'join'>(null);
  const [pairing, setPairing] = useState<{ vaultId: string; salt?: string }>();
  const [confirm, setConfirm] = useState<null | 'disconnect' | 'delete'>(null);
  const demo = readMode() === 'demo';

  // A pairing link (#pair&v=…&s=…) opens the join dialog prefilled, then leaves the URL.
  useEffect(() => {
    if (!location.hash.startsWith('#pair')) return;
    void loadEngine().then((engine) => {
      const parsed = engine.parsePairing(location.href);
      history.replaceState(null, '', `${location.pathname}#sync`);
      if (parsed) {
        setPairing(parsed);
        setDialog('join');
      }
    });
  }, []);

  if (demo) return <p className="text-muted text-sm">{t('sync.demoDisabled')}</p>;

  const confirmDialogs = (
    <>
      <ConfirmDialog
        open={confirm === 'disconnect'}
        title={t('sync.disconnectTitle')}
        body={t('sync.disconnectBody')}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await (await loadEngine()).disconnect();
          toast.success(t('sync.disconnected'));
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title={t('sync.deleteTitle')}
        body={t('sync.deleteBody')}
        confirmLabel={t('sync.deleteRemote')}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          try {
            await (await loadEngine()).deleteRemoteVault();
            toast.success(t('sync.deleted'));
          } catch {
            toast.error(t('sync.errors.network'));
          }
        }}
      />
    </>
  );

  if (phase === 'off') {
    return (
      <div className="grid gap-4">
        <ul className="text-muted grid gap-2 text-sm">
          <li className="flex gap-2">
            <ShieldCheck className="text-positive mt-0.5 size-4 shrink-0" aria-hidden />
            {t('sync.point1')}
          </li>
          <li className="flex gap-2">
            <KeyRound className="text-positive mt-0.5 size-4 shrink-0" aria-hidden />
            {t('sync.point2')}
          </li>
          <li className="flex gap-2">
            <LockKeyhole className="text-positive mt-0.5 size-4 shrink-0" aria-hidden />
            {t('sync.point3')}
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog('create')}>
            {t('sync.create')}
          </Button>
          <Button onClick={() => setDialog('join')}>{t('sync.join')}</Button>
        </div>
        {dialog === 'create' && <CreateDialog onClose={() => setDialog(null)} />}
        {dialog === 'join' && <JoinDialog initial={pairing} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  if (phase === 'locked') {
    return (
      <>
        <UnlockForm onDisconnect={() => setConfirm('disconnect')} />
        {confirmDialogs}
      </>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={phase === 'error' ? 'negative' : phase === 'offline' ? 'warning' : 'positive'}>
          {t(`sync.status.${phase}`)}
        </Badge>
        {lastSyncedAt && (
          <span className="text-muted text-sm">
            {t('sync.lastSynced', {
              when: `${date(lastSyncedAt.slice(0, 10), { day: '2-digit', month: 'short' })} ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            })}
          </span>
        )}
        <Button
          size="sm"
          icon={<RefreshCw className={cn('size-3.5', phase === 'syncing' && 'animate-spin')} />}
          disabled={phase === 'syncing'}
          onClick={async () => (await loadEngine()).syncNow()}
        >
          {t('sync.syncNow')}
        </Button>
      </div>
      {error && phase === 'error' && (
        <p className="text-negative text-sm">{t(`sync.errors.${error}`)}</p>
      )}
      {vaultId && salt && <PairingCard vaultId={vaultId} salt={salt} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setConfirm('disconnect')}>
          {t('sync.disconnect')}
        </Button>
        <Button variant="ghost" className="text-negative" onClick={() => setConfirm('delete')}>
          {t('sync.deleteRemote')}
        </Button>
      </div>
      {confirmDialogs}
    </div>
  );
}
